<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ label: string; hint?: string }>()
const model = defineModel<boolean>({ required: true })
const id = useId()
</script>

<template>
  <div class="switch-field">
    <label :for="id" class="text">
      <span class="label">{{ label }}</span>
      <span v-if="hint" class="hint">{{ hint }}</span>
    </label>
    <input :id="id" v-model="model" class="switch" type="checkbox" role="switch" />
  </div>
</template>

<style scoped>
.switch-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.text {
  display: grid;
}

.label {
  font-weight: 600;
}

.hint {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.switch {
  position: relative;
  flex: none;
  width: 52px;
  height: 32px;
  margin: 0;
  appearance: none;
  border-radius: 999px;
  background: var(--color-border);
  transition: background-color 0.15s;
}

.switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 25%);
  transition: transform 0.15s;
}

.switch:checked {
  background: var(--color-accent);
}

.switch:checked::after {
  transform: translateX(20px);
}
</style>
