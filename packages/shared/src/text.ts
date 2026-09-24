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
