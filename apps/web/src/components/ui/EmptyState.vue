<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ icon?: Component; title: string; description?: string }>()
</script>

<template>
  <div class="empty">
    <component :is="icon" v-if="icon" :size="40" :stroke-width="1.5" class="icon" />
    <p class="title">{{ title }}</p>
    <p v-if="description" class="description">{{ description }}</p>
    <slot />
  </div>
</template>

<style scoped>
.empty {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.icon {
  color: var(--color-text-muted);
  opacity: 0.6;
}

.title {
  margin: 0;
  font-weight: 600;
}

.description {
  margin: 0;
  max-width: 32ch;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
</style>
