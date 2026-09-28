import { describe, expect, it, vi } from 'vitest'
import { openFoodFactsLookup } from './openfoodfacts'
import { parseQuantity } from './quantity'

describe('parseQuantity', () => {
  it.each([
    ['1 L', { amount: 1, unit: 'L' }],
    ['400 g e', { amount: 400, unit: 'g' }],
    ['1,5 kg', { amount: 1.5, unit: 'kg' }],
    ['6 x 200 ml', { amount: 200, unit: 'ml' }],
    ['12 unidades', { amount: 12, unit: 'u' }],
    ['75 cl', { amount: 750, unit: 'ml' }],
  ])('%s', (text, expected) => expect(parseQuantity(text)).toEqual(expected))

  it('devuelve null si no entiende', () => {
    expect(parseQuantity('grande')).toBeNull()
    expect(parseQuantity(undefined)).toBeNull()
  })
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('openFoodFactsLookup', () => {
  it('convierte la respuesta en una sugerencia y la guarda en caché', async () => {
    const fetchMock = vi.fn(async () =>
      json({
        status: 1,
        product: {
          product_name: 'nutella',
          brands: 'Nutella, Ferrero',
          product_quantity: 400,
          product_quantity_unit: 'g',
        },
      }),
    )
    const lookup = openFoodFactsLookup({ fetch: fetchMock as typeof fetch })
    const expected = {
      source: 'openfoodfacts',
      name: 'Nutella',
      brand: 'Nutella',
      contentAmount: 400,
      contentUnit: 'g',
    }
    expect(await lookup.lookup('3017620422003')).toEqual(expected)
    expect(await lookup.lookup('3017620422003')).toEqual(expected)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('devuelve null si el producto no existe, hay error o se agota el tiempo', async () => {
    const notFound = openFoodFactsLookup({
      fetch: (async () => json({ status: 0 })) as typeof fetch,
    })
    expect(await notFound.lookup('7801234567894')).toBeNull()

    const failing = openFoodFactsLookup({
      fetch: (async () => {
        throw new Error('red')
      }) as typeof fetch,
    })
    expect(await failing.lookup('7801234567894')).toBeNull()

    const slow = openFoodFactsLookup({
      timeoutMs: 20,
      fetch: ((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(new Error('abort'))),
        )) as typeof fetch,
    })
    expect(await slow.lookup('7801234567894')).toBeNull()
  })
})
