<script setup lang="ts">
import { Minus, Plus } from 'lucide-vue-next'
import { useId } from 'vue'

const props = withDefaults(
  defineProps<{ label: string; min?: number; max?: number; hint?: string }>(),
  { min: 0, max: 999, hint: undefined },
)
const model = defineModel<number>({ required: true })
const id = useId()

function set(value: number) {
  model.value = Math.min(props.max, Math.max(props.min, Math.round(value) || 0))
}
</script>

<template>
  <div class="field">
    <label class="label" :for="id">{{ label }}</label>
    <div class="stepper">
      <button
        type="button"
        class="step"
        aria-label="Menos"
        :disabled="model <= min"
        @click="set(model - 1)"
      >
        <Minus :size="18" />
      </button>
      <input
        :id="id"
        class="value"
        type="number"
        inputmode="numeric"
        :min="min"
        :max="max"
        :value="model"
        @change="set(Number(($event.target as HTMLInputElement).value))"
      />
      <button
        type="button"
        class="step"
        aria-label="Más"
        :disabled="model >= max"
        @click="set(model + 1)"
      >
        <Plus :size="18" />
      </button>
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

.stepper {
  display: flex;
  width: fit-content;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  overflow: hidden;
}

.step {
  display: grid;
  place-items: center;
  width: var(--tap-size);
  height: var(--tap-size);
  border: 0;
  background: transparent;
}

.step:disabled {
  opacity: 0.35;
}

.value {
  width: 64px;
  border: 0;
  border-inline: 1px solid var(--color-border);
  background: transparent;
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  appearance: textfield;
}

.value::-webkit-inner-spin-button,
.value::-webkit-outer-spin-button {
  appearance: none;
}

.hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
</style>
