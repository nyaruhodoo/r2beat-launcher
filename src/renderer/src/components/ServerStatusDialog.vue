<template>
  <Transition name="modal" appear>
    <div v-if="visible" class="server-status-dialog-overlay" @click.self="handleCancel">
      <div class="server-status-dialog">
        <div class="dialog-header">
          <h3 class="dialog-title">
            <span class="title-icon">⚠️</span>
            服务端状态异常
          </h3>
          <button class="close-btn" @click="handleCancel">✕</button>
        </div>
        <div class="dialog-content">
          <p class="dialog-message">当前服务端状态异常，可能无法正常登录游戏，请选择处理方式</p>
        </div>
        <div class="dialog-footer">
          <button class="btn btn-option" @click="handleContinue">
            <span class="btn-icon">🚀</span>
            <span>继续登录</span>
          </button>
          <button class="btn btn-option" @click="handleAutoLogin">
            <span class="btn-icon">⏰</span>
            <span>服务端正常后自动登录</span>
          </button>
          <button class="btn btn-cancel" @click="handleCancel">取消</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'continue'): void
  (e: 'auto-login'): void
  (e: 'cancel'): void
}>()

const handleContinue = () => {
  emit('continue')
}

const handleAutoLogin = () => {
  emit('auto-login')
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped>
.server-status-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-overlay);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  animation: fadeIn 0.3s ease;
  transition: background var(--transition-normal);
}

:global(.light-theme) .server-status-dialog-overlay {
  background: var(--color-overlay-light);
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.server-status-dialog {
  background: var(--color-bg-secondary);
  border-radius: 20px;
  width: 90%;
  max-width: 480px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  animation: slideUp 0.3s ease;
  transition:
    background var(--transition-normal),
    border-color var(--transition-normal),
    box-shadow var(--transition-normal);
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
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.close-btn {
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.close-btn:hover {
  background: var(--color-bg-card-hover);
  color: var(--color-primary);
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
  flex-direction: column;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-card);
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  font-size: 16px;
}

.btn-option {
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-button-active);
}

.btn-option:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-button-hover);
}

.btn-cancel {
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  border: 1.5px solid var(--color-border);
  position: relative;
  overflow: hidden;
}

.btn-cancel::before {
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

.btn-cancel:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-bg-card-hover);
}

.btn-cancel:hover:not(:disabled)::before {
  opacity: 1;
}

/* 模态框过渡动画 */
.modal-enter-active {
  transition: opacity 0.3s ease;
}

.modal-enter-active .server-status-dialog {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-leave-active .server-status-dialog {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.modal-enter-from {
  opacity: 0;
}

.modal-enter-from .server-status-dialog {
  transform: translateY(30px);
  opacity: 0;
}

.modal-enter-to {
  opacity: 1;
}

.modal-enter-to .server-status-dialog {
  transform: translateY(0);
  opacity: 1;
}

.modal-leave-from {
  opacity: 1;
}

.modal-leave-from .server-status-dialog {
  transform: translateY(0);
  opacity: 1;
}

.modal-leave-to {
  opacity: 0;
}

.modal-leave-to .server-status-dialog {
  transform: translateY(30px);
  opacity: 0;
}
</style>
