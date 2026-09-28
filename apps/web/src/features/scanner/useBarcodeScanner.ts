import { isValidEan, isVariableMeasureEan } from '@rendi/shared'
import { onBeforeUnmount, ref, type Ref } from 'vue'
import { getDetector } from './detector'

export type ScannerState =
  'idle' | 'starting' | 'scanning' | 'paused' | 'denied' | 'unavailable' | 'error'

const SCAN_INTERVAL_MS = 120

/**
 * Cámara trasera + detección continua. Al leer un código válido dos veces seguidas
 * (evita lecturas erróneas) vibra, se pausa y llama a `onCode`. `resume()` reanuda.
 * Libera la cámara al desmontar o al ocultarse la página.
 */
export function useBarcodeScanner(
  video: Ref<HTMLVideoElement | null>,
  onCode: (code: string) => void,
) {
  const state = ref<ScannerState>('idle')
  const torchAvailable = ref(false)
  const torchOn = ref(false)

  let stream: MediaStream | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastRead: string | null = null

  async function start() {
    if (state.value === 'starting' || state.value === 'scanning') return
    if (!navigator.mediaDevices?.getUserMedia) {
      // Sin HTTPS (o navegador sin cámara) no existe getUserMedia.
      state.value = 'unavailable'
      return
    }
    state.value = 'starting'
    try {
      const [media, detector] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        }),
        getDetector(),
      ])
      stream = media
      const el = video.value
      if (!el) return stop()
      el.srcObject = media
      await el.play()
      const track = media.getVideoTracks()[0]
      const caps = (track?.getCapabilities?.() ?? {}) as { torch?: boolean }
      torchAvailable.value = !!caps.torch
      state.value = 'scanning'
      loop(detector)
    } catch (error) {
      stop()
      const name = (error as { name?: string }).name
      state.value =
        name === 'NotAllowedError' ? 'denied' : name === 'NotFoundError' ? 'unavailable' : 'error'
    }
  }

  function loop(detector: Awaited<ReturnType<typeof getDetector>>) {
    timer = setTimeout(async () => {
      const el = video.value
      if (state.value === 'scanning' && el && el.readyState >= 2) {
        try {
          const codes = await detector.detect(el)
          const code = codes
            .map((c) => c.rawValue)
            .find((v) => isValidEan(v) || isVariableMeasureEan(v))
          if (code && code === lastRead) {
            state.value = 'paused'
            lastRead = null
            navigator.vibrate?.(60)
            onCode(code)
          } else {
            lastRead = code ?? null
          }
        } catch {
          // Un fotograma que falla no detiene el escaneo.
        }
      }
      if (stream) loop(detector)
    }, SCAN_INTERVAL_MS)
  }

  function resume() {
    if (state.value === 'paused') state.value = 'scanning'
  }

  function stop() {
    clearTimeout(timer)
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    torchOn.value = false
    if (video.value) video.value.srcObject = null
    if (state.value === 'starting' || state.value === 'scanning' || state.value === 'paused') {
      state.value = 'idle'
    }
  }

  async function toggleTorch() {
    const track = stream?.getVideoTracks()[0]
    if (!track || !torchAvailable.value) return
    const next = !torchOn.value
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] })
      torchOn.value = next
    } catch {
      torchAvailable.value = false
    }
  }

  const onVisibility = () => {
    if (document.hidden) stop()
  }
  document.addEventListener('visibilitychange', onVisibility)
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    stop()
  })

  return { state, torchAvailable, torchOn, start, stop, resume, toggleTorch }
}
