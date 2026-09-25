<script setup lang="ts">
import { CalendarClock } from 'lucide-vue-next'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
</script>

<template>
  <PageHeader title="Por vencer" />
  <EmptyState
    :icon="CalendarClock"
    title="Próximamente"
    description="Aquí verás lo que vence pronto, ordenado por fecha."
  />
</template>
