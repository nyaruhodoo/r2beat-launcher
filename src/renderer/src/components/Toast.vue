<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-container">
      <div v-for="toast in toasts" :key="toast.id" class="toast" :class="[`toast-${toast.type}`]">
        <span class="toast-icon">{{ getIcon(toast.type) }}</span>
        <span class="toast-message">{{ toast.message }}</span>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { toasts } = useToast()

const getIcon = (type: 'success' | 'error' | 'warning' | 'info') => {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }
  return icons[type] || icons.info
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 90vw;
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  min-width: 280px;
  max-width: 500px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
  transition:
    background var(--transition-normal),
    border-color var(--transition-normal),
    box-shadow var(--transition-normal);
}

.toast-icon {
  font-size: 18px;
  flex-shrink: 0;
  line-height: 1;
}

.toast-message {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  line-height: 1.5;
  word-break: break-word;
}

.toast-success {
  border-color: var(--color-success-border);
  background: var(--color-success-bg);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);

  .toast-message {
    color: var(--color-success);
  }
}

.toast-error {
  border-color: var(--toast-error-border);
  background: var(--toast-error-bg);
  box-shadow: var(--toast-error-shadow);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  transition:
    background var(--transition-normal),
    border-color var(--transition-normal),
    box-shadow var(--transition-normal),
    --toast-error-bg var(--transition-normal),
    --toast-error-border var(--transition-normal);

  .toast-message {
    color: var(--toast-error-text);
    transition: color var(--transition-normal);
  }
}

.toast-warning {
  border-color: var(--color-warning-border);
  background: var(--color-warning-bg);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);

  .toast-message {
    color: var(--color-warning);
  }
}

.toast-info {
  border-color: var(--color-primary);
  background: var(--color-bg-card);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);

  .toast-message {
    color: var(--color-primary);
  }
}

/* 进入动画 */
.toast-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.9);
}

.toast-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* 离开动画 */
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.55, 0.06, 0.68, 0.19);
}

.toast-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

/* 移动动画 */
.toast-move {
  transition: transform 0.3s ease;
}
</style>
