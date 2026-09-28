import type {
  AdultCreateInput,
  ChildCreateInput,
  FoodPrefCreateInput,
  FoodPrefUpdateInput,
  MemberUpdateInput,
} from '@rendi/shared'
import { useMutation, useQuery } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { api, call } from '@/lib/api'
import { queryClient } from '@/lib/query'

const keys = {
  household: ['household'] as const,
  member: (id: string) => ['household', 'member', id] as const,
}

export function useHousehold() {
  return useQuery({ queryKey: keys.household, queryFn: () => call(api.household.$get()) })
}

export function useMember(id: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => keys.member(toValue(id))),
    queryFn: () => call(api.household.members[':id'].$get({ param: { id: toValue(id) } })),
  })
}

export type MemberDetail = NonNullable<ReturnType<typeof useMember>['data']['value']>
export type FoodPref = MemberDetail['prefs'][number]

const invalidateHousehold = () => queryClient.invalidateQueries({ queryKey: keys.household })

export function useCreateAdult() {
  return useMutation({
    mutationFn: (input: AdultCreateInput) => call(api.household.adults.$post({ json: input })),
    onSuccess: invalidateHousehold,
  })
}

export function useCreateChild() {
  return useMutation({
    mutationFn: (input: ChildCreateInput) => call(api.household.members.$post({ json: input })),
    onSuccess: invalidateHousehold,
  })
}

export function useUpdateMember(id: MaybeRefOrGetter<string>) {
  return useMutation({
    mutationFn: (input: MemberUpdateInput) =>
      call(api.household.members[':id'].$patch({ param: { id: toValue(id) }, json: input })),
    onSuccess: invalidateHousehold,
  })
}

/** Elimina un niño o un adulto (no a uno mismo; el hogar siempre conserva un adulto). */
export function useDeleteMember() {
  return useMutation({
    mutationFn: (id: string) => call(api.household.members[':id'].$delete({ param: { id } })),
    onSuccess: invalidateHousehold,
  })
}

/** Preferencias: todas invalidan el detalle del miembro y la búsqueda de alimentos. */
export function useFoodPrefMutations(memberId: MaybeRefOrGetter<string>) {
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.member(toValue(memberId)) }),
      queryClient.invalidateQueries({ queryKey: ['catalog', 'foods'] }),
    ])
  const prefs = api.household.members[':id'].prefs

  const add = useMutation({
    mutationFn: (input: FoodPrefCreateInput) =>
      call(prefs.$post({ param: { id: toValue(memberId) }, json: input })),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ foodId, ...input }: FoodPrefUpdateInput & { foodId: string }) =>
      call(prefs[':foodId'].$patch({ param: { id: toValue(memberId), foodId }, json: input })),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (foodId: string) =>
      call(prefs[':foodId'].$delete({ param: { id: toValue(memberId), foodId } })),
    onSuccess: invalidate,
  })
  return { add, update, remove }
}
