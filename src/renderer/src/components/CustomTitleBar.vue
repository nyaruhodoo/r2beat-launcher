<template>
  <div class="custom-title-bar">
    <div class="title-bar-drag-region">
      <div class="title-content">
        <slot name="title">
          <span class="title-icon">
            <img :src="icon" alt="" />
          </span>
          <span class="title-text">{{ title ?? 'R2Beat Launcher' }}</span>
        </slot>
      </div>
    </div>
    <div class="title-bar-nav">
      <slot name="nav" />
    </div>
    <div class="title-bar-controls">
      <button class="control-btn minimize-btn" title="最小化" @click="handleMinimize">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 6H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
      <button class="control-btn close-btn" title="关闭" @click="handleClose">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M1 1L11 11M11 1L1 11"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  type?: 'detail'
  title?: string
}>()

import icon from '@renderer/assets/imgs/game.ico'
import { ipcEmitter } from '@renderer/ipc'

const handleMinimize = () => {
  if (props.type === 'detail') {
    ipcEmitter.send('window-minimize-current')
  } else {
    ipcEmitter.send('window-minimize')
  }
}

const handleClose = () => {
  if (props.type === 'detail') {
    ipcEmitter.send('window-close-current')
  } else {
    ipcEmitter.send('window-close')
  }
}
</script>

<style scoped>
.custom-title-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: var(--color-bg-card);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 10000;
  -webkit-app-region: drag;
  user-select: none;
  transition:
    background var(--transition-normal),
    border-color var(--transition-normal);

  border-radius: var(--border-radius-app) var(--border-radius-app) 0 0;
  overflow: hidden;
}

.title-bar-drag-region {
  flex: 1;
  display: flex;
  align-items: center;
  padding-left: 15px;
  height: 100%;
  -webkit-app-region: drag;

  @media (platform: mac) {
    padding-left: 80px; /* 为 macOS 的交通灯按钮留出空间 */
  }
}

.title-content {
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.title-icon {
  font-size: 0;
  animation: float 3s ease-in-out infinite;

  img {
    width: 20px;
  }
}

.title-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-primary);
  text-shadow: var(--text-shadow-primary);
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-2px);
  }
}

.title-bar-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 100%;
  padding: 0 10px;
  -webkit-app-region: no-drag;
}

.title-bar-nav :deep(.nav-btn) {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  color: var(--color-text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  outline: none;

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: none;
  }

  img {
    width: 16px;
    height: 16px;
  }
}

.title-bar-nav :deep(.nav-btn:hover) {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-hover);
  color: var(--color-primary);
  transform: translateY(-1px);
}

.title-bar-nav :deep(.nav-btn:active) {
  transform: translateY(0);
}

.title-bar-nav :deep(.nav-icon) {
  font-size: 14px;
}

.title-bar-nav :deep(.nav-text) {
  font-size: 12px;
}

.title-bar-nav :deep(.dropdown-icon) {
  color: var(--color-text-tertiary);
  transition: transform 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  margin-left: 4px;

  &.rotated {
    transform: rotate(180deg);
  }
}

.title-bar-controls {
  display: flex;
  align-items: center;
  height: 100%;
  -webkit-app-region: no-drag;
}

.control-btn {
  width: 46px;
  height: 40px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  position: relative;
  outline: none;

  @media (platform: windows) {
    width: 46px;
  }

  &:hover {
    background: var(--color-bg-card-hover);
    color: var(--color-primary);
  }

  &:active {
    background: var(--color-bg-card);
  }

  &:focus {
    outline: none;
  }

  &:focus-visible {
    outline: none;
  }

  svg {
    pointer-events: none;
  }

  &.close-btn:hover {
    background: var(--color-error-hover-bg);
    color: var(--color-error);
  }
}
</style>
