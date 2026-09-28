import { join } from 'node:path'

/** EAN-13 válido que la cámara falsa muestra en las pruebas del escáner. */
export const SCANNED_EAN = '4006381333931'

export const scannedVideoPath = (generatedDir: string) =>
  join(generatedDir, `barcode-${SCANNED_EAN}.y4m`)
