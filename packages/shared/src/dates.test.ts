import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, toCalendarDate } from './dates'

describe('fechas de calendario', () => {
  it('usa la hora de Chile para decidir el día', () => {
    // 02:00 UTC del 25 de septiembre = 23:00 del 24 en Chile (UTC-3).
    expect(toCalendarDate(new Date('2026-09-25T02:00:00Z'))).toBe('2026-09-24')
  })

  it('suma días cruzando meses y años', () => {
    expect(addDays('2026-09-28', 5)).toBe('2026-10-03')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('calcula diferencias en días', () => {
    expect(daysBetween('2026-09-24', '2026-09-27')).toBe(3)
    expect(daysBetween('2026-09-24', '2026-09-20')).toBe(-4)
  })
})
