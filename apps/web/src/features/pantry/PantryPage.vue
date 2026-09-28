<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { ChevronRight, Package, Plus, ScanBarcode, Search } from 'lucide-vue-next'
import { ref } from 'vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { productSubtitle } from '@/features/catalog/format'
import { useCategories, useProducts } from '@/features/catalog/queries'
import { errorMessage } from '@/lib/api'

const search = ref('')
const debounced = refDebounced(search, 200)
const categoryId = ref<string | null>(null)

const { data, isPending, error } = useProducts(debounced, categoryId)
const { data: categories } = useCategories()
</script>

<template>
  <PageHeader title="Despensa">
    <template #actions>
      <RouterLink class="header-link" to="/escanear" aria-label="Escanear">
        <ScanBarcode :size="22" />
      </RouterLink>
    </template>
  </PageHeader>

  <div class="search">
    <Search :size="18" class="search-icon" aria-hidden="true" />
    <input
      v-model="search"
      class="search-input"
      type="search"
      placeholder="Buscar producto, marca o código"
      aria-label="Buscar producto"
      enterkeyhint="search"
    />
  </div>

  <div class="chips" role="radiogroup" aria-label="Categoría">
    <button
      type="button"
      role="radio"
      class="chip"
      :aria-checked="categoryId === null"
      @click="categoryId = null"
    >
      Todas
    </button>
    <button
      v-for="c in categories"
      :key="c.id"
      type="button"
      role="radio"
      class="chip"
      :aria-checked="categoryId === c.id"
      @click="categoryId = categoryId === c.id ? null : c.id"
    >
      {{ c.name }}
    </button>
  </div>

  <p v-if="error" class="error">{{ errorMessage(error) }}</p>
  <p v-else-if="isPending" class="muted">Cargando…</p>
  <template v-else-if="data">
    <EmptyState
      v-if="data.products.length === 0 && (debounced || categoryId)"
      :icon="Search"
      title="Sin resultados"
      description="Prueba con otra palabra, o crea el producto."
    />
    <EmptyState
      v-else-if="data.products.length === 0"
      :icon="Package"
      title="Aún no hay productos"
      description="Escanea un código de barras o crea un producto a mano."
    />
    <ul v-else class="list" aria-label="Productos">
      <li v-for="p in data.products" :key="p.id">
        <RouterLink class="row" :to="{ name: 'product', params: { id: p.id } }">
          <span class="row-main">
            <span class="row-title">{{ p.name }}</span>
            <span class="row-sub">{{ productSubtitle(p) }}</span>
          </span>
          <span v-if="p.stockMode === 'bulk'" class="badge">Granel</span>
          <ChevronRight :size="18" class="muted" />
        </RouterLink>
      </li>
    </ul>
  </template>

  <RouterLink class="fab" :to="{ name: 'product-new' }" aria-label="Nuevo producto">
    <Plus :size="26" />
  </RouterLink>
</template>

<style scoped>
.header-link {
  display: grid;
  place-items: center;
  width: var(--tap-size);
  height: var(--tap-size);
  border-radius: var(--radius-md);
  color: var(--color-text);
}

.search {
  position: relative;
  margin-bottom: var(--space-3);
}

.search-icon {
  position: absolute;
  top: 50%;
  left: var(--space-3);
  transform: translateY(-50%);
  color: var(--color-text-muted);
}

.search-input {
  width: 100%;
  min-height: 48px;
  padding: 0 var(--space-3) 0 calc(var(--space-3) + 26px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: 16px;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.chips {
  display: flex;
  gap: var(--space-2);
  margin: 0 calc(-1 * var(--space-4)) var(--space-3);
  padding: 0 var(--space-4) var(--space-1);
  overflow-x: auto;
  scrollbar-width: none;
}

.chip {
  flex: none;
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  font-size: 0.9rem;
  white-space: nowrap;
}

.chip[aria-checked='true'] {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  color: var(--color-accent);
  font-weight: 600;
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.list li + li {
  border-top: 1px solid var(--color-border);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 60px;
  padding: var(--space-2) var(--space-4);
  color: inherit;
  text-decoration: none;
}

.row:active {
  background: var(--color-surface-2);
}

.row-main {
  display: grid;
  flex: 1;
  min-width: 0;
}

.row-title {
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-sub {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.badge {
  padding: 2px var(--space-2);
  border-radius: 999px;
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.fab {
  position: fixed;
  right: max(var(--space-4), calc(50% - 320px + var(--space-4)));
  bottom: calc(env(safe-area-inset-bottom) + 88px);
  z-index: 15;
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  box-shadow: 0 6px 16px rgb(0 0 0 / 20%);
}

.muted {
  color: var(--color-text-muted);
}

.error {
  color: var(--color-danger);
}
</style>
