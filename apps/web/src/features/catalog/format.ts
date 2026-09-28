import { formatContent, type ContentUnit } from '@rendi/shared'

/** "Colun · 1 L" */
export function productSubtitle(p: {
  brand: string | null
  contentAmount: number
  contentUnit: string
}) {
  return [p.brand, formatContent(p.contentAmount, p.contentUnit as ContentUnit)]
    .filter(Boolean)
    .join(' · ')
}

/** Interpreta cantidades escritas con coma decimal chilena: "1,5" → 1.5. */
export function parseAmount(text: string): number {
  return Number(text.trim().replace(',', '.'))
}

export function formatAmount(n: number): string {
  return String(n).replace('.', ',')
}
