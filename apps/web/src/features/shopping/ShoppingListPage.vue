<script setup lang="ts">
import { useOnline } from '@vueuse/core'
import { ListChecks, ShoppingBag, Trash2, WifiOff } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import NumberStepper from '@/components/ui/NumberStepper.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import TextField from '@/components/ui/TextField.vue'
import { useMe } from '@/features/auth/queries'
import { useCategories } from '@/features/catalog/queries'
import { errorMessage } from '@/lib/api'
import AddItemForm from './AddItemForm.vue'
import { enqueueCheck, pendingChecks } from './checkQueue'
import FinalizeSheet from './FinalizeSheet.vue'
import ListItemRow from './ListItemRow.vue'
import { type ListItem, useDeleteItem, useShoppingList, useUpdateItem } from './queries'

const { items, isPending, error } = useShoppingList()
const { data: categories } = useCategories()
const { data: me } = useMe()
const online = useOnline()
const pendingCount = computed(() => Object.keys(pendingChecks.value).length)

/** Lo que falta, agrupado por categoría (en el orden del supermercado); lo marcado, al final. */
const groups = computed(() => {
  const open = (items.value ?? []).filter((i) => !i.checked)
  const order = [...(categories.value ?? []).map((c) => ({ id: c.id, name: c.name }))]
  const sections = order
    .map((c) => ({ ...c, items: open.filter((i) => i.categoryId === c.id) }))
    .filter((s) => s.items.length > 0)
  const known = new Set(order.map((c) => c.id))
  const rest = open.filter((i) => !i.categoryId || !known.has(i.categoryId))
  if (rest.length) sections.push({ id: 'sin-categoria', name: 'Otros', items: rest })
  return sections
})

const inCart = computed(() =>
  (items.value ?? []).filter((i) => i.checked).sort((a, b) => a.name.localeCompare(b.name, 'es')),
)
const mine = computed(() => inCart.value.filter((i) => i.checkedBy?.userId === me.value?.userId))

function toggle(item: ListItem) {
  enqueueCheck(item.id, !item.checked)
}

// Edición de un ítem: cantidad, nota o quitarlo.
const updateItem = useUpdateItem()
const deleteItem = useDeleteItem()
const editing = ref<ListItem | null>(null)
const form = ref({ quantity: 0, note: '' })
const editError = computed(() => updateItem.error.value ?? deleteItem.error.value)

function openItem(item: ListItem) {
  updateItem.reset()
  deleteItem.reset()
  editing.value = item
  form.value = { quantity: item.quantity ?? 0, note: item.note ?? '' }
}

const sheetOpen = computed({
  get: () => editing.value !== null,
  set: (open) => {
    if (!open) editing.value = null
  },
})

function saveItem() {
  if (!editing.value) return
  updateItem.mutate(
    {
      id: editing.value.id,
      input: { quantity: form.value.quantity || null, note: form.value.note },
    },
    { onSuccess: () => (editing.value = null) },
  )
}

function removeItem() {
  if (!editing.value) return
  deleteItem.mutate(editing.value.id, { onSuccess: () => (editing.value = null) })
}

const finalizing = ref(false)
</script>

<template>
  <PageHeader title="Lista de compras" />

  <p v-if="!online" class="banner" role="status">
    <WifiOff :size="18" aria-hidden="true" />
    <span>
      Sin conexión. Puedes marcar y desmarcar; se sincroniza al volver la señal.
      <template v-if="pendingCount"> ({{ pendingCount }} sin sincronizar)</template>
    </span>
  </p>

  <AddItemForm />

  <p v-if="error && !items" class="error">{{ errorMessage(error) }}</p>
  <p v-else-if="isPending" class="muted">Cargando…</p>
  <EmptyState
    v-else-if="items && items.length === 0"
    :icon="ListChecks"
    title="La lista está vacía"
    description="Lo que baje del mínimo se agrega solo. También puedes agregar a mano."
  />
  <template v-else>
    <section v-for="g in groups" :key="g.id" class="group" :aria-labelledby="`cat-${g.id}`">
      <h2 :id="`cat-${g.id}`" class="group-title">{{ g.name }}</h2>
      <ul class="list" :aria-label="g.name">
        <ListItemRow
          v-for="item in g.items"
          :key="item.id"
          :item="item"
          @toggle="toggle(item)"
          @open="openItem(item)"
        />
      </ul>
    </section>

    <section v-if="inCart.length" class="group" aria-labelledby="cat-cart">
      <h2 id="cat-cart" class="group-title">En el carro</h2>
      <ul class="list" aria-label="En el carro">
        <ListItemRow
          v-for="item in inCart"
          :key="item.id"
          :item="item"
          @toggle="toggle(item)"
          @open="openItem(item)"
        />
      </ul>
    </section>

    <div v-if="mine.length" class="finalize-bar">
      <AppButton variant="primary" size="lg" block @click="finalizing = true">
        <ShoppingBag :size="18" /> Finalizar compra ({{ mine.length }})
      </AppButton>
    </div>
  </template>

  <FinalizeSheet v-model:open="finalizing" :items="mine" />

  <BottomSheet v-model:open="sheetOpen" :title="editing?.name ?? 'Ítem'">
    <form v-if="editing" class="sheet-form" @submit.prevent="saveItem">
      <NumberStepper
        v-model="form.quantity"
        label="Cantidad"
        :hint="form.quantity === 0 ? 'En 0 no se indica cantidad.' : undefined"
      />
      <TextField v-model="form.note" label="Nota (opcional)" placeholder="Ej: sin lactosa" />
      <RouterLink
        v-if="editing.productId"
        class="product-link"
        :to="{ name: 'product', params: { id: editing.productId } }"
      >
        Ver producto
      </RouterLink>
      <p v-if="editError" class="error" role="alert">{{ errorMessage(editError) }}</p>
      <AppButton
        type="submit"
        variant="primary"
        size="lg"
        block
        :loading="updateItem.isPending.value"
      >
        Guardar
      </AppButton>
      <AppButton variant="danger" block :loading="deleteItem.isPending.value" @click="removeItem">
        <Trash2 :size="18" /> Quitar de la lista
      </AppButton>
    </form>
  </BottomSheet>
</template>

<style scoped>
.banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-warning-soft);
  color: var(--color-warning);
  font-size: 0.9rem;
  font-weight: 600;
}

.group + .group {
  margin-top: var(--space-4);
}

.group-title {
  margin-bottom: var(--space-2);
  color: var(--color-text-muted);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
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

.list > :deep(li + li) {
  border-top: 1px solid var(--color-border);
}

/* Queda a mano sobre la barra inferior mientras se recorre la lista. */
.finalize-bar {
  position: sticky;
  bottom: calc(env(safe-area-inset-bottom) + 84px);
  z-index: 10;
  margin-top: var(--space-4);
  padding-top: var(--space-2);
}

.sheet-form {
  display: grid;
  gap: var(--space-3);
}

.product-link {
  color: var(--color-accent);
  font-weight: 600;
}

.muted {
  color: var(--color-text-muted);
}

.error {
  color: var(--color-danger);
}
</style>
