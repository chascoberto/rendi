import { describe, expect, it } from 'vitest'
import { isBelowMinimum, isValidStockQuantity, minStockSchema } from './stock'

describe('isValidStockQuantity', () => {
  it('en bulk solo acepta los niveles 0, 1 y 2', () => {
    expect([0, 1, 2].every((q) => isValidStockQuantity('bulk', q))).toBe(true)
    expect(isValidStockQuantity('bulk', 3)).toBe(false)
    expect(isValidStockQuantity('bulk', -1)).toBe(false)
    expect(isValidStockQuantity('bulk', 1.5)).toBe(false)
  })

  it('en unit acepta envases enteros no negativos', () => {
    expect(isValidStockQuantity('unit', 0)).toBe(true)
    expect(isValidStockQuantity('unit', 7)).toBe(true)
    expect(isValidStockQuantity('unit', 0.5)).toBe(false)
    expect(isValidStockQuantity('unit', -1)).toBe(false)
  })
})

describe('minStockSchema', () => {
  it('en bulk el mínimo es null o el nivel "Hay"', () => {
    expect(minStockSchema('bulk').safeParse(null).success).toBe(true)
    expect(minStockSchema('bulk').safeParse(2).success).toBe(true)
    expect(minStockSchema('bulk').safeParse(1).success).toBe(false)
    expect(minStockSchema('bulk').safeParse(5).success).toBe(false)
  })

  it('en unit el mínimo es null o un entero ≥ 1', () => {
    expect(minStockSchema('unit').safeParse(null).success).toBe(true)
    expect(minStockSchema('unit').safeParse(3).success).toBe(true)
    expect(minStockSchema('unit').safeParse(0).success).toBe(false)
  })
})

describe('isBelowMinimum', () => {
  it('solo aplica si hay mínimo', () => {
    expect(isBelowMinimum(0, null)).toBe(false)
    expect(isBelowMinimum(1, 2)).toBe(true)
    expect(isBelowMinimum(2, 2)).toBe(false)
  })
})
