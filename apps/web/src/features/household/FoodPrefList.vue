<script setup lang="ts">
import { ArrowLeftRight, Trash2 } from 'lucide-vue-next'
import { ref } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import type { FoodPref } from './queries'
import { useFoodPrefMutations } from './queries'

const props = defineProps<{
  memberId: string
  title: string
  prefs: FoodPref[]
  tone: 'accepts' | 'rejects'
}>()

const { update, remove } = useFoodPrefMutations(() => props.memberId)
const openId = ref<string | null>(null)
const note = ref('')

function toggle(pref: FoodPref) {
  openId.value = openId.value === pref.foodId ? null : pref.foodId
  note.value = pref.notes ?? ''
}

const close = () => (openId.value = null)

function saveNote(pref: FoodPref) {
  update.mutate({ foodId: pref.foodId, notes: note.value }, { onSuccess: close })
}

function flip(pref: FoodPref) {
  const stance = pref.stance === 'accepts' ? 'rejects' : 'accepts'
  update.mutate({ foodId: pref.foodId, stance }, { onSuccess: close })
}
</script>

<template>
  <section :aria-label="title">
    <h3 class="title" :class="`title--${tone}`">
      {{ title }} <span class="count">{{ prefs.length }}</span>
    </h3>
    <p v-if="prefs.length === 0" class="empty">Nada registrado todavía.</p>
    <ul class="chips">
      <li v-for="pref in prefs" :key="pref.foodId" :class="{ open: openId === pref.foodId }">
        <button type="button" class="chip" :class="`chip--${tone}`" @click="toggle(pref)">
          {{ pref.foodName }}
          <span v-if="pref.notes" class="note-dot" aria-label="tiene nota">•</span>
        </button>
      </li>
    </ul>
    <template v-for="pref in prefs" :key="pref.foodId">
      <div v-if="openId === pref.foodId" class="editor">
        <p class="editor-title">{{ pref.foodName }}</p>
        <textarea
          v-model="note"
          class="note-input"
          rows="2"
          placeholder="Nota (ej: cocido sí, crudo no)"
        />
        <div class="editor-actions">
          <AppButton
            variant="danger"
            :disabled="remove.isPending.value"
            @click="remove.mutate(pref.foodId)"
          >
            <Trash2 :size="16" /> Quitar
          </AppButton>
          <AppButton :disabled="update.isPending.value" @click="flip(pref)">
            <ArrowLeftRight :size="16" />
            {{ pref.stance === 'accepts' ? 'Rechaza' : 'Acepta' }}
          </AppButton>
          <AppButton variant="primary" :loading="update.isPending.value" @click="saveNote(pref)">
            Guardar
          </AppButton>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0 0 var(--space-2);
  font-size: 0.95rem;
}

.count {
  padding: 0 var(--space-2);
  border-radius: 999px;
  background: var(--color-surface-2);
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

.title--accepts {
  color: var(--color-accent);
}

.title--rejects {
  color: var(--color-danger);
}

.empty {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.chip {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 500;
}

.chip--accepts {
  background: var(--color-accent-soft);
  color: var(--color-text);
}

.chip--rejects {
  background: var(--color-danger-soft);
  color: var(--color-text);
}

.open .chip {
  border-color: currentColor;
}

.note-dot {
  margin-left: 2px;
  color: var(--color-text-muted);
}

.editor {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
}

.editor-title {
  margin: 0;
  font-weight: 600;
}

.note-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: 16px;
  resize: vertical;
}

.editor-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
