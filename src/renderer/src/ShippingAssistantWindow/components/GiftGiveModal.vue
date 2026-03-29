<template>
  <Modal
    :visible="visible"
    title="赠送列表"
    title-icon="🎁"
    cancel-text="关闭"
    confirm-text="赠送"
    max-width="900px"
    @close="emit('close')"
    @cancel="emit('close')"
    @confirm="onGiveConfirm"
  >
    <div class="gift-give-modal-body">
      <div class="gift-give-giver-row">
        <el-autocomplete
          ref="giverAutocompleteRef"
          v-model="giverName"
          class="gift-give-giver-input"
          clearable
          :trigger-on-focus="true"
          :fetch-suggestions="fetchGiverSuggestions"
          placeholder="输入或选择赠送人"
          autocorrect="off"
          :debounce="200"
          popper-class="gift-giver-autocomplete-popper"
          style="width: 260px"
          maxlength="10"
        >
          <template #default="{ item }">
            <div class="gift-giver-suggest-row">
              <span class="gift-giver-suggest-text">{{ item.value }}</span>
              <el-button
                type="danger"
                link
                size="small"
                class="gift-giver-suggest-remove"
                @click.stop="onRemoveRecentGiver(item.value)"
              >
                删除
              </el-button>
            </div>
          </template>
          <template v-if="(recentGivers?.length ?? 0) > 0" #footer>
            <div class="gift-giver-suggest-footer">
              <el-button type="danger" link size="small" @click.stop="onClearAllRecentGivers">
                清空全部
              </el-button>
            </div>
          </template>
        </el-autocomplete>
        <span v-if="giverInvisibleHint" class="gift-give-giver-hint">{{ giverInvisibleHint }}</span>
      </div>
      <el-table
        :data="rows"
        stripe
        border
        :resizable="false"
        class="gift-give-table"
        empty-text="暂无数据"
        row-key="code"
      >
        <el-table-column type="expand" :resizable="false">
          <template #default="{ row }">
            <ExpandedGiftTable
              :items="row.list"
              :accounts="accounts"
              :visible-item-idx-set="giveVisibleItemIdxByCode[row.code]"
              :fixed-height="20 * 6"
            />
          </template>
        </el-table-column>
        <el-table-column align="center" width="100" :resizable="false">
          <template #default="{ row }">
            <el-image
              v-show="!isCompact"
              :src="Utils.createItemImgUrl(row)"
              fit="contain"
              lazy
              class="gift-item-thumb"
            />
          </template>
        </el-table-column>
        <el-table-column
          prop="name"
          :label="`道具名称(${rows.length})`"
          align="center"
          show-overflow-tooltip
          :resizable="false"
        />
        <el-table-column
          prop="latestCreatedAt"
          label="获得时间"
          align="center"
          width="170"
          :resizable="false"
        />
        <el-table-column prop="total" align="center" width="120" label="总计" :resizable="false" />
        <el-table-column align="center" width="180" label="数量/天数" :resizable="false">
          <template #default="{ row }">
            <div class="gift-give-qty-stepper">
              <el-button
                size="small"
                class="gift-give-qty-step-btn"
                :disabled="!canGiveQtyStepDown(row.code)"
                @click="giveQtyStepDown(row.code)"
              >
                −
              </el-button>
              <el-input-number
                v-model="giveQuantities[row.code]"
                class="gift-give-qty-input"
                :min="giveQtyMeta[row.code]?.min ?? 0"
                :max="giveQtyMeta[row.code]?.max ?? row._countValue"
                :precision="0"
                :controls="false"
                size="small"
                @change="(v: number | undefined) => onGiveQtyChange(row.code, v)"
              />
              <el-button
                size="small"
                class="gift-give-qty-step-btn"
                :disabled="!canGiveQtyStepUp(row.code)"
                @click="giveQtyStepUp(row.code)"
              >
                +
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { computed, h, Fragment, nextTick, ref, watch } from 'vue'
import type { VNode } from 'vue'
import { useLocalStorageState } from 'vue-hooks-plus'
import Modal from '@renderer/components/Modal.vue'
import type { GiftGroupedData, GiftItemWithGiver, WebUserInfo } from '@src/types'
import { giftItemNumericCount, pickGiftListSubsetIndices } from '../gift-process'
import { Utils } from '../utils'
import ExpandedGiftTable from './ExpandedGiftTable.vue'
import { useToast } from '@renderer/composables/useToast'
import { confirm } from '@renderer/composables/useConfirm'

/** 与 ItemTable 汇总行一致，用于展示 */
export type GiftGiveModalRow = GiftGroupedData & {
  latestCreatedAt: string
}

const props = defineProps<{
  visible: boolean
  rows: GiftGiveModalRow[]
  /** 与主表一致：为 true 时隐藏缩略图（紧凑模式） */
  isCompact: boolean
  accounts: WebUserInfo[]
  /** 点击「赠送」确认时传入完整 GiftItem，并附带 giverName */
  onGiveConfirmSubmit?: (items: GiftItemWithGiver[]) => void
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { error: toastError } = useToast()

/**
 * 最近赠送过的人（与自动补全同源，确认框用于判断是否曾赠送过）
 */
const [recentGivers, setRecentGivers] = useLocalStorageState<string[]>(
  'r2beat_shipping_recent_gift_givers_v1',
  {
    defaultValue: [],
  },
)

/** el-autocomplete 实例，用于删除/清空后刷新下拉、收起面板 */
const giverAutocompleteRef = ref<{
  getData: (queryString: string) => Promise<void>
  close: () => void
} | null>(null)

function refreshGiverSuggestions() {
  void nextTick(() => {
    giverAutocompleteRef.value?.getData(String(giverName.value ?? ''))
  })
}

function onRemoveRecentGiver(name: string) {
  setRecentGivers((prev) => (prev ?? []).filter((n) => n !== name))
  refreshGiverSuggestions()
}

async function onClearAllRecentGivers() {
  const list = recentGivers.value ?? []
  if (!list.length) return
  giverAutocompleteRef.value?.close()
  try {
    await confirm({
      title: '清空记录',
      message: '确定清空全部「最近赠送人」记录？',
      confirmText: '清空',
      cancelText: '取消',
    })
  } catch {
    return
  }
  setRecentGivers([])
  refreshGiverSuggestions()
}

/** 按主表行顺序，将当前选中的 idx 还原为 GiftItem，并附上赠送人 */
function buildGiveItemsWithGiver(
  byCode: Record<string, Set<number>>,
  rows: GiftGiveModalRow[],
  giverName: string,
): GiftItemWithGiver[] {
  const out: GiftItemWithGiver[] = []
  for (const row of rows) {
    const set = byCode[row.code]
    if (!set?.size) continue
    for (const idx of set) {
      const item = row.list.find((it) => it.idx === idx)
      if (!item) continue
      out.push({ ...item, giverName })
    }
  }
  return out
}

async function onGiveConfirm() {
  if (giverName.value.length <= 0) {
    toastError('赠送人不可为空')
    return
  }
  const items = buildGiveItemsWithGiver(giveVisibleItemIdxByCode.value, props.rows, giverName.value)
  if (items.length === 0) {
    toastError('没有可赠送的物品')
    return
  }

  const rawGiver = giverName.value ?? ''
  const invisibleHint = buildGiverInvisibleHint(rawGiver)
  const hasGiftedToGiverBefore = (recentGivers.value ?? []).includes(rawGiver)

  await confirm({
    title: '确认赠送',
    confirmText: '赠送',
    cancelText: '取消',
    content: () => {
      const blocks: VNode[] = [
        h('div', null, '请确认赠送人是否正确？'),
        h(
          'div',
          {
            style: {
              whiteSpace: 'pre-wrap',
              color: 'var(--el-color-primary)',
              marginTop: '6px',
              wordBreak: 'break-word',
            },
          },
          rawGiver,
        ),
      ]
      if (invisibleHint) {
        blocks.push(
          h(
            'div',
            {
              style: {
                whiteSpace: 'pre-wrap',
                color: 'var(--el-color-warning)',
                marginTop: '10px',
                fontSize: '13px',
              },
            },
            invisibleHint,
          ),
        )
      }

      blocks.push(
        h(
          'div',
          {
            style: {
              marginTop: '10px',
              fontSize: '13px',
              lineHeight: '1.5',
              fontWeight: '500',
              color: hasGiftedToGiverBefore ? 'var(--el-color-success)' : 'var(--el-color-danger)',
            },
          },
          hasGiftedToGiverBefore ? '您曾向该玩家赠送过物品。' : '您第一次向该玩家赠送物品。',
        ),
      )

      return h(Fragment, null, blocks)
    },
  })

  setRecentGivers((prev) => {
    const list = prev ?? []
    return [rawGiver, ...list.filter((n) => n !== rawGiver)]
  })

  props.onGiveConfirmSubmit?.(items)
  emit('close')
}

/**
 * Unicode 空白 + 格式类（含零宽、BOM 等不单独“占字”的字符）
 */
const NON_DISPLAY_CHAR = /\p{White_Space}|\p{gc=Cf}/u
function isNonDisplayChar(ch: string): boolean {
  return NON_DISPLAY_CHAR.test(ch)
}

/**
 * 先找首尾「可见」字符位置，再统计前/后/中间不可见段，避免纯空白串被同时算成「前」和「后」。
 */
function buildGiverInvisibleHint(raw: string): string {
  const units = [...(raw ?? '')]
  if (!units.length) return ''

  let firstVisible = -1
  let lastVisible = -1
  for (let i = 0; i < units.length; i++) {
    if (!isNonDisplayChar(units[i])) {
      if (firstVisible < 0) firstVisible = i
      lastVisible = i
    }
  }

  // 完全没有可见字符：整段算作「前导」一段
  if (firstVisible < 0) {
    return `前 ${units.length} 个不可见字符（含空白、零宽字符等）`
  }

  const lead = firstVisible
  const trail = units.length - 1 - lastVisible
  let mid = 0
  for (let i = firstVisible + 1; i < lastVisible; i++) {
    if (isNonDisplayChar(units[i])) mid++
  }

  if (lead === 0 && trail === 0 && mid === 0) return ''

  const parts: string[] = []
  if (lead > 0) parts.push(`前 ${lead} 个`)
  if (mid > 0) parts.push(`中间 ${mid} 个`)
  if (trail > 0) parts.push(`后 ${trail} 个`)

  return `${parts.join('，')}不可见字符（含空白、零宽字符等）`
}

// 避免送错人，特别显示特殊符号
const giverInvisibleHint = computed(() => buildGiverInvisibleHint(giverName.value ?? ''))

const giverName = ref('')

/** 每行赠送数量，key 为道具分组 code；合法值必须为 list 各条数量的某个子集和 */
const giveQuantities = ref<Record<string, number>>({})

type GiveQtyMeta = {
  min: number
  max: number
  /** 升序：子集和 ∩ [min, max]，用于纠错到最近合法值 */
  valid: number[]
}

const giveQtyMeta = ref<Record<string, GiveQtyMeta>>({})

/** list 每条数量的所有子集和（含 0） */
function buildSubsetSums(counts: number[]): number[] {
  const sums = new Set<number>([0])
  for (const c of counts) {
    const toAdd: number[] = []
    for (const s of sums) {
      toAdd.push(s + c)
    }
    for (const x of toAdd) {
      sums.add(x)
    }
  }
  return [...sums].sort((a, b) => a - b)
}

/** 与 target 差距最小的合法值；距离相同取较小（偏向下修正） */
function nearestSubsetSum(target: number, sortedValid: number[]): number {
  if (!sortedValid.length) return target
  let best = sortedValid[0]
  let bestDist = Math.abs(target - best)
  for (const v of sortedValid) {
    const d = Math.abs(target - v)
    if (d < bestDist) {
      best = v
      bestDist = d
    } else if (d === bestDist && v < best) {
      best = v
    }
  }
  return best
}

function resetGiveQuantitiesFromRows() {
  const next: Record<string, number> = {}
  const meta: Record<string, GiveQtyMeta> = {}
  for (const row of props.rows) {
    const counts = row.list.map(giftItemNumericCount)
    const max = row._countValue
    if (!counts.length) {
      next[row.code] = 0
      meta[row.code] = { min: 0, max: 0, valid: [0] }
      continue
    }
    const min = Math.min(...counts)
    const valid = buildSubsetSums(counts)
      .filter((s) => s >= min && s <= max)
      .sort((a, b) => a - b)
    next[row.code] = max
    meta[row.code] = { min, max, valid }
  }
  giveQuantities.value = next
  giveQtyMeta.value = meta
}

function onGiveQtyChange(code: string, value: number | undefined) {
  const m = giveQtyMeta.value[code]
  if (!m?.valid.length) return
  let t = value
  if (t == null || Number.isNaN(t)) {
    t = m.max
  }
  const snapped = nearestSubsetSum(t, m.valid)
  if (giveQuantities.value[code] !== snapped) {
    giveQuantities.value[code] = snapped
  }
}

function giveQtyStepUp(code: string) {
  const m = giveQtyMeta.value[code]
  if (!m?.valid.length) return
  const cur = giveQuantities.value[code]
  const base = cur == null || Number.isNaN(cur) ? m.valid[0]! : cur
  const next = m.valid.find((v) => v > base)
  if (next !== undefined) {
    giveQuantities.value[code] = next
  }
}

function giveQtyStepDown(code: string) {
  const m = giveQtyMeta.value[code]
  if (!m?.valid.length) return
  const cur = giveQuantities.value[code]
  const base = cur == null || Number.isNaN(cur) ? m.valid[m.valid.length - 1]! : cur
  let prev: number | undefined
  for (const v of m.valid) {
    if (v < base) prev = v
    else break
  }
  if (prev !== undefined) {
    giveQuantities.value[code] = prev
  }
}

function canGiveQtyStepUp(code: string): boolean {
  const m = giveQtyMeta.value[code]
  if (!m?.valid.length) return false
  const cur = giveQuantities.value[code]
  const base = cur == null || Number.isNaN(cur) ? m.valid[0]! : cur
  return m.valid.some((v) => v > base)
}

function canGiveQtyStepDown(code: string): boolean {
  const m = giveQtyMeta.value[code]
  if (!m?.valid.length) return false
  const cur = giveQuantities.value[code]
  const base = cur == null || Number.isNaN(cur) ? m.valid[m.valid.length - 1]! : cur
  return m.valid.some((v) => v < base)
}

/**
 * 与规范化后的数量对应的 list 子集（按 idx）；仅这些行在展开表中展示
 */
const giveVisibleItemIdxByCode = computed(() => {
  const q = giveQuantities.value
  const metaMap = giveQtyMeta.value
  const out: Record<string, Set<number>> = {}
  for (const row of props.rows) {
    const counts = row.list.map(giftItemNumericCount)
    const meta = metaMap[row.code]
    let t = q[row.code] ?? row._countValue
    if (meta?.valid.length) {
      t = nearestSubsetSum(t, meta.valid)
    }
    const picked = pickGiftListSubsetIndices(counts, t)
    const ids = new Set<number>()
    for (const i of picked) {
      const it = row.list[i]
      if (it) ids.add(it.idx)
    }
    out[row.code] = ids
  }

  return out
})

watch(
  () => props.visible,
  (v) => {
    if (v) {
      giverName.value = ''
      resetGiveQuantitiesFromRows()
    }
  },
)

watch(
  () => props.rows,
  () => {
    if (props.visible) resetGiveQuantitiesFromRows()
  },
  { deep: true },
)

function fetchGiverSuggestions(queryString: string, cb: (results: { value: string }[]) => void) {
  const q = queryString.trim().toLowerCase()
  const list = recentGivers.value ?? []
  const candidates = !q ? list : list.filter((name) => name.toLowerCase().includes(q))
  cb(candidates.map((value) => ({ value })))
}
</script>

<style scoped>
.gift-give-modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gift-give-giver-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.gift-giver-suggest-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.gift-giver-suggest-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gift-giver-suggest-remove {
  flex-shrink: 0;
}

.gift-giver-suggest-footer {
  padding: 6px 8px;
  text-align: center;
}

.gift-give-giver-hint {
  flex: 1 1 200px;
  min-width: 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--color-text-tertiary, #909399);
}

.gift-give-giver-label {
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.gift-give-empty {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted, #909399);
  text-align: center;
  padding: 24px 0;
}

.gift-give-table {
  width: 100%;
}

.gift-give-qty-stepper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.gift-give-qty-step-btn {
  min-width: 28px;
  padding: 6px 8px;
}

.gift-give-qty-input {
  width: 88px;
}

.gift-item-thumb {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  background: var(--color-bg-card, var(--el-fill-color));
}

.btn {
  padding: 8px 24px;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-cancel {
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  border: 1.5px solid var(--color-border);
}

.btn-cancel:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-bg-card-hover);
}
</style>
