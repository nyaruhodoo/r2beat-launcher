<template>
  <Dropdown :items="themeItems">
    <template #trigger="{ isOpen }">
      <button class="nav-btn">
        <img :src="sepanImg" />
        <div class="dropdown-icon" :class="{ rotated: isOpen }">
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
      </button>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Dropdown from './Dropdown.vue'
import type { DropdownItem } from './Dropdown.vue'
import sepanImg from '@renderer/assets/imgs/sepan.png'

interface Props {
  theme?: string
  toggleTheme: (theme: string) => void
}

const props = defineProps<Props>()

// 主题列表配置（包含主题色）
const themes = [
  { value: 'dark', label: '暗紫色', color: '#ffb6c1' },
  { value: 'light', label: '粉白色', color: '#ffb6c1' },
  { value: 'xiaocilan', label: '小辞蓝', color: '#7ed6ff' },
  { value: 'caolv', label: '草绿色', color: '#8ee4af' },
  { value: 'xixizi', label: '茜茜紫', color: '#b294ff' },
  { value: 'naihuang', label: '奶黄色', color: '#ffeaa7' },
  { value: 'qianhui', label: '浅灰色', color: '#b2bec3' },
  { value: 'xinchunhong', label: '新年红', color: '#ff4d4d' },
  { value: 'chunhei', label: '纯黑色', color: '#000' }
]

// 生成下拉菜单项
const themeItems = computed<DropdownItem[]>(() => {
  return themes.map((theme) => ({
    label: theme.label,
    color: theme.color,
    onClick: () => {
      props.toggleTheme(theme.value)
    }
  }))
})
</script>

<style scoped>
.nav-btn {
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
  transition: all 0.3s ease;
  white-space: nowrap;

  &:hover {
    background: var(--color-bg-card-hover);
    border-color: var(--color-border-hover);
    color: var(--color-primary);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }

  &:active {
    transform: translateY(0);
  }

  img {
    width: 16px;
    height: 16px;
    object-fit: contain;
  }

  .nav-text {
    font-size: 12px;
  }

  .dropdown-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s ease;
    color: var(--color-text-secondary);

    &.rotated {
      transform: rotate(180deg);
    }
  }
}
</style>
