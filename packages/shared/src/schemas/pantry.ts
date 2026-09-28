import { z } from 'zod'
import { bulkLevelSchema, unitCountSchema } from '../stock'
import { calendarDateSchema } from './household'

const idSchema = z.string().min(1).max(64)

/** "Compré": en `unit` agrega envases; en `bulk` deja el nivel en "Hay" (se ignora `quantity`). */
export const purchaseInputSchema = z.object({
  quantity: z.number().int().min(1, 'Indica al menos una unidad').max(999).default(1),
  expiresOn: calendarDateSchema.nullable().default(null),
  /** Por defecto, la ubicación del producto (o la primera del hogar). */
  locationId: idSchema.nullable().default(null),
})
export type PurchaseInput = z.infer<typeof purchaseInputSchema>

/** "Usé uno" / "Se acabó": sobre un lote en particular o, sin `lotId`, sobre el producto (FEFO). */
export const lotTargetSchema = z.object({ lotId: idSchema.optional() })
export type LotTarget = z.infer<typeof lotTargetSchema>

/** Nivel de un producto a granel: Hay (2) / Queda poco (1) / Se acabó (0). */
export const bulkLevelInputSchema = z.object({ level: bulkLevelSchema })

/** Ajuste manual de un lote. La cantidad se valida según el modo del producto en el servidor. */
export const lotUpdateSchema = z
  .object({
    quantity: unitCountSchema,
    expiresOn: calendarDateSchema.nullable(),
    locationId: idSchema,
  })
  .partial()
export type LotUpdateInput = z.infer<typeof lotUpdateSchema>
