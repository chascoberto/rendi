import type { DbOrTx } from '../../db/client'
import { households, locations } from '../../db/schema'

export const DEFAULT_LOCATIONS = ['Despensa', 'Refrigerador', 'Congelador'] as const

/** Crea un hogar con sus ubicaciones por defecto. */
export function createHousehold(db: DbOrTx, input: { name: string }) {
  return db.transaction((tx) => {
    const [household] = tx.insert(households).values({ name: input.name }).returning().all()
    if (!household) throw new Error('No se pudo crear el hogar')
    const locs = tx
      .insert(locations)
      .values(
        DEFAULT_LOCATIONS.map((name, i) => ({ householdId: household.id, name, sortOrder: i })),
      )
      .returning()
      .all()
    return { household, locations: locs }
  })
}
