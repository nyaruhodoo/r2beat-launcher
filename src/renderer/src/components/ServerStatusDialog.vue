<template>
  <Modal
    :visible="visible"
    title="服务端状态异常"
    title-icon="⚠️"
    max-width="480px"
    cancel-text="取消"
    confirm-text="继续登录"
    @close="handleCancel"
    @confirm="handleContinue"
    @cancel="handleCancel"
  >
    <p class="dialog-message">当前服务端状态异常，可能无法正常登录游戏，请选择处理方式</p>
  </Modal>
</template>

<script setup lang="ts">
import Modal from './Modal.vue'

defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'continue'): void
  (e: 'cancel'): void
}>()

const handleContinue = () => {
  emit('continue')
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
