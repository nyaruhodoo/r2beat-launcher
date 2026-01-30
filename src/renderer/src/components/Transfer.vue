<template>
  <div class="transfer-wrapper">
    <!-- 左侧：本地补丁 -->
    <div class="transfer-panel">
      <div class="panel-header">
        <span class="panel-title">本地补丁</span>
        <span class="panel-count">{{ leftItems.length }}</span>
      </div>
      <ul class="panel-list">
        <li
          v-for="item in leftItems"
          :key="item.id"
          class="panel-item"
          :class="{ active: selectedLeftIds.includes(item.id) }"
          @click="toggleSelectLeft(item.id)"
        >
          <span class="item-name" :title="item.label">{{ item.label }}</span>
          <button class="item-remove" @click.stop="removeLeft(item.id)">✕</button>
        </li>
        <li v-if="leftItems.length === 0" class="panel-empty">暂无补丁</li>
      </ul>
    </div>

    <!-- 中间按钮区 -->
    <div class="transfer-actions">
      <button class="btn-transfer" :disabled="selectedLeftIds.length === 0" @click="moveToRight">
        &gt;
      </button>
      <button class="btn-transfer" :disabled="selectedRightIds.length === 0" @click="moveToLeft">
        &lt;
      </button>
    </div>

    <!-- 右侧：游戏内补丁 -->
    <div class="transfer-panel">
      <div class="panel-header">
        <span class="panel-title">游戏内补丁</span>
        <span class="panel-count">{{ rightItems.length }}</span>
      </div>
      <ul class="panel-list">
        <li
          v-for="item in rightItems"
          :key="item.id"
          class="panel-item"
          :class="{ active: selectedRightIds.includes(item.id) }"
          @click="toggleSelectRight(item.id)"
        >
          <span class="item-name" :title="item.label">{{ item.label }}</span>
          <button class="item-remove" @click.stop="removeRight(item.id)">✕</button>
        </li>
        <li v-if="rightItems.length === 0" class="panel-empty">暂无补丁</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

export interface TransferItem {
  id: string
  label: string
}

const props = defineProps<{
  left: TransferItem[]
  right: TransferItem[]
}>()

const emit = defineEmits<{
  (e: 'update:left', value: TransferItem[]): void
  (e: 'update:right', value: TransferItem[]): void
  (e: 'remove', payload: { side: 'left' | 'right'; id: string }): void
}>()

const leftItems = computed(() => props.left)
const rightItems = computed(() => props.right)

const selectedLeftIds = ref<string[]>([])
const selectedRightIds = ref<string[]>([])

const toggleSelectLeft = (id: string) => {
  if (selectedLeftIds.value.includes(id)) {
    selectedLeftIds.value = selectedLeftIds.value.filter((x) => x !== id)
  } else {
    selectedLeftIds.value = [...selectedLeftIds.value, id]
  }
}

const toggleSelectRight = (id: string) => {
  if (selectedRightIds.value.includes(id)) {
    selectedRightIds.value = selectedRightIds.value.filter((x) => x !== id)
  } else {
    selectedRightIds.value = [...selectedRightIds.value, id]
  }
}

const moveToRight = () => {
  if (selectedLeftIds.value.length === 0) return
  const toMove = leftItems.value.filter((item) => selectedLeftIds.value.includes(item.id))
  const remain = leftItems.value.filter((item) => !selectedLeftIds.value.includes(item.id))

  emit('update:left', remain)
  emit('update:right', [...rightItems.value, ...toMove])
  selectedLeftIds.value = []
}

const moveToLeft = () => {
  if (selectedRightIds.value.length === 0) return
  const toMove = rightItems.value.filter((item) => selectedRightIds.value.includes(item.id))
  const remain = rightItems.value.filter((item) => !selectedRightIds.value.includes(item.id))

  emit('update:right', remain)
  emit('update:left', [...leftItems.value, ...toMove])
  selectedRightIds.value = []
}

const removeLeft = (id: string) => {
  emit('remove', { side: 'left', id })
}

const removeRight = (id: string) => {
  emit('remove', { side: 'right', id })
}

// 如果外部列表发生变化，重置已选中项，避免选中已不存在的 id
watch(
  () => [leftItems.value, rightItems.value],
  () => {
    selectedLeftIds.value = []
    selectedRightIds.value = []
  }
)
</script>

<style scoped>
.transfer-wrapper {
  display: flex;
  align-items: stretch; /* 保证左右两侧等高 */
  gap: 16px;
  min-height: 260px;
}

.transfer-panel {
  flex: 1;
  min-width: 0;
  background: var(--color-bg-card);
  border-radius: 12px;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
  font-size: 13px;
  color: var(--color-text-secondary);
}

.panel-title {
  font-weight: 600;
  color: var(--color-text-primary);
}

.panel-count {
  font-size: 12px;
  color: var(--color-text-muted);
}

.panel-list {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  flex: 1;
}

.panel-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  font-size: 12px;
  color: var(--color-text-primary);
  cursor: pointer;
  border-left: 2px solid transparent;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;
}

.panel-item:hover {
  background: var(--color-bg-card-hover);
}

.panel-item.active {
  background: rgba(80, 120, 255, 0.18); /* 选中项高亮背景，更明显 */
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}

.item-remove {
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 6px;
}

.item-remove:hover {
  background: var(--color-bg-card-hover);
  color: var(--color-danger, #ff4d4f);
}

.panel-empty {
  padding: 12px;
  font-size: 12px;
  color: var(--color-text-muted);
  text-align: center;
}

.transfer-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}

.btn-transfer {
  width: 32px;
  height: 28px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background: var(--gradient-primary);
  color: #fff;
  font-weight: 600;
  box-shadow: var(--shadow-button-active);
  transition: all 0.2s ease;
}

.btn-transfer:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-transfer:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-button-hover);
}
</style>
