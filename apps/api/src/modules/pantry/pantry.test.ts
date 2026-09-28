import { addDays, toCalendarDate } from '@rendi/shared'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { stockMovements } from '../../db/schema'
import { createTestApp, createTestHousehold } from '../../test/app'

let t: ReturnType<typeof createTestApp>
let cookie: string
let locations: { id: string; name: string }[]

type ActionResult = { actionId: string | null; stock: { total: number; lots: number } }
type Lot = {
  id: string
  quantity: number
  expiresOn: string | null
  locationId: string
  locationName: string
}

const today = toCalendarDate()

beforeEach(async () => {
  t = createTestApp()
  locations = createTestHousehold(t.db, 'camila').locations
  cookie = await t.login('camila')
})

async function api<T = ActionResult>(path: string, method = 'POST', body: unknown = {}) {
  const res = await t.request(`/api${path}`, { method, cookie, body })
  return { status: res.status, body: (await res.json()) as T & { error?: { code: string } } }
}

async function get<T>(path: string) {
  const res = await t.request(`/api${path}`, { cookie })
  return (await res.json()) as T
}

async function createProduct(body: object = {}) {
  const res = await api<{ product: { id: string } }>('/catalog/products', 'POST', {
    name: 'Yogur',
    contentAmount: 125,
    contentUnit: 'g',
    ...body,
  })
  return res.body.product.id
}

async function lots(productId: string) {
  return (await get<{ lots: Lot[] }>(`/catalog/products/${productId}`)).lots
}

describe('envases (unit)', () => {
  let id: string
  beforeEach(async () => {
    id = await createProduct({ defaultLocationId: locations[1]!.id })
  })

  it('compré suma a un lote igual o crea uno nuevo, en la ubicación del producto', async () => {
    const soon = addDays(today, 3)
    await api(`/pantry/products/${id}/purchase`, 'POST', { quantity: 2, expiresOn: soon })
    await api(`/pantry/products/${id}/purchase`, 'POST', { quantity: 1, expiresOn: soon })
    const { body } = await api(`/pantry/products/${id}/purchase`, 'POST', { quantity: 4 })
    expect(body.stock).toEqual({ total: 7, lots: 2 })

    const list = await lots(id)
    expect(list.map((l) => [l.quantity, l.expiresOn, l.locationName])).toEqual([
      [3, soon, 'Refrigerador'],
      [4, null, 'Refrigerador'],
    ])
  })

  it('usé uno descuenta del lote que vence primero (FEFO)', async () => {
    await api(`/pantry/products/${id}/purchase`, 'POST', { quantity: 2 })
    await api(`/pantry/products/${id}/purchase`, 'POST', {
      quantity: 1,
      expiresOn: addDays(today, 10),
    })
    await api(`/pantry/products/${id}/purchase`, 'POST', {
      quantity: 1,
      expiresOn: addDays(today, 2),
    })

    await api(`/pantry/products/${id}/consume`)
    expect((await lots(id)).map((l) => l.quantity)).toEqual([1, 2]) // se acabó el que vence en 2 días
    await api(`/pantry/products/${id}/consume`)
    expect((await lots(id)).map((l) => l.quantity)).toEqual([2])
  })

  it('usé uno sobre un lote en particular, y sin stock responde 409', async () => {
    await api(`/pantry/products/${id}/purchase`, 'POST', { quantity: 1 })
    const [lot] = await lots(id)
    const ok = await api(`/pantry/products/${id}/consume`, 'POST', { lotId: lot!.id })
    expect(ok.body.stock.total).toBe(0)

    const empty = await api(`/pantry/products/${id}/consume`)
    expect(empty.status).toBe(409)
    expect(empty.body.error?.code).toBe('out_of_stock')
  })

  it('se acabó deja en cero todos los lotes con una sola acción', async () => {
    await api(`/pantry/products/${id}/purchase`, 'POST', { quantity: 2 })
    await api(`/pantry/products/${id}/purchase`, 'POST', {
      quantity: 3,
      expiresOn: addDays(today, 5),
    })
    const { body } = await api(`/pantry/products/${id}/deplete`)
    expect(body.stock.total).toBe(0)
    const moves = t.db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.actionId, body.actionId!))
      .all()
    expect(moves.map((m) => [m.delta, m.reason])).toEqual([
      [-3, 'depleted'],
      [-2, 'depleted'],
    ])

    // Sin stock no hay nada que registrar.
    const again = await api(`/pantry/products/${id}/deplete`)
    expect(again.body.actionId).toBeNull()
  })

  it('ajusta cantidad, vencimiento y ubicación de un lote', async () => {
    await api(`/pantry/products/${id}/purchase`, 'POST', { quantity: 2 })
    const [lot] = await lots(id)
    const date = addDays(today, 7)
    const { body } = await api(`/pantry/lots/${lot!.id}`, 'PATCH', {
      quantity: 5,
      expiresOn: date,
      locationId: locations[2]!.id,
    })
    expect(body.stock.total).toBe(5)
    expect(await lots(id)).toMatchObject([
      { quantity: 5, expiresOn: date, locationName: 'Congelador' },
    ])

    const onlyDate = await api(`/pantry/lots/${lot!.id}`, 'PATCH', { expiresOn: null })
    expect(onlyDate.body.actionId).toBeNull()

    const bad = await api(`/pantry/lots/${lot!.id}`, 'PATCH', { quantity: 1.5 })
    expect(bad.status).toBe(400)
  })

  it('no acepta niveles de granel', async () => {
    const res = await api(`/pantry/products/${id}/level`, 'PUT', { level: 1 })
    expect(res.status).toBe(400)
    expect(res.body.error?.code).toBe('unit_has_count')
  })
})

describe('a granel (bulk)', () => {
  let id: string
  beforeEach(async () => {
    id = await createProduct({
      name: 'Plátano',
      contentAmount: 1,
      contentUnit: 'kg',
      stockMode: 'bulk',
    })
  })

  it('compré deja el nivel en "Hay" con un solo lote', async () => {
    await api(`/pantry/products/${id}/level`, 'PUT', { level: 1 })
    const { body } = await api(`/pantry/products/${id}/purchase`, 'POST', { quantity: 5 })
    expect(body.stock).toEqual({ total: 2, lots: 1 })
    await api(`/pantry/products/${id}/purchase`)
    expect(await lots(id)).toHaveLength(1)
  })

  it('cambia el nivel y registra el motivo', async () => {
    await api(`/pantry/products/${id}/purchase`)
    const low = await api(`/pantry/products/${id}/level`, 'PUT', { level: 1 })
    const empty = await api(`/pantry/products/${id}/level`, 'PUT', { level: 0 })
    expect(empty.body.stock.total).toBe(0)
    const reasons = [low, empty].map(
      (r) =>
        t.db
          .select()
          .from(stockMovements)
          .where(eq(stockMovements.actionId, r.body.actionId!))
          .get()!.reason,
    )
    expect(reasons).toEqual(['consume', 'depleted'])

    const same = await api(`/pantry/products/${id}/level`, 'PUT', { level: 0 })
    expect(same.body.actionId).toBeNull()
  })

  it('"usé uno" no aplica y el ajuste de lote solo admite niveles', async () => {
    const consume = await api(`/pantry/products/${id}/consume`)
    expect(consume.status).toBe(400)
    expect(consume.body.error?.code).toBe('bulk_has_levels')

    await api(`/pantry/products/${id}/purchase`)
    const [lot] = await lots(id)
    expect((await api(`/pantry/lots/${lot!.id}`, 'PATCH', { quantity: 3 })).status).toBe(400)
    expect((await api(`/pantry/lots/${lot!.id}`, 'PATCH', { quantity: 1 })).status).toBe(200)
  })
})

describe('deshacer', () => {
  let id: string
  beforeEach(async () => {
    id = await createProduct()
  })

  it('revierte todos los movimientos de la acción, una sola vez', async () => {
    await api(`/pantry/products/${id}/purchase`, 'POST', { quantity: 2 })
    await api(`/pantry/products/${id}/purchase`, 'POST', {
      quantity: 1,
      expiresOn: addDays(today, 1),
    })
    const { body } = await api(`/pantry/products/${id}/deplete`)

    const undo = await api(`/pantry/actions/${body.actionId}/undo`)
    expect(undo.status).toBe(200)
    expect(undo.body.stock.total).toBe(3)
    const moves = t.db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.actionId, body.actionId!))
      .all()
    expect(moves.every((m) => m.undoneAt !== null)).toBe(true)

    expect((await api(`/pantry/actions/${body.actionId}/undo`)).status).toBe(404)
  })

  it('deshacer una compra deja el lote en cero', async () => {
    const { body } = await api(`/pantry/products/${id}/purchase`, 'POST', { quantity: 3 })
    const undo = await api(`/pantry/actions/${body.actionId}/undo`)
    expect(undo.body.stock).toEqual({ total: 0, lots: 0 })
    expect(await lots(id)).toEqual([])
  })

  it('responde 409 si el stock cambió y el resultado no es válido', async () => {
    const bought = await api(`/pantry/products/${id}/purchase`, 'POST', { quantity: 1 })
    await api(`/pantry/products/${id}/consume`)
    const undo = await api(`/pantry/actions/${bought.body.actionId}/undo`)
    expect(undo.status).toBe(409)
    expect(undo.body.error?.code).toBe('undo_conflict')
  })
})

describe('vencimientos y aislamiento', () => {
  it('lista los lotes con stock que vencen pronto, incluidos los vencidos', async () => {
    const yogur = await createProduct()
    const leche = await createProduct({ name: 'Leche', contentAmount: 1, contentUnit: 'L' })
    const buy = (pid: string, days: number | null, quantity = 1) =>
      api(`/pantry/products/${pid}/purchase`, 'POST', {
        quantity,
        expiresOn: days === null ? null : addDays(today, days),
      })
    await buy(yogur, 5)
    await buy(leche, -1)
    await buy(leche, 40)
    await buy(yogur, null)
    const used = await buy(yogur, 2)
    await api(`/pantry/products/${yogur}/deplete`, 'POST', {
      lotId: (await lots(yogur)).find((l) => l.expiresOn === addDays(today, 2))!.id,
    })
    expect(used.status).toBe(200)

    const res = await get<{
      today: string
      lots: { expiresOn: string; quantity: number; product: { name: string } }[]
    }>('/pantry/expiring?days=30')
    expect(res.today).toBe(today)
    expect(res.lots.map((l) => [l.product.name, l.expiresOn])).toEqual([
      ['Leche', addDays(today, -1)],
      ['Yogur', addDays(today, 5)],
    ])
  })

  it('no permite tocar el stock de otro hogar', async () => {
    const id = await createProduct()
    const { body } = await api(`/pantry/products/${id}/purchase`, 'POST', { quantity: 2 })
    const [lot] = await lots(id)

    createTestHousehold(t.db, 'otro', 'Otro hogar')
    cookie = await t.login('otro')
    expect((await api(`/pantry/products/${id}/consume`)).status).toBe(404)
    expect((await api(`/pantry/lots/${lot!.id}`, 'PATCH', { quantity: 0 })).status).toBe(404)
    expect((await api(`/pantry/actions/${body.actionId}/undo`)).status).toBe(404)
    expect((await get<{ lots: unknown[] }>('/pantry/expiring')).lots).toEqual([])
  })

  it('la lista de productos incluye el stock total y el próximo vencimiento', async () => {
    const id = await createProduct()
    await api(`/pantry/products/${id}/purchase`, 'POST', { quantity: 2 })
    await api(`/pantry/products/${id}/purchase`, 'POST', {
      quantity: 1,
      expiresOn: addDays(today, 4),
    })
    const res = await get<{ products: { stock: number; nextExpiry: string | null }[] }>(
      '/catalog/products',
    )
    expect(res.products[0]).toMatchObject({ stock: 3, nextExpiry: addDays(today, 4) })
  })
})
