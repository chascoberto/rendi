export const HOUSEHOLD_TIMEZONE = 'America/Santiago'

/** Fecha de calendario `YYYY-MM-DD`. */
export type CalendarDate = string

const calendarFormatters = new Map<string, Intl.DateTimeFormat>()

/** Fecha de calendario de un instante en la zona horaria dada ("hoy" en Chile por defecto). */
export function toCalendarDate(
  instant: Date = new Date(),
  timeZone = HOUSEHOLD_TIMEZONE,
): CalendarDate {
  let fmt = calendarFormatters.get(timeZone)
  if (!fmt) {
    // en-CA formatea como YYYY-MM-DD.
    fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    calendarFormatters.set(timeZone, fmt)
  }
  return fmt.format(instant)
}

/** Suma días a una fecha de calendario (sin horas, sin efectos de cambio de horario). */
export function addDays(date: CalendarDate, days: number): CalendarDate {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Días desde `from` hasta `to` (negativo si `to` ya pasó). */
export function daysBetween(from: CalendarDate, to: CalendarDate): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)
  return Math.round(ms / 86_400_000)
}

/** Edad en años cumplidos a la fecha `today`. */
export function ageInYears(
  birthDate: CalendarDate,
  today: CalendarDate = toCalendarDate(),
): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number]
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number]
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}
