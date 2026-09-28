<script setup lang="ts">
import { normalizeSearch } from '@rendi/shared'
import { computed } from 'vue'
import TextField from '@/components/ui/TextField.vue'
import { useFoodSearch } from './queries'

const model = defineModel<string>({ required: true })
const { data } = useFoodSearch(model)

/** Alimentos conocidos que calzan con lo escrito, sin repetir el que ya está escrito tal cual. */
const suggestions = computed(() => {
  const typed = normalizeSearch(model.value)
  if (!typed) return []
  return (data.value?.foods ?? []).filter((f) => normalizeSearch(f.name) !== typed).slice(0, 4)
})
</script>

<template>
  <div class="food-field">
    <TextField
      v-model="model"
      label="Alimento genérico"
      placeholder="Ej: leche, arroz, plátano"
      hint="Agrupa marcas y formatos: «¿hay leche?» suma todas las leches."
    />
    <ul v-if="suggestions.length" class="suggestions" aria-label="Alimentos conocidos">
      <li v-for="food in suggestions" :key="food.id">
        <button type="button" class="suggestion" @click="model = food.name">{{ food.name }}</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.food-field {
  display: grid;
  gap: var(--space-2);
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
</style>
