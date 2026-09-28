<script setup lang="ts">
import {
  BULK_RESTOCK_MIN,
  CONTENT_UNIT_LABELS,
  CONTENT_UNITS,
  type ContentUnit,
  type ProductCreateInput,
  type StockMode,
} from '@rendi/shared'
import { Archive, Barcode, Plus, ScanBarcode, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import NumberStepper from '@/components/ui/NumberStepper.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import SelectField from '@/components/ui/SelectField.vue'
import SwitchField from '@/components/ui/SwitchField.vue'
import TextField from '@/components/ui/TextField.vue'
import BarcodeScanner from '@/features/scanner/BarcodeScanner.vue'
import { errorMessage } from '@/lib/api'
import FoodNameField from './FoodNameField.vue'
import { formatAmount, parseAmount } from './format'
import {
  useAddBarcode,
  useArchiveProduct,
  useCategories,
  useCreateProduct,
  useLocations,
  useProduct,
  useRemoveBarcode,
  useUpdateProduct,
} from './queries'

/** Sin `id`: producto nuevo (puede venir prellenado desde el escáner vía query). */
const props = defineProps<{ id?: string }>()
const route = useRoute()
const router = useRouter()
const isNew = computed(() => !props.id)

const { data: detail, error: loadError } = useProduct(() => props.id ?? null)
const { data: categories } = useCategories()
const { data: locations } = useLocations()
const createProduct = useCreateProduct()
const updateProduct = useUpdateProduct(() => props.id ?? '')
const archiveProduct = useArchiveProduct()
const addBarcode = useAddBarcode()
const removeBarcode = useRemoveBarcode()

const query = (key: string) =>
  typeof route.query[key] === 'string' ? (route.query[key] as string) : ''

const form = ref({
  name: query('name'),
  brand: query('brand'),
  foodName: '',
  categoryId: null as string | null,
  contentAmount: query('amount').replace('.', ','),
  contentUnit: (CONTENT_UNITS.includes(query('unit') as ContentUnit)
    ? query('unit')
    : 'u') as ContentUnit,
  stockMode: 'unit' as StockMode,
  minUnits: 0,
  bulkRestock: false,
  defaultLocationId: null as string | null,
  unitCount: 0,
})
/** Código escaneado para un producto nuevo, y cuántas unidades trae. */
const newBarcode = ref({ ean: query('ean'), packCount: Number(query('pack')) || 1 })

// Al cargar un producto existente, se copia al formulario (una vez por producto).
watch(
  () => detail.value?.product.id,
  () => {
    const p = detail.value?.product
    if (!p) return
    form.value = {
      name: p.name,
      brand: p.brand ?? '',
      foodName: p.foodName ?? '',
      categoryId: p.categoryId,
      contentAmount: formatAmount(p.contentAmount),
      contentUnit: p.contentUnit,
      stockMode: p.stockMode,
      minUnits: p.stockMode === 'unit' ? (p.minStock ?? 0) : 0,
      bulkRestock: p.stockMode === 'bulk' && p.minStock !== null,
      defaultLocationId: p.defaultLocationId,
      unitCount: 0,
    }
  },
  { immediate: true },
)

// Ubicación por defecto para productos nuevos: la primera (Despensa).
watch(
  locations,
  (locs) => {
    if (isNew.value && !form.value.defaultLocationId && locs?.[0])
      form.value.defaultLocationId = locs[0].id
  },
  { immediate: true },
)

/** Pasar de granel a envases con stock exige decir cuántos envases hay. */
const needsUnitCount = computed(
  () =>
    !isNew.value &&
    detail.value?.product.stockMode === 'bulk' &&
    form.value.stockMode === 'unit' &&
    (detail.value?.stock.total ?? 0) > 0,
)

const modeOptions = [
  { value: 'unit' as const, label: 'Envases' },
  { value: 'bulk' as const, label: 'A granel' },
]
const unitOptions = CONTENT_UNITS.map((u) => ({ value: u, label: CONTENT_UNIT_LABELS[u] }))
const categoryOptions = computed(() => [
  { value: null, label: 'Sin categoría' },
  ...(categories.value ?? []).map((c) => ({ value: c.id as string | null, label: c.name })),
])
const locationOptions = computed(() => [
  { value: null, label: 'Sin ubicación' },
  ...(locations.value ?? []).map((l) => ({ value: l.id as string | null, label: l.name })),
])

function payload(): Omit<ProductCreateInput, 'barcode'> {
  const f = form.value
  return {
    name: f.name,
    brand: f.brand,
    foodName: f.foodName.trim() || null,
    categoryId: f.categoryId,
    contentAmount: parseAmount(f.contentAmount),
    contentUnit: f.contentUnit,
    stockMode: f.stockMode,
    minStock:
      f.stockMode === 'bulk'
        ? f.bulkRestock
          ? BULK_RESTOCK_MIN
          : null
        : f.minUnits > 0
          ? f.minUnits
          : null,
    defaultLocationId: f.defaultLocationId,
  }
}

const saveError = computed(() => createProduct.error.value ?? updateProduct.error.value)
const saving = computed(() => createProduct.isPending.value || updateProduct.isPending.value)

function save() {
  if (isNew.value) {
    const barcode = newBarcode.value.ean ? newBarcode.value : undefined
    createProduct.mutate(
      { ...payload(), barcode },
      {
        onSuccess: ({ product }) => router.replace({ name: 'product', params: { id: product.id } }),
      },
    )
  } else {
    updateProduct.mutate({
      ...payload(),
      ...(needsUnitCount.value ? { unitCount: form.value.unitCount } : {}),
    })
  }
}

function archive() {
  if (
    !props.id ||
    !window.confirm(
      `¿Archivar «${form.value.name}»? Dejará de aparecer, pero su historial se conserva.`,
    )
  )
    return
  archiveProduct.mutate(props.id, { onSuccess: () => router.replace({ name: 'pantry' }) })
}

// Códigos de barra de un producto existente.
const barcodeInput = ref({ ean: '', packCount: 1 })
const scanning = ref(false)

function onScanned(code: string) {
  barcodeInput.value.ean = code
  scanning.value = false
}

function addCode() {
  if (!props.id) return
  addBarcode.mutate(
    { productId: props.id, ...barcodeInput.value },
    { onSuccess: () => (barcodeInput.value = { ean: '', packCount: 1 }) },
  )
}
</script>

<template>
  <PageHeader :title="isNew ? 'Nuevo producto' : (detail?.product.name ?? 'Producto')" back="/" />

  <p v-if="loadError" class="error">{{ errorMessage(loadError) }}</p>

  <form v-if="isNew || detail" class="form" @submit.prevent="save">
    <AppCard>
      <div class="block">
        <p v-if="isNew && newBarcode.ean" class="scanned">
          <Barcode :size="16" /> Código {{ newBarcode.ean }}
        </p>
        <TextField v-model="form.name" label="Nombre" placeholder="Ej: Leche entera" required />
        <TextField v-model="form.brand" label="Marca (opcional)" placeholder="Ej: Colun" />
        <FoodNameField v-model="form.foodName" />
        <SelectField v-model="form.categoryId" label="Categoría" :options="categoryOptions" />
      </div>
    </AppCard>

    <AppCard>
      <div class="block">
        <h2 class="block-title">Contenido</h2>
        <div class="content-row">
          <TextField
            v-model="form.contentAmount"
            class="amount"
            label="Cantidad"
            inputmode="decimal"
            placeholder="1"
            required
          />
          <SelectField
            v-model="form.contentUnit"
            class="unit"
            label="Unidad"
            :options="unitOptions"
          />
        </div>
        <NumberStepper
          v-if="isNew && newBarcode.ean"
          v-model="newBarcode.packCount"
          label="Unidades que trae este código"
          :min="1"
          hint="Si escaneaste un pack (ej. 6 × 1 L de Alvi), indica 6 y el contenido de una unidad."
        />
      </div>
    </AppCard>

    <AppCard>
      <div class="block">
        <h2 class="block-title">Stock</h2>
        <SegmentedControl v-model="form.stockMode" label="Cómo se cuenta" :options="modeOptions" />
        <p class="muted small">
          {{
            form.stockMode === 'unit'
              ? 'Se cuentan envases o piezas: «usé uno» descuenta uno. También para contar paltas o tomates.'
              : 'Fruta y verdura suelta: solo se indica si hay, queda poco o se acabó.'
          }}
        </p>
        <NumberStepper
          v-if="needsUnitCount"
          v-model="form.unitCount"
          label="¿Cuántas unidades hay ahora?"
          hint="El nivel a granel no se puede convertir solo en unidades."
        />
        <NumberStepper
          v-if="form.stockMode === 'unit'"
          v-model="form.minUnits"
          label="Agregar a la lista cuando queden menos de"
          :hint="form.minUnits === 0 ? 'En 0 no se agrega solo a la lista.' : undefined"
        />
        <SwitchField
          v-else
          v-model="form.bulkRestock"
          label="Agregar a la lista cuando quede poco"
        />
        <SelectField
          v-model="form.defaultLocationId"
          label="Se guarda en"
          :options="locationOptions"
        />
      </div>
    </AppCard>

    <p v-if="saveError" class="error" role="alert">{{ errorMessage(saveError) }}</p>
    <AppButton type="submit" variant="primary" size="lg" block :loading="saving">
      {{ isNew ? 'Crear producto' : 'Guardar cambios' }}
    </AppButton>
  </form>

  <template v-if="detail && id">
    <AppCard class="spaced">
      <div class="block">
        <h2 class="block-title">Códigos de barra</h2>
        <ul v-if="detail.barcodes.length" class="codes">
          <li v-for="b in detail.barcodes" :key="b.ean" class="code">
            <Barcode :size="18" class="muted" />
            <span class="code-text">
              <span class="ean">{{ b.ean }}</span>
              <span v-if="b.packCount > 1" class="pack">Pack de {{ b.packCount }}</span>
            </span>
            <button
              type="button"
              class="icon-button"
              :aria-label="`Quitar código ${b.ean}`"
              @click="removeBarcode.mutate({ productId: id, ean: b.ean })"
            >
              <Trash2 :size="18" />
            </button>
          </li>
        </ul>
        <p v-else class="muted small">Sin códigos. Asocia uno para encontrarlo al escanear.</p>

        <form class="add-code" @submit.prevent="addCode">
          <div class="code-input-row">
            <TextField
              v-model="barcodeInput.ean"
              label="Agregar código"
              inputmode="numeric"
              placeholder="13 dígitos"
            />
            <AppButton aria-label="Escanear código" @click="scanning = true">
              <ScanBarcode :size="18" />
            </AppButton>
          </div>
          <NumberStepper v-model="barcodeInput.packCount" label="Unidades que trae" :min="1" />
          <p v-if="addBarcode.isError.value" class="error">
            {{ errorMessage(addBarcode.error.value) }}
          </p>
          <AppButton
            type="submit"
            :disabled="!barcodeInput.ean.trim()"
            :loading="addBarcode.isPending.value"
          >
            <Plus :size="18" /> Asociar código
          </AppButton>
        </form>
      </div>
    </AppCard>

    <AppButton
      class="spaced"
      variant="danger"
      block
      :loading="archiveProduct.isPending.value"
      @click="archive"
    >
      <Archive :size="18" /> Archivar producto
    </AppButton>

    <BottomSheet v-model:open="scanning" title="Escanear código">
      <BarcodeScanner v-if="scanning" @code="onScanned" />
    </BottomSheet>
  </template>
</template>

<style scoped>
.form {
  display: grid;
  gap: var(--space-4);
}

.block {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
}

.block-title {
  font-size: 1.05rem;
}

.scanned {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.content-row {
  display: grid;
  grid-template-columns: 1fr 1.3fr;
  gap: var(--space-3);
}

.codes {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.code {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.code-text {
  display: grid;
  flex: 1;
}

.ean {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.03em;
}

.pack {
  color: var(--color-accent);
  font-size: 0.85rem;
  font-weight: 600;
}

.icon-button {
  display: grid;
  place-items: center;
  width: var(--tap-size);
  height: var(--tap-size);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
}

.add-code {
  display: grid;
  gap: var(--space-3);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.code-input-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: var(--space-2);
}

.muted {
  color: var(--color-text-muted);
}

.small {
  margin: 0;
  font-size: 0.85rem;
}

.spaced {
  margin-top: var(--space-4);
}

.error {
  margin: 0;
  color: var(--color-danger);
}
</style>
