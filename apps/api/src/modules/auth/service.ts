import { eq } from 'drizzle-orm'
import type { Db, DbOrTx } from '../../db/client'
import { members, users } from '../../db/schema'
import { burnPasswordCheck, hashPassword, verifyPassword } from './password'
import { invalidateUserSessions } from './session'

/** Verifica credenciales. Tarda lo mismo exista o no el usuario. */
export async function authenticate(db: Db, username: string, password: string) {
  const user = db.select().from(users).where(eq(users.username, username)).get()
  if (!user) {
    await burnPasswordCheck(password)
    return null
  }
  return (await verifyPassword(user.passwordHash, password)) ? user : null
}

/** Crea un adulto: miembro del hogar + cuenta de acceso. */
export function createAdultUser(
  db: DbOrTx,
  input: { householdId: string; name: string; username: string; passwordHash: string },
) {
  return db.transaction((tx) => {
    const [member] = tx
      .insert(members)
      .values({ householdId: input.householdId, name: input.name, kind: 'adult' })
      .returning()
      .all()
    const [user] = tx
      .insert(users)
      .values({ memberId: member!.id, username: input.username, passwordHash: input.passwordHash })
      .returning()
      .all()
    return { member: member!, user: user! }
  })
}

/** Cambia la contraseña y cierra todas las sesiones abiertas del usuario. */
export async function setPassword(db: Db, userId: string, password: string) {
  const passwordHash = await hashPassword(password)
  db.transaction((tx) => {
    tx.update(users).set({ passwordHash }).where(eq(users.id, userId)).run()
    invalidateUserSessions(tx, userId)
  })
}
