<script setup lang="ts" generic="T extends string | null">
import { ChevronDown } from 'lucide-vue-next'
import { useId } from 'vue'

defineProps<{
  label: string
  options: { value: T; label: string }[]
  hint?: string
}>()
const model = defineModel<T>({ required: true })
const id = useId()
</script>

<template>
  <div class="field">
    <label class="label" :for="id">{{ label }}</label>
    <div class="wrap">
      <select :id="id" v-model="model" class="select">
        <option v-for="o in options" :key="String(o.value)" :value="o.value">{{ o.label }}</option>
      </select>
      <ChevronDown :size="18" class="chevron" aria-hidden="true" />
    </div>
    <p v-if="hint" class="hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.field {
  display: grid;
  gap: var(--space-1);
}

.label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.wrap {
  position: relative;
}

.select {
  width: 100%;
  min-height: var(--tap-size);
  padding: var(--space-2) calc(var(--space-3) + 24px) var(--space-2) var(--space-3);
  appearance: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 16px;
}

.select:focus {
  outline: none;
  border-color: var(--color-accent);
}

.chevron {
  position: absolute;
  top: 50%;
  right: var(--space-3);
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
</style>
