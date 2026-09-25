<script setup lang="ts">
import { CalendarClock, House, ListChecks, Package, ScanBarcode } from 'lucide-vue-next'
import { useRoute } from 'vue-router'

const route = useRoute()

const tabs = [
  { tab: 'pantry', to: '/', label: 'Despensa', icon: Package },
  { tab: 'shopping', to: '/lista', label: 'Lista', icon: ListChecks },
  { tab: 'scan', to: '/escanear', label: 'Escanear', icon: ScanBarcode },
  { tab: 'expiring', to: '/vencimientos', label: 'Vence', icon: CalendarClock },
  { tab: 'household', to: '/hogar', label: 'Hogar', icon: House },
] as const
</script>

<template>
  <nav class="bottom-nav" aria-label="Navegación principal">
    <RouterLink
      v-for="t in tabs"
      :key="t.tab"
      :to="t.to"
      class="tab"
      :class="{ 'tab--scan': t.tab === 'scan' }"
      :aria-current="route.meta.tab === t.tab ? 'page' : undefined"
    >
      <span class="icon"><component :is="t.icon" :size="t.tab === 'scan' ? 26 : 22" /></span>
      <span class="label">{{ t.label }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  inset: auto 0 0;
  z-index: 20;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  padding: var(--space-1) var(--space-2) calc(env(safe-area-inset-bottom) + var(--space-1));
  background: color-mix(in srgb, var(--color-bg) 92%, transparent);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--color-border);
}

.tab {
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: var(--space-1) 0;
  color: var(--color-text-muted);
  text-decoration: none;
  font-size: 0.72rem;
  font-weight: 600;
}

.icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 30px;
  border-radius: 999px;
}

.tab[aria-current='page'] {
  color: var(--color-text);
}

.tab[aria-current='page'] .icon {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

/* Escanear es la acción principal: botón destacado al centro. */
.tab--scan .icon {
  width: 52px;
  height: 52px;
  margin-top: -18px;
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  box-shadow: 0 4px 12px rgb(0 0 0 / 18%);
}

.tab--scan[aria-current='page'] .icon {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}
</style>
