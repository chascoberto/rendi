<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { type BarcodeLookup, lookupBarcode } from '@/features/catalog/queries'
import { errorMessage } from '@/lib/api'
import BarcodeScanner from './BarcodeScanner.vue'
import ScanResult from './ScanResult.vue'

const router = useRouter()
const scanner = ref<InstanceType<typeof BarcodeScanner> | null>(null)

const sheetOpen = ref(false)
const loading = ref(false)
const result = ref<BarcodeLookup | null>(null)
const lookupError = ref<string | null>(null)

async function onCode(code: string) {
  sheetOpen.value = true
  loading.value = true
  result.value = null
  lookupError.value = null
  try {
    result.value = await lookupBarcode(code)
  } catch (error) {
    lookupError.value = errorMessage(error)
  } finally {
    loading.value = false
  }
}

/** Al cerrar el panel (por botón, Escape o tocando fuera) se sigue escaneando. */
function onSheetToggle(open: boolean) {
  sheetOpen.value = open
  if (!open) scanner.value?.next()
}

function openProduct(id: string) {
  sheetOpen.value = false
  void router.push({ name: 'product', params: { id } })
}

function createProduct(query: Record<string, string>) {
  sheetOpen.value = false
  void router.push({ name: 'product-new', query })
}
</script>

<template>
  <PageHeader title="Escanear" />
  <BarcodeScanner ref="scanner" @code="onCode" />

  <BottomSheet :open="sheetOpen" title="Código escaneado" @update:open="onSheetToggle">
    <p v-if="loading" class="muted" role="status">Buscando…</p>
    <p v-else-if="lookupError" class="error">{{ lookupError }}</p>
    <ScanResult
      v-else-if="result"
      :key="'ean' in result ? result.ean : result.product.id"
      :result="result"
      @open="openProduct"
      @create="createProduct"
      @done="onSheetToggle(false)"
    />
  </BottomSheet>
</template>

<style scoped>
.muted {
  color: var(--color-text-muted);
}

.error {
  color: var(--color-danger);
}
</style>
