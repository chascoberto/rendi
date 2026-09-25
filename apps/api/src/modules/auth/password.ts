import { hash, hashSync, verify } from '@node-rs/argon2'

// Argon2id con los parámetros mínimos recomendados por OWASP (19 MiB, 2 iteraciones).
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const

export const hashPassword = (password: string) => hash(password, OPTIONS)

/** Versión síncrona, para scripts (seed) que corren dentro de una transacción síncrona. */
export const hashPasswordSync = (password: string) => hashSync(password, OPTIONS)

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password)
  } catch {
    return false
  }
}

/** Hash de referencia para igualar el tiempo de respuesta cuando el usuario no existe. */
let dummyHash: string | undefined
export async function burnPasswordCheck(password: string) {
  dummyHash ??= await hashPassword('rendi-dummy-password')
  await verifyPassword(dummyHash, password)
}
