<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import TextField from '@/components/ui/TextField.vue'
import { errorMessage } from '@/lib/api'
import { useLogin } from './queries'

const route = useRoute()
const router = useRouter()
const login = useLogin()

const username = ref('')
const password = ref('')

async function submit() {
  try {
    await login.mutateAsync({ username: username.value, password: password.value })
  } catch {
    return // el mensaje se muestra desde login.error
  }
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
  await router.replace(redirect.startsWith('/') ? redirect : '/')
}
</script>

<template>
  <div class="login">
    <div class="brand">
      <img src="/favicon.svg" alt="" width="56" height="56" />
      <h1>Rendi</h1>
      <p>Despensa y compras del hogar</p>
    </div>
    <form class="form" @submit.prevent="submit">
      <TextField v-model="username" label="Usuario" autocomplete="username" required />
      <TextField
        v-model="password"
        label="Contraseña"
        type="password"
        autocomplete="current-password"
        required
      />
      <p v-if="login.isError.value" class="error" role="alert">
        {{ errorMessage(login.error.value) }}
      </p>
      <AppButton type="submit" variant="primary" size="lg" block :loading="login.isPending.value">
        Entrar
      </AppButton>
    </form>
  </div>
</template>

<style scoped>
.login {
  display: grid;
  gap: var(--space-6);
  max-width: 360px;
  margin: 12vh auto 0;
}

.brand {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  text-align: center;
}

.brand h1 {
  font-size: 1.8rem;
}

.brand p {
  margin: 0;
  color: var(--color-text-muted);
}

.form {
  display: grid;
  gap: var(--space-4);
}

.error {
  margin: 0;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 0.9rem;
}
</style>
