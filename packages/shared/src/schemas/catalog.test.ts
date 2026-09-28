import { describe, expect, it } from 'vitest'
import { eanSchema, productCreateSchema, productUpdateSchema } from './catalog'

const base = { name: 'leche entera', contentAmount: 1, contentUnit: 'L' as const }

describe('productCreateSchema', () => {
  it('aplica valores por defecto y mayúscula inicial', () => {
    expect(productCreateSchema.parse({ ...base, brand: 'colun' })).toMatchObject({
      name: 'Leche entera',
      brand: 'Colun',
      stockMode: 'unit',
      minStock: null,
      foodName: null,
    })
  })

  it('valida el mínimo según el modo', () => {
    expect(productCreateSchema.safeParse({ ...base, minStock: 3 }).success).toBe(true)
    expect(productCreateSchema.safeParse({ ...base, minStock: 0 }).success).toBe(false)
    expect(productCreateSchema.safeParse({ ...base, stockMode: 'bulk', minStock: 2 }).success).toBe(
      true,
    )
    expect(productCreateSchema.safeParse({ ...base, stockMode: 'bulk', minStock: 3 }).success).toBe(
      false,
    )
  })

  it('acepta un código de barras con pack', () => {
    const parsed = productCreateSchema.parse({
      ...base,
      barcode: { ean: '4006381333931', packCount: 6 },
    })
    expect(parsed.barcode).toEqual({ ean: '4006381333931', packCount: 6 })
  })
})

describe('productUpdateSchema', () => {
  it('permite actualizaciones parciales sin validar el mínimo si no viene el modo', () => {
    expect(productUpdateSchema.safeParse({ minStock: 5 }).success).toBe(true)
    expect(productUpdateSchema.safeParse({ stockMode: 'bulk', minStock: 5 }).success).toBe(false)
  })
})

describe('eanSchema', () => {
  it('rechaza códigos inválidos y de peso variable con mensajes claros', () => {
    expect(eanSchema.safeParse('4006381333931').success).toBe(true)
    expect(eanSchema.safeParse('4006381333932').error?.issues[0]?.message).toBe(
      'Código de barras inválido',
    )
    expect(eanSchema.safeParse('2012345012342').error?.issues[0]?.message).toBe(
      'Es un código de peso variable de la tienda',
    )
  })
})
