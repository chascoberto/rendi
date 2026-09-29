import { VueQueryPlugin } from '@tanstack/vue-query'
import { createApp } from 'vue'
import { z } from 'zod'
import App from './App.vue'
import { startCheckQueue } from './features/shopping/checkQueue'
import { setUnauthenticatedHandler } from './lib/api'
import { setupPwa } from './pwa'
import { queryClient } from './lib/query'
import { router } from './router'
import './styles/tokens.css'
import './styles/base.css'

z.config(z.locales.es())

setUnauthenticatedHandler(() => {
  queryClient.setQueryData(['me'], null)
  const current = router.currentRoute.value
  // Durante la primera navegación la ruta aún no está resuelta: de eso se encarga el guard.
  if (current.matched.length > 0 && !current.meta.public) {
    void router.replace({ name: 'login', query: { redirect: current.fullPath } })
  }
})

const app = createApp(App).use(VueQueryPlugin, { queryClient }).use(router)
// Montar tras la primera navegación evita mostrar la barra inferior antes de saber si hay sesión.
void router.isReady().then(() => app.mount('#app'))
startCheckQueue()
setupPwa()
