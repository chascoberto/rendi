<script setup lang="ts">
import type { ListItemCreateInput } from '@rendi/shared'
import { refDebounced } from '@vueuse/core'
import { Package, Plus, Tag, Type } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { productSubtitle } from '@/features/catalog/format'
import { useFoodSearch, useProducts } from '@/features/catalog/queries'
import { errorMessage } from '@/lib/api'
import { useAddItem } from './queries'

const text = ref('')
const debounced = refDebounced(text, 200)
const query = computed(() => debounced.value.trim())

const { data: products } = useProducts(query)
const { data: foods } = useFoodSearch(query)
const addItem = useAddItem()

/** Sugerencias solo mientras se escribe: productos del catálogo y alimentos genéricos. */
const productMatches = computed(() =>
  query.value ? (products.value?.products ?? []).slice(0, 4) : [],
)
const foodMatches = computed(() => (query.value ? (foods.value?.foods ?? []).slice(0, 3) : []))

function add(input: Partial<ListItemCreateInput>) {
  addItem.mutate(input, { onSuccess: () => (text.value = '') })
}

/** Enter agrega lo escrito como texto libre. */
function submit() {
  const freeText = text.value.trim()
  if (freeText) add({ freeText })
}
</script>

<template>
  <form class="add" @submit.prevent="submit">
    <div class="input-row">
      <input
        v-model="text"
        class="input"
        type="text"
        placeholder="Agregar a la lista"
        aria-label="Agregar a la lista"
        enterkeyhint="done"
        autocomplete="off"
      />
      <button
        type="submit"
        class="add-button"
        aria-label="Agregar"
        :disabled="!text.trim() || addItem.isPending.value"
      >
        <Plus :size="22" />
      </button>
    </div>

    <p v-if="addItem.isError.value" class="error" role="alert">
      {{ errorMessage(addItem.error.value) }}
    </p>

    <ul v-if="text.trim()" class="suggestions" aria-label="Sugerencias">
      <li v-for="p in productMatches" :key="p.id">
        <button type="button" class="suggestion" @click="add({ productId: p.id })">
          <Package :size="18" class="icon" aria-hidden="true" />
          <span class="s-main">
            <span class="s-title">{{ p.name }}</span>
            <span class="s-sub">{{ productSubtitle(p) }}</span>
          </span>
        </button>
      </li>
      <li v-for="f in foodMatches" :key="f.id">
        <button type="button" class="suggestion" @click="add({ foodId: f.id })">
          <Tag :size="18" class="icon" aria-hidden="true" />
          <span class="s-main">
            <span class="s-title">{{ f.name }}</span>
            <span class="s-sub">Cualquier marca</span>
          </span>
        </button>
      </li>
      <li>
        <button type="button" class="suggestion" @click="submit">
          <Type :size="18" class="icon" aria-hidden="true" />
          <span class="s-main">
            <span class="s-title">Agregar «{{ text.trim() }}»</span>
            <span class="s-sub">Como texto libre</span>
          </span>
        </button>
      </li>
    </ul>
  </form>
</template>

<style scoped>
.add {
  display: grid;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.input-row {
  display: flex;
  gap: var(--space-2);
}

.input {
  flex: 1;
  min-width: 0;
  min-height: 48px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: 16px;
}

.input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.add-button {
  display: grid;
  flex: none;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.add-button:disabled {
  opacity: 0.5;
}

.suggestions {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.suggestions li + li {
  border-top: 1px solid var(--color-border);
}

.suggestion {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 52px;
  padding: var(--space-2) var(--space-3);
  border: 0;
  background: transparent;
  text-align: left;
}

.suggestion:active {
  background: var(--color-surface-2);
}

.icon {
  flex: none;
  color: var(--color-text-muted);
}

.s-main {
  display: grid;
  min-width: 0;
}

.s-title {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.s-sub {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.error {
  margin: 0;
  color: var(--color-danger);
}
</style>
