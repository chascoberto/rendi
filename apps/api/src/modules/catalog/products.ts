import {
  isValidEan,
  isVariableMeasureEan,
  normalizeSearch,
  type BarcodeInput,
  type ProductCreateInput,
  type ProductUpdateInput,
} from '@rendi/shared'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { DbOrTx } from '../../db/client'
import { categories, foods, productBarcodes, products } from '../../db/schema'
import { AppError, badRequest, notFound } from '../../lib/errors'
import { assertLocation, convertStockMode, getStockSummary } from '../pantry/service'
import { findOrCreateFood, likePattern } from './foods'
import type { ProductLookup } from './lookup/types'
import { productDerivedFields } from './product-fields'

export function listCategories(db: DbOrTx) {
  return db.select().from(categories).orderBy(asc(categories.sortOrder)).all()
}

const productColumns = {
  id: products.id,
  name: products.name,
  brand: products.brand,
  foodId: products.foodId,
  foodName: foods.name,
  categoryId: products.categoryId,
  contentAmount: products.contentAmount,
  contentUnit: products.contentUnit,
  baseUnit: products.baseUnit,
  baseQuantity: products.baseQuantity,
  stockMode: products.stockMode,
  minStock: products.minStock,
  defaultLocationId: products.defaultLocationId,
  archivedAt: products.archivedAt,
}

/** Busca productos activos por nombre/marca (sin tildes) o por código de barras exacto. */
export function listProducts(
  db: DbOrTx,
  householdId: string,
  opts: { q?: string; categoryId?: string; limit?: number } = {},
) {
  const q = normalizeSearch(opts.q ?? '')
  const byBarcode = /^\d{8,14}$/.test(q)
    ? sql`${products.id} IN (SELECT ${productBarcodes.productId} FROM ${productBarcodes}
        WHERE ${productBarcodes.householdId} = ${householdId} AND ${productBarcodes.ean} = ${q})`
    : undefined
  const byText = q ? sql`${products.searchText} LIKE ${likePattern(q)} ESCAPE '\\'` : undefined
  return db
    .select(productColumns)
    .from(products)
    .leftJoin(foods, eq(foods.id, products.foodId))
    .where(
      and(
        eq(products.householdId, householdId),
        isNull(products.archivedAt),
        opts.categoryId ? eq(products.categoryId, opts.categoryId) : undefined,
        byBarcode ?? byText,
      ),
    )
    .orderBy(asc(products.searchText))
    .limit(opts.limit ?? 200)
    .all()
}

function findProduct(db: DbOrTx, householdId: string, productId: string) {
  return db
    .select(productColumns)
    .from(products)
    .leftJoin(foods, eq(foods.id, products.foodId))
    .where(and(eq(products.id, productId), eq(products.householdId, householdId)))
    .get()
}

/** Producto con sus códigos de barra y resumen de stock. */
export function getProduct(db: DbOrTx, householdId: string, productId: string) {
  const product = findProduct(db, householdId, productId)
  if (!product) throw notFound('Producto no encontrado')
  const barcodes = db
    .select({ ean: productBarcodes.ean, packCount: productBarcodes.packCount })
    .from(productBarcodes)
    .where(eq(productBarcodes.productId, productId))
    .orderBy(asc(productBarcodes.packCount), asc(productBarcodes.ean))
    .all()
  return { product, barcodes, stock: getStockSummary(db, productId) }
}

function assertCategory(db: DbOrTx, categoryId: string | null | undefined) {
  if (!categoryId) return
  if (
    !db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId)).get()
  ) {
    throw badRequest('invalid_category', 'Categoría desconocida')
  }
}

function insertBarcode(db: DbOrTx, householdId: string, productId: string, barcode: BarcodeInput) {
  const existing = db
    .select({ productId: productBarcodes.productId, name: products.name })
    .from(productBarcodes)
    .innerJoin(products, eq(products.id, productBarcodes.productId))
    .where(and(eq(productBarcodes.householdId, householdId), eq(productBarcodes.ean, barcode.ean)))
    .get()
  if (existing) {
    throw new AppError(409, 'barcode_taken', `Ese código ya está asociado a "${existing.name}"`)
  }
  db.insert(productBarcodes)
    .values({ householdId, productId, ...barcode })
    .run()
}

export function createProduct(db: DbOrTx, householdId: string, input: ProductCreateInput) {
  return db.transaction((tx) => {
    assertCategory(tx, input.categoryId)
    if (input.defaultLocationId) assertLocation(tx, householdId, input.defaultLocationId)
    const food = input.foodName ? findOrCreateFood(tx, householdId, input.foodName) : null
    const [product] = tx
      .insert(products)
      .values({
        householdId,
        name: input.name,
        brand: input.brand,
        foodId: food?.id ?? null,
        categoryId: input.categoryId ?? food?.categoryId ?? null,
        contentAmount: input.contentAmount,
        contentUnit: input.contentUnit,
        stockMode: input.stockMode,
        minStock: input.minStock,
        defaultLocationId: input.defaultLocationId,
        ...productDerivedFields(input),
      })
      .returning({ id: products.id })
      .all()
    if (input.barcode) insertBarcode(tx, householdId, product!.id, input.barcode)
    return getProduct(tx, householdId, product!.id)
  })
}

export function updateProduct(
  db: DbOrTx,
  householdId: string,
  productId: string,
  input: ProductUpdateInput,
  userId: string | null,
) {
  return db.transaction((tx) => {
    const current = findProduct(tx, householdId, productId)
    if (!current) throw notFound('Producto no encontrado')
    const { unitCount, foodName, ...fields } = input
    const merged = { ...current, ...fields }

    // El mínimo debe ser coherente con el modo resultante, aunque solo cambie uno de los dos.
    if (merged.minStock !== null) {
      const ok =
        merged.stockMode === 'bulk'
          ? merged.minStock === 2
          : Number.isInteger(merged.minStock) && merged.minStock >= 1
      if (!ok) {
        throw badRequest(
          'invalid_min_stock',
          merged.stockMode === 'bulk'
            ? 'En productos a granel el mínimo solo puede activarse o desactivarse'
            : 'El mínimo debe ser un número entero mayor que cero',
        )
      }
    }
    assertCategory(tx, fields.categoryId)
    if (fields.defaultLocationId) assertLocation(tx, householdId, fields.defaultLocationId)

    const food =
      foodName === undefined
        ? undefined
        : foodName
          ? findOrCreateFood(tx, householdId, foodName)
          : null
    const modeChange = fields.stockMode && fields.stockMode !== current.stockMode
    const conversion = {
      productId,
      from: current.stockMode,
      to: merged.stockMode,
      unitCount,
      fallbackLocationId: merged.defaultLocationId,
      userId,
    }
    if (modeChange && merged.stockMode === 'bulk') convertStockMode(tx, conversion)

    tx.update(products)
      .set({
        ...fields,
        ...(food === undefined ? {} : { foodId: food?.id ?? null }),
        ...productDerivedFields(merged),
      })
      .where(eq(products.id, productId))
      .run()

    if (modeChange && merged.stockMode === 'unit') convertStockMode(tx, conversion)
    return getProduct(tx, householdId, productId)
  })
}

/** Archiva: el producto deja de aparecer, pero su historial de stock y precios se conserva. */
export function archiveProduct(db: DbOrTx, householdId: string, productId: string) {
  const [row] = db
    .update(products)
    .set({ archivedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.householdId, householdId)))
    .returning({ id: products.id })
    .all()
  if (!row) throw notFound('Producto no encontrado')
}

export function addBarcode(
  db: DbOrTx,
  householdId: string,
  productId: string,
  barcode: BarcodeInput,
) {
  return db.transaction((tx) => {
    if (!findProduct(tx, householdId, productId)) throw notFound('Producto no encontrado')
    insertBarcode(tx, householdId, productId, barcode)
    return getProduct(tx, householdId, productId)
  })
}

export function removeBarcode(db: DbOrTx, householdId: string, productId: string, ean: string) {
  db.delete(productBarcodes)
    .where(
      and(
        eq(productBarcodes.householdId, householdId),
        eq(productBarcodes.productId, productId),
        eq(productBarcodes.ean, ean),
      ),
    )
    .run()
}

export type BarcodeLookupResult =
  | {
      status: 'found'
      product: ReturnType<typeof getProduct>['product']
      packCount: number
      archived: boolean
    }
  | { status: 'unknown'; ean: string; suggestion: Awaited<ReturnType<ProductLookup['lookup']>> }
  | { status: 'variable_measure'; ean: string }
  | { status: 'invalid'; ean: string }

/** Resuelve un código escaneado: producto del catálogo, o sugerencia externa si es desconocido. */
export async function lookupBarcode(
  db: DbOrTx,
  householdId: string,
  ean: string,
  external: ProductLookup,
): Promise<BarcodeLookupResult> {
  if (isVariableMeasureEan(ean)) return { status: 'variable_measure', ean }
  if (!isValidEan(ean)) return { status: 'invalid', ean }
  const row = db
    .select({ productId: productBarcodes.productId, packCount: productBarcodes.packCount })
    .from(productBarcodes)
    .where(and(eq(productBarcodes.householdId, householdId), eq(productBarcodes.ean, ean)))
    .get()
  if (row) {
    const product = findProduct(db, householdId, row.productId)!
    return {
      status: 'found',
      product,
      packCount: row.packCount,
      archived: product.archivedAt !== null,
    }
  }
  return { status: 'unknown', ean, suggestion: await external.lookup(ean) }
}
