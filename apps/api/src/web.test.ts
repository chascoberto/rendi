import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createTestApp } from './test/app'
import { findWebDir, withWebApp } from './web'

const dir = mkdtempSync(join(tmpdir(), 'rendi-web-'))
mkdirSync(join(dir, 'assets'))
writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Rendi</title>')
writeFileSync(join(dir, 'sw.js'), 'self.skipWaiting()')
writeFileSync(join(dir, 'assets', 'app-abc123.js'), 'console.log(1)')
afterAll(() => rmSync(dir, { recursive: true, force: true }))

const { app } = createTestApp()
const server = withWebApp(app, dir)
const get = (path: string) => server.request(path)

describe('API + frontend compilado', () => {
  it('las rutas /api siguen siendo la API, con sus errores JSON', async () => {
    const health = await get('/api/system/health')
    expect(health.status).toBe(200)
    const missing = await get('/api/no-existe')
    expect(missing.status).toBe(404)
    expect(await missing.json()).toMatchObject({ error: { code: 'not_found' } })
  })

  it('las rutas del SPA devuelven index.html sin caché larga', async () => {
    for (const path of ['/', '/lista', '/productos/abc']) {
      const res = await get(path)
      expect(res.status).toBe(200)
      expect(await res.text()).toContain('<title>Rendi</title>')
      expect(res.headers.get('cache-control')).toBe('no-cache')
    }
  })

  it('los assets con hash se guardan un año; sw.js se revalida', async () => {
    const asset = await get('/assets/app-abc123.js')
    expect(asset.status).toBe(200)
    expect(asset.headers.get('cache-control')).toContain('immutable')
    expect(asset.headers.get('x-content-type-options')).toBe('nosniff')
    expect((await get('/sw.js')).headers.get('cache-control')).toBe('no-cache')
  })

  it('un archivo inexistente responde 404 sin caché', async () => {
    const res = await get('/assets/viejo-000.js')
    expect(res.status).toBe(404)
    expect(res.headers.get('cache-control')).toBeNull()
  })

  it('sin build del frontend se sirve solo la API', () => {
    expect(findWebDir(dir)).toBe(dir)
    expect(findWebDir(join(dir, 'no-existe'))).toBeNull()
    expect(findWebDir(undefined)).toBeNull()
  })
})
