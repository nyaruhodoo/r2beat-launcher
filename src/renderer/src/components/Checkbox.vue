<template>
  <label class="checkbox-wrapper">
    <input
      :checked="modelValue"
      type="checkbox"
      class="checkbox-input"
      :disabled="disabled"
      @change="handleChange"
    />
    <span class="checkbox-text">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean
    label?: string
    disabled?: boolean
  }>(),
  {
    disabled: false
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const handleChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}
</script>

<style scoped>
.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
  position: relative;
  transition: all var(--transition-normal);
  padding: 10px 15px;
  border-radius: 8px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);

  &:hover {
    background: var(--color-bg-card-hover);

    .checkbox-text {
      color: var(--color-text-primary);
    }
  }

  &:active {
    transform: scale(0.98);
  }

  &:has(.checkbox-input:disabled) {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .checkbox-input {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--color-primary);
    transition: all var(--transition-normal);
    position: relative;
    flex-shrink: 0;

    &:hover {
      transform: scale(1.1);
    }

    &:checked {
      transform: scale(1.05);
    }

    &:disabled {
      cursor: not-allowed;
    }
  }

  .checkbox-text {
    font-size: 14px;
    color: var(--color-text-secondary);
    transition: color var(--transition-normal);
  }
}
</style>
