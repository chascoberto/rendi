import { describe, expect, it } from 'vitest'
import { AVATAR_EMOJI_GROUPS, avatarEmojiSchema, isSingleEmoji } from './emoji'

describe('isSingleEmoji', () => {
  it('acepta emojis simples y compuestos', () => {
    for (const e of ['😀', '🦖', '☕', '👨‍🍳', '👍🏽', '🇨🇱', '👨‍👩‍👧‍👦']) {
      expect(isSingleEmoji(e), e).toBe(true)
    }
  })

  it('rechaza texto, varios emojis y símbolos que no son emoji', () => {
    for (const t of ['a', 'hola', '😀😀', '😀 ', '1', '#', '→', '']) {
      expect(isSingleEmoji(t), t).toBe(false)
    }
  })

  it('todos los emojis sugeridos son válidos', () => {
    for (const e of AVATAR_EMOJI_GROUPS.flatMap((g) => g.emojis))
      expect(isSingleEmoji(e), e).toBe(true)
  })
})

describe('avatarEmojiSchema', () => {
  it('normaliza vacío a null y recorta espacios', () => {
    expect(avatarEmojiSchema.parse('')).toBeNull()
    expect(avatarEmojiSchema.parse(null)).toBeNull()
    expect(avatarEmojiSchema.parse(' 🦄 ')).toBe('🦄')
  })

  it('rechaza lo que no es un solo emoji', () => {
    expect(avatarEmojiSchema.safeParse('ab').success).toBe(false)
    expect(avatarEmojiSchema.safeParse('🦄🦖').success).toBe(false)
  })
})
