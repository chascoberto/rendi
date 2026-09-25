<script setup lang="ts">
import { ChevronLeft } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

const props = defineProps<{ title: string; back?: string }>()
const router = useRouter()

function goBack() {
  // Si se llegó desde la app, volver; si se abrió el enlace directo, ir al destino indicado.
  if (window.history.state?.back) router.back()
  else void router.push(props.back ?? '/')
}
</script>

<template>
  <header class="page-header">
    <button v-if="back" class="back" type="button" aria-label="Volver" @click="goBack">
      <ChevronLeft :size="24" />
    </button>
    <h1 class="title">{{ title }}</h1>
    <div class="actions"><slot name="actions" /></div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 48px;
  margin-bottom: var(--space-4);
}

.back {
  display: grid;
  place-items: center;
  width: var(--tap-size);
  height: var(--tap-size);
  margin-left: calc(-1 * var(--space-2));
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
}

.title {
  flex: 1;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.actions {
  display: flex;
  gap: var(--space-2);
}
</style>
