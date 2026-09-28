<script setup lang="ts">
import { daysBetween } from '@rendi/shared'
import { CalendarCheck, Minus, Trash2 } from 'lucide-vue-next'
import { computed } from 'vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { expiryLabel, expiryTone } from '@/features/pantry/format'
import { type ExpiringLot, useConsume, useDeplete, useExpiring } from '@/features/pantry/queries'
import { errorMessage } from '@/lib/api'

/** Ventana de "por vencer": los próximos 30 días (y lo ya vencido). */
const DAYS = 30

const { data, isPending, error } = useExpiring(DAYS)
const consume = useConsume()
const deplete = useDeplete()
const actionError = computed(() => consume.error.value ?? deplete.error.value)

const groups = computed(() => {
  if (!data.value) return []
  const { today, lots } = data.value
  const sections = [
    { title: 'Vencidos', max: -1, lots: [] as ExpiringLot[] },
    { title: 'Hoy y mañana', max: 1, lots: [] as ExpiringLot[] },
    { title: 'Esta semana', max: 7, lots: [] as ExpiringLot[] },
    { title: 'Próximas semanas', max: Infinity, lots: [] as ExpiringLot[] },
  ]
  for (const lot of lots) {
    const days = daysBetween(today, lot.expiresOn)
    sections.find((s) => days <= s.max)!.lots.push(lot)
  }
  return sections.filter((s) => s.lots.length > 0)
})

function quantityText(lot: ExpiringLot) {
  if (lot.product.stockMode === 'bulk') return lot.quantity === 1 ? 'Queda poco' : 'Hay'
  return lot.quantity === 1 ? '1 unidad' : `${lot.quantity} unidades`
}

const target = (lot: ExpiringLot) => ({
  productId: lot.productId,
  lotId: lot.lotId,
  name: lot.product.name,
})
</script>

<template>
  <PageHeader title="Por vencer" />

  <p v-if="error" class="error">{{ errorMessage(error) }}</p>
  <p v-else-if="isPending" class="muted">Cargando…</p>
  <EmptyState
    v-else-if="groups.length === 0"
    :icon="CalendarCheck"
    title="Nada por vencer"
    :description="`No hay productos que venzan en los próximos ${DAYS} días.`"
  />
  <template v-else>
    <p v-if="actionError" class="error" role="alert">{{ errorMessage(actionError) }}</p>
    <section v-for="g in groups" :key="g.title" class="group" :aria-labelledby="`g-${g.max}`">
      <h2 :id="`g-${g.max}`" class="group-title">{{ g.title }}</h2>
      <ul class="list" :aria-label="g.title">
        <li v-for="lot in g.lots" :key="lot.lotId" class="item">
          <RouterLink class="row" :to="{ name: 'product', params: { id: lot.productId } }">
            <span class="row-title">{{ lot.product.name }}</span>
            <span class="row-sub">{{ quantityText(lot) }} · {{ lot.locationName }}</span>
            <span
              class="row-expiry"
              :class="`row-expiry--${expiryTone(lot.expiresOn, data!.today)}`"
            >
              {{ expiryLabel(lot.expiresOn, data!.today) }}
            </span>
          </RouterLink>
          <button
            v-if="lot.product.stockMode === 'unit'"
            type="button"
            class="quick"
            :aria-label="`Usé uno: ${lot.product.name}`"
            :disabled="consume.isPending.value"
            @click="consume.mutate(target(lot))"
          >
            <Minus :size="20" />
          </button>
          <button
            type="button"
            class="quick"
            :aria-label="`Descartar lote: ${lot.product.name}`"
            :disabled="deplete.isPending.value"
            @click="deplete.mutate(target(lot))"
          >
            <Trash2 :size="20" />
          </button>
        </li>
      </ul>
    </section>
  </template>
</template>

<style scoped>
.group + .group {
  margin-top: var(--space-5);
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

.list li + li {
  border-top: 1px solid var(--color-border);
}

.item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding-right: var(--space-2);
}

.row {
  display: grid;
  flex: 1;
  min-width: 0;
  min-height: 64px;
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  color: inherit;
  text-decoration: none;
}

.row:active {
  background: var(--color-surface-2);
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

.row-expiry {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  font-weight: 600;
}

.row-expiry--expired {
  color: var(--color-danger);
}

.row-expiry--soon {
  color: var(--color-warning);
}

.quick {
  display: grid;
  flex: none;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
}

.quick:active:not(:disabled) {
  background: var(--color-surface-2);
}

.quick:disabled {
  opacity: 0.5;
}

.muted {
  color: var(--color-text-muted);
}

.error {
  color: var(--color-danger);
}
</style>
