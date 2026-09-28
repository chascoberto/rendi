import type { BarcodeInput, ProductCreateInput, ProductUpdateInput } from '@rendi/shared'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { api, call } from '@/lib/api'
import { queryClient } from '@/lib/query'

export const catalogKeys = {
  all: ['catalog'] as const,
  foods: (q: string) => ['catalog', 'foods', q] as const,
  products: (q: string, categoryId: string | null) =>
    ['catalog', 'products', q, categoryId] as const,
  product: (id: string) => ['catalog', 'product', id] as const,
  categories: ['catalog', 'categories'] as const,
  locations: ['pantry', 'locations'] as const,
}

export function useFoodSearch(query: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => catalogKeys.foods(toValue(query).trim())),
    queryFn: () =>
      call(api.catalog.foods.$get({ query: { q: toValue(query).trim(), limit: '6' } })),
    enabled: computed(() => toValue(query).trim().length > 0),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}

export function useProducts(
  query: MaybeRefOrGetter<string>,
  categoryId: MaybeRefOrGetter<string | null> = null,
) {
  return useQuery({
    queryKey: computed(() => catalogKeys.products(toValue(query).trim(), toValue(categoryId))),
    queryFn: () => {
      const q = toValue(query).trim()
      const cat = toValue(categoryId)
      return call(
        api.catalog.products.$get({
          query: { ...(q ? { q } : {}), ...(cat ? { categoryId: cat } : {}) },
        }),
      )
    },
    placeholderData: keepPreviousData,
  })
}

export type ProductSummary = NonNullable<
  ReturnType<typeof useProducts>['data']['value']
>['products'][number]

export function useProduct(id: MaybeRefOrGetter<string | null>) {
  return useQuery({
    queryKey: computed(() => catalogKeys.product(toValue(id) ?? '')),
    queryFn: () => call(api.catalog.products[':id'].$get({ param: { id: toValue(id)! } })),
    enabled: computed(() => !!toValue(id)),
  })
}

export type ProductDetail = NonNullable<ReturnType<typeof useProduct>['data']['value']>

export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories,
    queryFn: async () => (await call(api.catalog.categories.$get())).categories,
    staleTime: Infinity,
  })
}

export function useLocations() {
  return useQuery({
    queryKey: catalogKeys.locations,
    queryFn: async () => (await call(api.pantry.locations.$get())).locations,
    staleTime: 10 * 60_000,
  })
}

/**
 * Cualquier cambio en el catálogo invalida listas, detalles y alimentos, y la lista de compras
 * (el mínimo de un producto decide si aparece como ítem automático).
 */
const invalidateCatalog = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: catalogKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['shopping'] }),
  ])

export function useCreateProduct() {
  return useMutation({
    mutationFn: (input: ProductCreateInput) => call(api.catalog.products.$post({ json: input })),
    onSuccess: invalidateCatalog,
  })
}

export function useUpdateProduct(id: MaybeRefOrGetter<string>) {
  return useMutation({
    mutationFn: (input: ProductUpdateInput) =>
      call(api.catalog.products[':id'].$patch({ param: { id: toValue(id) }, json: input })),
    onSuccess: invalidateCatalog,
  })
}

export function useArchiveProduct() {
  return useMutation({
    mutationFn: (id: string) => call(api.catalog.products[':id'].$delete({ param: { id } })),
    onSuccess: invalidateCatalog,
  })
}

export function useAddBarcode() {
  return useMutation({
    mutationFn: ({ productId, ...barcode }: BarcodeInput & { productId: string }) =>
      call(api.catalog.products[':id'].barcodes.$post({ param: { id: productId }, json: barcode })),
    onSuccess: invalidateCatalog,
  })
}

export function useRemoveBarcode() {
  return useMutation({
    mutationFn: ({ productId, ean }: { productId: string; ean: string }) =>
      call(api.catalog.products[':id'].barcodes[':ean'].$delete({ param: { id: productId, ean } })),
    onSuccess: invalidateCatalog,
  })
}

/** Resuelve un código escaneado (no se cachea: cada escaneo consulta de nuevo). */
export function lookupBarcode(ean: string) {
  return call(api.catalog.barcodes[':ean'].$get({ param: { ean } }))
}

export type BarcodeLookup = Awaited<ReturnType<typeof lookupBarcode>>
