import type { ApiErrorBody } from '@rendi/shared'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/** Error de dominio con código estable y mensaje legible para la UI. */
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const notFound = (message = 'No encontrado') => new AppError(404, 'not_found', message)
export const badRequest = (code: string, message: string) => new AppError(400, code, message)

/** Errores de los triggers de SQLite: "stock_bulk_level: mensaje". */
const TRIGGER_ERROR = /^(stock_[a-z_]+): (.+)$/

function isSqliteError(err: unknown): err is Error & { code: string } {
  return err instanceof Error && err.name === 'SqliteError'
}

/** Traduce cualquier error a la respuesta JSON estándar. */
export function handleError(err: Error, c: Context) {
  const body = (code: string, message: string): ApiErrorBody => ({ error: { code, message } })

  if (err instanceof AppError) return c.json(body(err.code, err.message), err.status)

  if (isSqliteError(err)) {
    const trigger = TRIGGER_ERROR.exec(err.message)
    if (trigger) return c.json(body(trigger[1]!, trigger[2]!), 422)
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return c.json(body('conflict', 'Ya existe un registro con esos datos'), 409)
    }
  }

  console.error(err)
  return c.json(body('internal', 'Ocurrió un error inesperado'), 500)
}
