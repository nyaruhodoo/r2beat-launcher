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
    max-width="400px"
  >
    <p class="dialog-message">{{ message }}</p>
  </Modal>
</template>

<script setup lang="ts">
import Modal from './Modal.vue'

withDefaults(
  defineProps<{
    visible: boolean
    title?: string
    message: string
    confirmText?: string
    cancelText?: string
  }>(),
  {
    title: '确认',
    confirmText: '确认',
    cancelText: '取消'
  }
)

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
}
</style>
