<script setup lang="ts">
import { ScanBarcode } from 'lucide-vue-next'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
</script>

<template>
  <PageHeader title="Escanear" />
  <EmptyState
    :icon="ScanBarcode"
    title="Próximamente"
    description="Escanea un código de barras para buscar o crear un producto."
  />
</template>
