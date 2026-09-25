/**
 * Administración de cuentas de adultos (no hay registro público).
 *   pnpm user:create   → crea un adulto con cuenta (y el hogar, si no existe)
 *   pnpm user:passwd   → cambia la contraseña de un usuario y cierra sus sesiones
 *   pnpm user:list     → lista las cuentas
 */
import {
  capitalizeFirst,
  capitalizePersonName,
  passwordSchema,
  usernameSchema,
} from '@rendi/shared'
import { asc, eq } from 'drizzle-orm'
import { createDb, type Db } from '../db/client'
import { runMigrations } from '../db/migrate'
import { households, members, users } from '../db/schema'
import { env } from '../env'
import { hashPassword } from '../modules/auth/password'
import { createAdultUser, setPassword } from '../modules/auth/service'
import { createHousehold } from '../modules/household/service'
import { prompt, promptHidden } from './prompt'

async function askValid<T>(ask: () => Promise<string>, parse: (v: string) => T): Promise<T> {
  for (;;) {
    try {
      return parse(await ask())
    } catch (err) {
      const issue = (err as { issues?: { message: string }[] }).issues?.[0]?.message
      console.error(`  ✗ ${issue ?? (err as Error).message}`)
    }
  }
}

async function askPassword(): Promise<string> {
  for (;;) {
    const password = await askValid(
      () => promptHidden('Contraseña: '),
      (v) => passwordSchema.parse(v),
    )
    const again = await promptHidden('Repite la contraseña: ')
    if (password === again) return password
    console.error('  ✗ Las contraseñas no coinciden')
  }
}

async function create(db: Db) {
  let household = db.select().from(households).limit(1).get()
  if (!household) {
    const name = capitalizeFirst((await prompt('Nombre del hogar [Mi hogar]: ')) || 'Mi hogar')
    household = createHousehold(db, { name }).household
    console.log(`Hogar "${household.name}" creado.`)
  }
  const name = await askValid(
    () => prompt('Nombre de la persona: '),
    (v) => {
      if (!v) throw new Error('Ingresa un nombre')
      return capitalizePersonName(v)
    },
  )
  const username = await askValid(
    () => prompt('Usuario: '),
    (v) => {
      const parsed = usernameSchema.parse(v)
      if (db.select().from(users).where(eq(users.username, parsed)).get()) {
        throw new Error('Ese usuario ya existe')
      }
      return parsed
    },
  )
  const passwordHash = await hashPassword(await askPassword())
  createAdultUser(db, { householdId: household.id, name, username, passwordHash })
  console.log(`Cuenta "${username}" creada en "${household.name}".`)
}

async function passwd(db: Db) {
  const username = usernameSchema.parse(await prompt('Usuario: '))
  const user = db.select().from(users).where(eq(users.username, username)).get()
  if (!user) throw new Error(`No existe el usuario "${username}"`)
  await setPassword(db, user.id, await askPassword())
  console.log('Contraseña actualizada. Se cerraron sus sesiones abiertas.')
}

function list(db: Db) {
  const rows = db
    .select({ username: users.username, name: members.name, household: households.name })
    .from(users)
    .innerJoin(members, eq(members.id, users.memberId))
    .innerJoin(households, eq(households.id, members.householdId))
    .orderBy(asc(users.username))
    .all()
  if (rows.length === 0) console.log('No hay cuentas. Crea una con `pnpm user:create`.')
  for (const r of rows) console.log(`${r.username.padEnd(20)} ${r.name.padEnd(20)} ${r.household}`)
}

const commands = { create, passwd, list } as const

async function main() {
  const command = process.argv[2] as keyof typeof commands | undefined
  if (!command || !(command in commands)) {
    console.error('Uso: users.ts <create|passwd|list>')
    process.exit(1)
  }
  const db = createDb(env.DATABASE_PATH)
  runMigrations(db, { migrationsDir: env.MIGRATIONS_DIR })
  try {
    await commands[command](db)
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`)
    process.exitCode = 1
  } finally {
    db.$client.close()
  }
}

void main()
