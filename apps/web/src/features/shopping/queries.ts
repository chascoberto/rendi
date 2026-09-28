import type { ListItemCreateInput, ListItemUpdateInput, PurchaseFinalizeInput } from '@rendi/shared'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useMe } from '@/features/auth/queries'
import { invalidateStock } from '@/features/pantry/queries'
import { api, ApiError, call } from '@/lib/api'
import { queryClient } from '@/lib/query'
import { flushChecks, pendingChecks } from './checkQueue'

export const shoppingKeys = {
  items: ['shopping', 'items'] as const,
  supermarkets: ['shopping', 'supermarkets'] as const,
}

/** Con varias personas comprando a la vez, la lista se refresca sola cada pocos segundos. */
const REFRESH_MS = 10_000

function useItemsQuery() {
  return useQuery({
    queryKey: shoppingKeys.items,
    queryFn: async () => (await call(api.shopping.items.$get())).items,
    refetchInterval: REFRESH_MS,
  })
}

export type ServerListItem = NonNullable<ReturnType<typeof useItemsQuery>['data']['value']>[number]
export type ListItem = ServerListItem & { pending: boolean }

/**
 * La lista con las marcas pendientes de la cola offline aplicadas encima: lo que la persona
 * tocó se ve al instante, aunque el servidor aún no lo sepa.
 */
export function useShoppingList() {
  const query = useItemsQuery()
  const { data: me } = useMe()
  /** Yo, tal como aparezco en la lista (con avatar si alguien ya me muestra ahí). */
  const self = computed(() => {
    const user = me.value
    if (!user) return null
    const known = query.data.value
      ?.flatMap((i) => [i.checkedBy, i.addedBy])
      .find((p) => p?.userId === user.userId)
    return known ?? { userId: user.userId, name: user.name, avatarEmoji: null as string | null }
  })
  const items = computed<ListItem[] | undefined>(() =>
    query.data.value?.map((item) => {
      const pending = pendingChecks.value[item.id]
      if (!pending) return { ...item, pending: false }
      return {
        ...item,
        checked: pending.checked,
        checkedBy: pending.checked ? self.value : null,
        pending: true,
      }
    }),
  )
  return { ...query, items }
}

export function useSupermarkets() {
  return useQuery({
    queryKey: shoppingKeys.supermarkets,
    queryFn: async () => (await call(api.shopping.supermarkets.$get())).supermarkets,
    staleTime: Infinity,
  })
}

const invalidateList = () => queryClient.invalidateQueries({ queryKey: shoppingKeys.items })

export function useAddItem() {
  return useMutation({
    mutationFn: (input: Partial<ListItemCreateInput>) =>
      call(api.shopping.items.$post({ json: input })),
    onSuccess: invalidateList,
  })
}

export function useUpdateItem() {
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ListItemUpdateInput }) =>
      call(api.shopping.items[':id'].$patch({ param: { id }, json: input })),
    onSuccess: invalidateList,
  })
}

export function useDeleteItem() {
  return useMutation({
    mutationFn: (id: string) => call(api.shopping.items[':id'].$delete({ param: { id } })),
    onSuccess: invalidateList,
  })
}

/** Finalizar exige que el servidor ya tenga las marcas: primero se vacía la cola. */
export function useFinalizePurchase() {
  return useMutation({
    mutationFn: async (input: PurchaseFinalizeInput) => {
      await flushChecks()
      if (Object.keys(pendingChecks.value).length > 0) {
        throw new ApiError(0, 'network', 'Sin conexión: tus marcas aún no se sincronizan')
      }
      return call(api.shopping.purchases.$post({ json: input }))
    },
    onSuccess: invalidateStock,
  })
}
