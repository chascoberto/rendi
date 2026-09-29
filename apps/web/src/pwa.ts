import { registerSW } from 'virtual:pwa-register'
import { showToast } from '@/composables/useToast'

/**
 * Registra el service worker (solo existe en el build). Una versión nueva no se activa sola,
 * para no recargar la app en medio de una compra: se ofrece con un aviso que queda visible.
 */
export function setupPwa() {
  const updateSW = registerSW({
    onNeedRefresh() {
      showToast({
        message: 'Hay una versión nueva de Rendi',
        action: { label: 'Actualizar', run: () => void updateSW(true) },
        duration: null,
      })
    },
  })
}
