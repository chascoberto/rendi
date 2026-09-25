import type { LoginInput } from '@rendi/shared'
import { queryOptions, useMutation, useQuery } from '@tanstack/vue-query'
import { api, call } from '@/lib/api'
import { queryClient } from '@/lib/query'

export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async () => (await call(api.auth.me.$get())).user,
  staleTime: 5 * 60_000,
  retry: false,
})

export const useMe = () => useQuery(meQuery)

export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) => call(api.auth.login.$post({ json: input })),
    // Pedir la sesión de nuevo antes de navegar: invalidar no basta, porque en el login nadie
    // observa ['me'] y el guard del router leería el `null` que quedó en caché tras el 401.
    onSuccess: () => queryClient.fetchQuery({ ...meQuery, staleTime: 0 }),
  })
}

/**
 * Cierra la sesión y marca `me` como null (así el guard deja entrar al login).
 * Quien lo llame debe navegar al login y después llamar a `clearCachedData()`.
 */
export function useLogout() {
  return useMutation({
    mutationFn: () => call(api.auth.logout.$post()),
    onSettled: () => queryClient.setQueryData(['me'], null),
  })
}

/**
 * Borra los datos del hogar en caché. Va después de salir de las páginas protegidas:
 * si se borra antes, sus consultas se vuelven a pedir, reciben 401 y redirigen con `?redirect=`.
 */
export function clearCachedData() {
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
}
