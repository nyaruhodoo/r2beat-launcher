<template>
  <Modal
    :visible="visible"
    title="赠送预览"
    title-icon="🎁"
    cancel-text="关闭"
    :show-confirm="false"
    :show-cancel="false"
    max-width="900px"
    @close="emit('close')"
  >
    <div class="gift-give-modal-body">
      <div class="gift-give-giver-row">
        <el-autocomplete
          v-model="giverName"
          class="gift-give-giver-input"
          clearable
          :trigger-on-focus="true"
          :fetch-suggestions="fetchGiverSuggestions"
          placeholder="输入或选择赠送人"
          autocorrect="off"
          :debounce="200"
          style="width: 200px"
        />
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
            <ExpandedGiftTable :items="row.list" :accounts="accounts" />
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
        <el-table-column align="center" width="100" label="数量" :resizable="false">
          <template #default="{ row }">{{ row.list.length }}</template>
        </el-table-column>
      </el-table>
    </div>

    <template #footer>
      <button class="btn btn-cancel" type="button" @click="emit('close')">关闭</button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLocalStorageState } from 'vue-hooks-plus'
import Modal from '@renderer/components/Modal.vue'
import type { GiftGroupedData, WebUserInfo } from '@src/types'
import { Utils } from '../utils'
import ExpandedGiftTable from './ExpandedGiftTable.vue'

/** 与 ItemTable 汇总行一致，用于展示 */
export type GiftGiveModalRow = GiftGroupedData & {
  latestCreatedAt: string
}

defineProps<{
  visible: boolean
  rows: GiftGiveModalRow[]
  /** 与主表一致：为 true 时隐藏缩略图（紧凑模式） */
  isCompact: boolean
  accounts: WebUserInfo[]
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

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

/**
 * 最近赠送过的人
 */
const [recentGivers] = useLocalStorageState<string[]>('r2beat_shipping_recent_gift_givers_v1', {
  defaultValue: [],
})

const giverName = ref('')

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
