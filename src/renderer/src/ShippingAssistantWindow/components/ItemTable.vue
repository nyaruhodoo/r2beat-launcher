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
              placeholder="按道具名称筛选"
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
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" align="center" width="50" :reserve-selection="false" />
          <el-table-column type="expand">
            <template #default="{ row }">
              <ExpandedGiftTable :items="row.list" :accounts="props.accounts" />
            </template>
          </el-table-column>
          <el-table-column align="center" width="100" :label="`道具种类(${groupCount})`">
            <template #default="{ row }">
              <el-image :src="giftItemImageUrl(row)" fit="contain" lazy class="gift-item-thumb">
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
            width="120"
            :label="`总物品数量(${totalItemCount})`"
            sortable="custom"
          >
            <template #default="{ row }">{{ row.itemCount }}</template>
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
  itemCount: number
}

type SortOrder = 'ascending' | 'descending' | null
type SortProp = 'latestCreatedAt' | 'itemCount' | 'total' | 'name' | null

const loading = ref(false)
const keyword = ref('')
const selectedKeywordGroups = ref<string[]>([])
const selectedRows = ref<GroupedRow[]>([])
const tableRef = ref<InstanceType<typeof ElTable>>()
const canFetch = computed(() => props.accounts.length > 0)
const sortState = ref<{ prop: SortProp; order: SortOrder }>({
  prop: 'latestCreatedAt',
  order: 'descending',
})

/**
 * 道具分组：只保留 user_id 仍属于当前启用账号（与 username 一致）的道具
 */
function parseCreatedAtToTs(text: string): number {
  const ts = Date.parse(text)
  return Number.isNaN(ts) ? 0 : ts
}

const groupedRows = computed<GroupedRow[]>(() => {
  const items = storedGiftItems.value ?? []
  if (!items.length) return []

  const enabledIds = new Set(props.accounts.map((a) => a.username))
  const filtered = items.filter((item) => enabledIds.has(item.user_id))

  if (!filtered.length) return []

  const grouped = processGiftData(filtered).map((g) => {
    let latestText = ''
    let latestTs = 0
    for (const item of g.list) {
      const ts = parseCreatedAtToTs(item.created_at)
      if (ts >= latestTs) {
        latestTs = ts
        latestText = item.created_at
      }
    }
    return {
      ...g,
      latestCreatedAt: latestText,
      latestCreatedAtTs: latestTs,
      itemCount: g.list.length,
    }
  })

  // 默认按获得时间降序（与 sortState / default-sort 一致）
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

/**
 * 表格数据，根据关键字做二次筛选
 */
const displayData = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  const rows = groupedRows.value
  const filteredByText = !kw ? rows : rows.filter((row) => rowMatches(row, kw))

  const pickedKeywords = selectedGroupKeywords.value
  const filtered =
    pickedKeywords.length === 0
      ? filteredByText
      : filteredByText.filter((row) => rowMatchesAnyKeyword(row, pickedKeywords))

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
      sortState.value.order === 'ascending' ? a.itemCount - b.itemCount : b.itemCount - a.itemCount,
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
  const set = new Set<string>()
  for (const row of displayData.value) {
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

const groupCount = computed(() => displayData.value.length)

const totalItemCount = computed(() => displayData.value.reduce((n, g) => n + g.list.length, 0))

/** 每分钟刷新相对时间文案 */
const relativeTimeTick = ref(0)
let relativeTimeTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  relativeTimeTimer = setInterval(() => {
    relativeTimeTick.value++
  }, 60_000)
})

onUnmounted(() => {
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
  if (
    row.name.toLowerCase().includes(kw) ||
    row.code.toLowerCase().includes(kw) ||
    row.total.toLowerCase().includes(kw)
  ) {
    return true
  }
  return row.list.some((item) => {
    const text = [
      item.item_name,
      item.item_code,
      item.character_name,
      item.created_at,
      item.server_name,
      item.user_id,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return text.includes(kw)
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
 * 获取道具图片
 */
function giftItemImageUrl(item: GiftGroupedData) {
  const code = String(item.code ?? '').trim()
  if (!code) return ''
  return `https://r2beat-web-cdn.xiyouxi.com/images/sub/gift/item/${code}.png`
}

function onSelectionChange(rows: GroupedRow[]) {
  selectedRows.value = rows
}

function querySearchItemName(queryString: string, cb: (results: NameOption[]) => void) {
  const q = queryString.trim().toLowerCase()
  const source = itemNameOptions.value
  if (!q) {
    cb(source)
    return
  }
  cb(source.filter((item) => item.value.toLowerCase().includes(q)))
}

function onKeywordSelect(item: Record<string, unknown>) {
  keyword.value = String(item.value ?? '')
}

function formatExportFileName() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `gift-group-summary_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.txt`
}

/**
 * 前端导出道具种类汇总：
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
  a.download = formatExportFileName()
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  toastSuccess('已导出道具种类统计')
}

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
 * 获取已启用账户道具（仅持久化原始 items；分组与筛选由计算属性完成）
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

watch(keyword, () => {
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
  width: 48px;
  height: 48px;
  border-radius: 6px;
  background: var(--color-bg-card, var(--el-fill-color));
}

.gift-item-thumb--fail {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  font-size: 12px;
  color: var(--color-text-tertiary, var(--el-text-color-placeholder));
  background: var(--color-bg-card, var(--el-fill-color));
  border-radius: 6px;
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
