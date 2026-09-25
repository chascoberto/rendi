<script setup lang="ts" generic="T extends string">
defineProps<{
  options: { value: T; label: string }[]
  label: string
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="segmented" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="segment"
      :aria-checked="model === option.value"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: flex;
  padding: 3px;
  background: var(--color-surface-2);
  border-radius: var(--radius-md);
}

.segment {
  flex: 1;
  min-height: 38px;
  border: 0;
  border-radius: calc(var(--radius-md) - 3px);
  background: transparent;
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 0.9rem;
}

.segment[aria-checked='true'] {
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-1);
}
</style>
