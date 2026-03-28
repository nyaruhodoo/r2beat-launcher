<template>
  <Modal
    :visible="visible"
    title="赠送预览"
    title-icon="🎁"
    cancel-text="关闭"
    :show-confirm="false"
    :show-cancel="false"
    max-width="900px"
    @close="handleClose"
  >
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

    <template #footer>
      <button class="btn btn-cancel" type="button" @click="handleClose">关闭</button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
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

/** el-table 使用 max-height 后表体内部滚动 */

const handleClose = () => {
  emit('close')
}
</script>

<style scoped>
.gift-give-modal-body {
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
