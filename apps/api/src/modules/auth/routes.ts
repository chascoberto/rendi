import { loginSchema } from '@rendi/shared'
import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import type { AppEnv } from '../../lib/context'
import { AppError } from '../../lib/errors'
import { RateLimiter } from '../../lib/rate-limit'
import { validate } from '../../lib/validation'
import { clearSessionCookie, requireAuth, setSessionCookie } from './middleware'
import { authenticate } from './service'
import { SESSION_COOKIE, createSession, invalidateSession } from './session'

// 5 intentos fallidos por usuario cada 15 minutos.
const loginLimiter = new RateLimiter(5, 15 * 60_000)

export const authRoutes = new Hono<AppEnv>()
  .post('/login', validate('json', loginSchema), async (c) => {
    const { username, password } = c.req.valid('json')
    if (loginLimiter.isBlocked(username)) {
      throw new AppError(429, 'too_many_attempts', 'Demasiados intentos. Espera unos minutos.')
    }
    const user = await authenticate(c.var.db, username, password)
    if (!user) {
      loginLimiter.fail(username)
      throw new AppError(401, 'invalid_credentials', 'Usuario o contraseña incorrectos')
    }
    loginLimiter.reset(username)
    const { token, expiresAt } = createSession(c.var.db, user.id)
    setSessionCookie(c, token, expiresAt)
    return c.json({ ok: true as const })
  })
  .post('/logout', (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (token) invalidateSession(c.var.db, token)
    clearSessionCookie(c)
    return c.json({ ok: true as const })
  })
  .get('/me', requireAuth, (c) => c.json({ user: c.var.user }))
