/**
 * Normaliza texto para búsquedas: minúsculas, sin tildes y con espacios simples.
 * "Plátano  ORO" → "platano oro". SQLite no ignora tildes por sí solo, por eso se
 * guarda una columna `search_text` calculada con esta función.
 */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Primera letra en mayúscula, el resto tal cual: "brócoli" → "Brócoli", "ñandú" → "Ñandú".
 * Se aplica al guardar nombres visibles (personas, alimentos, productos).
 */
export function capitalizeFirst(text: string): string {
  const trimmed = text.trim()
  const first = trimmed.charAt(0)
  return first ? first.toLocaleUpperCase('es-CL') + trimmed.slice(1) : trimmed
}

/** Partículas que van en minúscula dentro de un nombre ("María de los Ángeles"). */
const NAME_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e'])

/**
 * Nombre de persona: mayúscula inicial en cada palabra (también tras un guion), salvo
 * partículas que no están al comienzo. "maría josé" → "María José",
 * "ana-maría de la cruz" → "Ana-María de la Cruz". El resto de cada palabra queda tal cual.
 */
export function capitalizePersonName(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLocaleLowerCase('es-CL')
      if (i > 0 && NAME_PARTICLES.has(lower)) return lower
      return word.split('-').map(capitalizeFirst).join('-')
    })
    .join(' ')
}
