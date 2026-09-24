<script setup lang="ts">
import { Monitor, Moon, Sun } from 'lucide-vue-next'
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { preference, cycle } = useTheme()

const themeIcon = computed(() => ({ system: Monitor, light: Sun, dark: Moon })[preference.value])
const themeLabel = computed(
  () =>
    ({ system: 'Tema del sistema', light: 'Tema claro', dark: 'Tema oscuro' })[preference.value],
)
</script>

<template>
  <header class="app-header">
    <span class="brand">Rendi</span>
    <button
      class="icon-button"
      type="button"
      :aria-label="themeLabel"
      :title="themeLabel"
      @click="cycle"
    >
      <component :is="themeIcon" :size="20" />
    </button>
  </header>
  <main class="app-main">
    <RouterView />
  </main>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top) + var(--space-2)) var(--space-4) var(--space-2);
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
}

.brand {
  font-weight: 700;
  font-size: 1.15rem;
  letter-spacing: -0.01em;
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

.icon-button:active {
  background: var(--color-surface-2);
}

.app-main {
  max-width: 640px;
  margin: 0 auto;
  padding: var(--space-4);
}
</style>
