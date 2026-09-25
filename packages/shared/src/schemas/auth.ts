import { z } from 'zod'

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/
export const PASSWORD_MIN_LENGTH = 8

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    USERNAME_PATTERN,
    'Entre 3 y 32 caracteres: letras minúsculas, números, punto, guion o guion bajo',
  )

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(200)

export const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, 'Ingresa tu usuario'),
  password: z.string().min(1, 'Ingresa tu contraseña').max(200),
})
export type LoginInput = z.infer<typeof loginSchema>
