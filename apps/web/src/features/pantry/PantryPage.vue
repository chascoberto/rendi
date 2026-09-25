<script setup lang="ts">
import { Package } from 'lucide-vue-next'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
</script>

<template>
  <PageHeader title="Despensa" />
  <EmptyState
    :icon="Package"
    title="Próximamente"
    description="Aquí verás el inventario del hogar con acciones rápidas."
  />
</template>
