import { describe, expect, it } from 'vitest'
import { formatClp } from './money'
import { formatContent, toBase, unitPrice } from './units'

describe('toBase', () => {
  it('normaliza kg y L a g y ml', () => {
    expect(toBase(1.5, 'kg')).toEqual({ unit: 'g', quantity: 1500 })
    expect(toBase(1, 'L')).toEqual({ unit: 'ml', quantity: 1000 })
    expect(toBase(12, 'u')).toEqual({ unit: 'u', quantity: 12 })
  })
})

describe('unitPrice', () => {
  it('calcula precio por L', () => {
    expect(unitPrice(1090, toBase(1, 'L'))).toEqual({ amount: 1090, unit: 'L' })
  })

  it('calcula precio por kg desde gramos', () => {
    expect(unitPrice(1290, toBase(500, 'g'))).toEqual({ amount: 2580, unit: 'kg' })
  })

  it('considera packs mayoristas', () => {
    // Pack Alvi 6 × 1 L a $5.990 → $998,33 por L
    expect(unitPrice(5990, toBase(1, 'L'), 6).amount).toBeCloseTo(998.33, 2)
  })

  it('rechaza contenidos no positivos', () => {
    expect(() => unitPrice(1000, toBase(0, 'g'))).toThrow(RangeError)
  })
})

describe('formato', () => {
  it('usa formato chileno', () => {
    expect(formatClp(1990)).toBe('$1.990')
    expect(formatContent(1.5, 'kg')).toBe('1,5 kg')
  })
})
