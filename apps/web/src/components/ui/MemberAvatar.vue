<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string
    emoji?: string | null
    kind?: 'adult' | 'child'
    size?: number
  }>(),
  { emoji: null, kind: 'adult', size: 36 },
)
</script>

<template>
  <!-- El nombre ya se muestra al lado: el avatar es decorativo para lectores de pantalla. -->
  <span
    class="avatar"
    :class="{ 'avatar--child': kind === 'child', 'avatar--emoji': emoji }"
    :style="{ '--size': `${size}px` }"
    aria-hidden="true"
  >
    {{ emoji ?? name.charAt(0).toLocaleUpperCase('es-CL') }}
  </span>
</template>

<style scoped>
.avatar {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: var(--size);
  height: var(--size);
  border-radius: 50%;
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  font-weight: 700;
  font-size: calc(var(--size) * 0.42);
  line-height: 1;
  user-select: none;
}

.avatar--child {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.avatar--emoji {
  font-family: var(--font-emoji);
  font-weight: 400;
  font-size: calc(var(--size) * 0.56);
}
</style>
