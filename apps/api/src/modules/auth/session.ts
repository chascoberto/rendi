import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { DbOrTx } from '../../db/client'
import { members, sessions, users } from '../../db/schema'

const DAY_MS = 86_400_000
export const SESSION_TTL_MS = 30 * DAY_MS
/** Si a la sesión le quedan menos de 15 días, se extiende otros 30 (expiración deslizante). */
const RENEW_THRESHOLD_MS = 15 * DAY_MS

export const SESSION_COOKIE = 'rendi_session'

export interface SessionUser {
  userId: string
  username: string
  memberId: string
  name: string
  householdId: string
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

/** La base solo guarda el SHA-256 del token: una filtración de la base no expone sesiones. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createSession(db: DbOrTx, userId: string, now = new Date()) {
  const token = generateSessionToken()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
  db.insert(sessions)
    .values({ id: hashSessionToken(token), userId, expiresAt, createdAt: now })
    .run()
  return { token, expiresAt }
}

/**
 * Valida el token de la cookie. Devuelve el usuario y, si se renovó, la nueva expiración
 * (para reenviar la cookie). Las sesiones vencidas se eliminan.
 */
export function validateSession(
  db: DbOrTx,
  token: string,
  now = new Date(),
): { user: SessionUser; renewedUntil: Date | null } | null {
  const id = hashSessionToken(token)
  const row = db
    .select({
      expiresAt: sessions.expiresAt,
      userId: users.id,
      username: users.username,
      memberId: members.id,
      name: members.name,
      householdId: members.householdId,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(members, eq(members.id, users.memberId))
    .where(eq(sessions.id, id))
    .get()
  if (!row) return null

  if (row.expiresAt.getTime() <= now.getTime()) {
    db.delete(sessions).where(eq(sessions.id, id)).run()
    return null
  }

  let renewedUntil: Date | null = null
  if (row.expiresAt.getTime() - now.getTime() < RENEW_THRESHOLD_MS) {
    renewedUntil = new Date(now.getTime() + SESSION_TTL_MS)
    db.update(sessions).set({ expiresAt: renewedUntil }).where(eq(sessions.id, id)).run()
  }

  const { expiresAt: _expiresAt, ...user } = row
  return { user, renewedUntil }
}

export function invalidateSession(db: DbOrTx, token: string) {
  db.delete(sessions)
    .where(eq(sessions.id, hashSessionToken(token)))
    .run()
}

export function invalidateUserSessions(db: DbOrTx, userId: string) {
  db.delete(sessions).where(eq(sessions.userId, userId)).run()
}
