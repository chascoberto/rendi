import { capitalizeFirst } from '@rendi/shared'
import { parseQuantity } from './quantity'
import type { ProductLookup, ProductSuggestion } from './types'

interface OffResponse {
  status: number
  product?: {
    product_name?: string
    product_name_es?: string
    brands?: string
    quantity?: string
    product_quantity?: number | string
    product_quantity_unit?: string
  }
}

const FIELDS = 'product_name,product_name_es,brands,quantity,product_quantity,product_quantity_unit'
const CACHE_TTL_MS = 24 * 60 * 60_000
const CACHE_MAX = 500

export interface OpenFoodFactsOptions {
  timeoutMs?: number
  fetch?: typeof fetch
  baseUrl?: string
}

/**
 * Consulta Open Food Facts (base abierta, sin cuenta). La consulta sale del servidor:
 * OFF solo ve la IP del servidor, nunca datos del hogar. Resultados en caché por 24 h.
 */
export function openFoodFactsLookup(options: OpenFoodFactsOptions = {}): ProductLookup {
  const timeoutMs = options.timeoutMs ?? 2500
  const doFetch = options.fetch ?? fetch
  const baseUrl = options.baseUrl ?? 'https://world.openfoodfacts.org'
  const cache = new Map<string, { value: ProductSuggestion | null; expiresAt: number }>()

  return {
    async lookup(ean) {
      const cached = cache.get(ean)
      if (cached && cached.expiresAt > Date.now()) return cached.value

      let value: ProductSuggestion | null
      try {
        const res = await doFetch(`${baseUrl}/api/v2/product/${ean}.json?fields=${FIELDS}`, {
          headers: { 'user-agent': 'Rendi/0.1 (app doméstica autoalojada)' },
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (!res.ok && res.status !== 404) return null // error transitorio: no se cachea
        value = toSuggestion((await res.json()) as OffResponse)
      } catch {
        return null // timeout o red: no se cachea
      }

      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!)
      cache.set(ean, { value, expiresAt: Date.now() + CACHE_TTL_MS })
      return value
    },
  }
}

function toSuggestion(body: OffResponse): ProductSuggestion | null {
  const p = body.product
  if (body.status !== 1 || !p) return null

  const name = (p.product_name_es || p.product_name || '').trim()
  const brand = (p.brands ?? '').split(',')[0]?.trim() ?? ''
  const amount = Number(p.product_quantity)
  const structured =
    amount > 0 && p.product_quantity_unit
      ? parseQuantity(`${amount} ${p.product_quantity_unit}`)
      : null
  const quantity = structured ?? parseQuantity(p.quantity)

  if (!name && !brand && !quantity) return null
  return {
    source: 'openfoodfacts',
    name: name ? capitalizeFirst(name) : null,
    brand: brand ? capitalizeFirst(brand) : null,
    contentAmount: quantity?.amount ?? null,
    contentUnit: quantity?.unit ?? null,
  }
}
