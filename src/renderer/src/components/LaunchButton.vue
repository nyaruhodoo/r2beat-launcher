<template>
  <div class="launch-button-container">
    <button
      class="launch-btn"
      :class="{ launching: isLaunching, disabled: isDisabled }"
      :disabled="isDisabled"
      @click="handleLaunch"
    >
      <span v-if="!isLaunching" class="btn-icon">🚀</span>
      <span v-else class="btn-icon loading">⏳</span>
      <span class="btn-text">{{ isLaunching ? '启动中...' : '启动游戏' }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { GameSettings, UserInfo } from '@types'
import { ref } from 'vue'
import { useToast } from '../composables/useToast'

interface Props {
  userInfo?: UserInfo
  gameSettings?: GameSettings
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'login-required'): void
}>()

const isLaunching = ref(false)
const isDisabled = ref(false)

// Toast 提示
const { error: showError, success: showSuccess } = useToast()

const handleLaunch = async () => {
  if (isLaunching.value || isDisabled.value) return

  // 检查登录状态
  if (!props.userInfo) {
    emit('login-required')
    return
  }

  // 使用传入的 gameSettings
  const latestSettings = props.gameSettings

  // 检查游戏路径是否设置
  if (!latestSettings?.gamePath || latestSettings.gamePath.trim() === '') {
    showError('请先在设置中配置游戏安装目录')
    return
  }

  isLaunching.value = true
  isDisabled.value = true

  try {
    const result = await window.api.launchGame?.(
      latestSettings.gamePath,
      latestSettings.launchArgs || undefined,
      latestSettings.closeOnLaunch || false,
      latestSettings.processPriority || 'normal',
      latestSettings.lowerNPPriority || false
    )

    if (result?.success) {
      showSuccess('游戏启动成功！')
    } else {
      showError(result?.error || '启动游戏失败', 5000)
    }
  } catch (error) {
    if (error instanceof Error) {
      showError(error.message || '启动游戏失败', 5000)
    }
  } finally {
    isLaunching.value = false
    isDisabled.value = false
  }
}
</script>

<style scoped>
.launch-button-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.launch-btn {
  position: relative;
  padding: 18px 60px;
  font-size: 20px;
  font-weight: 700;
  color: white;
  background: var(--gradient-primary-dark);
  border: none;
  border-radius: 30px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-lg);
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  min-width: 200px;
  justify-content: center;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: var(--gradient-shine-light);
    transition: left 0.5s;
  }

  &:hover::before {
    left: 100%;
  }

  &:hover:not(.disabled):not(.launching) {
    transform: translateY(-3px) scale(1.05);
    box-shadow: 0 12px 40px rgba(255, 107, 157, 0.6);
  }

  &:active:not(.disabled):not(.launching) {
    transform: translateY(-1px) scale(1.02);
  }

  &.launching {
    background: var(--gradient-primary);
    cursor: wait;
    animation: pulse-glow 2s ease-in-out infinite;
  }

  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-icon {
    font-size: 24px;
    display: inline-block;

    &.loading {
      animation: spin 1s linear infinite;
    }
  }

  .btn-text {
    position: relative;
    z-index: 1;
  }
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: var(--shadow-lg);
  }
  50% {
    box-shadow: 0 8px 40px rgba(255, 182, 193, 0.8);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
