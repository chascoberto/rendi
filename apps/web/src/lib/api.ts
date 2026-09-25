import type { AppType } from '@rendi/api/app'
import type { ApiErrorBody } from '@rendi/shared'
import { hc } from 'hono/client'

/** Error de la API con el código y el mensaje legible que envía el servidor. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues: ApiErrorBody['error']['issues'] = [],
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let onUnauthenticated: (() => void) | undefined

/** Se llama cuando la sesión expiró o no existe (401 `unauthenticated`). */
export function setUnauthenticatedHandler(handler: () => void) {
  onUnauthenticated = handler
}

async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let res: Response
  try {
    res = await fetch(input, { ...init, credentials: 'same-origin' })
  } catch {
    throw new ApiError(0, 'network', 'Sin conexión con el servidor')
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null
    const error = new ApiError(
      res.status,
      body?.error.code ?? 'http_error',
      body?.error.message ?? `Error ${res.status}`,
      body?.error.issues,
    )
    if (error.code === 'unauthenticated') onUnauthenticated?.()
    throw error
  }
  return res
}

/**
 * Cliente RPC tipado: rutas, parámetros y respuestas vienen del tipo de la API.
 * Las respuestas no exitosas se lanzan como `ApiError`.
 */
export const api = hc<AppType>('/', { fetch: apiFetch }).api

/** Cuerpo de las respuestas exitosas (los errores ya se lanzaron como `ApiError`). */
type SuccessBody<R> = R extends { json(): Promise<infer T> } ? Exclude<T, ApiErrorBody> : never

/** Espera la respuesta y devuelve su JSON tipado. */
export async function call<R extends { json(): Promise<unknown> }>(
  response: Promise<R>,
): Promise<SuccessBody<R>> {
  return (await (await response).json()) as SuccessBody<R>
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Ocurrió un error inesperado'
}
