<script setup lang="ts">
import { BULK_LEVEL_LABELS, BULK_LEVELS, toCalendarDate, type BulkLevel } from '@rendi/shared'
import { ChevronRight, Minus, PackageX, Plus } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import NumberStepper from '@/components/ui/NumberStepper.vue'
import SelectField from '@/components/ui/SelectField.vue'
import TextField from '@/components/ui/TextField.vue'
import { type ProductDetail, useLocations } from '@/features/catalog/queries'
import { errorMessage } from '@/lib/api'
import { expiryLabel, expiryTone, stockLabel } from './format'
import { useConsume, useDeplete, usePurchase, useSetLevel, useUpdateLot } from './queries'

const props = defineProps<{ detail: ProductDetail }>()

const product = computed(() => props.detail.product)
const total = computed(() => props.detail.stock.total)
const vars = computed(() => ({ productId: product.value.id, name: product.value.name }))
const today = toCalendarDate()

const { data: locations } = useLocations()
const locationOptions = computed(() =>
  (locations.value ?? []).map((l) => ({ value: l.id, label: l.name })),
)

const consume = useConsume()
const deplete = useDeplete()
const purchase = usePurchase()
const setLevel = useSetLevel()
const updateLot = useUpdateLot()
const mutations = [consume, deplete, purchase, setLevel, updateLot]
const actionError = computed(() => mutations.find((m) => m.isError.value)?.error.value ?? null)
const busy = computed(() => mutations.some((m) => m.isPending.value))

const levels = ([BULK_LEVELS.full, BULK_LEVELS.low, BULK_LEVELS.empty] as BulkLevel[]).map(
  (level) => ({ level, label: BULK_LEVEL_LABELS[level] }),
)

function chooseLevel(level: BulkLevel, label: string) {
  if (level === total.value) return
  setLevel.mutate({ ...vars.value, level, label })
}

// "Compré": cantidad, vencimiento y ubicación.
const buying = ref(false)
const buyForm = ref({ quantity: 1, expiresOn: '', locationId: '' })

function openPurchase() {
  buyForm.value = {
    quantity: 1,
    expiresOn: '',
    locationId: product.value.defaultLocationId ?? locations.value?.[0]?.id ?? '',
  }
  buying.value = true
}

function submitPurchase() {
  const f = buyForm.value
  purchase.mutate(
    {
      ...vars.value,
      input: {
        quantity: f.quantity,
        expiresOn: f.expiresOn || null,
        locationId: f.locationId || null,
      },
    },
    { onSuccess: () => (buying.value = false) },
  )
}

// Ajuste manual de un lote.
type Lot = ProductDetail['lots'][number]
const editing = ref<Lot | null>(null)
const lotForm = ref({ quantity: 0, expiresOn: '', locationId: '' })

function openLot(lot: Lot) {
  editing.value = lot
  lotForm.value = {
    quantity: lot.quantity,
    expiresOn: lot.expiresOn ?? '',
    locationId: lot.locationId,
  }
}

function submitLot() {
  const lot = editing.value
  if (!lot) return
  const f = lotForm.value
  updateLot.mutate(
    {
      lotId: lot.id,
      name: product.value.name,
      input: {
        ...(f.quantity !== lot.quantity ? { quantity: f.quantity } : {}),
        ...((f.expiresOn || null) !== lot.expiresOn ? { expiresOn: f.expiresOn || null } : {}),
        ...(f.locationId !== lot.locationId ? { locationId: f.locationId } : {}),
      },
    },
    { onSuccess: () => (editing.value = null) },
  )
}

const lotSheetOpen = computed({
  get: () => editing.value !== null,
  set: (open) => {
    if (!open) editing.value = null
  },
})
</script>

<template>
  <AppCard>
    <section class="block" aria-labelledby="stock-title">
      <div class="head">
        <h2 id="stock-title" class="block-title">Stock</h2>
        <span class="total" :class="{ 'total--empty': total <= 0 }" data-testid="stock-total">
          {{ stockLabel(product.stockMode, total) }}
        </span>
      </div>

      <div v-if="product.stockMode === 'unit'" class="actions">
        <AppButton :disabled="total <= 0 || busy" @click="consume.mutate({ ...vars })">
          <Minus :size="18" /> Usé uno
        </AppButton>
        <AppButton variant="primary" :disabled="busy" @click="openPurchase">
          <Plus :size="18" /> Compré
        </AppButton>
        <AppButton :disabled="total <= 0 || busy" @click="deplete.mutate({ ...vars })">
          <PackageX :size="18" /> Se acabó
        </AppButton>
      </div>

      <div v-else class="levels" role="radiogroup" aria-label="Nivel">
        <button
          v-for="l in levels"
          :key="l.level"
          type="button"
          role="radio"
          class="level"
          :class="`level--${l.level}`"
          :aria-checked="total === l.level"
          :disabled="busy"
          @click="chooseLevel(l.level, l.label)"
        >
          {{ l.label }}
        </button>
      </div>

      <p v-if="actionError" class="error" role="alert">{{ errorMessage(actionError) }}</p>

      <ul v-if="product.stockMode === 'unit' && detail.lots.length" class="lots" aria-label="Lotes">
        <li v-for="lot in detail.lots" :key="lot.id">
          <button type="button" class="lot" @click="openLot(lot)">
            <span class="lot-qty">{{ lot.quantity }}</span>
            <span class="lot-main">
              <span>{{ lot.locationName }}</span>
              <span
                v-if="lot.expiresOn"
                class="expiry"
                :class="`expiry--${expiryTone(lot.expiresOn, today)}`"
              >
                {{ expiryLabel(lot.expiresOn, today) }}
              </span>
              <span v-else class="muted">Sin vencimiento</span>
            </span>
            <ChevronRight :size="18" class="muted" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </section>
  </AppCard>

  <BottomSheet v-model:open="buying" title="Compré">
    <form class="sheet-form" @submit.prevent="submitPurchase">
      <NumberStepper v-model="buyForm.quantity" label="Unidades" :min="1" />
      <TextField v-model="buyForm.expiresOn" type="date" label="Vence (opcional)" />
      <SelectField v-model="buyForm.locationId" label="Se guarda en" :options="locationOptions" />
      <p v-if="purchase.isError.value" class="error">{{ errorMessage(purchase.error.value) }}</p>
      <AppButton
        type="submit"
        variant="primary"
        size="lg"
        block
        :loading="purchase.isPending.value"
      >
        Agregar al stock
      </AppButton>
    </form>
  </BottomSheet>

  <BottomSheet v-model:open="lotSheetOpen" title="Ajustar lote">
    <form class="sheet-form" @submit.prevent="submitLot">
      <NumberStepper v-model="lotForm.quantity" label="Unidades en este lote" />
      <TextField
        v-model="lotForm.expiresOn"
        type="date"
        label="Vence"
        hint="Vacío: sin vencimiento"
      />
      <SelectField v-model="lotForm.locationId" label="Ubicación" :options="locationOptions" />
      <p v-if="updateLot.isError.value" class="error">{{ errorMessage(updateLot.error.value) }}</p>
      <AppButton
        type="submit"
        variant="primary"
        size="lg"
        block
        :loading="updateLot.isPending.value"
      >
        Guardar lote
      </AppButton>
    </form>
  </BottomSheet>
</template>

<style scoped>
.block {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.block-title {
  font-size: 1.05rem;
}

.total {
  font-size: 1.15rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.total--empty {
  color: var(--color-text-muted);
}

.actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

.actions :deep(.btn) {
  flex-direction: column;
  gap: 2px;
  min-height: 60px;
  padding: var(--space-1);
  font-size: 0.85rem;
}

.levels {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

.level {
  min-height: 52px;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-weight: 600;
  font-size: 0.9rem;
}

.level[aria-checked='true'] {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.level--1[aria-checked='true'] {
  border-color: var(--color-warning);
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.level--0[aria-checked='true'] {
  border-color: var(--color-danger);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.lots {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--color-border);
}

.lots li + li {
  border-top: 1px solid var(--color-border);
}

.lot {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 52px;
  padding: var(--space-2) 0;
  border: 0;
  background: transparent;
  text-align: left;
}

.lot-qty {
  display: grid;
  place-items: center;
  min-width: 36px;
  height: 36px;
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.lot-main {
  display: grid;
  flex: 1;
  font-size: 0.95rem;
}

.expiry {
  font-size: 0.85rem;
  font-weight: 600;
}

.expiry--expired {
  color: var(--color-danger);
}

.expiry--soon {
  color: var(--color-warning);
}

.expiry--week,
.expiry--later {
  color: var(--color-text-muted);
  font-weight: 400;
}

.sheet-form {
  display: grid;
  gap: var(--space-3);
}

.muted {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.error {
  margin: 0;
  color: var(--color-danger);
}
</style>
