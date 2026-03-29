<template>
  <Modal
    :visible="visible"
    title="转化能量"
    title-icon="⚡"
    cancel-text="关闭"
    :confirm-text="confirmButtonLabel"
    max-width="900px"
    @close="emit('close')"
    @cancel="emit('close')"
    @confirm="onEnergyConvertConfirm"
  >
    <div class="energy-convert-modal-body">
      <el-table
        :data="rows"
        stripe
        border
        :resizable="false"
        class="energy-convert-table"
        empty-text="暂无数据"
        row-key="code"
      >
        <el-table-column type="expand" :resizable="false">
          <template #default="{ row }">
            <ExpandedGiftTable
              :items="row.list"
              :accounts="accounts"
              :visible-item-idx-set="convertVisibleItemIdxByCode[row.code]"
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
        <el-table-column align="center" width="120" label="总计" :resizable="false">
          <template #default="{ row }">{{ row.list.length }}个</template>
        </el-table-column>
        <el-table-column align="center" width="180" label="能量" :resizable="false">
          <template #default="{ row }">
            <div class="energy-convert-qty-stepper">
              <el-button
                size="small"
                class="energy-convert-qty-step-btn"
                :disabled="!canConvertQtyStepDown(row)"
                @click="convertQtyStepDown(row)"
              >
                −
              </el-button>
              <el-input-number
                v-model="convertQuantities[row.code]"
                class="energy-convert-qty-input"
                :min="qtyMinMax(row).min"
                :max="qtyMinMax(row).max"
                :step="1"
                :precision="0"
                :controls="false"
                :disabled="row.list.length === 0"
                size="small"
                @change="(v: number | undefined) => onConvertQtyChange(row, v)"
              />
              <el-button
                size="small"
                class="energy-convert-qty-step-btn"
                :disabled="!canConvertQtyStepUp(row)"
                @click="convertQtyStepUp(row)"
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
import { computed, ref, watch } from 'vue'
import Modal from '@renderer/components/Modal.vue'
import type { GiftGroupedData, GiftItemWithGiver, WebUserInfo } from '@src/types'
import { Utils } from '../utils'
import ExpandedGiftTable from './ExpandedGiftTable.vue'
import { useToast } from '@renderer/composables/useToast'
import { confirm } from '@renderer/composables/useConfirm'

/** 与 ItemTable 汇总行一致，用于展示 */
export type EnergyConvertModalRow = GiftGroupedData & {
  latestCreatedAt: string
}

const props = defineProps<{
  visible: boolean
  rows: EnergyConvertModalRow[]
  /** 与主表一致：为 true 时隐藏缩略图（紧凑模式） */
  isCompact: boolean
  accounts: WebUserInfo[]
  /** 点击「转化能量」确认时传入选中条目（按每行列表前 N 条）；giverName 固定为空串 */
  onEnergyConvertConfirmSubmit?: (items: GiftItemWithGiver[]) => void
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { error: toastError } = useToast()

function qtyMinMax(row: EnergyConvertModalRow): { min: number; max: number } {
  const len = row.list.length
  if (len <= 0) return { min: 0, max: 0 }
  return { min: 1, max: len }
}

function clampQty(row: EnergyConvertModalRow, v: number): number {
  const { min, max } = qtyMinMax(row)
  if (max <= 0) return 0
  return Math.min(max, Math.max(min, Math.round(v)))
}

/** 按主表行顺序，取每行 list 前 N 条（N 为该行数量），并附上 giverName: '' */
function buildConvertItems(rows: EnergyConvertModalRow[]): GiftItemWithGiver[] {
  const out: GiftItemWithGiver[] = []
  const q = convertQuantities.value
  for (const row of rows) {
    const len = row.list.length
    if (len <= 0) continue
    const n = clampQty(row, q[row.code] ?? len)
    for (const item of row.list.slice(0, n)) {
      out.push({ ...item, giverName: '' })
    }
  }
  return out
}

const confirmButtonLabel = computed(() => {
  const n = buildConvertItems(props.rows).length
  return `转化能量(${n})`
})

async function onEnergyConvertConfirm() {
  const items = buildConvertItems(props.rows)
  if (items.length === 0) {
    toastError('没有可转化的物品')
    return
  }

  const n = buildConvertItems(props.rows).length
  try {
    await confirm({
      title: '确认转化能量',
      confirmText: `转化能量(${n})`,
      cancelText: '取消',
      message: `确定将 ${n} 件道具转化为能量？`,
    })
  } catch {
    return
  }

  props.onEnergyConvertConfirmSubmit?.(items)
  emit('close')
}

const convertQuantities = ref<Record<string, number>>({})

function resetConvertQuantitiesFromRows() {
  const next: Record<string, number> = {}
  for (const row of props.rows) {
    const len = row.list.length
    next[row.code] = len <= 0 ? 0 : len
  }
  convertQuantities.value = next
}

function onConvertQtyChange(row: EnergyConvertModalRow, value: number | undefined) {
  const snapped = clampQty(row, value == null || Number.isNaN(value) ? qtyMinMax(row).max : value)
  if (convertQuantities.value[row.code] !== snapped) {
    convertQuantities.value[row.code] = snapped
  }
}

function convertQtyStepUp(row: EnergyConvertModalRow) {
  const { max } = qtyMinMax(row)
  if (max <= 0) return
  const cur = convertQuantities.value[row.code] ?? max
  convertQuantities.value[row.code] = Math.min(max, cur + 1)
}

function convertQtyStepDown(row: EnergyConvertModalRow) {
  const { min, max } = qtyMinMax(row)
  if (max <= 0) return
  const cur = convertQuantities.value[row.code] ?? max
  convertQuantities.value[row.code] = Math.max(min, cur - 1)
}

function canConvertQtyStepUp(row: EnergyConvertModalRow): boolean {
  const { max } = qtyMinMax(row)
  if (max <= 0) return false
  const cur = convertQuantities.value[row.code] ?? max
  return cur < max
}

function canConvertQtyStepDown(row: EnergyConvertModalRow): boolean {
  const { min, max } = qtyMinMax(row)
  if (max <= 0) return false
  const cur = convertQuantities.value[row.code] ?? max
  return cur > min
}

const convertVisibleItemIdxByCode = computed(() => {
  const q = convertQuantities.value
  const out: Record<string, Set<number>> = {}
  for (const row of props.rows) {
    const len = row.list.length
    const ids = new Set<number>()
    if (len > 0) {
      const n = clampQty(row, q[row.code] ?? len)
      for (const item of row.list.slice(0, n)) {
        ids.add(item.idx)
      }
    }
    out[row.code] = ids
  }
  return out
})

watch(
  () => props.visible,
  (v) => {
    if (v) {
      resetConvertQuantitiesFromRows()
    }
  },
)

watch(
  () => props.rows,
  () => {
    if (props.visible) resetConvertQuantitiesFromRows()
  },
  { deep: true },
)
</script>

<style scoped>
.energy-convert-modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.energy-convert-table {
  width: 100%;
}

.energy-convert-qty-stepper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.energy-convert-qty-step-btn {
  min-width: 28px;
  padding: 6px 8px;
}

.energy-convert-qty-input {
  width: 88px;
}

.gift-item-thumb {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  background: var(--color-bg-card, var(--el-fill-color));
}
</style>
