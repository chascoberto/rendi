import { createRouter, createWebHistory } from 'vue-router'
import { meQuery } from '@/features/auth/queries'
import { ApiError } from '@/lib/api'
import { queryClient } from '@/lib/query'

declare module 'vue-router' {
  interface RouteMeta {
    /** Ruta accesible sin sesión. */
    public?: boolean
    /** Pestaña de la barra inferior que se marca como activa. */
    tab?: 'pantry' | 'shopping' | 'scan' | 'expiring' | 'household'
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'pantry',
      component: () => import('@/features/pantry/PantryPage.vue'),
      meta: { tab: 'pantry' },
    },
    {
      path: '/lista',
      name: 'shopping',
      component: () => import('@/features/shopping/ShoppingListPage.vue'),
      meta: { tab: 'shopping' },
    },
    {
      path: '/escanear',
      name: 'scan',
      component: () => import('@/features/scanner/ScanPage.vue'),
      meta: { tab: 'scan' },
    },
    {
      path: '/vencimientos',
      name: 'expiring',
      component: () => import('@/features/expiring/ExpiringPage.vue'),
      meta: { tab: 'expiring' },
    },
    {
      path: '/productos/nuevo',
      name: 'product-new',
      component: () => import('@/features/catalog/ProductFormPage.vue'),
      meta: { tab: 'pantry' },
    },
    {
      path: '/productos/:id',
      name: 'product',
      component: () => import('@/features/catalog/ProductFormPage.vue'),
      meta: { tab: 'pantry' },
      props: true,
    },
    {
      path: '/hogar',
      name: 'household',
      component: () => import('@/features/household/HouseholdPage.vue'),
      meta: { tab: 'household' },
    },
    {
      path: '/hogar/miembros/:id',
      name: 'member',
      component: () => import('@/features/household/MemberPage.vue'),
      meta: { tab: 'household' },
      props: true,
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  let me = null
  try {
    me = await queryClient.ensureQueryData(meQuery)
  } catch (error) {
    // Sin conexión u otro error: si no es un 401, dejamos pasar y la página mostrará el error.
    if (!(error instanceof ApiError && error.status === 401)) return true
  }
  if (to.meta.public) return me ? { name: 'pantry' } : true
  if (!me) return { name: 'login', query: to.fullPath === '/' ? {} : { redirect: to.fullPath } }
  return true
})
