/**
 * Carga datos de ejemplo en la base de desarrollo.
 *   pnpm db:seed          → siembra si la base no tiene hogares
 *   pnpm db:reset         → borra la base, migra y siembra
 */
import { existsSync, rmSync } from 'node:fs'
import {
  addDays,
  capitalizeFirst,
  isBelowMinimum,
  normalizeSearch,
  toCalendarDate,
} from '@rendi/shared'
import { v7 as uuidv7 } from 'uuid'
import { env } from '../../env'
import { hashPasswordSync } from '../../modules/auth/password'
import { productDerivedFields } from '../../modules/catalog/product-fields'
import { createHousehold } from '../../modules/household/service'
import { createDb, type Db } from '../client'
import { runMigrations } from '../migrate'
import {
  foods,
  households,
  memberFoodPrefs,
  members,
  products,
  shoppingListItems,
  stockItems,
  stockMovements,
  users,
} from '../schema'
import { FOODS, HOUSEHOLD_NAME, MANUAL_LIST_ITEMS, MEMBERS, PRODUCTS, SEED_PASSWORD } from './data'

export function seed(db: Db, today = toCalendarDate()) {
  // Argon2 es costoso: se calcula una vez, fuera de la transacción.
  const passwordHash = hashPasswordSync(SEED_PASSWORD)
  return db.transaction((tx) => {
    const { household, locations } = createHousehold(tx, { name: HOUSEHOLD_NAME })
    const householdId = household.id
    const locationId = (name: string) => {
      const loc = locations.find((l) => l.name === name)
      if (!loc) throw new Error(`Ubicación desconocida: ${name}`)
      return loc.id
    }

    const foodIds = new Map<string, string>()
    for (const [name, categoryId] of Object.entries(FOODS)) {
      const [row] = tx
        .insert(foods)
        .values({
          householdId,
          name: capitalizeFirst(name),
          searchText: normalizeSearch(name),
          categoryId,
        })
        .returning({ id: foods.id })
        .all()
      foodIds.set(name, row!.id)
    }
    const foodId = (name: string) => {
      const id = foodIds.get(name)
      if (!id) throw new Error(`Alimento desconocido: ${name}`)
      return id
    }

    for (const m of MEMBERS) {
      const [member] = tx
        .insert(members)
        .values({
          householdId,
          name: m.name,
          kind: m.kind,
          birthDate: m.birthDate,
          notes: m.notes,
          avatarEmoji: m.avatarEmoji,
        })
        .returning({ id: members.id })
        .all()
      if (m.username) {
        tx.insert(users).values({ memberId: member!.id, username: m.username, passwordHash }).run()
      }
      const prefs = [
        ...(m.accepts ?? []).map((food) => ({ food, stance: 'accepts' as const, notes: null })),
        ...(m.rejects ?? []).map((r) =>
          typeof r === 'string'
            ? { food: r, stance: 'rejects' as const, notes: null }
            : { food: r.food, stance: 'rejects' as const, notes: r.notes },
        ),
      ]
      if (prefs.length > 0) {
        tx.insert(memberFoodPrefs)
          .values(
            prefs.map((p) => ({
              memberId: member!.id,
              foodId: foodId(p.food),
              stance: p.stance,
              notes: p.notes,
            })),
          )
          .run()
      }
    }

    const productIds = new Map<string, string>()
    for (const p of PRODUCTS) {
      const [product] = tx
        .insert(products)
        .values({
          householdId,
          name: p.name,
          brand: p.brand,
          foodId: p.food ? foodId(p.food) : null,
          categoryId: p.category,
          contentAmount: p.amount,
          contentUnit: p.unit,
          stockMode: p.mode ?? 'unit',
          minStock: p.min ?? null,
          defaultLocationId: locationId(p.location),
          ...productDerivedFields({
            name: p.name,
            brand: p.brand,
            contentAmount: p.amount,
            contentUnit: p.unit,
          }),
        })
        .returning({ id: products.id })
        .all()
      productIds.set(p.name, product!.id)

      for (const lot of p.lots) {
        const [item] = tx
          .insert(stockItems)
          .values({
            productId: product!.id,
            locationId: locationId(lot.location ?? p.location),
            quantity: lot.quantity,
            expiresOn: lot.expiresInDays === undefined ? null : addDays(today, lot.expiresInDays),
          })
          .returning({ id: stockItems.id })
          .all()
        if (lot.quantity > 0) {
          tx.insert(stockMovements)
            .values({
              actionId: uuidv7(),
              productId: product!.id,
              stockItemId: item!.id,
              delta: lot.quantity,
              reason: 'purchase',
            })
            .run()
        }
      }

      // Regla de stock mínimo: mismo criterio que usará el módulo de compras.
      const total = p.lots.reduce((sum, lot) => sum + lot.quantity, 0)
      if (isBelowMinimum(total, p.min ?? null)) {
        tx.insert(shoppingListItems)
          .values({ householdId, productId: product!.id, source: 'min_stock' })
          .run()
      }
    }

    for (const item of MANUAL_LIST_ITEMS) {
      const target =
        'freeText' in item
          ? { freeText: item.freeText }
          : 'food' in item
            ? { foodId: foodId(item.food) }
            : { productId: productIds.get(item.product) }
      tx.insert(shoppingListItems)
        .values({
          householdId,
          source: 'manual',
          note: item.note,
          quantity: item.quantity,
          ...target,
        })
        .run()
    }

    return household
  })
}

function main() {
  if (env.NODE_ENV === 'production') {
    console.error('El seed es solo para desarrollo (NODE_ENV=production).')
    process.exit(1)
  }
  const reset = process.argv.includes('--reset')
  if (reset) {
    for (const suffix of ['', '-wal', '-shm']) {
      const file = env.DATABASE_PATH + suffix
      if (existsSync(file)) rmSync(file)
    }
    console.log(`Base eliminada: ${env.DATABASE_PATH}`)
  }

  const db = createDb(env.DATABASE_PATH)
  runMigrations(db, { migrationsDir: env.MIGRATIONS_DIR })

  if (db.select({ id: households.id }).from(households).limit(1).get()) {
    console.error('La base ya tiene un hogar. Usa `pnpm db:reset` para empezar de cero.')
    process.exit(1)
  }

  const household = seed(db)
  const count = (table: string) =>
    (db.$client.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n
  console.log(`Hogar "${household.name}" creado:`)
  for (const t of ['members', 'foods', 'products', 'stock_items', 'shopping_list_items']) {
    console.log(`  ${t.padEnd(20)} ${count(t)}`)
  }
  const usernames = MEMBERS.flatMap((m) => m.username ?? [])
  console.log(`Cuentas: ${usernames.join(', ')} · contraseña: ${SEED_PASSWORD}`)
  db.$client.close()
}

if (import.meta.url === `file://${process.argv[1]}`) main()
