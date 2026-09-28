/**
 * Cola offline de marcado de la lista. Es lo único que funciona sin conexión: cada toque guarda
 * "estado en el instante T" por ítem (el último reemplaza al anterior), se persiste en
 * localStorage y se envía cuando hay red. El servidor aplica "última escritura gana" según `at`.
 */
import { ref } from 'vue'
import { api, ApiError, call } from '@/lib/api'
import { queryClient } from '@/lib/query'

export interface PendingCheck {
  checked: boolean
  /** Instante del toque en el cliente (ms). */
  at: number
}

const STORAGE_KEY = 'rendi:check-queue'
const RETRY_MS = 15_000

function load(): Record<string, PendingCheck> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, PendingCheck>) : {}
  } catch {
    return {}
  }
}

/** Marcas aún no confirmadas por el servidor, por id de ítem. */
export const pendingChecks = ref<Record<string, PendingCheck>>(load())

function save() {
  try {
    if (Object.keys(pendingChecks.value).length === 0) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingChecks.value))
  } catch {
    // Sin localStorage la cola vive solo en memoria.
  }
}

/** Quita la entrada solo si no la reemplazó un toque más nuevo mientras se enviaba. */
function settle(itemId: string, sent: PendingCheck) {
  if (pendingChecks.value[itemId]?.at !== sent.at) return
  const { [itemId]: _, ...rest } = pendingChecks.value
  pendingChecks.value = rest
  save()
}

export function enqueueCheck(itemId: string, checked: boolean) {
  pendingChecks.value = { ...pendingChecks.value, [itemId]: { checked, at: Date.now() } }
  save()
  void flushChecks()
}

let flushing: Promise<void> | null = null
/** Se pidió enviar mientras otro envío estaba en curso: al terminar, se repite. */
let again = false

/** Una pasada por la cola. Devuelve si se cortó por falta de red (o de sesión). */
async function sendPending(): Promise<{ sent: number; offline: boolean }> {
  let sent = 0
  for (const [itemId, check] of Object.entries(pendingChecks.value)) {
    try {
      await call(api.shopping.items[':id'].check.$put({ param: { id: itemId }, json: check }))
    } catch (error) {
      // Sin conexión o sin sesión: se reintenta más tarde con la cola intacta.
      if (error instanceof ApiError && (error.status === 0 || error.status === 401)) {
        return { sent, offline: true }
      }
      // 404 (ya comprado o eliminado) u otro rechazo: no tiene sentido reintentar.
    }
    settle(itemId, check)
    sent++
  }
  return { sent, offline: false }
}

/** Envía la cola. Sin red se detiene y reintenta después; otros errores descartan la entrada. */
export function flushChecks(): Promise<void> {
  if (flushing) {
    again = true
    return flushing
  }
  const run = async () => {
    let total = 0
    let result
    do {
      again = false
      result = await sendPending()
      total += result.sent
    } while (again && !result.offline)
    if (total > 0) await queryClient.invalidateQueries({ queryKey: ['shopping', 'items'] })
  }
  // `finally` se encadena después de asignar `flushing`, aunque la cola esté vacía y `run`
  // termine sin esperar nada (si se limpiara dentro de `run`, quedaría trabada para siempre).
  flushing = run().finally(() => {
    flushing = null
  })
  return flushing
}

export function clearCheckQueue() {
  pendingChecks.value = {}
  save()
}

/** Reintentos: al volver la conexión y cada 15 s mientras quede algo pendiente. */
export function startCheckQueue() {
  window.addEventListener('online', () => void flushChecks())
  setInterval(() => {
    if (Object.keys(pendingChecks.value).length > 0 && navigator.onLine) void flushChecks()
  }, RETRY_MS)
  void flushChecks()
}
