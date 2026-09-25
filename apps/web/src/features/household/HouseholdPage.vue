<script setup lang="ts">
import { ageInYears } from '@rendi/shared'
import { ChevronRight, LogOut, Plus } from 'lucide-vue-next'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import MemberAvatar from '@/components/ui/MemberAvatar.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import TextField from '@/components/ui/TextField.vue'
import { useTheme } from '@/composables/useTheme'
import { clearCachedData, useLogout, useMe } from '@/features/auth/queries'
import { errorMessage } from '@/lib/api'
import { useCreateAdult, useCreateChild, useHousehold } from './queries'

const router = useRouter()
const { data: me } = useMe()
const { data, isPending, error } = useHousehold()
const { preference } = useTheme()
const logout = useLogout()
const createChild = useCreateChild()
const createAdult = useCreateAdult()

const addingAdult = ref(false)
const adult = ref({ name: '', username: '', password: '' })

function addAdult() {
  createAdult.mutate(adult.value, {
    onSuccess: () => {
      addingAdult.value = false
      adult.value = { name: '', username: '', password: '' }
    },
  })
}

const adding = ref(false)
const childName = ref('')
const childBirthDate = ref('')

function addChild() {
  createChild.mutate(
    { name: childName.value, birthDate: childBirthDate.value || null },
    { onSuccess: ({ member }) => onChildCreated(member.id) },
  )
}

async function onChildCreated(id: string) {
  adding.value = false
  childName.value = ''
  childBirthDate.value = ''
  await router.push({ name: 'member', params: { id } })
}

async function signOut() {
  try {
    await logout.mutateAsync()
  } catch {
    // Aunque falle la red, se sale igual: la cookie expirará sola.
  }
  await router.replace({ name: 'login' })
  clearCachedData()
}

const themeOptions = [
  { value: 'system' as const, label: 'Sistema' },
  { value: 'light' as const, label: 'Claro' },
  { value: 'dark' as const, label: 'Oscuro' },
]
</script>

<template>
  <PageHeader :title="data?.household.name ?? 'Hogar'" />

  <p v-if="error" class="error">{{ errorMessage(error) }}</p>
  <p v-else-if="isPending" class="muted">Cargando…</p>

  <template v-if="data">
    <h2 class="section-title">Adultos</h2>
    <AppCard>
      <ul class="rows">
        <li v-for="m in data.members.filter((m) => m.kind === 'adult')" :key="m.id">
          <RouterLink class="row" :to="{ name: 'member', params: { id: m.id } }">
            <MemberAvatar :name="m.name" :emoji="m.avatarEmoji" kind="adult" />
            <span class="row-main">
              <span class="row-title">{{ m.name }}</span>
              <span class="row-sub">
                @{{ m.username }}<template v-if="m.username === me?.username"> · tú</template>
              </span>
            </span>
            <ChevronRight :size="18" class="chevron" />
          </RouterLink>
        </li>
      </ul>

      <form v-if="addingAdult" class="add-form" @submit.prevent="addAdult">
        <TextField v-model="adult.name" label="Nombre" required />
        <TextField
          v-model="adult.username"
          label="Usuario"
          autocomplete="off"
          autocapitalize="off"
          hint="Minúsculas, números, punto o guion. Con esto inicia sesión."
          required
        />
        <TextField
          v-model="adult.password"
          label="Contraseña"
          type="password"
          autocomplete="new-password"
          hint="Mínimo 8 caracteres. Compártela con esa persona."
          required
        />
        <p v-if="createAdult.isError.value" class="error">
          {{ errorMessage(createAdult.error.value) }}
        </p>
        <div class="form-actions">
          <AppButton variant="ghost" @click="addingAdult = false">Cancelar</AppButton>
          <AppButton type="submit" variant="primary" :loading="createAdult.isPending.value">
            Crear cuenta
          </AppButton>
        </div>
      </form>
      <button v-else class="add-row" type="button" @click="addingAdult = true">
        <Plus :size="18" /> Agregar adulto
      </button>
    </AppCard>

    <h2 class="section-title">Niños</h2>
    <AppCard>
      <ul class="rows">
        <li v-for="m in data.members.filter((m) => m.kind === 'child')" :key="m.id">
          <RouterLink class="row" :to="{ name: 'member', params: { id: m.id } }">
            <MemberAvatar :name="m.name" :emoji="m.avatarEmoji" kind="child" />
            <span class="row-main">
              <span class="row-title">{{ m.name }}</span>
              <span v-if="m.birthDate" class="row-sub">{{ ageInYears(m.birthDate) }} años</span>
            </span>
            <ChevronRight :size="18" class="chevron" />
          </RouterLink>
        </li>
      </ul>

      <form v-if="adding" class="add-form" @submit.prevent="addChild">
        <TextField v-model="childName" label="Nombre" required />
        <TextField v-model="childBirthDate" label="Fecha de nacimiento (opcional)" type="date" />
        <p v-if="createChild.isError.value" class="error">
          {{ errorMessage(createChild.error.value) }}
        </p>
        <div class="form-actions">
          <AppButton variant="ghost" @click="adding = false">Cancelar</AppButton>
          <AppButton type="submit" variant="primary" :loading="createChild.isPending.value">
            Agregar
          </AppButton>
        </div>
      </form>
      <button v-else class="add-row" type="button" @click="adding = true">
        <Plus :size="18" /> Agregar niño o niña
      </button>
    </AppCard>
    <p class="muted small">
      Si alguien olvida su contraseña, se cambia en el servidor con
      <code>pnpm user:passwd</code>.
    </p>
  </template>

  <h2 class="section-title">Apariencia</h2>
  <SegmentedControl v-model="preference" label="Tema" :options="themeOptions" />

  <AppButton
    class="logout"
    variant="ghost"
    block
    :loading="logout.isPending.value"
    @click="signOut"
  >
    <LogOut :size="18" /> Cerrar sesión
  </AppButton>
</template>

<style scoped>
.section-title {
  margin: var(--space-5) 0 var(--space-2);
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rows li + li {
  border-top: 1px solid var(--color-border);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 60px;
  padding: var(--space-2) var(--space-4);
  color: inherit;
  text-decoration: none;
}

.row:active {
  background: var(--color-surface-2);
}

.row-main {
  display: grid;
  flex: 1;
}

.row-title {
  font-weight: 600;
}

.row-sub {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.chevron {
  color: var(--color-text-muted);
}

.add-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 52px;
  padding: 0 var(--space-4);
  border: 0;
  border-top: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-accent);
  font-weight: 600;
}

.add-form {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}

.muted {
  color: var(--color-text-muted);
}

.small {
  margin: var(--space-2) var(--space-1) 0;
  font-size: 0.8rem;
}

.error {
  margin: 0;
  color: var(--color-danger);
}

.logout {
  margin-top: var(--space-6);
}
</style>
