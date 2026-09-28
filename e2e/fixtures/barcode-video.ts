import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareZXingModule, writeBarcode } from 'zxing-wasm/writer'

const here = dirname(fileURLToPath(import.meta.url))
export const GENERATED_DIR = join(here, '..', '.generated')

/**
 * Genera un video .y4m con un código EAN-13 en pantalla, para usarlo como cámara falsa de
 * Chromium (`--use-file-for-fake-video-capture`). Requiere ffmpeg. Devuelve la ruta al video.
 */
export async function barcodeVideo(ean: string): Promise<string> {
  const video = join(GENERATED_DIR, `barcode-${ean}.y4m`)
  if (existsSync(video)) return video
  mkdirSync(GENERATED_DIR, { recursive: true })

  const require = createRequire(import.meta.url)
  const wasmPath = require.resolve('zxing-wasm/writer/zxing_writer.wasm')
  prepareZXingModule({ overrides: { wasmBinary: readFileSync(wasmPath).buffer as ArrayBuffer } })
  const { image, error } = await writeBarcode(ean, { format: 'EAN13', scale: 4 })
  if (!image) throw new Error(`No se pudo generar el código: ${error}`)
  const png = join(GENERATED_DIR, `barcode-${ean}.png`)
  writeFileSync(png, Buffer.from(await image.arrayBuffer()))

  // Código centrado sobre fondo blanco en 640×480, 10 cuadros (Chromium repite el video).
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-loop',
    '1',
    '-i',
    png,
    '-vf',
    'scale=480:-1,pad=640:480:(ow-iw)/2:(oh-ih)/2:white,format=yuv420p',
    '-frames:v',
    '10',
    video,
  ])
  return video
}
