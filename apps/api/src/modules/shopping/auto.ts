/**
 * Regla de reposición automática. No depende del catálogo ni de la despensa: quien la llama
 * entrega el mínimo del producto y su stock total, así catálogo y despensa pueden usarla sin ciclos.
 */
import { isBelowMinimum } from '@rendi/shared'
import { and, eq, isNull } from 'drizzle-orm'
import type { DbOrTx } from '../../db/client'
import { shoppingListItems } from '../../db/schema'

export interface MinStockProduct {
  id: string
  minStock: number | null
  archivedAt: Date | null
}

/**
 * Tras un cambio de stock o del mínimo:
 * - bajo el mínimo y sin el producto en la lista → agrega un ítem automático;
 * - repuesto (o sin mínimo, o archivado) → retira el ítem automático si nadie lo marcó.
 * Si el producto ya está en la lista como ítem manual, no se duplica. Los ítems manuales nunca se tocan.
 */
export function syncMinStockItem(
  tx: DbOrTx,
  householdId: string,
  product: MinStockProduct,
  stockTotal: number,
) {
  const open = tx
    .select({
      id: shoppingListItems.id,
      source: shoppingListItems.source,
      checkedAt: shoppingListItems.checkedAt,
    })
    .from(shoppingListItems)
    .where(
      and(
        eq(shoppingListItems.householdId, householdId),
        eq(shoppingListItems.productId, product.id),
        isNull(shoppingListItems.purchaseId),
      ),
    )
    .all()
  const auto = open.find((i) => i.source === 'min_stock')
  const needed = product.archivedAt === null && isBelowMinimum(stockTotal, product.minStock)

  if (needed && open.length === 0) {
    tx.insert(shoppingListItems)
      .values({ householdId, productId: product.id, source: 'min_stock' })
      .run()
  } else if (!needed && auto && auto.checkedAt === null) {
    tx.delete(shoppingListItems).where(eq(shoppingListItems.id, auto.id)).run()
  }
}
