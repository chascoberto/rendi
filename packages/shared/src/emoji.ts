import { z } from 'zod'

/** Un emoji compuesto (ZWJ, tonos de piel, banderas) puede ocupar más de 20 unidades UTF-16. */
export const AVATAR_EMOJI_MAX_LENGTH = 40

let rgiEmoji: RegExp | null | undefined

/**
 * `\p{RGI_Emoji}` requiere el flag `v` (Chrome 112+, Safari 17+, Node 20+). Se construye en
 * tiempo de ejecución: como literal, un navegador antiguo no podría ni cargar este módulo.
 */
function rgiEmojiRegex(): RegExp | null {
  if (rgiEmoji === undefined) {
    try {
      rgiEmoji = new RegExp('^\\p{RGI_Emoji}$', 'v')
    } catch {
      rgiEmoji = null
    }
  }
  return rgiEmoji
}

/**
 * ¿Es exactamente un emoji? Devuelve `null` si el entorno no puede validarlo
 * (navegador antiguo): en ese caso decide el servidor.
 */
export function isSingleEmoji(text: string): boolean | null {
  const regex = rgiEmojiRegex()
  return regex ? regex.test(text) : null
}

/** Emoji de avatar: exactamente uno, o null para quitarlo. */
export const avatarEmojiSchema = z
  .string()
  .trim()
  .max(AVATAR_EMOJI_MAX_LENGTH, 'Elige un solo emoji')
  .transform((v) => (v === '' ? null : v))
  .refine((v) => v === null || isSingleEmoji(v) !== false, 'Elige un solo emoji')
  .nullable()

/** Emojis sugeridos en el selector de avatar. */
export const AVATAR_EMOJI_GROUPS = [
  {
    label: 'Caras',
    emojis: ['😀', '😎', '🤓', '🥳', '😺', '🤠', '👸', '🦸', '🧙', '🧑‍🍳', '👩‍🍳', '👨‍🍳'],
  },
  {
    label: 'Animales',
    emojis: ['🐶', '🐱', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐸', '🐵', '🦄', '🦖'],
  },
  {
    label: 'Comida',
    emojis: ['🍓', '🍎', '🍌', '🍉', '🍇', '🥑', '🥕', '🌽', '🍕', '🍪', '🧁', '🍦'],
  },
  {
    label: 'Otros',
    emojis: ['⚽', '🏀', '🎨', '🎸', '🚀', '🚗', '🌻', '🌈', '⭐', '🌙', '☕', '🎈'],
  },
] as const
