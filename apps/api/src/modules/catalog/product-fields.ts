import { normalizeSearch, toBase, type ContentUnit } from '@rendi/shared'

/** Campos derivados de un producto: contenido normalizado y texto de búsqueda. */
export function productDerivedFields(input: {
  name: string
  brand?: string | null
  contentAmount: number
  contentUnit: ContentUnit
}) {
  const base = toBase(input.contentAmount, input.contentUnit)
  return {
    baseUnit: base.unit,
    baseQuantity: base.quantity,
    searchText: normalizeSearch([input.name, input.brand].filter(Boolean).join(' ')),
  }
}
