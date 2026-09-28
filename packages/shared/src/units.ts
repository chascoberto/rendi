/** Unidades en que se declara el contenido neto de un producto. */
export const CONTENT_UNITS = ['g', 'kg', 'ml', 'L', 'u'] as const
export type ContentUnit = (typeof CONTENT_UNITS)[number]

/** Unidad base en que se normaliza todo contenido para poder comparar. */
export type BaseUnit = 'g' | 'ml' | 'u'

/** Unidad en que se expresa un precio unitario normalizado. */
export type PriceUnit = 'kg' | 'L' | 'u'

export const CONTENT_UNIT_LABELS: Record<ContentUnit, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  L: 'L',
  u: 'unidades',
}

const TO_BASE: Record<ContentUnit, { unit: BaseUnit; factor: number }> = {
  g: { unit: 'g', factor: 1 },
  kg: { unit: 'g', factor: 1000 },
  ml: { unit: 'ml', factor: 1 },
  L: { unit: 'ml', factor: 1000 },
  u: { unit: 'u', factor: 1 },
}

const PRICE_UNIT: Record<BaseUnit, { unit: PriceUnit; perBase: number }> = {
  g: { unit: 'kg', perBase: 1000 },
  ml: { unit: 'L', perBase: 1000 },
  u: { unit: 'u', perBase: 1 },
}

/** Convierte un contenido neto (p. ej. 1 L) a su unidad base (1000 ml). */
export function toBase(amount: number, unit: ContentUnit): { unit: BaseUnit; quantity: number } {
  const { unit: base, factor } = TO_BASE[unit]
  return { unit: base, quantity: amount * factor }
}

/**
 * Precio unitario normalizado (CLP por kg, L o unidad).
 * `packCount` cubre los packs: un pack de 6 × 1 L a $6.000 → $1.000 por L.
 */
export function unitPrice(
  priceClp: number,
  base: { unit: BaseUnit; quantity: number },
  packCount = 1,
): { amount: number; unit: PriceUnit } {
  if (base.quantity <= 0 || packCount <= 0) {
    throw new RangeError('El contenido y el tamaño del pack deben ser positivos')
  }
  const { unit, perBase } = PRICE_UNIT[base.unit]
  return { amount: (priceClp / (base.quantity * packCount)) * perBase, unit }
}

/** Texto legible del contenido neto: "1 L", "500 g", "1 unidad", "12 unidades". */
export function formatContent(amount: number, unit: ContentUnit): string {
  const n = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 3 }).format(amount)
  const label = unit === 'u' && amount === 1 ? 'unidad' : CONTENT_UNIT_LABELS[unit]
  return `${n} ${label}`
}
