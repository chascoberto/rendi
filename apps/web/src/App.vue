<script setup lang="ts">
import { useRoute } from 'vue-router'
import BottomNav from '@/components/layout/BottomNav.vue'
import ToastHost from '@/components/layout/ToastHost.vue'
import '@/composables/useTheme'

const route = useRoute()
</script>

<template>
  <main class="app-main" :class="{ 'app-main--with-nav': !route.meta.public }">
    <RouterView />
  </main>
  <ToastHost />
  <BottomNav v-if="!route.meta.public" />
</template>

<style scoped>
.app-main {
  max-width: 640px;
  margin: 0 auto;
  padding: calc(env(safe-area-inset-top) + var(--space-4)) var(--space-4) var(--space-6);
}

.app-main--with-nav {
  /* Espacio para la barra inferior fija. */
  padding-bottom: calc(env(safe-area-inset-bottom) + 96px);
}
</style>
