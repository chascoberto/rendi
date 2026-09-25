<script setup lang="ts">
import { ListChecks } from 'lucide-vue-next'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
</script>

<template>
  <PageHeader title="Lista de compras" />
  <EmptyState
    :icon="ListChecks"
    title="Próximamente"
    description="Aquí estará la lista compartida, con los faltantes agregados solos."
  />
</template>
