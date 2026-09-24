import { and, eq, isNull } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { productDerivedFields } from '../modules/catalog/product-fields'
import { createHousehold } from '../modules/household/service'
import { createTestDb } from '../test/db'
import type { Db } from './client'
import { products, shoppingListItems, stockItems, supermarkets } from './schema'
import { seed } from './seed'

let db: Db
let householdId: string
let locationId: string

function insertProduct(overrides: Partial<typeof products.$inferInsert> = {}) {
  const [row] = db
    .insert(products)
    .values({
      householdId,
      name: 'Plátano',
      contentAmount: 1,
      contentUnit: 'kg',
      ...productDerivedFields({ name: 'Plátano', contentAmount: 1, contentUnit: 'kg' }),
      ...overrides,
    })
    .returning()
    .all()
  return row!
}

beforeEach(() => {
  db = createTestDb()
  const created = createHousehold(db, { name: 'Test' })
  householdId = created.household.id
  locationId = created.locations[0]!.id
})

describe('datos de referencia', () => {
  it('precarga los 7 supermercados', () => {
    const rows = db.select().from(supermarkets).all()
    expect(rows.map((s) => s.id).sort()).toEqual(
      ['acuenta', 'alvi', 'cugat', 'ganga', 'jumbo', 'lider', 'super10'].sort(),
    )
    expect(
      rows
        .filter((s) => s.hasOnlinePrices)
        .map((s) => s.id)
        .sort(),
    ).toEqual(['jumbo', 'lider'])
    expect(rows.find((s) => s.id === 'alvi')?.isWholesale).toBe(true)
  })

  it('crea el hogar con sus tres ubicaciones', () => {
    const created = createHousehold(db, { name: 'Otro' })
    expect(created.locations.map((l) => l.name)).toEqual(['Despensa', 'Refrigerador', 'Congelador'])
  })
})

describe('invariantes de stock por modo', () => {
  it('bulk solo admite niveles 0, 1 y 2', () => {
    const p = insertProduct({ stockMode: 'bulk' })
    expect(() =>
      db.insert(stockItems).values({ productId: p.id, locationId, quantity: 3 }).run(),
    ).toThrow(/stock_bulk_level/)
    const [lot] = db
      .insert(stockItems)
      .values({ productId: p.id, locationId, quantity: 2 })
      .returning()
      .all()
    expect(() =>
      db.update(stockItems).set({ quantity: 5 }).where(eq(stockItems.id, lot!.id)).run(),
    ).toThrow(/stock_bulk_level/)
  })

  it('bulk tiene a lo más un lote', () => {
    const p = insertProduct({ stockMode: 'bulk' })
    db.insert(stockItems).values({ productId: p.id, locationId, quantity: 2 }).run()
    expect(() =>
      db.insert(stockItems).values({ productId: p.id, locationId, quantity: 1 }).run(),
    ).toThrow(/stock_bulk_single_lot/)
  })

  it('unit solo admite envases enteros', () => {
    const p = insertProduct()
    expect(() =>
      db.insert(stockItems).values({ productId: p.id, locationId, quantity: 1.5 }).run(),
    ).toThrow(/stock_unit_integer/)
    expect(() =>
      db.insert(stockItems).values({ productId: p.id, locationId, quantity: 7 }).run(),
    ).not.toThrow()
  })

  it('no permite pasar a bulk sin consolidar el stock', () => {
    const p = insertProduct()
    db.insert(stockItems).values({ productId: p.id, locationId, quantity: 1 }).run()
    db.insert(stockItems).values({ productId: p.id, locationId, quantity: 1 }).run()
    expect(() =>
      db.update(products).set({ stockMode: 'bulk' }).where(eq(products.id, p.id)).run(),
    ).toThrow(/stock_bulk_single_lot/)
  })

  it('valida el stock mínimo según el modo', () => {
    expect(() => insertProduct({ stockMode: 'bulk', minStock: 1 })).toThrow(/CHECK/)
    expect(() => insertProduct({ stockMode: 'unit', minStock: 0 })).toThrow(/CHECK/)
    expect(() => insertProduct({ stockMode: 'bulk', minStock: 2 })).not.toThrow()
  })
})

describe('lista de compras', () => {
  it('no duplica ítems automáticos abiertos del mismo producto', () => {
    const p = insertProduct({ minStock: 2 })
    db.insert(shoppingListItems).values({ householdId, productId: p.id, source: 'min_stock' }).run()
    expect(() =>
      db
        .insert(shoppingListItems)
        .values({ householdId, productId: p.id, source: 'min_stock' })
        .run(),
    ).toThrow(/UNIQUE/)
    // Un ítem manual del mismo producto sí se permite.
    expect(() =>
      db.insert(shoppingListItems).values({ householdId, productId: p.id, source: 'manual' }).run(),
    ).not.toThrow()
  })

  it('exige exactamente un destino por ítem', () => {
    expect(() =>
      db.insert(shoppingListItems).values({ householdId, source: 'manual' }).run(),
    ).toThrow(/CHECK/)
  })
})

describe('seed', () => {
  it('carga el hogar de ejemplo y agrega los faltantes por stock mínimo', () => {
    const fresh = createTestDb()
    const household = seed(fresh, '2026-09-24')
    const auto = fresh
      .select({ name: products.name })
      .from(shoppingListItems)
      .innerJoin(products, eq(products.id, shoppingListItems.productId))
      .where(
        and(
          eq(shoppingListItems.householdId, household.id),
          eq(shoppingListItems.source, 'min_stock'),
          isNull(shoppingListItems.purchaseId),
        ),
      )
      .all()
      .map((r) => r.name)
      .sort()
    expect(auto).toEqual(
      ['Leche entera', 'Papel higiénico doble hoja', 'Plátano', 'Tallarines N°5'].sort(),
    )
  })
})
