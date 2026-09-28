import { z } from 'zod'
import { capitalizeFirst } from '../text'

const idSchema = z.string().min(1).max(64)
const listQuantitySchema = z.number().int().min(1, 'Mínimo 1').max(999)

const noteSchema = z
  .string()
  .trim()
  .max(120)
  .transform((v) => (v === '' ? null : v))
  .nullable()

/** Ítem manual: un producto del catálogo, un alimento genérico o texto libre (exactamente uno). */
export const listItemCreateSchema = z
  .object({
    productId: idSchema.optional(),
    foodId: idSchema.optional(),
    freeText: z
      .string()
      .trim()
      .min(1, 'Escribe qué comprar')
      .max(80)
      .transform(capitalizeFirst)
      .optional(),
    quantity: listQuantitySchema.nullable().default(null),
    note: noteSchema.default(null),
  })
  .refine(
    (v) => [v.productId, v.foodId, v.freeText].filter((x) => x !== undefined).length === 1,
    'Indica un producto, un alimento o un texto',
  )
export type ListItemCreateInput = z.infer<typeof listItemCreateSchema>

export const listItemUpdateSchema = z
  .object({ quantity: listQuantitySchema.nullable(), note: noteSchema })
  .partial()
export type ListItemUpdateInput = z.infer<typeof listItemUpdateSchema>

/**
 * Marcar/desmarcar. `at` es el instante del cliente (ms): con la cola offline gana
 * la escritura con el `at` más reciente, aunque llegue después.
 */
export const listItemCheckSchema = z.object({
  checked: z.boolean(),
  at: z.number().int().positive(),
})
export type ListItemCheckInput = z.infer<typeof listItemCheckSchema>

/** Finalizar compra: supermercado y, opcionalmente, cuántas unidades se compraron de cada ítem. */
export const purchaseFinalizeSchema = z.object({
  supermarketId: idSchema,
  quantities: z.record(idSchema, listQuantitySchema).default({}),
})
export type PurchaseFinalizeInput = z.infer<typeof purchaseFinalizeSchema>
