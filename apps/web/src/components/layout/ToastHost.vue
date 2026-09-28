<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toast, dismissToast } = useToast()

function runAction() {
  const t = toast.value
  if (!t?.action) return
  dismissToast(t.id)
  t.action.run()
}
</script>

<template>
  <!-- La región viva existe siempre para que los lectores de pantalla anuncien cada mensaje. -->
  <div class="toast-host" role="status" aria-live="polite" aria-label="Aviso">
    <Transition name="toast">
      <div v-if="toast" :key="toast.id" class="toast">
        <span class="message">{{ toast.message }}</span>
        <button v-if="toast.action" type="button" class="action" @click="runAction">
          {{ toast.action.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  inset: auto 0 calc(env(safe-area-inset-bottom) + 84px);
  z-index: 30;
  display: flex;
  justify-content: center;
  padding: 0 var(--space-4);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  max-width: 608px;
  min-height: 52px;
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-text);
  color: var(--color-bg);
  box-shadow: 0 6px 20px rgb(0 0 0 / 25%);
  pointer-events: auto;
}

.message {
  flex: 1;
  min-width: 0;
  font-size: 0.95rem;
}

.action {
  flex: none;
  min-height: var(--tap-size);
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-accent-soft);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  font-size: 0.85rem;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    transform 0.2s ease-out,
    opacity 0.2s ease-out;
}

.toast-enter-from,
.toast-leave-to {
  transform: translateY(12px);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active {
    transition: none;
  }
}
</style>
