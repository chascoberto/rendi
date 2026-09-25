<script setup lang="ts">
import { ageInYears, toCalendarDate } from '@rendi/shared'
import { Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import MemberAvatar from '@/components/ui/MemberAvatar.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import TextField from '@/components/ui/TextField.vue'
import { errorMessage } from '@/lib/api'
import EmojiPicker from './EmojiPicker.vue'
import FoodPrefAdder from './FoodPrefAdder.vue'
import FoodPrefList from './FoodPrefList.vue'
import { useMe } from '@/features/auth/queries'
import { useDeleteMember, useMember, useUpdateMember } from './queries'

const props = defineProps<{ id: string }>()
const router = useRouter()

const { data, isPending, error } = useMember(() => props.id)
const updateMember = useUpdateMember(() => props.id)
const deleteMember = useDeleteMember()
const { data: me } = useMe()

/** Nadie elimina su propia cuenta (la API también lo impide). */
const canDelete = computed(() => !!data.value && data.value.member.id !== me.value?.memberId)
const isAdult = computed(() => data.value?.member.kind === 'adult')

const pickingAvatar = ref(false)
function selectAvatar(avatarEmoji: string | null) {
  updateMember.mutate({ avatarEmoji }, { onSuccess: () => (pickingAvatar.value = false) })
}

const form = ref({ name: '', birthDate: '', notes: '' })
// Se inicializa al cargar cada miembro, no en cada actualización: cambiar el avatar no debe
// borrar lo que se está escribiendo en el formulario.
watch(
  () => data.value?.member.id,
  () => {
    const m = data.value?.member
    if (m) form.value = { name: m.name, birthDate: m.birthDate ?? '', notes: m.notes ?? '' }
  },
  { immediate: true },
)

const dirty = computed(() => {
  const m = data.value?.member
  if (!m) return false
  return (
    form.value.name !== m.name ||
    form.value.birthDate !== (m.birthDate ?? '') ||
    form.value.notes !== (m.notes ?? '')
  )
})

const accepts = computed(() => data.value?.prefs.filter((p) => p.stance === 'accepts') ?? [])
const rejects = computed(() => data.value?.prefs.filter((p) => p.stance === 'rejects') ?? [])
const existingFoodIds = computed(() => data.value?.prefs.map((p) => p.foodId) ?? [])
const today = toCalendarDate()

function save() {
  updateMember.mutate({
    name: form.value.name,
    birthDate: form.value.birthDate || null,
    notes: form.value.notes,
  })
}

function remove() {
  const name = data.value?.member.name
  const message = isAdult.value
    ? `¿Eliminar la cuenta de ${name}? Perderá el acceso y se cerrarán sus sesiones.`
    : `¿Eliminar a ${name}? Se borrarán también sus preferencias.`
  if (!window.confirm(message)) return
  deleteMember.mutate(props.id, { onSuccess: () => router.replace({ name: 'household' }) })
}
</script>

<template>
  <PageHeader :title="data?.member.name ?? 'Miembro'" back="/hogar" />

  <p v-if="error" class="error">{{ errorMessage(error) }}</p>
  <p v-else-if="isPending" class="muted">Cargando…</p>

  <template v-if="data">
    <button
      type="button"
      class="avatar-button"
      aria-label="Cambiar avatar"
      @click="pickingAvatar = true"
    >
      <MemberAvatar
        :name="data.member.name"
        :emoji="data.member.avatarEmoji"
        :kind="data.member.kind"
        :size="72"
      />
      <span class="avatar-hint">{{
        data.member.avatarEmoji ? 'Cambiar avatar' : 'Elegir avatar'
      }}</span>
    </button>

    <BottomSheet v-model:open="pickingAvatar" :title="`Avatar de ${data.member.name}`">
      <EmojiPicker :current="data.member.avatarEmoji" @select="selectAvatar" />
      <p v-if="updateMember.isError.value" class="error spaced-sm">
        {{ errorMessage(updateMember.error.value) }}
      </p>
    </BottomSheet>

    <AppCard>
      <div class="block">
        <h2 class="block-title">Preferencias</h2>
        <FoodPrefAdder :member-id="id" :existing="existingFoodIds" />
      </div>
      <div class="block">
        <FoodPrefList :member-id="id" title="Acepta" tone="accepts" :prefs="accepts" />
      </div>
      <div class="block">
        <FoodPrefList :member-id="id" title="Rechaza" tone="rejects" :prefs="rejects" />
      </div>
    </AppCard>

    <AppCard class="spaced">
      <form class="block form" @submit.prevent="save">
        <h2 class="block-title">Datos</h2>
        <TextField v-model="form.name" label="Nombre" required />
        <TextField
          v-model="form.birthDate"
          label="Fecha de nacimiento"
          type="date"
          :max="today"
          :hint="form.birthDate ? `${ageInYears(form.birthDate)} años` : undefined"
        />
        <TextField
          v-model="form.notes"
          label="Notas"
          multiline
          placeholder="Ej: no le gusta que los alimentos se toquen en el plato"
        />
        <p v-if="updateMember.isError.value" class="error">
          {{ errorMessage(updateMember.error.value) }}
        </p>
        <AppButton
          type="submit"
          variant="primary"
          :disabled="!dirty"
          :loading="updateMember.isPending.value"
        >
          {{ updateMember.isSuccess.value && !dirty ? 'Guardado' : 'Guardar cambios' }}
        </AppButton>
      </form>
    </AppCard>

    <template v-if="canDelete">
      <AppButton
        class="spaced"
        variant="danger"
        block
        :loading="deleteMember.isPending.value"
        @click="remove"
      >
        <Trash2 :size="18" /> {{ isAdult ? 'Eliminar cuenta' : 'Eliminar perfil' }}
      </AppButton>
      <p v-if="deleteMember.isError.value" class="error spaced-sm">
        {{ errorMessage(deleteMember.error.value) }}
      </p>
    </template>
  </template>
</template>

<style scoped>
.block {
  padding: var(--space-4);
}

.block + .block {
  border-top: 1px solid var(--color-border);
}

.block-title {
  margin-bottom: var(--space-3);
  font-size: 1.05rem;
}

.form {
  display: grid;
  gap: var(--space-3);
}

.form .block-title {
  margin-bottom: 0;
}

.spaced {
  margin-top: var(--space-4);
}

.avatar-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  margin: calc(-1 * var(--space-2)) auto var(--space-4);
  padding: var(--space-2);
  border: 0;
  border-radius: var(--radius-lg);
  background: transparent;
}

.avatar-button:active {
  background: var(--color-surface-2);
}

.avatar-hint {
  color: var(--color-accent);
  font-size: 0.85rem;
  font-weight: 600;
}

.spaced-sm {
  margin-top: var(--space-2);
}

.muted {
  color: var(--color-text-muted);
}

.error {
  margin: 0;
  color: var(--color-danger);
}
</style>
