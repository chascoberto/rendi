<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'md' | 'lg'
    type?: 'button' | 'submit'
    loading?: boolean
    disabled?: boolean
    block?: boolean
  }>(),
  { variant: 'secondary', size: 'md', type: 'button' },
)
</script>

<template>
  <button
    class="btn"
    :class="[`btn--${variant}`, `btn--${size}`, { 'btn--block': block }]"
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <LoaderCircle v-if="loading" class="spin" :size="18" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--tap-size);
  padding: 0 var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 0.95rem;
  transition:
    background-color 0.15s,
    opacity 0.15s;
}

.btn--lg {
  min-height: 52px;
  font-size: 1rem;
}

.btn--block {
  width: 100%;
}

.btn--primary {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.btn--secondary {
  background: var(--color-surface);
  border-color: var(--color-border);
}

.btn--ghost {
  background: transparent;
  color: var(--color-text-muted);
}

.btn--danger {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.btn:active:not(:disabled) {
  opacity: 0.8;
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
