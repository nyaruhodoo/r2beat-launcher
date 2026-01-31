<template>
  <div class="user-info-wrapper">
    <div v-if="userInfo" class="user-info" @click.stop="handleSwitchAccount">
      <span class="user-name">{{ userInfo.remark || userInfo.username }}</span>
    </div>
    <button v-else class="login-btn" @click="handleLoginClick">
      <span class="login-icon">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 1V7M7 7L4 4M7 7L10 4M3 5V11.5C3 12.0523 3.44772 12.5 4 12.5H10C10.5523 12.5 11 12.0523 11 11.5V5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="login-text">登录</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { UserInfo } from '@types'

defineProps<{
  userInfo?: UserInfo
}>()

const emit = defineEmits<{
  (e: 'login-click'): void
  (e: 'logout'): void
  (e: 'switch-account'): void
  (e: 'show-logout-confirm'): void
}>()

const handleLoginClick = () => {
  emit('login-click')
}

const handleSwitchAccount = () => {
  emit('switch-account')
}
</script>

<style scoped>
.user-info-wrapper {
  position: relative;
}

.user-info {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  height: 28px;

  &:hover {
    background: var(--color-bg-card-hover);
    border-color: var(--color-border-hover);
    color: var(--color-primary);
    transform: translateY(-1px);

    .user-name {
      color: var(--color-primary);
    }
  }

  &:active {
    transform: translateY(0);
  }

  .user-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
    transition: color 0.2s ease;
  }
}

.login-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--gradient-primary);
  border: none;
  border-radius: 20px;
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
  box-shadow: var(--shadow-button-active);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: var(--gradient-shine);
    transition: left 0.5s ease;
  }

  &:hover::before {
    left: 100%;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-button-hover);
  }

  &:active {
    transform: translateY(0);
    box-shadow: var(--shadow-button-active);
  }
}

.login-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.login-text {
  font-size: 13px;
  font-weight: 600;
}
</style>
