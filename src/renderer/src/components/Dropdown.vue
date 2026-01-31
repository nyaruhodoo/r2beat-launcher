<template>
  <div class="dropdown-wrapper" ref="wrapperRef">
    <div ref="triggerRef" @click.stop="toggleMenu">
      <slot name="trigger" :is-open="showMenu" />
    </div>

    <!-- 下拉菜单 - 使用 Teleport 渲染到 body，避免被 overflow: hidden 裁剪 -->
    <Teleport to="body">
      <div
        v-if="showMenu"
        ref="menuRef"
        v-click-outside="closeMenu"
        class="dropdown-menu"
        :style="menuStyle"
        @click.stop
      >
        <div
          v-for="(item, index) in items"
          :key="index"
          class="menu-item"
          :class="{ disabled: item.disabled }"
          @click.stop="handleItemClick(item)"
        >
          <span v-if="item.icon" class="menu-icon">
            <img
              v-if="typeof item.icon === 'string' && (item.icon.endsWith('.png') || item.icon.endsWith('.jpg') || item.icon.endsWith('.jpeg') || item.icon.endsWith('.svg') || item.icon.endsWith('.gif') || item.icon.endsWith('.webp') || item.icon.startsWith('data:') || item.icon.startsWith('http'))"
              :src="item.icon"
              alt=""
            />
            <component :is="item.icon" v-else-if="typeof item.icon === 'object'" />
            <span v-else>{{ item.icon }}</span>
          </span>
          <span class="menu-text">{{ item.label }}</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { CSSProperties } from 'vue'

export interface DropdownItem {
  label: string
  icon?: string | object
  disabled?: boolean
  onClick?: () => void
  href?: string
  target?: string
}

const props = withDefaults(
  defineProps<{
    items: DropdownItem[]
  }>(),
  {
    items: () => []
  }
)

const showMenu = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const wrapperRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuWidth = ref<number>(0)

// 计算菜单位置
const menuStyle = computed((): CSSProperties => {
  if (!triggerRef.value || !showMenu.value) {
    return { display: 'none' }
  }

  const rect = triggerRef.value.getBoundingClientRect()
  const gap = 8 // 间距
  const menuHeight = props.items.length * 50 // 估算高度（每个菜单项约50px）

  // 使用菜单的实际宽度（如果已获取），否则使用触发按钮的宽度作为初始值
  const width = menuWidth.value > 0 ? menuWidth.value : rect.width

  // 计算右侧位置（右对齐）
  let left = rect.right - width
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

// 点击外部关闭菜单的指令
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

const handleItemClick = (item: DropdownItem) => {
  if (item.disabled) {
    return
  }

  if (item.href) {
    // 如果是链接，打开新窗口
    window.open(item.href, item.target || '_blank')
  } else if (item.onClick) {
    // 如果有点击回调，执行回调
    item.onClick()
  }

  closeMenu()
}

// 更新菜单宽度
const updateMenuWidth = () => {
  if (menuRef.value) {
    menuWidth.value = menuRef.value.offsetWidth
  }
}

// 监听菜单显示状态，更新菜单宽度
watch(showMenu, (newVal) => {
  if (!newVal) {
    menuWidth.value = 0
    return
  }

  // 使用 nextTick 确保菜单已渲染，可以获取实际宽度
  nextTick(() => {
    updateMenuWidth()
  })

  const updatePosition = () => {
    updateMenuWidth()
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
.dropdown-wrapper {
  position: relative;
}

.dropdown-menu {
  /* position 和位置由内联样式控制（通过 Teleport 渲染到 body） */
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  width: max-content;
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

  &:hover:not(.disabled) {
    background: var(--color-bg-card-hover);
    color: var(--color-primary);

    &::before {
      transform: scaleY(1);
    }

    .menu-icon {
      color: var(--color-primary);
    }
  }

  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    font-size: 16px;

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }
}

.menu-text {
  font-size: 14px;
  font-weight: 500;
  flex: 1;
}
</style>

