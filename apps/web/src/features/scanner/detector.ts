import type { BarcodeDetector as PonyfillDetector } from 'barcode-detector/ponyfill'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

type Detector = Pick<PonyfillDetector, 'detect'>

/** Formatos de supermercado: EAN-13 (casi todo en Chile), EAN-8 y UPC-A (importados). */
const FORMATS = ['ean_13', 'ean_8', 'upc_a'] as const

let detectorPromise: Promise<Detector> | undefined

/**
 * Usa la API nativa `BarcodeDetector` si el navegador la trae con EAN (Chrome en Android);
 * si no (Safari, Firefox, Chrome de escritorio), el ponyfill con zxing-cpp en WASM.
 * El `.wasm` se sirve desde la propia app (no desde un CDN) para funcionar sin internet.
 */
export function getDetector(): Promise<Detector> {
  detectorPromise ??= createDetector()
  return detectorPromise
}

async function createDetector(): Promise<Detector> {
  const native = (globalThis as { BarcodeDetector?: typeof PonyfillDetector }).BarcodeDetector
  if (native) {
    try {
      const supported = await native.getSupportedFormats()
      if (FORMATS.every((f) => supported.includes(f))) return new native({ formats: [...FORMATS] })
    } catch {
      // Implementación nativa incompleta: se usa el ponyfill.
    }
  }
  const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill')
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith('.wasm') ? wasmUrl : prefix + path,
    },
  })
  return new BarcodeDetector({ formats: [...FORMATS] })
}
