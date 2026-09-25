import { createMiddleware } from 'hono/factory'
import { AppError } from './errors'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const ALLOWED_SITES = new Set(['same-origin', 'none'])

/**
 * Rechaza escrituras iniciadas desde otro sitio usando `Sec-Fetch-Site`, que envían
 * todos los navegadores actuales. No depende del Host/Origin, así que funciona igual
 * detrás de `tailscale serve`. Clientes sin el header (curl, tests) pasan: la cookie
 * SameSite=Lax ya impide que otro sitio la use.
 */
export const csrfProtection = createMiddleware(async (c, next) => {
  if (!SAFE_METHODS.has(c.req.method)) {
    const site = c.req.header('sec-fetch-site')
    if (site && !ALLOWED_SITES.has(site)) {
      throw new AppError(403, 'forbidden', 'Solicitud de origen no permitido')
    }
  }
  await next()
})
