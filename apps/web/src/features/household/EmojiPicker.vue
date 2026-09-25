<script setup lang="ts">
import { AVATAR_EMOJI_GROUPS, avatarEmojiSchema } from '@rendi/shared'
import { ref, useId } from 'vue'

defineProps<{ current: string | null }>()
const emit = defineEmits<{ select: [emoji: string | null] }>()

const custom = ref('')
const customError = ref<string | null>(null)
const customId = useId()

function useCustom() {
  const parsed = avatarEmojiSchema.safeParse(custom.value)
  if (!parsed.success || parsed.data === null) {
    customError.value = 'Escribe o pega un solo emoji'
    return
  }
  customError.value = null
  emit('select', parsed.data)
}
</script>

<template>
  <div class="picker">
    <section v-for="group in AVATAR_EMOJI_GROUPS" :key="group.label" :aria-label="group.label">
      <h3 class="group-title">{{ group.label }}</h3>
      <div class="grid">
        <button
          v-for="emoji in group.emojis"
          :key="emoji"
          type="button"
          class="emoji"
          :aria-label="emoji"
          :aria-pressed="current === emoji"
          @click="emit('select', emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </section>

    <form class="custom" @submit.prevent="useCustom">
      <label class="group-title" :for="customId">Otro emoji</label>
      <div class="custom-row">
        <input
          :id="customId"
          v-model="custom"
          class="custom-input"
          autocomplete="off"
          placeholder="Pega o escribe uno"
          :aria-invalid="!!customError || undefined"
        />
        <button type="submit" class="custom-use" :disabled="!custom.trim()">Usar</button>
      </div>
      <p v-if="customError" class="error">{{ customError }}</p>
    </form>

    <button v-if="current" type="button" class="remove" @click="emit('select', null)">
      Quitar avatar (usar la inicial)
    </button>
  </div>
</template>

<style scoped>
.picker {
  display: grid;
  gap: var(--space-4);
}

.group-title {
  display: block;
  margin: 0 0 var(--space-2);
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--space-1);
}

.emoji {
  aspect-ratio: 1;
  min-height: var(--tap-size);
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  font-family: var(--font-emoji);
  font-size: 1.6rem;
  line-height: 1;
}

.emoji:active {
  transform: scale(0.94);
}

.emoji[aria-pressed='true'] {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.custom-row {
  display: flex;
  gap: var(--space-2);
}

.custom-input {
  flex: 1;
  min-height: var(--tap-size);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  font-size: 16px;
}

.custom-input[aria-invalid] {
  border-color: var(--color-danger);
}

.custom-use {
  min-width: 72px;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  font-weight: 600;
}

.custom-use:disabled {
  opacity: 0.5;
}

.error {
  margin: var(--space-1) 0 0;
  color: var(--color-danger);
  font-size: 0.85rem;
}

.remove {
  min-height: var(--tap-size);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  font-weight: 600;
}
</style>
