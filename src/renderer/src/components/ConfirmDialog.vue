<template>
  <Modal
    :visible="visible"
    :title="title"
    title-icon="⚠️"
    :confirm-text="confirmText"
    :cancel-text="cancelText"
    @close="handleCancel"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  >
    <div v-if="content" class="dialog-message dialog-message--custom">
      <component :is="renderCustomContent" />
    </div>
    <p v-else class="dialog-message">{{ message }}</p>
  </Modal>
</template>

<script setup lang="ts">
import { computed, h, Fragment, type VNode } from 'vue'
import Modal from './Modal.vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    title?: string
    /** 纯文本正文（未传 content 时使用） */
    message?: string
    /** 自定义正文，返回 VNode 或 VNode 数组（优先级高于 message） */
    content?: () => VNode | VNode[]
    confirmText?: string
    cancelText?: string
  }>(),
  {
    title: '确认',
    message: '',
    confirmText: '确认',
    cancelText: '取消',
  },
)

const renderCustomContent = computed(() => {
  if (!props.content) {
    return () => null
  }
  return () => {
    const r = props.content!()
    return Array.isArray(r) ? h(Fragment, null, r) : r
  }
})

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.dialog-message {
  font-size: 14px;
  color: var(--color-text-primary);
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
}

.dialog-message--custom {
  white-space: normal;
}
</style>
