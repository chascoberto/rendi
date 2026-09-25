import { zValidator } from '@hono/zod-validator'
import type { ApiErrorBody } from '@rendi/shared'
import type { ValidationTargets } from 'hono'
import type { ZodType } from 'zod'

/** `zValidator` con la respuesta de error estándar de la API. */
export function validate<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (result.success) return
    const body: ApiErrorBody = {
      error: {
        code: 'invalid_input',
        message: result.error.issues[0]?.message ?? 'Datos inválidos',
        issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    }
    return c.json(body, 400)
  })
}
