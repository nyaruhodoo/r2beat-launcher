<template>
  <el-splitter>
    <el-splitter-panel size="60%">
      <div class="item-table-wrap">
        <div class="item-table-toolbar">
          <div class="item-table-toolbar-sync">
            <el-button type="primary" :disabled="!canFetch" @click="syncData"> 数据同步 </el-button>
            <span class="item-table-last-sync">
              {{ lastSyncDisplay }}
              <span v-if="shouldSuggestSync" class="item-table-sync-suggest-text"
                >，建议同步（启用账号有变更）</span
              >
            </span>

            <el-button :disabled="displayData.length === 0" @click="exportGroupedSummaryTxt">
              导出
            </el-button>
          </div>
          <div class="item-table-filters">
            <el-autocomplete
              v-model="keyword"
              class="item-table-filter"
              clearable
              :trigger-on-focus="true"
              :fetch-suggestions="querySearchItemName"
              placeholder="按道具名称筛选（支持拼音全拼/首字母）"
              @select="onKeywordSelect"
            />
            <el-select
              v-model="selectedKeywordGroups"
              class="item-table-filter-select"
              multiple
              collapse-tags
              collapse-tags-tooltip
              clearable
              placeholder="按分类筛选"
            >
              <el-option
                v-for="group in keywordGroupOptions"
                :key="group.value"
                :label="group.label"
                :value="group.value"
              />
            </el-select>
          </div>
        </div>
        <el-table
          ref="tableRef"
          v-loading="loading"
          :data="displayData"
          stripe
          border
          class="item-table"
          empty-text="暂无数据，请点击「数据同步」拉取"
          row-key="code"
          :default-sort="{ prop: 'latestCreatedAt', order: 'descending' }"
          @sort-change="onSortChange"
          @selection-change="selectedRows = $event"
        >
          <el-table-column type="selection" align="center" width="50" :reserve-selection="false" />
          <el-table-column type="expand">
            <template #default="{ row }">
              <ExpandedGiftTable :items="row.list" :accounts="props.accounts" />
            </template>
          </el-table-column>
          <el-table-column align="center" width="100">
            <template #default="{ row }">
              <el-image
                :src="Utils.createItemImgUrl(row)"
                fit="contain"
                lazy
                class="gift-item-thumb"
              >
              </el-image>
            </template>
          </el-table-column>
          <el-table-column
            prop="name"
            label="道具名称"
            align="center"
            show-overflow-tooltip
            sortable="custom"
          />
          <el-table-column
            prop="latestCreatedAt"
            label="获得时间"
            align="center"
            header-align="center"
            width="170"
            sortable="custom"
          />
          <el-table-column prop="total" align="center" width="100" label="总计" sortable="custom" />
          <el-table-column
            prop="itemCount"
            align="center"
            width="100"
            :label="`总数量`"
            sortable="custom"
          >
            <template #default="{ row }">{{ row.list.length }}</template>
          </el-table-column>
        </el-table>
      </div>
    </el-splitter-panel>
    <el-splitter-panel size="40%" :resizable="false">
      <div class="log-wrap">
        <MainLogPanel />
      </div>
    </el-splitter-panel>
  </el-splitter>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import type { GiftGroupedData, GiftItem, WebUserInfo } from '@types'
import { processGiftData } from '../gift-process'
import { ipcEmitter, ipcArg } from '@renderer/ipc'
import { useToast } from '@renderer/composables/useToast'
import { useLocalStorageState } from 'vue-hooks-plus'
import type { ElTable } from 'element-plus'
import { Utils } from '../utils'
import { pinyin } from 'pinyin-pro'
import MainLogPanel from './MainLogPanel.vue'
import ExpandedGiftTable from './ExpandedGiftTable.vue'
import { keywordGroupOptions } from '../config'

const props = defineProps<{
  accounts: WebUserInfo[]
  verifyLoginBeforeSync: () => Promise<boolean>
}>()

const { error: toastError, success: toastSuccess } = useToast()

/**
 * 原始道具数据
 */
const [storedGiftItems, setStoredGiftItems] = useLocalStorageState<GiftItem[]>(
  'r2beat_shipping_gift_raw_items_v1',
  { defaultValue: [] },
)

/**
 * 上次同步数据时间
 */
const [lastSyncAt, setLastSyncAt] = useLocalStorageState<number | null>(
  'r2beat_shipping_last_sync_at',
  { defaultValue: null },
)

/**
 * 上次同步时参与同步的账号列表（username）
 */
const [lastSyncedAccountUsernames, setLastSyncedAccountUsernames] = useLocalStorageState<string[]>(
  'r2beat_shipping_last_synced_account_usernames_v1',
  { defaultValue: [] },
)

type GroupedRow = GiftGroupedData & {
  latestCreatedAt: string
  latestCreatedAtTs: number
}

type SortOrder = 'ascending' | 'descending' | null
type SortProp = 'latestCreatedAt' | 'itemCount' | 'total' | 'name' | null

const loading = ref(false)
const keyword = ref('')
const debouncedKeyword = ref('')
// 当前选中的道具组
const selectedKeywordGroups = ref<string[]>([])
// 当前选中道具
const selectedRows = ref<GroupedRow[]>([])
const tableRef = ref<InstanceType<typeof ElTable>>()
const canFetch = computed(() => props.accounts.length > 0)
const sortState = ref<{ prop: SortProp; order: SortOrder }>({
  prop: 'latestCreatedAt',
  order: 'descending',
})
let keywordDebounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 *  对所有道具进行一次同类型合并
 */
const groupedRows = computed<GroupedRow[]>(() => {
  const items = storedGiftItems.value ?? []
  if (!items.length) return []

  // 需要检查当前账户是否已启用
  const enabledIds = new Set(props.accounts.map((a) => a.username))
  const filtered = items.filter((item) => enabledIds.has(item.user_id))

  if (!filtered.length) return []

  // 额外添加最新一次道具的获取时间，方便排序
  const grouped = processGiftData(filtered).map((g) => {
    let latestText = ''
    let latestTs = 0
    for (const item of g.list) {
      const ts = Utils.parseCreatedAtToTs(item.created_at)
      if (ts >= latestTs) {
        latestTs = ts
        latestText = item.created_at
      }
    }

    return {
      ...g,
      latestCreatedAt: latestText,
      latestCreatedAtTs: latestTs,
    }
  })

  // 默认根据获取时间进行一次排序
  grouped.sort((a, b) => b.latestCreatedAtTs - a.latestCreatedAtTs)
  return grouped
})

/** 道具名称首字符的 Unicode 码点（用于「编码先后」排序） */
function firstCharCodePoint(name: string): number {
  const t = (name ?? '').trim()
  if (!t.length) return -1
  return t.codePointAt(0) ?? -1
}

function compareByFirstCodePointAsc(a: GroupedRow, b: GroupedRow): number {
  const ca = firstCharCodePoint(a.name)
  const cb = firstCharCodePoint(b.name)
  if (ca !== cb) return ca - cb
  return (a.name || '').localeCompare(b.name || '', 'zh-CN')
}

function sortByFirstCodePoint(rows: GroupedRow[], order: 'ascending' | 'descending'): GroupedRow[] {
  const sorted = [...rows]
  sorted.sort((a, b) =>
    order === 'ascending' ? compareByFirstCodePointAsc(a, b) : compareByFirstCodePointAsc(b, a),
  )
  return sorted
}

/** 编辑距离（短名称相似度补充） */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const row = new Uint16Array(n + 1)
  for (let j = 0; j <= n; j++) row[j] = j
  for (let i = 1; i <= m; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = row[j]
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost)
      prev = tmp
    }
  }
  return row[n]
}

function nameSimilarityScore(a: string, b: string): number {
  const na = (a ?? '').trim()
  const nb = (b ?? '').trim()
  if (!na && !nb) return 1
  if (!na || !nb) return 0
  if (na === nb) return 1

  const maxLen = Math.max(na.length, nb.length)
  let lcp = 0
  for (let i = 0; i < Math.min(na.length, nb.length); i++) {
    if (na[i] !== nb[i]) break
    lcp++
  }
  let score = lcp / maxLen
  if (na.includes(nb) || nb.includes(na)) {
    score = Math.max(score, 0.88)
  }
  if (maxLen <= 36) {
    const dist = levenshtein(na, nb)
    const levScore = 1 - dist / maxLen
    score = Math.max(score, levScore)
  }
  return score
}

/** 贪心链式：相邻行名称尽量相似 */
function sortRowsByNameSimilarityChain(rows: GroupedRow[]): GroupedRow[] {
  if (rows.length <= 1) return rows
  const remaining = [...rows]
  remaining.sort((x, y) => (x.name || '').localeCompare(y.name || '', 'zh-CN'))
  const out: GroupedRow[] = [remaining.shift()!]
  while (remaining.length) {
    const lastName = out[out.length - 1].name || ''
    let bestIdx = 0
    let bestScore = -1
    for (let i = 0; i < remaining.length; i++) {
      const s = nameSimilarityScore(lastName, remaining[i].name || '')
      if (s > bestScore) {
        bestScore = s
        bestIdx = i
      } else if (s === bestScore) {
        const tie = (remaining[i].name || '').localeCompare(remaining[bestIdx].name || '', 'zh-CN')
        if (tie < 0) bestIdx = i
      }
    }
    out.push(remaining.splice(bestIdx, 1)[0])
  }
  return out
}

/** 仅拉丁字母与数字时，才用拼音匹配（避免对中文关键字重复计算）；允许中间空格 */
function looksLikeLatinPinyinQuery(kw: string): boolean {
  return /^[a-z0-9\s]+$/i.test(kw.trim()) && /^[a-z0-9]+$/i.test(kw.replace(/\s+/g, ''))
}

const pinyinSearchCache = new Map<string, { full: string; first: string }>()

function getPinyinSearchKeys(text: string): { full: string; first: string } {
  const raw = String(text ?? '')
  const hit = pinyinSearchCache.get(raw)
  if (hit) return hit
  let full = ''
  let first = ''
  try {
    full = pinyin(raw, {
      toneType: 'none',
      type: 'string',
      separator: '',
    })
      .replace(/\s+/g, '')
      .toLowerCase()
    first = pinyin(raw, {
      pattern: 'first',
      toneType: 'none',
      type: 'string',
      separator: '',
    })
      .replace(/\s+/g, '')
      .toLowerCase()
  } catch {
    /* ignore */
  }
  const v = { full, first }
  if (pinyinSearchCache.size > 2000) {
    pinyinSearchCache.clear()
  }
  pinyinSearchCache.set(raw, v)
  return v
}

/**
 * 文本是否匹配关键字：原文包含，或（拉丁关键字时）全拼 / 首字母包含
 */
function textMatchesKeyword(text: string, kwLower: string): boolean {
  if (!kwLower) return true
  const t = String(text ?? '').toLowerCase()
  if (t.includes(kwLower)) return true
  if (!looksLikeLatinPinyinQuery(kwLower)) return false
  const q = kwLower.replace(/\s+/g, '')
  const { full, first } = getPinyinSearchKeys(text)
  if (full.includes(q)) return true
  if (first.includes(q)) return true
  return false
}

/**
 * 表格数据：先分类筛选，再关键字（含拼音）筛选
 */
const displayData = computed(() => {
  const kw = debouncedKeyword.value.trim().toLowerCase()
  const pickedKeywords = selectedGroupKeywords.value
  let rows = groupedRows.value
  if (pickedKeywords.length > 0) {
    rows = rows.filter((row) => rowMatchesAnyKeyword(row, pickedKeywords))
  }
  const filtered = !kw ? rows : rows.filter((row) => rowMatches(row, kw))

  const ss = sortState.value
  if (ss.prop === 'name') {
    if (ss.order === 'ascending') {
      return sortByFirstCodePoint(filtered, 'ascending')
    }
    if (ss.order === 'descending') {
      return sortByFirstCodePoint(filtered, 'descending')
    }
    return sortRowsByNameSimilarityChain(filtered)
  }

  if (!ss.order || !ss.prop) return filtered
  const sorted = [...filtered]
  if (sortState.value.prop === 'latestCreatedAt') {
    sorted.sort((a, b) =>
      sortState.value.order === 'ascending'
        ? a.latestCreatedAtTs - b.latestCreatedAtTs
        : b.latestCreatedAtTs - a.latestCreatedAtTs,
    )
  } else if (sortState.value.prop === 'itemCount') {
    sorted.sort((a, b) =>
      sortState.value.order === 'ascending'
        ? a.list.length - b.list.length
        : b.list.length - a.list.length,
    )
  } else if (sortState.value.prop === 'total') {
    sorted.sort((a, b) =>
      sortState.value.order === 'ascending'
        ? a._countValue - b._countValue
        : b._countValue - a._countValue,
    )
  }

  return sorted
})

type NameOption = { value: string }

const itemNameOptions = computed<NameOption[]>(() => {
  const pickedKeywords = selectedGroupKeywords.value
  let rows = groupedRows.value
  if (pickedKeywords.length > 0) {
    rows = rows.filter((row) => rowMatchesAnyKeyword(row, pickedKeywords))
  }
  const set = new Set<string>()
  for (const row of rows) {
    const name = (row.name ?? '').trim()
    if (name) set.add(name)
  }
  return Array.from(set).map((name) => ({ value: name }))
})

const selectedGroupKeywords = computed(() => {
  const picked = new Set(selectedKeywordGroups.value)
  return keywordGroupOptions
    .filter((group) => picked.has(group.value))
    .flatMap((group) => group.keywords)
})

/** 每分钟刷新相对时间文案 */
const relativeTimeTick = ref(0)
let relativeTimeTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  debouncedKeyword.value = keyword.value
  relativeTimeTimer = setInterval(() => {
    relativeTimeTick.value++
  }, 60_000)
})

onUnmounted(() => {
  if (keywordDebounceTimer) {
    clearTimeout(keywordDebounceTimer)
    keywordDebounceTimer = null
  }
  if (relativeTimeTimer) {
    clearInterval(relativeTimeTimer)
    relativeTimeTimer = null
  }
})

const lastSyncDisplay = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  relativeTimeTick.value
  const t = lastSyncAt.value
  if (t == null || !Number.isFinite(t)) return '上次同步：—'
  return `上次同步：${Utils.formatRelativePastZh(t)}`
})

const shouldSuggestSync = computed(() => {
  const enabled = props.accounts.map((account) => account.username).filter(Boolean)
  if (enabled.length === 0) return false
  const lastSynced = new Set((lastSyncedAccountUsernames.value ?? []).filter(Boolean))
  if (lastSynced.size === 0) return false
  return enabled.some((username) => !lastSynced.has(username))
})

function rowMatches(row: GiftGroupedData, kw: string): boolean {
  const k = kw.trim().toLowerCase()
  if (!k) return true

  if (
    textMatchesKeyword(row.name, k) ||
    row.code.toLowerCase().includes(k) ||
    row.total.toLowerCase().includes(k)
  ) {
    return true
  }
  return row.list.some((item) => {
    if (textMatchesKeyword(String(item.item_name ?? ''), k)) {
      return true
    }
    const text = [
      item.item_code,
      item.character_name,
      item.created_at,
      item.server_name,
      item.user_id,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return text.includes(k)
  })
}

function rowMatchesAnyKeyword(row: GiftGroupedData, keywords: string[]): boolean {
  const lowers = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)
  if (!lowers.length) return true
  const allNames = [row.name, ...row.list.map((i) => i.item_name)].map((t) =>
    String(t ?? '').toLowerCase(),
  )
  return lowers.some((kw) => allNames.some((name) => name.includes(kw)))
}

/**
 * 生成符合关键字的搜索数据
 */
function querySearchItemName(queryString: string, cb: (results: NameOption[]) => void) {
  const q = queryString.trim().toLowerCase()
  const source = itemNameOptions.value
  if (!q) {
    cb(source)
    return
  }
  cb(source.filter((item) => textMatchesKeyword(item.value, q)))
}

/**
 * 点击下拉框时补全搜索文本
 */
function onKeywordSelect(item: Record<string, string>) {
  keyword.value = item.value
}

/**
 * 导出道具种类汇总：
 * 【道具名称】  总数+单位
 */
function exportGroupedSummaryTxt() {
  const rows = displayData.value
  if (!rows.length) {
    toastError('暂无可导出的道具种类')
    return
  }

  const content = '\uFEFF' + rows.map((row) => `【${row.name}】  ${row.total}\r\n\r\n`).join('')
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = Utils.formatExportFileName('道具列表')
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * 自定义排序功能
 */
function onSortChange(payload: { prop: string; order: SortOrder }) {
  const { prop, order } = payload

  if (prop === 'name') {
    sortState.value = { prop: 'name', order }
    return
  }

  if (!prop) {
    sortState.value = { prop: 'latestCreatedAt', order: 'descending' }
    nextTick(() => {
      const table = tableRef.value as { sort?: (p: string, o: string) => void } | undefined
      table?.sort?.('latestCreatedAt', 'descending')
    })
    return
  }

  if (prop !== 'latestCreatedAt' && prop !== 'itemCount' && prop !== 'total') {
    sortState.value = { prop: null, order: null }
    return
  }

  sortState.value = {
    prop: prop as Exclude<SortProp, 'name' | null>,
    order,
  }
}

/**
 * 获取已启用账户道具
 */
async function fetchAndStoreGifts() {
  const result = await ipcEmitter.invoke('get-gift-list', ipcArg(props.accounts))
  if (!result.success) {
    toastError(result.error ?? '获取道具数据失败')
    return false
  }
  const raw = result.items ?? []
  setStoredGiftItems(raw)
  return true
}

/**
 * 获取数据
 */
async function syncData() {
  if (!canFetch.value || loading.value) return

  loading.value = true
  try {
    const ready = await props.verifyLoginBeforeSync()
    if (!ready) return

    const ok = await fetchAndStoreGifts()
    if (ok) {
      setLastSyncAt(Date.now())
      setLastSyncedAccountUsernames(
        props.accounts.map((account) => account.username).filter(Boolean),
      )
      toastSuccess('数据同步完成')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    toastError(msg)
  } finally {
    loading.value = false
  }
}

/**
 * 给输入框做个简易防抖
 */
watch(keyword, () => {
  if (keywordDebounceTimer) clearTimeout(keywordDebounceTimer)
  keywordDebounceTimer = setTimeout(() => {
    debouncedKeyword.value = keyword.value
    keywordDebounceTimer = null
  }, 1000)
  tableRef.value?.clearSelection()
})

watch(selectedKeywordGroups, () => {
  tableRef.value?.clearSelection()
})
</script>

<style scoped>
.el-splitter {
  gap: 10px;
  height: 100%;
  min-height: 0;
}
.item-table-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;

  .item-table-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
}

.item-table-toolbar-sync {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
}

.item-table-last-sync {
  margin-right: auto;
  font-size: 12px;
  line-height: 1.3;
  color: var(--color-text-tertiary, #909399);
  white-space: nowrap;
}

.item-table-sync-suggest-text {
  color: var(--el-color-warning, #e6a23c);
}

.item-table-filter {
  flex: 1 1 0;
  min-width: 160px;
}

.item-table-filters {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: nowrap;
}

.item-table-filter-select {
  flex: 1 1 0;
  min-width: 160px;
}

.item-table-hint {
  font-size: 13px;
  color: var(--color-text-tertiary, #909399);
}

.item-table-error {
  font-size: 13px;
  color: var(--el-color-danger, #f56c6c);
}

.item-table-meta {
  font-size: 13px;
  color: var(--color-text-secondary, #606266);
}

.item-table {
  flex: 1;
  min-height: 0;
}

.gift-item-thumb {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  background: var(--color-bg-card, var(--el-fill-color));
}

.log-wrap {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  overflow: hidden;
  background: var(--el-fill-color-blank);
}
</style>
