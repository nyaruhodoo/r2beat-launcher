<template>
  <div ref="selectRef" class="custom-select-wrapper">
    <div class="custom-select-trigger" @click.stop="toggleDropdown">
      <span class="custom-select-value">{{ selectedLabel }}</span>
      <div class="custom-select-arrow" :class="{ rotated: isOpen }">
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
    <Transition name="dropdown">
      <div v-if="isOpen" class="custom-select-dropdown" @click.stop>
        <div
          v-for="(option, index) in options"
          :key="index"
          class="custom-select-option"
          :class="{ active: isEqual(modelValue, option.value) }"
          @click="selectOption(option)"
        >
          {{ option.label }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import useEventListener from 'vue-hooks-plus/lib/useEventListener'

interface SelectOption {
  value: unknown
  label: string
}

const props = defineProps<{
  modelValue: unknown
  options: SelectOption[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: unknown): void
}>()

const isOpen = ref(false)
const selectRef = ref<HTMLElement>()

// 深度比较函数，用于判断数组是否相等
const isEqual = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((val, idx) => val === b[idx])
  }
  return a === b
}

const selectedLabel = computed(() => {
  const option = props.options.find((opt) => isEqual(opt.value, props.modelValue))
  if (option) return option.label
  // 如果是数组，显示格式化的分辨率
  if (Array.isArray(props.modelValue)) {
    return `${props.modelValue[0]} × ${props.modelValue[1]}`
  }
  return String(props.modelValue)
})

const selectOption = (option: SelectOption) => {
  emit('update:modelValue', option.value)
  isOpen.value = false
}

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const closeDropdown = () => {
  isOpen.value = false
}

useEventListener('click', (event) => {
  if (selectRef.value && !selectRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
})
</script>

<style scoped>
.custom-select-wrapper {
  position: relative;
  width: 100%;
}

.custom-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 15px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  color: var(--color-text-primary);
  font-size: 14px;
  cursor: pointer;
  transition: all var(--transition-normal);
  min-height: 44px;

  &:hover {
    background: var(--color-bg-card-hover);
    border-color: var(--color-primary);
  }
}

.custom-select-value {
  flex: 1;
  text-align: left;
}

.custom-select-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  transition: transform var(--transition-normal);
  margin-left: 10px;
  flex-shrink: 0;

  &.rotated {
    transform: rotate(180deg);
  }
}

.custom-select-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: var(--color-bg-secondary);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  z-index: 1001;
  overflow: hidden;
  max-height: 180px;
  overflow-y: auto;
  transform-origin: top center;
  will-change: transform, opacity;
  transition:
    background var(--transition-normal),
    border-color var(--transition-normal),
    box-shadow var(--transition-normal);

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
    transition: background var(--transition-normal);

    &:hover {
      background: var(--color-border-hover);
    }
  }
}

.custom-select-option {
  padding: 8px 15px;
  cursor: pointer;
  transition: all var(--transition-normal);
  color: var(--color-text-primary);
  font-size: 13px;
  position: relative;
  line-height: 1.5;

  &:hover,
  &.active {
    background: var(--color-bg-card-hover);
    color: var(--color-text-primary);
  }

  &.active {
    font-weight: 500;
  }
}

/* 下拉动画 - 使用 transition 而不是 animation 来避免闪烁 */
.dropdown-enter-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.dropdown-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}

.dropdown-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.dropdown-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
}
</style>
