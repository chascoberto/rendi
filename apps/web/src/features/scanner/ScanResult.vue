<script setup lang="ts">
import { formatContent, type ContentUnit } from '@rendi/shared'
import { Barcode, PackagePlus, Scale, Search } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import NumberStepper from '@/components/ui/NumberStepper.vue'
import { productSubtitle } from '@/features/catalog/format'
import {
  type BarcodeLookup,
  type ProductSummary,
  useAddBarcode,
  useProducts,
} from '@/features/catalog/queries'
import { errorMessage } from '@/lib/api'

const props = defineProps<{ result: BarcodeLookup }>()
const emit = defineEmits<{
  open: [productId: string]
  create: [query: Record<string, string>]
  done: []
}>()

// Asociar el código a un producto existente (p. ej. el EAN del pack de Alvi).
const linking = ref(false)
const search = ref('')
const selected = ref<ProductSummary | null>(null)
const packCount = ref(1)
const { data: matches } = useProducts(search)
const addBarcode = useAddBarcode()

const suggestion = computed(() =>
  props.result.status === 'unknown' ? props.result.suggestion : null,
)

function create() {
  if (props.result.status !== 'unknown') return
  const s = suggestion.value
  emit('create', {
    ean: props.result.ean,
    ...(s?.name ? { name: s.name } : {}),
    ...(s?.brand ? { brand: s.brand } : {}),
    ...(s?.contentAmount ? { amount: String(s.contentAmount) } : {}),
    ...(s?.contentUnit ? { unit: s.contentUnit } : {}),
  })
}

function link() {
  if (!selected.value || props.result.status !== 'unknown') return
  const productId = selected.value.id
  addBarcode.mutate(
    { productId, ean: props.result.ean, packCount: packCount.value },
    { onSuccess: () => emit('open', productId) },
  )
}
</script>

<template>
  <div class="result">
    <template v-if="result.status === 'found'">
      <p class="product-name">{{ result.product.name }}</p>
      <p class="muted">{{ productSubtitle(result.product) }}</p>
      <p v-if="result.packCount > 1" class="pack">Pack de {{ result.packCount }} unidades</p>
      <p v-if="result.archived" class="warning">Este producto está archivado.</p>
      <div class="actions">
        <AppButton variant="primary" size="lg" block @click="emit('open', result.product.id)">
          Ver producto
        </AppButton>
        <AppButton variant="ghost" block @click="emit('done')">Seguir escaneando</AppButton>
      </div>
    </template>

    <template v-else-if="result.status === 'unknown' && !linking">
      <p class="code"><Barcode :size="16" /> {{ result.ean }}</p>
      <p class="lead">Este código no está en tu catálogo.</p>
      <div v-if="suggestion" class="suggestion">
        <p class="suggestion-label">Encontrado en Open Food Facts</p>
        <p class="product-name">{{ suggestion.name ?? 'Sin nombre' }}</p>
        <p class="muted">
          {{
            [
              suggestion.brand,
              suggestion.contentAmount && suggestion.contentUnit
                ? formatContent(suggestion.contentAmount, suggestion.contentUnit as ContentUnit)
                : null,
            ]
              .filter(Boolean)
              .join(' · ')
          }}
        </p>
      </div>
      <div class="actions">
        <AppButton variant="primary" size="lg" block @click="create">
          <PackagePlus :size="18" /> Crear producto
        </AppButton>
        <AppButton block @click="linking = true"> Asociar a un producto existente </AppButton>
        <AppButton variant="ghost" block @click="emit('done')">Seguir escaneando</AppButton>
      </div>
    </template>

    <template v-else-if="result.status === 'unknown'">
      <p class="lead">¿A qué producto corresponde el código {{ result.ean }}?</p>
      <div class="search">
        <Search :size="18" class="search-icon" aria-hidden="true" />
        <input
          v-model="search"
          class="search-input"
          type="search"
          placeholder="Buscar producto"
          aria-label="Buscar producto para asociar"
        />
      </div>
      <ul class="matches" aria-label="Productos">
        <li v-for="p in matches?.products.slice(0, 6)" :key="p.id">
          <button
            type="button"
            class="match"
            :aria-pressed="selected?.id === p.id"
            @click="selected = p"
          >
            <span class="product-name small">{{ p.name }}</span>
            <span class="muted">{{ productSubtitle(p) }}</span>
          </button>
        </li>
      </ul>
      <NumberStepper
        v-if="selected"
        v-model="packCount"
        label="Unidades que trae este código"
        :min="1"
        hint="Para un pack mayorista (ej. 6 × 1 L), indica cuántas unidades del producto trae."
      />
      <p v-if="addBarcode.isError.value" class="error">
        {{ errorMessage(addBarcode.error.value) }}
      </p>
      <div class="actions">
        <AppButton
          variant="primary"
          size="lg"
          block
          :disabled="!selected"
          :loading="addBarcode.isPending.value"
          @click="link"
        >
          Asociar código
        </AppButton>
        <AppButton variant="ghost" block @click="linking = false">Volver</AppButton>
      </div>
    </template>

    <template v-else-if="result.status === 'variable_measure'">
      <p class="lead"><Scale :size="18" /> Código de peso variable</p>
      <p class="muted">
        Es una etiqueta de carnicería o fiambrería con el precio o el peso incluido: no identifica
        al producto. Búscalo por nombre en la despensa.
      </p>
      <div class="actions">
        <AppButton variant="ghost" block @click="emit('done')">Seguir escaneando</AppButton>
      </div>
    </template>

    <template v-else>
      <p class="lead">El código {{ result.ean }} no es válido.</p>
      <p class="muted">Revisa los dígitos o vuelve a escanear.</p>
      <div class="actions">
        <AppButton variant="ghost" block @click="emit('done')">Seguir escaneando</AppButton>
      </div>
    </template>
  </div>
</template>

<style scoped>
.result {
  display: grid;
  gap: var(--space-2);
}

.product-name {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
}

.product-name.small {
  font-size: 1rem;
}

.lead {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-weight: 600;
}

.code {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.pack {
  margin: 0;
  color: var(--color-accent);
  font-weight: 600;
}

.warning {
  margin: 0;
  color: var(--color-warning);
}

.suggestion {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}

.suggestion-label {
  margin: 0 0 var(--space-1);
  color: var(--color-text-muted);
  font-size: 0.8rem;
  font-weight: 600;
}

.actions {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.search {
  position: relative;
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
  min-height: var(--tap-size);
  padding: 0 var(--space-3) 0 calc(var(--space-3) + 26px);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  font-size: 16px;
}

.matches {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.match {
  display: grid;
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  text-align: left;
}

.match[aria-pressed='true'] {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
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
