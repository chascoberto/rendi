import { createApp, type AppDeps } from '../app'
import type { Db } from '../db/client'
import { hashPasswordSync } from '../modules/auth/password'
import { createAdultUser } from '../modules/auth/service'
import { createHousehold } from '../modules/household/service'
import { createTestDb } from './db'

export const TEST_PASSWORD = 'clave-segura-123'
const passwordHash = hashPasswordSync(TEST_PASSWORD)

/** Crea un hogar con un adulto con cuenta. */
export function createTestHousehold(db: Db, username = 'adulto', name = 'Hogar de prueba') {
  const { household, locations } = createHousehold(db, { name })
  const { member, user } = createAdultUser(db, {
    householdId: household.id,
    name: username,
    username,
    passwordHash,
  })
  return { household, locations, member, user }
}

/** App sobre una base en memoria, con helpers para requests JSON autenticados. */
export function createTestApp(overrides: Pick<AppDeps, 'productLookup'> = {}) {
  const db = createTestDb()
  const app = createApp({ db, config: { cookieSecure: false }, logRequests: false, ...overrides })

  async function request(
    path: string,
    init: {
      method?: string
      body?: unknown
      cookie?: string
      headers?: Record<string, string>
    } = {},
  ) {
    const headers: Record<string, string> = { ...init.headers }
    if (init.body !== undefined) headers['content-type'] = 'application/json'
    if (init.cookie) headers.cookie = init.cookie
    return app.request(path, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
  }

  /** Inicia sesión y devuelve el header `cookie` para siguientes requests. */
  async function login(username: string, password = TEST_PASSWORD) {
    const res = await request('/api/auth/login', { method: 'POST', body: { username, password } })
    if (res.status !== 200) throw new Error(`login falló: ${res.status}`)
    const setCookie = res.headers.get('set-cookie') ?? ''
    return setCookie.split(';')[0]!
  }

  return { db, app, request, login }
}
