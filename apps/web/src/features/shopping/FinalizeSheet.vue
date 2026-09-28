<script setup lang="ts">
import { ShoppingBag } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import NumberStepper from '@/components/ui/NumberStepper.vue'
import SelectField from '@/components/ui/SelectField.vue'
import { showToast } from '@/composables/useToast'
import { errorMessage } from '@/lib/api'
import { type ListItem, useFinalizePurchase, useSupermarkets } from './queries'

/** Ítems marcados por quien finaliza. */
const props = defineProps<{ items: ListItem[] }>()
const open = defineModel<boolean>('open', { required: true })

const LAST_MARKET_KEY = 'rendi:last-supermarket'

const { data: supermarkets } = useSupermarkets()
const finalize = useFinalizePurchase()

const supermarketId = ref('')
const quantities = ref<Record<string, number>>({})

/** Productos por envases: se pregunta cuántos se compraron (a granel queda en "Hay"). */
const counted = computed(() =>
  props.items.filter((i) => i.product && i.product.stockMode === 'unit'),
)
const others = computed(() => props.items.filter((i) => !counted.value.includes(i)))

/** Lo pedido en el ítem o, si es automático, lo que falta para llegar al mínimo. */
function suggested(item: ListItem) {
  if (item.quantity) return item.quantity
  const p = item.product
  if (item.source === 'min_stock' && p?.minStock) return Math.max(1, p.minStock - p.stock)
  return 1
}

function readLastMarket() {
  try {
    return localStorage.getItem(LAST_MARKET_KEY)
  } catch {
    return null
  }
}

// Al abrir: supermercado de la última compra y cantidades sugeridas.
watch(open, (isOpen) => {
  if (!isOpen) return
  finalize.reset()
  const last = readLastMarket()
  const list = supermarkets.value ?? []
  supermarketId.value = list.find((s) => s.id === last)?.id ?? list[0]?.id ?? ''
  quantities.value = Object.fromEntries(counted.value.map((i) => [i.id, suggested(i)]))
})

const marketOptions = computed(() =>
  (supermarkets.value ?? []).map((s) => ({ value: s.id, label: s.name })),
)

function submit() {
  finalize.mutate(
    {
      supermarketId: supermarketId.value,
      quantities: Object.fromEntries(
        counted.value.map((i) => [i.id, quantities.value[i.id] ?? suggested(i)]),
      ),
    },
    {
      onSuccess: ({ purchase }) => {
        try {
          localStorage.setItem(LAST_MARKET_KEY, supermarketId.value)
        } catch {
          // Solo es una comodidad.
        }
        open.value = false
        const market = supermarkets.value?.find((s) => s.id === purchase.supermarketId)?.name
        showToast({
          message:
            purchase.stocked > 0
              ? `Compra en ${market}: ${purchase.stocked} ${purchase.stocked === 1 ? 'producto' : 'productos'} al stock`
              : `Compra en ${market} registrada`,
        })
      },
    },
  )
}
</script>

<template>
  <BottomSheet v-model:open="open" title="Finalizar compra">
    <form class="form" @submit.prevent="submit">
      <p class="muted">
        Se registra solo lo que marcaste tú ({{
          items.length === 1 ? '1 ítem' : `${items.length} ítems`
        }}). Lo marcado por otras personas sigue en la lista.
      </p>
      <SelectField v-model="supermarketId" label="Supermercado" :options="marketOptions" />

      <section v-if="counted.length" class="group" aria-labelledby="counted-title">
        <h3 id="counted-title" class="group-title">¿Cuántos compraste?</h3>
        <NumberStepper
          v-for="item in counted"
          :key="item.id"
          :model-value="quantities[item.id] ?? suggested(item)"
          :label="item.name"
          :min="1"
          @update:model-value="quantities[item.id] = $event"
        />
      </section>

      <section v-if="others.length" class="group" aria-labelledby="others-title">
        <h3 id="others-title" class="group-title">También sale de la lista</h3>
        <ul class="others">
          <li v-for="item in others" :key="item.id">
            {{ item.name }}
            <span v-if="item.product" class="muted"> · queda en «Hay»</span>
          </li>
        </ul>
      </section>

      <p v-if="finalize.isError.value" class="error" role="alert">
        {{ errorMessage(finalize.error.value) }}
      </p>
      <AppButton
        type="submit"
        variant="primary"
        size="lg"
        block
        :disabled="!supermarketId"
        :loading="finalize.isPending.value"
      >
        <ShoppingBag :size="18" /> Registrar compra
      </AppButton>
    </form>
  </BottomSheet>
</template>

<style scoped>
.form {
  display: grid;
  gap: var(--space-4);
}

.group {
  display: grid;
  gap: var(--space-3);
}

.group-title {
  font-size: 0.95rem;
}

.others {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding-left: var(--space-4);
}

.muted {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.error {
  margin: 0;
  color: var(--color-danger);
}
</style>
