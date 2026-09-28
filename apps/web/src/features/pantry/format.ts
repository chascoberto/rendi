import {
  BULK_LEVEL_LABELS,
  daysBetween,
  toCalendarDate,
  type BulkLevel,
  type CalendarDate,
  type StockMode,
} from '@rendi/shared'

/** "3 unidades", "Sin stock" o, a granel, el nivel ("Queda poco"). */
export function stockLabel(mode: StockMode, total: number): string {
  if (mode === 'bulk') return BULK_LEVEL_LABELS[Math.min(2, Math.max(0, total)) as BulkLevel]
  if (total <= 0) return 'Sin stock'
  return total === 1 ? '1 unidad' : `${total} unidades`
}

/** Urgencia de un vencimiento, para el color: vencido, ≤ 3 días, ≤ 7 días o lejano. */
export type ExpiryTone = 'expired' | 'soon' | 'week' | 'later'

export const EXPIRY_SOON_DAYS = 3

export function expiryTone(expiresOn: CalendarDate, today: CalendarDate = toCalendarDate()) {
  const days = daysBetween(today, expiresOn)
  const tone: ExpiryTone =
    days < 0 ? 'expired' : days <= EXPIRY_SOON_DAYS ? 'soon' : days <= 7 ? 'week' : 'later'
  return tone
}

const dateFormat = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

/** "12 oct." a partir de `YYYY-MM-DD` (sin desfase de zona horaria). */
export function formatShortDate(date: CalendarDate): string {
  return dateFormat.format(new Date(`${date}T00:00:00Z`))
}

/** "Venció hace 2 días", "Vence hoy", "Vence mañana", "Vence en 5 días", "Vence el 12 oct." */
export function expiryLabel(expiresOn: CalendarDate, today: CalendarDate = toCalendarDate()) {
  const days = daysBetween(today, expiresOn)
  if (days < -1) return `Venció hace ${-days} días`
  if (days === -1) return 'Venció ayer'
  if (days === 0) return 'Vence hoy'
  if (days === 1) return 'Vence mañana'
  if (days <= 14) return `Vence en ${days} días`
  return `Vence el ${formatShortDate(expiresOn)}`
}
