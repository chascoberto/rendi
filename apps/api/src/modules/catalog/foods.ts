import { capitalizeFirst, normalizeSearch } from '@rendi/shared'
import { and, asc, eq, sql } from 'drizzle-orm'
import type { DbOrTx } from '../../db/client'
import { foods } from '../../db/schema'

/** Escapa comodines de LIKE en texto ingresado por el usuario. */
export function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (m) => `\\${m}`)}%`
}

/** Busca un alimento por nombre (sin tildes ni mayúsculas); si no existe lo crea. */
export function findOrCreateFood(db: DbOrTx, householdId: string, name: string) {
  const searchText = normalizeSearch(name)
  const existing = db
    .select()
    .from(foods)
    .where(and(eq(foods.householdId, householdId), eq(foods.searchText, searchText)))
    .get()
  if (existing) return existing
  const [created] = db
    .insert(foods)
    .values({ householdId, name: capitalizeFirst(name), searchText })
    .returning()
    .all()
  return created!
}

export function searchFoods(db: DbOrTx, householdId: string, query: string, limit = 10) {
  const q = normalizeSearch(query)
  return db
    .select({ id: foods.id, name: foods.name, categoryId: foods.categoryId })
    .from(foods)
    .where(
      and(
        eq(foods.householdId, householdId),
        q ? sql`${foods.searchText} LIKE ${likePattern(q)} ESCAPE '\\'` : undefined,
      ),
    )
    .orderBy(asc(foods.searchText))
    .limit(limit)
    .all()
}
