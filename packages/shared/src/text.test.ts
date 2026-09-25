import { describe, expect, it } from 'vitest'
import { isValidEan, isVariableMeasureEan } from './barcode'
import { capitalizeFirst, capitalizePersonName, normalizeSearch } from './text'

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

describe('capitalizeFirst', () => {
  it('pone mayúscula solo a la primera letra, incluidas tildes y ñ', () => {
    expect(capitalizeFirst('  camila ')).toBe('Camila')
    expect(capitalizeFirst('ñandú')).toBe('Ñandú')
    expect(capitalizeFirst('ángela')).toBe('Ángela')
    expect(capitalizeFirst('zapallo italiano')).toBe('Zapallo italiano')
    expect(capitalizeFirst('Zapallo')).toBe('Zapallo')
    expect(capitalizeFirst('')).toBe('')
  })
})

describe('capitalizePersonName', () => {
  it('pone mayúscula a cada palabra', () => {
    expect(capitalizePersonName('maría josé')).toBe('María José')
    expect(capitalizePersonName('  tomás   ignacio ')).toBe('Tomás Ignacio')
    expect(capitalizePersonName('ñuño')).toBe('Ñuño')
  })

  it('deja las partículas en minúscula salvo al comienzo', () => {
    expect(capitalizePersonName('maría de los ángeles')).toBe('María de los Ángeles')
    expect(capitalizePersonName('ana-maría DE LA cruz')).toBe('Ana-María de la Cruz')
    expect(capitalizePersonName('de la fuente')).toBe('De la Fuente')
  })
})
