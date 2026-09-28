import { z } from 'zod'
import { isValidEan, isVariableMeasureEan } from '../barcode'
import { minStockSchema, STOCK_MODES, unitCountSchema } from '../stock'
import { capitalizeFirst } from '../text'
import { CONTENT_UNITS } from '../units'
import { foodNameSchema } from './household'

export const eanSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, 'El código solo debe tener números')
  .refine((v) => !isVariableMeasureEan(v), 'Es un código de peso variable de la tienda')
  .refine(isValidEan, 'Código de barras inválido')

export const packCountSchema = z.number().int().min(1).max(999)

export const barcodeInputSchema = z.object({
  ean: eanSchema,
  /** Unidades del producto que trae este código (pack Alvi 6 × 1 L → 6). */
  packCount: packCountSchema.default(1),
})
export type BarcodeInput = z.infer<typeof barcodeInputSchema>

const optionalName = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : capitalizeFirst(v)))
    .nullable()

const productFields = {
  name: z.string().trim().min(1, 'Ingresa un nombre').max(80).transform(capitalizeFirst),
  brand: optionalName(60),
  /** Alimento genérico ("Leche"); se crea si no existe. null = sin alimento. */
  foodName: foodNameSchema.nullable(),
  categoryId: z.string().min(1).nullable(),
  contentAmount: z.number().positive('Debe ser mayor que cero').max(100_000),
  contentUnit: z.enum(CONTENT_UNITS),
  stockMode: z.enum(STOCK_MODES),
  minStock: z.number().int().nullable(),
  defaultLocationId: z.string().min(1).nullable(),
}

/** Valida el stock mínimo según el modo (ver `minStockSchema`). */
function refineMinStock(
  value: { stockMode?: (typeof STOCK_MODES)[number]; minStock?: number | null },
  ctx: z.RefinementCtx,
) {
  if (value.stockMode === undefined || value.minStock === undefined) return
  const result = minStockSchema(value.stockMode).safeParse(value.minStock)
  if (!result.success) {
    ctx.addIssue({
      code: 'custom',
      path: ['minStock'],
      message:
        value.stockMode === 'bulk'
          ? 'En productos a granel el mínimo solo puede activarse o desactivarse'
          : 'El mínimo debe ser un número entero mayor que cero',
    })
  }
}

export const productCreateSchema = z
  .object({
    ...productFields,
    brand: productFields.brand.default(null),
    foodName: productFields.foodName.default(null),
    categoryId: productFields.categoryId.default(null),
    stockMode: productFields.stockMode.default('unit'),
    minStock: productFields.minStock.default(null),
    defaultLocationId: productFields.defaultLocationId.default(null),
    barcode: barcodeInputSchema.optional(),
  })
  .superRefine(refineMinStock)
export type ProductCreateInput = z.infer<typeof productCreateSchema>

export const productUpdateSchema = z
  .object({
    ...productFields,
    /** Al pasar de granel a envases: cuántos envases hay (el nivel no se puede convertir solo). */
    unitCount: unitCountSchema.optional(),
  })
  .partial()
  .superRefine(refineMinStock)
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>
