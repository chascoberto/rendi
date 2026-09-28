<script setup lang="ts">
import { normalizeSearch, type FoodStance } from '@rendi/shared'
import { Plus, ThumbsDown, ThumbsUp } from 'lucide-vue-next'
import { computed, ref, useId } from 'vue'
import { errorMessage } from '@/lib/api'
import { useFoodSearch } from '@/features/catalog/queries'
import { useFoodPrefMutations } from './queries'

const props = defineProps<{ memberId: string; existing: string[] }>()

const { add } = useFoodPrefMutations(() => props.memberId)
const name = ref('')
const inputId = useId()
const { data } = useFoodSearch(name)

const existingSet = computed(() => new Set(props.existing))
/** Alimentos ya conocidos que calzan con lo escrito (sin repetir el que ya está escrito tal cual). */
const suggestions = computed(() => {
  const typed = normalizeSearch(name.value)
  if (!typed) return []
  return (data.value?.foods ?? []).filter((f) => normalizeSearch(f.name) !== typed).slice(0, 4)
})

function submit(stance: FoodStance) {
  const foodName = name.value.trim()
  if (!foodName) return
  add.mutate({ foodName, stance }, { onSuccess: () => (name.value = '') })
}
</script>

<template>
  <div class="adder">
    <label class="label" :for="inputId">Agregar alimento</label>
    <input
      :id="inputId"
      v-model="name"
      class="input"
      placeholder="Ej: brócoli, arroz, pescado…"
      autocomplete="off"
      enterkeyhint="done"
    />
    <!-- En el flujo normal (no flotante): nunca tapa los botones Acepta/Rechaza. -->
    <ul v-if="suggestions.length" class="suggestions" aria-label="Alimentos conocidos">
      <li v-for="food in suggestions" :key="food.id">
        <button type="button" class="suggestion" @click="name = food.name">
          {{ food.name }}
          <span v-if="existingSet.has(food.id)" class="already">· ya está</span>
        </button>
      </li>
    </ul>
    <div class="actions">
      <button
        type="button"
        class="stance stance--accepts"
        :disabled="!name.trim() || add.isPending.value"
        @click="submit('accepts')"
      >
        <ThumbsUp :size="18" /> Acepta
      </button>
      <button
        type="button"
        class="stance stance--rejects"
        :disabled="!name.trim() || add.isPending.value"
        @click="submit('rejects')"
      >
        <ThumbsDown :size="18" /> Rechaza
      </button>
    </div>
    <p v-if="add.isError.value" class="error">{{ errorMessage(add.error.value) }}</p>
    <p v-else class="hint"><Plus :size="12" /> Si el alimento no existe, se crea.</p>
  </div>
</template>

<style scoped>
.adder {
  display: grid;
  gap: var(--space-2);
}

.label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.input {
  width: 100%;
  min-height: var(--tap-size);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 16px;
}

.input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.suggestion {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px dashed var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  font-size: 0.9rem;
}

.suggestion:active {
  background: var(--color-surface-2);
}

.already {
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.stance {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--tap-size);
  border: 0;
  border-radius: var(--radius-md);
  font-weight: 600;
}

.stance:disabled {
  opacity: 0.45;
}

.stance--accepts {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.stance--rejects {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.hint,
.error {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin: 0;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.error {
  color: var(--color-danger);
}
</style>
