/**
 * En producción un solo proceso sirve la API (`/api/*`) y el frontend compilado (`apps/web/dist`),
 * así `tailscale serve` apunta a un único puerto.
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'

interface FetchApp {
  fetch: (request: Request, env?: unknown) => Response | Promise<Response>
}

/** Agrega un header solo si la respuesta salió bien (un 404 no debe quedar en caché). */
const cacheOnSuccess =
  (value: string): MiddlewareHandler =>
  async (c, next) => {
    await next()
    if (c.res.status === 200) c.res.headers.set('Cache-Control', value)
  }

/**
 * La API más los archivos de `webDir`. Los de `/assets/` llevan hash en el nombre y se guardan un
 * año; el resto (index.html, sw.js, manifest) se revalida siempre, para que una versión nueva
 * llegue de inmediato. Cualquier ruta sin extensión devuelve index.html (rutas del SPA).
 */
export function withWebApp(api: FetchApp, webDir: string) {
  const dir = resolve(webDir)
  const root = new Hono()
  root.all('/api', (c) => api.fetch(c.req.raw, c.env))
  root.all('/api/*', (c) => api.fetch(c.req.raw, c.env))

  root.use('*', async (c, next) => {
    await next()
    c.res.headers.set('X-Content-Type-Options', 'nosniff')
    c.res.headers.set('Referrer-Policy', 'same-origin')
  })
  root.use('/assets/*', cacheOnSuccess('public, max-age=31536000, immutable'))
  root.use('*', async (c, next) => {
    await next()
    if (c.res.status === 200 && !c.req.path.startsWith('/assets/')) {
      c.res.headers.set('Cache-Control', 'no-cache')
    }
  })
  root.use('*', serveStatic({ root: dir }))
  root.get('*', (c, next) => {
    if (/\.[a-z0-9]+$/i.test(c.req.path)) return next()
    return serveStatic({ root: dir, path: 'index.html' })(c, next)
  })
  return root
}

/** La carpeta del frontend, si existe (sin build, la API funciona sola). */
export function findWebDir(webDir: string | undefined): string | null {
  if (!webDir) return null
  if (existsSync(resolve(webDir, 'index.html'))) return webDir
  console.warn(`No se encontró el frontend en ${resolve(webDir)}: se sirve solo la API.`)
  return null
}
