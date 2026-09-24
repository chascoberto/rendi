import { describe, expect, it } from 'vitest'
import { isValidEan, isVariableMeasureEan } from './barcode'
import { normalizeSearch } from './text'

describe('normalizeSearch', () => {
  it('quita tildes, mayúsculas y espacios extra', () => {
    expect(normalizeSearch('  Plátano  ORO ')).toBe('platano oro')
    expect(normalizeSearch('Ñandú')).toBe('nandu')
  })
})

describe('isValidEan', () => {
  it('valida el dígito verificador', () => {
    expect(isValidEan('4006381333931')).toBe(true) // EAN-13 de ejemplo estándar
    expect(isValidEan('4006381333932')).toBe(false)
    expect(isValidEan('96385074')).toBe(true) // EAN-8
    expect(isValidEan('036000291452')).toBe(true) // UPC-A
  })

  it('rechaza largos y caracteres inválidos', () => {
    expect(isValidEan('12345')).toBe(false)
    expect(isValidEan('40063813339a1')).toBe(false)
  })

  it('detecta códigos de peso variable', () => {
    expect(isVariableMeasureEan('2012345012345')).toBe(true)
    expect(isVariableMeasureEan('7801234567890')).toBe(false)
  })
})
