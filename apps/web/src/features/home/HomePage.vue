<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/lib/api'

const status = ref<'loading' | 'ok' | 'error'>('loading')

onMounted(async () => {
  try {
    const res = await api.system.health.$get()
    status.value = res.ok && (await res.json()).status === 'ok' ? 'ok' : 'error'
  } catch {
    status.value = 'error'
  }
})
</script>

<template>
  <section class="card">
    <h1>Despensa</h1>
    <p class="muted">Andamiaje listo. Aquí vivirá el inventario del hogar.</p>
    <p class="status" :data-status="status">
      API:
      {{ { loading: 'conectando…', ok: 'conectada', error: 'sin conexión' }[status] }}
    </p>
  </section>
</template>

<style scoped>
.card {
  padding: var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-1);
}

.muted {
  color: var(--color-text-muted);
}

.status[data-status='ok'] {
  color: var(--color-accent);
}

.status[data-status='error'] {
  color: var(--color-danger);
}
</style>
