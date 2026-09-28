import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { stockItems, stockMovements } from '../../db/schema'
import { createTestApp, createTestHousehold } from '../../test/app'
import type { ProductLookup } from './lookup/types'

// EAN-13 con dígito verificador válido (ficticios para pruebas).
const EAN_UNIT = '4006381333931'
const EAN_PACK = '5901234123457'
const EAN_UNKNOWN = '9780201379624'

const fakeLookup: ProductLookup = {
  lookup: async (ean) =>
    ean === EAN_UNKNOWN
      ? {
          source: 'openfoodfacts',
          name: 'Galletas',
          brand: 'Costa',
          contentAmount: 140,
          contentUnit: 'g',
        }
      : null,
}

let t: ReturnType<typeof createTestApp>
let cookie: string
let locationId: string

type ProductDetail = {
  product: {
    id: string
    name: string
    stockMode: string
    minStock: number | null
    foodName: string | null
  }
  barcodes: { ean: string; packCount: number }[]
  stock: { total: number; lots: number }
}

beforeEach(async () => {
  t = createTestApp({ productLookup: fakeLookup })
  locationId = createTestHousehold(t.db, 'camila').locations[0]!.id
  cookie = await t.login('camila')
})

async function create(body: object) {
  const res = await t.request('/api/catalog/products', { method: 'POST', cookie, body })
  return {
    status: res.status,
    body: (await res.json()) as ProductDetail & { error?: { code: string } },
  }
}

const leche = {
  name: 'leche entera',
  brand: 'colun',
  foodName: 'leche',
  categoryId: 'lacteos',
  contentAmount: 1,
  contentUnit: 'L',
  minStock: 4,
}

describe('productos', () => {
  it('crea un producto con alimento, código y contenido normalizado', async () => {
    const { status, body } = await create({ ...leche, barcode: { ean: EAN_UNIT } })
    expect(status).toBe(201)
    expect(body.product).toMatchObject({
      name: 'Leche entera',
      foodName: 'Leche',
      stockMode: 'unit',
    })
    expect(body.barcodes).toEqual([{ ean: EAN_UNIT, packCount: 1 }])
    expect(body.stock).toEqual({ total: 0, lots: 0 })
  })

  it('busca por nombre sin tildes, por marca y por código exacto', async () => {
    await create({ ...leche, barcode: { ean: EAN_UNIT } })
    await create({ name: 'Plátano', contentAmount: 1, contentUnit: 'kg', stockMode: 'bulk' })
    const search = async (q: string) =>
      (
        (await (await t.request(`/api/catalog/products?q=${q}`, { cookie })).json()) as {
          products: { name: string }[]
        }
      ).products.map((p) => p.name)
    expect(await search('platano')).toEqual(['Plátano'])
    expect(await search('COLUN')).toEqual(['Leche entera'])
    expect(await search(EAN_UNIT)).toEqual(['Leche entera'])
  })

  it('valida el mínimo según el modo resultante al editar', async () => {
    const { body } = await create(leche)
    const res = await t.request(`/api/catalog/products/${body.product.id}`, {
      method: 'PATCH',
      cookie,
      body: { stockMode: 'bulk' }, // el mínimo 4 no sirve en granel
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: { code: 'invalid_min_stock' } })
  })

  it('archivar lo saca de la lista', async () => {
    const { body } = await create(leche)
    await t.request(`/api/catalog/products/${body.product.id}`, { method: 'DELETE', cookie })
    const list = (await (await t.request('/api/catalog/products', { cookie })).json()) as {
      products: unknown[]
    }
    expect(list.products).toHaveLength(0)
  })
})

describe('códigos de barra', () => {
  it('un EAN de pack apunta al mismo producto con su cantidad', async () => {
    const { body } = await create({ ...leche, barcode: { ean: EAN_UNIT } })
    const res = await t.request(`/api/catalog/products/${body.product.id}/barcodes`, {
      method: 'POST',
      cookie,
      body: { ean: EAN_PACK, packCount: 6 },
    })
    expect(res.status).toBe(201)
    const lookup = await (await t.request(`/api/catalog/barcodes/${EAN_PACK}`, { cookie })).json()
    expect(lookup).toMatchObject({
      status: 'found',
      packCount: 6,
      product: { name: 'Leche entera' },
    })
  })

  it('no permite asociar un código ya usado por otro producto', async () => {
    await create({ ...leche, barcode: { ean: EAN_UNIT } })
    const { status, body } = await create({
      name: 'Otra leche',
      contentAmount: 1,
      contentUnit: 'L',
      barcode: { ean: EAN_UNIT },
    })
    expect(status).toBe(409)
    expect(body).toMatchObject({ error: { code: 'barcode_taken' } })
  })

  it('un código desconocido trae la sugerencia externa', async () => {
    const res = await t.request(`/api/catalog/barcodes/${EAN_UNKNOWN}`, { cookie })
    expect(await res.json()).toEqual({
      status: 'unknown',
      ean: EAN_UNKNOWN,
      suggestion: {
        source: 'openfoodfacts',
        name: 'Galletas',
        brand: 'Costa',
        contentAmount: 140,
        contentUnit: 'g',
      },
    })
  })

  it('reconoce códigos de peso variable e inválidos', async () => {
    const get = async (ean: string) =>
      (
        (await (await t.request(`/api/catalog/barcodes/${ean}`, { cookie })).json()) as {
          status: string
        }
      ).status
    expect(await get('2012345012342')).toBe('variable_measure')
    expect(await get('4006381333932')).toBe('invalid')
  })
})

describe('cambio de modo con stock', () => {
  it('envases → granel consolida los lotes en uno con nivel "Hay"', async () => {
    const { body } = await create({ ...leche, minStock: null })
    const id = body.product.id
    t.db
      .insert(stockItems)
      .values([
        { productId: id, locationId, quantity: 3, expiresOn: '2026-10-10' },
        { productId: id, locationId, quantity: 2, expiresOn: '2026-10-01' },
      ])
      .run()

    const res = await t.request(`/api/catalog/products/${id}`, {
      method: 'PATCH',
      cookie,
      body: { stockMode: 'bulk', minStock: 2 },
    })
    expect(res.status).toBe(200)
    const lots = t.db.select().from(stockItems).where(eq(stockItems.productId, id)).all()
    expect(lots).toEqual([expect.objectContaining({ quantity: 2, expiresOn: '2026-10-01' })])
    const movements = t.db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.productId, id))
      .all()
    expect(movements.reduce((s, m) => s + m.delta, 0)).toBe(2 - 5)
  })

  it('granel → envases exige indicar cuántos hay si había stock', async () => {
    const { body } = await create({
      name: 'Palta',
      contentAmount: 1,
      contentUnit: 'u',
      stockMode: 'bulk',
    })
    const id = body.product.id
    t.db.insert(stockItems).values({ productId: id, locationId, quantity: 1 }).run()

    const missing = await t.request(`/api/catalog/products/${id}`, {
      method: 'PATCH',
      cookie,
      body: { stockMode: 'unit' },
    })
    expect(missing.status).toBe(400)
    expect(await missing.json()).toMatchObject({ error: { code: 'unit_count_required' } })

    const ok = await t.request(`/api/catalog/products/${id}`, {
      method: 'PATCH',
      cookie,
      body: { stockMode: 'unit', unitCount: 5 },
    })
    expect(await ok.json()).toMatchObject({ product: { stockMode: 'unit' }, stock: { total: 5 } })
  })
})
