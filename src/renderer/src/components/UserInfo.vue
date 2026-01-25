<template>
  <div class="user-info-wrapper">
    <div v-if="userInfo" ref="triggerRef" class="user-info" @click.stop="toggleMenu">
      <span class="user-name">{{ userInfo.remark || userInfo.username }}</span>
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

    <!-- 用户菜单 - 使用 Teleport 渲染到 body，避免被 overflow: hidden 裁剪 -->
    <Teleport to="body">
      <div
        v-if="userInfo && showMenu"
        v-click-outside="closeMenu"
        class="user-menu"
        :style="menuStyle"
        @click.stop
      >
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
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { UserInfo } from '@types'
import { ref, computed, watch } from 'vue'
import type { CSSProperties } from 'vue'

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
const triggerRef = ref<HTMLElement | null>(null)

// 计算菜单位置
const menuStyle = computed((): CSSProperties => {
  if (!triggerRef.value || !showMenu.value) {
    return { display: 'none' }
  }

  const rect = triggerRef.value.getBoundingClientRect()
  const menuWidth = 160 // min-width
  const menuHeight = 50 // 估算高度
  const gap = 8 // 间距

  // 计算右侧位置（右对齐）
  let left = rect.right - menuWidth
  // 如果菜单会超出屏幕左侧，则左对齐
  if (left < 0) {
    left = rect.left
  }

  // 计算顶部位置（在按钮下方）
  let top = rect.bottom + gap
  // 如果菜单会超出屏幕底部，则显示在按钮上方
  if (top + menuHeight > window.innerHeight) {
    top = rect.top - menuHeight - gap
  }

  return {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    zIndex: 10001 // 确保在 CustomTitleBar (z-index: 10000) 之上
  }
})

// 点击外部关闭菜单的指令（更新以支持 Teleport）
const vClickOutside = {
  mounted(el: HTMLElement & { clickOutsideEvent?: (event: MouseEvent) => void }, binding) {
    el.clickOutsideEvent = (event: MouseEvent) => {
      const target = event.target as Node
      // 检查点击是否在菜单内部
      if (el.contains(target)) {
        return
      }
      // 检查点击是否在触发按钮区域内
      if (triggerRef.value && triggerRef.value.contains(target)) {
        return
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

// 监听窗口大小变化和滚动，更新菜单位置
watch(showMenu, (newVal) => {
  if (!newVal) return

  const updatePosition = () => {
    // menuStyle 是 computed，会自动更新
    // 这里只是触发重新计算
  }

  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)

  // 返回清理函数
  return () => {
    window.removeEventListener('resize', updatePosition)
    window.removeEventListener('scroll', updatePosition, true)
  }
})
</script>

<style scoped>
.user-info-wrapper {
  position: relative;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
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

  .dropdown-icon {
    color: var(--color-text-tertiary);
    transition: transform 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 12px;
    height: 12px;

    &.rotated {
      transform: rotate(180deg);
    }
  }
}

.user-menu {
  /* position 和位置由内联样式控制（通过 Teleport 渲染到 body） */
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  min-width: 160px;
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

  &::before {
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

  &:hover {
    background: var(--color-bg-card-hover);
    color: var(--color-primary);

    &::before {
      transform: scaleY(1);
    }

    .menu-icon {
      color: var(--color-primary);
    }
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
