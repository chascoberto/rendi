import { barcodeVideo } from './fixtures/barcode-video'
import { SCANNED_EAN } from './fixtures/constants'

/** Prepara el video de cámara falsa para el proyecto `scanner`. */
export default async function globalSetup() {
  await barcodeVideo(SCANNED_EAN)
}
