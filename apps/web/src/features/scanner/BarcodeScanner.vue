<script setup lang="ts">
import { Flashlight, FlashlightOff, Keyboard, ScanBarcode } from 'lucide-vue-next'
import { onMounted, ref, useId } from 'vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useBarcodeScanner } from './useBarcodeScanner'

const props = withDefaults(defineProps<{ autostart?: boolean }>(), { autostart: true })
const emit = defineEmits<{ code: [code: string] }>()

const video = ref<HTMLVideoElement | null>(null)
const scanner = useBarcodeScanner(video, (code) => emit('code', code))
const { state, torchAvailable, torchOn } = scanner

const manualOpen = ref(false)
const manualCode = ref('')
const manualId = useId()

function submitManual() {
  const code = manualCode.value.replace(/\D/g, '')
  if (!code) return
  manualCode.value = ''
  manualOpen.value = false
  scanner.stop()
  emit('code', code)
}

onMounted(() => {
  if (props.autostart) void scanner.start()
})

/** Sigue escaneando tras mostrar un resultado (reanuda, o reinicia si se ingresó a mano). */
function next() {
  if (state.value === 'paused') scanner.resume()
  else if (state.value === 'idle') void scanner.start()
}

defineExpose({ next, stop: scanner.stop })

const messages: Partial<Record<typeof state.value, { title: string; text: string }>> = {
  denied: {
    title: 'Sin permiso para la cámara',
    text: 'Actívalo en los ajustes del navegador para este sitio, o ingresa el código a mano.',
  },
  unavailable: {
    title: 'Cámara no disponible',
    text: 'El navegador necesita HTTPS para usar la cámara, o el equipo no tiene una. Ingresa el código a mano.',
  },
  error: {
    title: 'No se pudo iniciar la cámara',
    text: 'Inténtalo de nuevo o ingresa el código a mano.',
  },
}
</script>

<template>
  <div class="scanner">
    <div class="viewport" :data-state="state">
      <video ref="video" class="video" muted playsinline aria-hidden="true" />
      <div v-if="state === 'scanning' || state === 'starting'" class="frame" aria-hidden="true">
        <span class="line" />
      </div>
      <p v-if="state === 'scanning'" class="status" role="status">Apunta al código de barras</p>
      <p v-else-if="state === 'starting'" class="status" role="status">Iniciando cámara…</p>

      <div v-if="messages[state]" class="overlay">
        <p class="overlay-title">{{ messages[state]!.title }}</p>
        <p class="overlay-text">{{ messages[state]!.text }}</p>
        <AppButton v-if="state === 'error'" variant="primary" @click="scanner.start()">
          Reintentar
        </AppButton>
      </div>
      <div v-else-if="state === 'idle'" class="overlay">
        <AppButton variant="primary" size="lg" @click="scanner.start()">
          <ScanBarcode :size="20" /> Activar cámara
        </AppButton>
      </div>

      <button
        v-if="torchAvailable && state === 'scanning'"
        type="button"
        class="torch"
        :aria-label="torchOn ? 'Apagar linterna' : 'Encender linterna'"
        :aria-pressed="torchOn"
        @click="scanner.toggleTorch()"
      >
        <FlashlightOff v-if="torchOn" :size="22" />
        <Flashlight v-else :size="22" />
      </button>
    </div>

    <form v-if="manualOpen" class="manual" @submit.prevent="submitManual">
      <label :for="manualId" class="manual-label">Código de barras</label>
      <div class="manual-row">
        <input
          :id="manualId"
          v-model="manualCode"
          class="manual-input"
          inputmode="numeric"
          autocomplete="off"
          placeholder="13 dígitos"
          enterkeyhint="search"
        />
        <AppButton type="submit" variant="primary" :disabled="!manualCode.trim()">Buscar</AppButton>
      </div>
    </form>
    <AppButton v-else variant="ghost" block @click="manualOpen = true">
      <Keyboard :size="18" /> Ingresar código a mano
    </AppButton>
  </div>
</template>

<style scoped>
.scanner {
  display: grid;
  gap: var(--space-3);
}

.viewport {
  position: relative;
  overflow: hidden;
  aspect-ratio: 3 / 4;
  max-height: 60dvh;
  border-radius: var(--radius-lg);
  background: #0c0d0c;
}

.video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.frame {
  position: absolute;
  inset: 32% 10%;
  border: 3px solid rgb(255 255 255 / 85%);
  border-radius: var(--radius-md);
  box-shadow: 0 0 0 100vmax rgb(0 0 0 / 35%);
}

.line {
  position: absolute;
  inset: 50% 8% auto;
  height: 2px;
  background: #ff4d4d;
  box-shadow: 0 0 8px #ff4d4d;
}

.status {
  position: absolute;
  inset: auto 0 var(--space-4);
  margin: 0;
  color: #fff;
  font-weight: 600;
  text-align: center;
  text-shadow: 0 1px 3px rgb(0 0 0 / 60%);
}

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--space-2);
  padding: var(--space-5);
  color: #fff;
  text-align: center;
}

.overlay-title {
  margin: 0;
  font-weight: 700;
}

.overlay-text {
  margin: 0;
  max-width: 34ch;
  color: rgb(255 255 255 / 75%);
  font-size: 0.9rem;
}

.torch {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 0;
  border-radius: 50%;
  background: rgb(0 0 0 / 50%);
  color: #fff;
}

.torch[aria-pressed='true'] {
  background: #fff;
  color: #000;
}

.manual {
  display: grid;
  gap: var(--space-1);
}

.manual-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.manual-row {
  display: flex;
  gap: var(--space-2);
}

.manual-input {
  flex: 1;
  min-height: var(--tap-size);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: 16px;
  letter-spacing: 0.05em;
}
</style>
