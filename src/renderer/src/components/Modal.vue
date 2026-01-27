<template>
  <Transition name="modal" appear>
    <div v-if="visible" class="modal-overlay" @click.self="handleClose">
      <div class="modal-container" :style="{ maxWidth: maxWidth, maxHeight: maxHeight }">
        <!-- 标题栏 -->
        <div class="modal-header">
          <h2 class="modal-title">
            <span v-if="titleIcon" class="title-icon">{{ titleIcon }}</span>
            <slot name="header">
              {{ title }}
            </slot>
          </h2>
          <button v-if="showClose" class="close-btn" @click="handleClose">✕</button>
        </div>

        <!-- 内容区域 -->
        <div class="modal-content">
          <slot></slot>
        </div>

        <!-- 底部按钮 -->
        <div v-if="showFooter" class="modal-footer">
          <slot name="footer">
            <button
              v-if="showCancel"
              class="btn btn-cancel"
              :disabled="cancelDisabled"
              @click="handleCancel"
            >
              {{ cancelText }}
            </button>
            <button
              v-if="showConfirm"
              class="btn btn-confirm"
              :disabled="confirmDisabled"
              @click="handleConfirm"
            >
              {{ confirmText }}
            </button>
          </slot>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    visible: boolean
    title?: string
    titleIcon?: string
    confirmText?: string
    cancelText?: string
    showCancel?: boolean
    showConfirm?: boolean
    showFooter?: boolean
    showClose?: boolean
    confirmDisabled?: boolean
    cancelDisabled?: boolean
    maxWidth?: string
    maxHeight?: string
  }>(),
  {
    title: '',
    confirmText: '确认',
    cancelText: '取消',
    showCancel: true,
    showConfirm: true,
    showFooter: true,
    showClose: true,
    confirmDisabled: false,
    cancelDisabled: false,
    maxWidth: '600px',
    maxHeight: '80vh'
  }
)

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const handleClose = () => {
  emit('close')
}

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.modal-overlay {
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
  transition:
    background var(--transition-normal),
    --modal-bg-overlay var(--transition-normal);
  border-radius: var(--border-radius-app);
  overflow: hidden;
}

.modal-container {
  background: var(--modal-bg);
  border-radius: 20px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  transition:
    background var(--transition-normal),
    border-color var(--transition-normal),
    box-shadow var(--transition-normal),
    transform 0.3s ease,
    opacity 0.3s ease,
    --modal-bg var(--transition-normal);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-card);
  flex-shrink: 0;
}

.modal-title {
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

.close-btn {
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: all 0.3s ease;

  &:hover {
    background: var(--color-bg-card-hover);
    color: var(--color-primary);
  }
}

.modal-content {
  padding: 30px;
  overflow-y: auto;
  overflow-x: visible;
  flex: 1;
  min-height: 0;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--color-bg-card);
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 10px;
  }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 15px;
  padding: 12px 24px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-card);
  flex-shrink: 0;
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
  border: 1.5px solid var(--color-border);
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

.modal-enter-active .modal-container {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-leave-active .modal-container {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.modal-enter-from {
  opacity: 0;
}

.modal-enter-from .modal-container {
  transform: translateY(30px);
  opacity: 0;
}

.modal-enter-to {
  opacity: 1;
}

.modal-enter-to .modal-container {
  transform: translateY(0);
  opacity: 1;
}

.modal-leave-from {
  opacity: 1;
}

.modal-leave-from .modal-container {
  transform: translateY(0);
  opacity: 1;
}

.modal-leave-to {
  opacity: 0;
}

.modal-leave-to .modal-container {
  transform: translateY(30px);
  opacity: 0;
}
</style>
















