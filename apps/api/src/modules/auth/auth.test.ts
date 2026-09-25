import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { sessions } from '../../db/schema'
import { createTestApp, createTestHousehold } from '../../test/app'
import { createSession, hashSessionToken, SESSION_TTL_MS, validateSession } from './session'

let t: ReturnType<typeof createTestApp>
let userId: string

beforeEach(() => {
  t = createTestApp()
  userId = createTestHousehold(t.db, 'camila').user.id
})

describe('login', () => {
  it('crea una sesión con cookie HttpOnly y SameSite=Lax', async () => {
    const res = await t.request('/api/auth/login', {
      method: 'POST',
      body: { username: 'Camila ', password: 'clave-segura-123' },
    })
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/^rendi_session=/)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=Lax/i)
  })

  it('rechaza credenciales incorrectas con un mensaje genérico', async () => {
    for (const body of [
      { username: 'camila', password: 'otra-clave' },
      { username: 'nadie', password: 'clave-segura-123' },
    ]) {
      const res = await t.request('/api/auth/login', { method: 'POST', body })
      expect(res.status).toBe(401)
      expect(await res.json()).toMatchObject({ error: { code: 'invalid_credentials' } })
    }
  })

  it('bloquea tras 5 intentos fallidos', async () => {
    const body = { username: 'bloqueo', password: 'x' }
    for (let i = 0; i < 5; i++) await t.request('/api/auth/login', { method: 'POST', body })
    const res = await t.request('/api/auth/login', { method: 'POST', body })
    expect(res.status).toBe(429)
  })

  it('valida el cuerpo con mensajes en español', async () => {
    const res = await t.request('/api/auth/login', { method: 'POST', body: { username: '' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: { code: 'invalid_input' } })
  })
})

describe('sesión', () => {
  it('/me exige sesión y devuelve el usuario', async () => {
    expect((await t.request('/api/auth/me')).status).toBe(401)
    const cookie = await t.login('camila')
    const res = await t.request('/api/auth/me', { cookie })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ user: { username: 'camila', name: 'camila' } })
  })

  it('logout invalida la sesión', async () => {
    const cookie = await t.login('camila')
    await t.request('/api/auth/logout', { method: 'POST', cookie })
    expect((await t.request('/api/auth/me', { cookie })).status).toBe(401)
  })

  it('guarda solo el hash del token', () => {
    const { token } = createSession(t.db, userId)
    const rows = t.db.select().from(sessions).all()
    expect(rows.map((r) => r.id)).toEqual([hashSessionToken(token)])
    expect(rows[0]!.id).not.toBe(token)
  })

  it('renueva sesiones a las que les quedan menos de 15 días y elimina las vencidas', () => {
    const start = new Date('2026-01-01T00:00:00Z')
    const { token } = createSession(t.db, userId, start)

    const day20 = new Date(start.getTime() + 20 * 86_400_000)
    const renewed = validateSession(t.db, token, day20)
    expect(renewed?.renewedUntil?.getTime()).toBe(day20.getTime() + SESSION_TTL_MS)

    const later = new Date(day20.getTime() + SESSION_TTL_MS + 1)
    expect(validateSession(t.db, token, later)).toBeNull()
    expect(t.db.select().from(sessions).where(eq(sessions.userId, userId)).all()).toHaveLength(0)
  })
})

describe('CSRF', () => {
  it('rechaza escrituras desde otro sitio', async () => {
    const res = await t.request('/api/auth/login', {
      method: 'POST',
      body: { username: 'camila', password: 'clave-segura-123' },
      headers: { 'sec-fetch-site': 'cross-site' },
    })
    expect(res.status).toBe(403)
  })
})
