import type { ContentUnit } from '@rendi/shared'

const UNIT_ALIASES: Record<string, ContentUnit> = {
  g: 'g',
  gr: 'g',
  grs: 'g',
  gramos: 'g',
  kg: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  ml: 'ml',
  cc: 'ml',
  cl: 'ml',
  l: 'L',
  lt: 'L',
  lts: 'L',
  litro: 'L',
  litros: 'L',
  u: 'u',
  un: 'u',
  und: 'u',
  unid: 'u',
  unidades: 'u',
}

/**
 * Interpreta textos de contenido como "1 L", "400 g e", "1,5 kg", "6 x 200 ml" o "12 unidades".
 * En "6 x 200 ml" devuelve el contenido de una unidad (200 ml). Devuelve null si no entiende.
 */
export function parseQuantity(
  text: string | null | undefined,
): { amount: number; unit: ContentUnit } | null {
  if (!text) return null
  const match = /(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)\b/.exec(
    text.replace(/^\s*\d+\s*[x×]\s*/i, ''), // "6 x 200 ml" → "200 ml"
  )
  if (!match) return null
  const amount = Number(match[1]!.replace(',', '.'))
  const unit = UNIT_ALIASES[match[2]!.toLowerCase()]
  if (!unit || !(amount > 0)) return null
  if (match[2]!.toLowerCase() === 'cl') return { amount: amount * 10, unit: 'ml' }
  return { amount, unit }
}
