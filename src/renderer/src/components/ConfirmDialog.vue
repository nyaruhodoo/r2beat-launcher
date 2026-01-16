<template>
  <Transition name="modal" appear>
    <div v-if="visible" class="confirm-dialog-overlay" @click.self="handleCancel">
      <div class="confirm-dialog">
        <div class="dialog-header">
          <h3 class="dialog-title">
            <span class="title-icon">⚠️</span>
            {{ title }}
          </h3>
        </div>
        <div class="dialog-content">
          <p class="dialog-message">{{ message }}</p>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-cancel" @click="handleCancel">{{ cancelText }}</button>
          <button class="btn btn-confirm" @click="handleConfirm">{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
}>()

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
.confirm-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--modal-bg-overlay);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.3s ease;
  transition:
    background var(--transition-normal),
    --modal-bg-overlay var(--transition-normal);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.confirm-dialog {
  background: var(--modal-bg);
  border-radius: 20px;
  width: 90%;
  max-width: 400px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  animation: slideUp 0.3s ease;
  transition:
    background var(--transition-normal),
    border-color var(--transition-normal),
    box-shadow var(--transition-normal),
    --modal-bg var(--transition-normal);
}

@keyframes slideUp {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.dialog-header {
  padding: 12px 24px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-card);
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
  margin: 0;
}

.title-icon {
  font-size: 20px;
}

.dialog-content {
  padding: 30px;
}

.dialog-message {
  font-size: 14px;
  color: var(--color-text-primary);
  line-height: 1.6;
  margin: 0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  padding: 12px 24px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-card);
}

.btn {
  padding: 8px 24px;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s ease;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.btn-cancel {
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--gradient-card);
    opacity: 0;
    transition: opacity var(--transition-normal);
    z-index: -1;
  }

  &:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
    background: var(--color-bg-card-hover);
  }

  &:hover:not(:disabled)::before {
    opacity: 1;
  }
}

.btn-confirm {
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-button-active);

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: var(--shadow-button-hover);
  }
}

/* 模态框过渡动画 */
.modal-enter-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .confirm-dialog {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-leave-active .confirm-dialog {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from {
  opacity: 0;
}

.modal-enter-from .confirm-dialog {
  transform: translateY(30px);
  opacity: 0;
}

.modal-enter-to {
  opacity: 1;
}

.modal-enter-to .confirm-dialog {
  transform: translateY(0);
  opacity: 1;
}

.modal-leave-from {
  opacity: 1;
}

.modal-leave-from .confirm-dialog {
  transform: translateY(0);
  opacity: 1;
}

.modal-leave-to {
  opacity: 0;
}

.modal-leave-to .confirm-dialog {
  transform: translateY(30px);
  opacity: 0;
}
</style>

