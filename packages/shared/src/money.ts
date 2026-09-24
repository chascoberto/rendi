const clp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

/** Formatea pesos chilenos: 1990 → "$1.990". */
export function formatClp(amount: number): string {
  return clp.format(Math.round(amount))
}
