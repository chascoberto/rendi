<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { ref, useId, watch } from 'vue'

defineProps<{ title: string }>()
const open = defineModel<boolean>('open', { required: true })

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = useId()

// <dialog> nativo con showModal(): foco atrapado, Escape y fondo inerte sin librerías.
watch(
  [open, dialog],
  ([isOpen, el]) => {
    if (!el) return
    if (isOpen && !el.open) el.showModal()
    if (!isOpen && el.open) el.close()
  },
  { immediate: true },
)

/** Un toque en el fondo (fuera del panel) cierra el diálogo. */
function onClick(event: MouseEvent) {
  if (event.target === dialog.value) open.value = false
}
</script>

<template>
  <dialog
    ref="dialog"
    class="sheet"
    :aria-labelledby="titleId"
    @close="open = false"
    @click="onClick"
  >
    <div class="panel">
      <header class="header">
        <h2 :id="titleId" class="title">{{ title }}</h2>
        <button class="close" type="button" aria-label="Cerrar" @click="open = false">
          <X :size="20" />
        </button>
      </header>
      <div class="body"><slot /></div>
    </div>
  </dialog>
</template>

<style scoped>
.sheet {
  width: 100%;
  max-width: 640px;
  max-height: 85dvh;
  margin: auto auto 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--color-surface);
  color: var(--color-text);
}

.sheet[open] {
  animation: slide-up 0.2s ease-out;
}

.sheet::backdrop {
  background: rgb(0 0 0 / 45%);
}

.panel {
  display: flex;
  flex-direction: column;
  max-height: 85dvh;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-2) var(--space-2) var(--space-4);
}

.title {
  font-size: 1.1rem;
}

.close {
  display: grid;
  place-items: center;
  width: var(--tap-size);
  height: var(--tap-size);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
}

.body {
  overflow-y: auto;
  padding: 0 var(--space-4) calc(env(safe-area-inset-bottom) + var(--space-4));
}

@keyframes slide-up {
  from {
    transform: translateY(24px);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sheet[open] {
    animation: none;
  }
}
</style>
