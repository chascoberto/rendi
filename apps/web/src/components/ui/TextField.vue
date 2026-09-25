<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next'
import { computed, ref, useId } from 'vue'

const props = defineProps<{
  label: string
  type?: string
  multiline?: boolean
  error?: string | null
  hint?: string
  autocomplete?: string
  placeholder?: string
  required?: boolean
  max?: string
  autocapitalize?: 'off' | 'sentences' | 'words'
}>()

const model = defineModel<string>({ default: '' })
const id = useId()

// Los campos de contraseña incluyen un botón para mostrarla (útil al escribir en el celular).
const revealed = ref(false)
const isPassword = computed(() => props.type === 'password')
const inputType = computed(() =>
  isPassword.value && revealed.value ? 'text' : (props.type ?? 'text'),
)
</script>

<template>
  <div class="field">
    <label class="label" :for="id">{{ label }}</label>
    <textarea
      v-if="multiline"
      :id="id"
      v-model="model"
      class="input textarea"
      rows="3"
      :placeholder="placeholder"
      :aria-invalid="!!error || undefined"
    />
    <div v-else class="input-wrap">
      <input
        :id="id"
        v-model="model"
        class="input"
        :class="{ 'input--with-toggle': isPassword }"
        :type="inputType"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :required="required"
        :max="max"
        :aria-invalid="!!error || undefined"
        :autocapitalize="isPassword ? 'off' : autocapitalize"
        :spellcheck="isPassword ? false : undefined"
      />
      <button
        v-if="isPassword"
        type="button"
        class="toggle"
        :aria-label="revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'"
        :aria-pressed="revealed"
        :aria-controls="id"
        @click="revealed = !revealed"
      >
        <EyeOff v-if="revealed" :size="20" />
        <Eye v-else :size="20" />
      </button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="hint" class="hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.field {
  display: grid;
  gap: var(--space-1);
}

.label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.input {
  width: 100%;
  min-height: var(--tap-size);
  padding: var(--space-2) var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  /* 16px evita el zoom automático de iOS al enfocar. */
  font-size: 16px;
}

.input-wrap {
  position: relative;
}

.input--with-toggle {
  padding-right: calc(var(--tap-size) + var(--space-1));
}

.toggle {
  position: absolute;
  inset: 0 0 0 auto;
  display: grid;
  place-items: center;
  width: var(--tap-size);
  border: 0;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  background: transparent;
  color: var(--color-text-muted);
}

.toggle:active {
  color: var(--color-text);
}

.textarea {
  resize: vertical;
}

.input:focus {
  outline: none;
  border-color: var(--color-accent);
}

.input[aria-invalid] {
  border-color: var(--color-danger);
}

.error,
.hint {
  margin: 0;
  font-size: 0.85rem;
}

.error {
  color: var(--color-danger);
}

.hint {
  color: var(--color-text-muted);
}
</style>
