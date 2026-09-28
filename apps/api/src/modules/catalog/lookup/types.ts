import type { ContentUnit } from '@rendi/shared'

/** Datos sugeridos para crear un producto a partir de su código de barras. */
export interface ProductSuggestion {
  source: 'openfoodfacts'
  name: string | null
  brand: string | null
  contentAmount: number | null
  contentUnit: ContentUnit | null
}

/**
 * Fuente externa de datos por código de barras. Intercambiable (e inyectable en tests);
 * nunca debe lanzar: ante error, timeout o desconocido devuelve null.
 */
export interface ProductLookup {
  lookup(ean: string): Promise<ProductSuggestion | null>
}

export const noopLookup: ProductLookup = { lookup: async () => null }
