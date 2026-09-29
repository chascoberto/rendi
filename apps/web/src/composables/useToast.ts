import { shallowRef } from 'vue'

export interface Toast {
  id: number
  message: string
  /** Acción opcional, p. ej. "Deshacer". */
  action?: { label: string; run: () => void }
  /** Milisegundos visible; `null` = hasta que se use la acción o llegue otro toast. */
  duration?: number | null
}

/** Duración de un toast. Las acciones rápidas se pueden deshacer mientras está visible. */
export const TOAST_MS = 5_000

const current = shallowRef<Toast | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
let nextId = 1

/** Muestra un toast (reemplaza al anterior). */
export function showToast(toast: Omit<Toast, 'id'>) {
  clearTimeout(timer)
  const shown = { ...toast, id: nextId++ }
  current.value = shown
  const duration = toast.duration === undefined ? TOAST_MS : toast.duration
  if (duration !== null) timer = setTimeout(() => dismissToast(shown.id), duration)
}

/** Cierra el toast; con `id`, solo si sigue siendo ese. */
export function dismissToast(id?: number) {
  if (id !== undefined && current.value?.id !== id) return
  clearTimeout(timer)
  current.value = null
}

export function useToast() {
  return { toast: current, showToast, dismissToast }
}
