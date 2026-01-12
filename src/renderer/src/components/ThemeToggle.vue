<template>
  <button
    class="theme-toggle"
    :title="props.theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'"
    @click="props.toggleTheme"
  >
    <span v-if="props.theme !== 'dark'" class="theme-icon">☀️</span>
    <span v-else class="theme-icon">🌙</span>
  </button>
</template>

<script setup lang="ts">
import { Theme } from '@types'

interface Props {
  theme?: Theme
  toggleTheme: () => void
}

const props = defineProps<Props>()
</script>

<style scoped>
.theme-toggle {
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
}

.theme-toggle:hover {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-hover);
  color: var(--color-primary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.theme-toggle:active {
  transform: translateY(0);
}

.theme-icon {
  font-size: 14px;
  transition: transform 0.3s ease;
}

.theme-toggle:hover .theme-icon {
  transform: rotate(15deg);
}

.theme-text {
  font-size: 12px;
}
</style>
