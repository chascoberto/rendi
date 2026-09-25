import type { Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import type { AppEnv, AuthEnv } from '../../lib/context'
import { AppError } from '../../lib/errors'
import { SESSION_COOKIE, SESSION_TTL_MS, validateSession } from './session'

export function setSessionCookie<E extends AppEnv>(c: Context<E>, token: string, expiresAt: Date) {
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: c.var.config.cookieSecure,
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  })
}

export function clearSessionCookie<E extends AppEnv>(c: Context<E>) {
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: c.var.config.cookieSecure })
}

/** Exige sesión válida y deja el usuario en `c.var.user`. */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  const session = token ? validateSession(c.var.db, token) : null
  if (!token || !session) {
    if (token) clearSessionCookie(c)
    throw new AppError(401, 'unauthenticated', 'Inicia sesión para continuar')
  }
  if (session.renewedUntil) setSessionCookie(c, token, session.renewedUntil)
  c.set('user', session.user)
  await next()
})
