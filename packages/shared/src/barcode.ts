/** Largos válidos de códigos GTIN: EAN-8, UPC-A, EAN-13, GTIN-14. */
const GTIN_LENGTHS = new Set([8, 12, 13, 14])

/** Verifica formato y dígito verificador (módulo 10) de un EAN/GTIN. */
export function isValidEan(code: string): boolean {
  if (!/^\d+$/.test(code) || !GTIN_LENGTHS.has(code.length)) return false
  const digits = [...code].map(Number)
  const check = digits.pop()!
  // Desde la derecha (sin el verificador), las posiciones impares pesan 3.
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0)
  return (10 - (sum % 10)) % 10 === check
}

/**
 * EAN-13 de uso interno de tienda (prefijo 2): productos de peso variable de
 * carnicería o fiambrería, con el precio o el peso incrustado. No identifican un
 * producto de forma estable, así que no se asocian al catálogo.
 */
export function isVariableMeasureEan(code: string): boolean {
  return code.length === 13 && code.startsWith('2')
}
