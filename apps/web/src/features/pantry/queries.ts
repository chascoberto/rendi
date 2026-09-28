import type { BulkLevel, LotTarget, LotUpdateInput, PurchaseInput } from '@rendi/shared'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { showToast } from '@/composables/useToast'
import { catalogKeys } from '@/features/catalog/queries'
import { api, call, errorMessage } from '@/lib/api'
import { queryClient } from '@/lib/query'

export const pantryKeys = {
  expiring: (days: number) => ['pantry', 'expiring', days] as const,
}

/** El stock aparece en la lista de productos, en el detalle y en "por vencer". */
function invalidateStock() {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['pantry', 'expiring'] }),
  ])
}

export function useExpiring(days: MaybeRefOrGetter<number> = 30) {
  return useQuery({
    queryKey: computed(() => pantryKeys.expiring(toValue(days))),
    queryFn: () => call(api.pantry.expiring.$get({ query: { days: String(toValue(days)) } })),
  })
}

export type ExpiringLot = NonNullable<
  ReturnType<typeof useExpiring>['data']['value']
>['lots'][number]

function undo(actionId: string) {
  call(api.pantry.actions[':id'].undo.$post({ param: { id: actionId } }))
    .then(() => showToast({ message: 'Acción deshecha' }))
    .catch((error: unknown) => showToast({ message: errorMessage(error) }))
    .finally(invalidateStock)
}

type ActionResult = { actionId: string | null }

/**
 * Mutación de stock que, al terminar, muestra un toast con "Deshacer" durante 5 s.
 * `message` arma el texto a partir de las variables de la mutación.
 */
function useStockAction<V>(run: (vars: V) => Promise<ActionResult>, message: (vars: V) => string) {
  return useMutation({
    mutationFn: run,
    onSuccess: (result, vars) => {
      void invalidateStock()
      const { actionId } = result
      if (!actionId) return
      showToast({
        message: message(vars),
        action: { label: 'Deshacer', run: () => undo(actionId) },
      })
    },
  })
}

type ProductVars = { productId: string; name: string }

export function useConsume() {
  return useStockAction(
    ({ productId, lotId }: ProductVars & LotTarget) =>
      call(
        api.pantry.products[':id'].consume.$post({
          param: { id: productId },
          json: lotId ? { lotId } : {},
        }),
      ),
    ({ name }) => `Usaste uno: ${name}`,
  )
}

export function useDeplete() {
  return useStockAction(
    ({ productId, lotId }: ProductVars & LotTarget) =>
      call(
        api.pantry.products[':id'].deplete.$post({
          param: { id: productId },
          json: lotId ? { lotId } : {},
        }),
      ),
    ({ name, lotId }) => (lotId ? `Lote descartado: ${name}` : `Se acabó: ${name}`),
  )
}

export function usePurchase() {
  return useStockAction(
    ({ productId, input }: ProductVars & { input: Partial<PurchaseInput> }) =>
      call(api.pantry.products[':id'].purchase.$post({ param: { id: productId }, json: input })),
    ({ name, input }) =>
      (input.quantity ?? 1) > 1 ? `Compraste ${input.quantity}: ${name}` : `Compraste: ${name}`,
  )
}

export function useSetLevel() {
  return useStockAction(
    ({ productId, level }: ProductVars & { level: BulkLevel; label: string }) =>
      call(api.pantry.products[':id'].level.$put({ param: { id: productId }, json: { level } })),
    ({ name, label }) => `${name}: ${label.toLowerCase()}`,
  )
}

export function useUpdateLot() {
  return useStockAction(
    ({ lotId, input }: { lotId: string; input: LotUpdateInput; name: string }) =>
      call(api.pantry.lots[':id'].$patch({ param: { id: lotId }, json: input })),
    ({ name }) => `Stock ajustado: ${name}`,
  )
}
