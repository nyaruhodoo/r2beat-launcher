<template>
  <div class="user-info-wrapper">
    <div v-if="userInfo" class="user-info" @click.stop="toggleMenu">
      <span class="user-name">{{ userInfo.remark || userInfo.remark }}</span>
      <div class="dropdown-icon" :class="{ rotated: showMenu }">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
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

    <!-- 用户菜单 -->
    <div v-if="userInfo && showMenu" v-click-outside="closeMenu" class="user-menu" @click.stop>
      <div class="menu-item" @click.stop="handleSwitchAccount">
        <span class="menu-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1V4M8 4L5 1M8 4L11 1M4 5V11.5C4 12.3284 4.67157 13 5.5 13H10.5C11.3284 13 12 12.3284 12 11.5V5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path d="M2 8H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </span>
        <span class="menu-text">切换账号</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UserInfo } from '@types'
import { ref } from 'vue'

defineProps<{
  userInfo?: UserInfo
}>()

const emit = defineEmits<{
  (e: 'login-click'): void
  (e: 'logout'): void
  (e: 'switch-account'): void
  (e: 'show-logout-confirm'): void
}>()

const showMenu = ref(false)

// 点击外部关闭菜单的指令
const vClickOutside = {
  mounted(el: HTMLElement & { clickOutsideEvent?: (event: MouseEvent) => void }, binding) {
    el.clickOutsideEvent = (event: MouseEvent) => {
      const target = event.target as Node
      // 检查点击是否在菜单内部或用户信息区域内
      const userInfoWrapper = el.closest('.user-info-wrapper')
      if (userInfoWrapper && userInfoWrapper.contains(target)) {
        return // 点击在用户信息区域内，不关闭菜单
      }
      // 点击在外部，关闭菜单
      binding.value()
    }
    // 使用捕获阶段，确保在其他事件之前执行
    document.addEventListener('click', el.clickOutsideEvent, true)
  },
  unmounted(el: HTMLElement & { clickOutsideEvent?: (event: MouseEvent) => void }) {
    if (el.clickOutsideEvent) {
      document.removeEventListener('click', el.clickOutsideEvent, true)
    }
  }
}

const toggleMenu = () => {
  showMenu.value = !showMenu.value
}

const closeMenu = () => {
  showMenu.value = false
}

const handleLoginClick = () => {
  emit('login-click')
}

const handleSwitchAccount = () => {
  closeMenu()
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
  gap: 6px;
  padding: 4px 10px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  height: 28px;
}

.user-info:hover {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-hover);
  color: var(--color-primary);
  transform: translateY(-1px);
}

.user-info:active {
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
  line-height: 1;
  transition: color 0.2s ease;
}

.user-info:hover .user-name {
  color: var(--color-primary);
}

.dropdown-icon {
  color: var(--color-text-tertiary);
  transition: transform 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 12px;
  height: 12px;
}

.dropdown-icon.rotated {
  transform: rotate(180deg);
}

.user-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  min-width: 160px;
  z-index: 1000;
  overflow: hidden;
  animation: slideDown 0.2s ease;
  transition:
    background var(--transition-normal),
    border-color var(--transition-normal),
    box-shadow var(--transition-normal);
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: var(--color-text-primary);
  position: relative;
}

.menu-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--gradient-primary);
  transform: scaleY(0);
  transition: transform 0.2s ease;
}

.menu-item:hover {
  background: var(--color-bg-card-hover);
  color: var(--color-primary);
}

.menu-item:hover::before {
  transform: scaleY(1);
}

.menu-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: var(--color-text-secondary);
  transition: color 0.2s ease;
}

.menu-item:hover .menu-icon {
  color: var(--color-primary);
}

.menu-text {
  font-size: 14px;
  font-weight: 500;
  flex: 1;
}

.menu-divider {
  height: 1px;
  background: var(--color-border);
  margin: 4px 0;
}

.login-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
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
