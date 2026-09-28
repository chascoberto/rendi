import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { purchases, stockMovements } from '../../db/schema'
import { createTestApp, createTestHousehold, TEST_PASSWORD } from '../../test/app'
import { hashPasswordSync } from '../auth/password'
import { createAdultUser } from '../auth/service'

let t: ReturnType<typeof createTestApp>
let camila: string
let diego: string

type Item = {
  id: string
  source: string
  name: string
  quantity: number | null
  checked: boolean
  checkedBy: { name: string } | null
  product: { stock: number; minStock: number | null } | null
}

beforeEach(async () => {
  t = createTestApp()
  const { household } = createTestHousehold(t.db, 'camila')
  createAdultUser(t.db, {
    householdId: household.id,
    name: 'Diego',
    username: 'diego',
    passwordHash: hashPasswordSync(TEST_PASSWORD),
  })
  camila = await t.login('camila')
  diego = await t.login('diego')
})

async function call<T = Record<string, unknown>>(
  path: string,
  {
    method = 'POST',
    body,
    cookie = camila,
  }: { method?: string; body?: unknown; cookie?: string } = {},
) {
  const res = await t.request(`/api${path}`, { method, cookie, body })
  return { status: res.status, body: (await res.json()) as T & { error?: { code: string } } }
}

async function items(cookie = camila) {
  return (await call<{ items: Item[] }>('/shopping/items', { method: 'GET', cookie })).body.items
}

async function createProduct(body: object = {}) {
  const res = await call<{ product: { id: string } }>('/catalog/products', {
    body: { name: 'Leche', contentAmount: 1, contentUnit: 'L', ...body },
  })
  return res.body.product.id
}

const stock = (id: string, action: string, body: object = {}) =>
  call<{ actionId: string | null }>(`/pantry/products/${id}/${action}`, { body })

describe('reposición automática', () => {
  it('agrega el ítem bajo el mínimo y lo retira al reponer', async () => {
    const id = await createProduct({ minStock: 2 })
    expect(await items()).toMatchObject([
      { source: 'min_stock', name: 'Leche', product: { stock: 0, minStock: 2 } },
    ])

    await stock(id, 'purchase', { quantity: 2 })
    expect(await items()).toEqual([])

    const used = await stock(id, 'consume')
    expect(await items()).toHaveLength(1)

    // Deshacer también re-evalúa la regla.
    await call(`/pantry/actions/${used.body.actionId}/undo`)
    expect(await items()).toEqual([])
  })

  it('no retira un ítem automático ya marcado, ni duplica uno manual', async () => {
    const id = await createProduct({ minStock: 3 })
    const [auto] = await items()
    await call(`/shopping/items/${auto!.id}/check`, {
      method: 'PUT',
      body: { checked: true, at: Date.now() },
    })
    await stock(id, 'purchase', { quantity: 5 })
    expect(await items()).toMatchObject([{ id: auto!.id, checked: true }])

    const yogur = await createProduct({ name: 'Yogur' })
    await call('/shopping/items', { body: { productId: yogur, quantity: 6 } })
    await call(`/catalog/products/${yogur}`, { method: 'PATCH', body: { minStock: 1 } })
    expect((await items()).filter((i) => i.name === 'Yogur')).toMatchObject([
      { source: 'manual', quantity: 6 },
    ])
  })

  it('quitar el mínimo o archivar el producto retira el ítem automático', async () => {
    const leche = await createProduct({ minStock: 1 })
    const pan = await createProduct({ name: 'Pan', minStock: 1 })
    expect(await items()).toHaveLength(2)

    await call(`/catalog/products/${leche}`, { method: 'PATCH', body: { minStock: null } })
    await call(`/catalog/products/${pan}`, { method: 'DELETE' })
    expect(await items()).toEqual([])
  })

  it('a granel: "queda poco" agrega el ítem si está activado', async () => {
    const id = await createProduct({
      name: 'Plátano',
      contentUnit: 'kg',
      stockMode: 'bulk',
      minStock: 2,
    })
    await stock(id, 'purchase')
    expect(await items()).toEqual([])
    await call(`/pantry/products/${id}/level`, { method: 'PUT', body: { level: 1 } })
    expect(await items()).toMatchObject([{ name: 'Plátano', source: 'min_stock' }])
  })
})

describe('ítems manuales', () => {
  it('agrega productos, alimentos y texto libre, sin duplicar', async () => {
    const id = await createProduct({ foodName: 'leche' })
    const food = (
      await call<{ foods: { id: string }[] }>('/catalog/foods?q=leche', { method: 'GET' })
    ).body.foods[0]!

    expect((await call('/shopping/items', { body: { productId: id } })).status).toBe(201)
    expect(
      (await call('/shopping/items', { body: { foodId: food.id, note: 'sin lactosa' } })).status,
    ).toBe(201)
    expect(
      (await call('/shopping/items', { body: { freeText: 'velas', quantity: 2 } })).status,
    ).toBe(201)
    expect(await items()).toMatchObject([
      { name: 'Leche', source: 'manual' },
      { name: 'Leche' },
      { name: 'Velas', quantity: 2 },
    ])

    const dup = await call('/shopping/items', { body: { productId: id } })
    expect(dup.status).toBe(409)
    expect(dup.body.error?.code).toBe('already_listed')
    expect((await call('/shopping/items', { body: {} })).status).toBe(400)
    expect((await call('/shopping/items', { body: { productId: id, freeText: 'x' } })).status).toBe(
      400,
    )
  })

  it('edita cantidad y nota, y elimina', async () => {
    const { body } = await call<{ item: Item }>('/shopping/items', { body: { freeText: 'pan' } })
    const edited = await call<{ item: Item & { note: string | null } }>(
      `/shopping/items/${body.item.id}`,
      { method: 'PATCH', body: { quantity: 10, note: 'amasado' } },
    )
    expect(edited.body.item).toMatchObject({ quantity: 10, note: 'amasado' })
    await call(`/shopping/items/${body.item.id}`, { method: 'DELETE' })
    expect(await items()).toEqual([])
  })

  it('no ve ni toca la lista de otro hogar', async () => {
    const { body } = await call<{ item: Item }>('/shopping/items', { body: { freeText: 'pan' } })
    const id = await createProduct()
    createTestHousehold(t.db, 'otro', 'Otro hogar')
    const otro = await t.login('otro')
    expect(await items(otro)).toEqual([])
    expect(
      (await call(`/shopping/items/${body.item.id}`, { method: 'DELETE', cookie: otro })).status,
    ).toBe(404)
    expect((await call('/shopping/items', { body: { productId: id }, cookie: otro })).status).toBe(
      404,
    )
  })
})

describe('marcar', () => {
  it('guarda quién marcó y la última escritura (según el cliente) gana', async () => {
    const { body } = await call<{ item: Item }>('/shopping/items', { body: { freeText: 'pan' } })
    const url = `/shopping/items/${body.item.id}/check`
    const now = Date.now()

    const checked = await call<{ applied: boolean; item: Item }>(url, {
      method: 'PUT',
      body: { checked: true, at: now - 1_000 },
      cookie: diego,
    })
    expect(checked.body).toMatchObject({ applied: true, item: { checkedBy: { name: 'Diego' } } })

    // Un desmarcado anterior que llega tarde (cola offline) no pisa el marcado.
    const stale = await call<{ applied: boolean }>(url, {
      method: 'PUT',
      body: { checked: false, at: now - 5_000 },
    })
    expect(stale.body.applied).toBe(false)
    expect((await items())[0]).toMatchObject({ checked: true, checkedBy: { name: 'Diego' } })

    await call(url, { method: 'PUT', body: { checked: false, at: now } })
    expect((await items())[0]).toMatchObject({ checked: false, checkedBy: null })
  })
})

describe('finalizar compra', () => {
  it('toma solo lo marcado por quien finaliza y lo pasa al stock', async () => {
    const leche = await createProduct({ minStock: 4 })
    const arroz = await createProduct({ name: 'Arroz', contentUnit: 'kg' })
    const add = async (body: object) =>
      (await call<{ item: Item }>('/shopping/items', { body })).body.item.id
    const autoLeche = (await items())[0]!.id
    const arrozItem = await add({ productId: arroz, quantity: 2 })
    const velas = await add({ freeText: 'velas' })
    const pan = await add({ freeText: 'pan' })
    const check = (id: string, cookie = camila) =>
      call(`/shopping/items/${id}/check`, {
        method: 'PUT',
        body: { checked: true, at: Date.now() },
        cookie,
      })
    await check(autoLeche)
    await check(arrozItem)
    await check(velas)
    await check(pan, diego)

    const res = await call<{ purchase: { id: string; items: number; stocked: number } }>(
      '/shopping/purchases',
      { body: { supermarketId: 'lider', quantities: { [autoLeche]: 3 } } },
    )
    expect(res.status).toBe(201)
    expect(res.body.purchase).toMatchObject({ items: 3, stocked: 2 })

    // Queda lo de Diego y, como la leche sigue bajo el mínimo (3 < 4), un ítem automático nuevo.
    const left = await items()
    expect(left.map((i) => [i.name, i.source, i.checked])).toEqual([
      ['Pan', 'manual', true],
      ['Leche', 'min_stock', false],
    ])
    expect(left[1]!.id).not.toBe(autoLeche)

    const detail = async (id: string) =>
      (await call<{ stock: { total: number } }>(`/catalog/products/${id}`, { method: 'GET' })).body
        .stock.total
    expect(await detail(leche)).toBe(3)
    expect(await detail(arroz)).toBe(2)
    const moves = t.db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.purchaseId, res.body.purchase.id))
      .all()
    expect(moves).toHaveLength(2)
    expect(t.db.select().from(purchases).get()).toMatchObject({ supermarketId: 'lider' })
  })

  it('exige haber marcado algo y un supermercado válido', async () => {
    const none = await call('/shopping/purchases', { body: { supermarketId: 'lider' } })
    expect(none.body.error?.code).toBe('nothing_checked')
    const bad = await call('/shopping/purchases', { body: { supermarketId: 'otro' } })
    expect(bad.body.error?.code).toBe('invalid_supermarket')
  })

  it('lista los supermercados activos', async () => {
    const res = await call<{ supermarkets: { id: string }[] }>('/shopping/supermarkets', {
      method: 'GET',
    })
    expect(res.body.supermarkets.map((s) => s.id).slice(0, 3)).toEqual(['lider', 'jumbo', 'alvi'])
  })
})
