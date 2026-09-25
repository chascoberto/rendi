import { z } from 'zod'
import { avatarEmojiSchema } from '../emoji'
import { capitalizeFirst, capitalizePersonName } from '../text'
import { passwordSchema, usernameSchema } from './auth'

const calendarDateSchema = z.iso.date('Fecha inválida')

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()

export const memberNameSchema = z
  .string()
  .trim()
  .min(1, 'Ingresa un nombre')
  .max(60)
  .transform(capitalizePersonName)

/** Un adulto nuevo: miembro del hogar con cuenta de acceso. */
export const adultCreateSchema = z.object({
  name: memberNameSchema,
  username: usernameSchema,
  password: passwordSchema,
})
export type AdultCreateInput = z.infer<typeof adultCreateSchema>

export const childCreateSchema = z.object({
  name: memberNameSchema,
  birthDate: calendarDateSchema.nullable().optional(),
  notes: optionalText(1000).optional(),
  avatarEmoji: avatarEmojiSchema.optional(),
})
export type ChildCreateInput = z.infer<typeof childCreateSchema>

export const memberUpdateSchema = z
  .object({
    name: memberNameSchema,
    birthDate: calendarDateSchema.nullable(),
    notes: optionalText(1000),
    avatarEmoji: avatarEmojiSchema,
  })
  .partial()
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>

export const FOOD_STANCES = ['accepts', 'rejects'] as const
export type FoodStance = (typeof FOOD_STANCES)[number]

export const foodNameSchema = z
  .string()
  .trim()
  .min(1, 'Ingresa un alimento')
  .max(60)
  .transform(capitalizeFirst)

/** Agrega una preferencia; si el alimento no existe se crea con ese nombre. */
export const foodPrefCreateSchema = z.object({
  foodName: foodNameSchema,
  stance: z.enum(FOOD_STANCES),
  notes: optionalText(300).optional(),
})
export type FoodPrefCreateInput = z.infer<typeof foodPrefCreateSchema>

export const foodPrefUpdateSchema = z
  .object({
    stance: z.enum(FOOD_STANCES),
    notes: optionalText(300),
  })
  .partial()
export type FoodPrefUpdateInput = z.infer<typeof foodPrefUpdateSchema>
