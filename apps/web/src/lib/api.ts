import type { AppType } from '@rendi/api/app'
import { hc } from 'hono/client'

/** Cliente RPC tipado: rutas, parámetros y respuestas vienen del tipo de la API. */
export const api = hc<AppType>('/', { init: { credentials: 'same-origin' } }).api
