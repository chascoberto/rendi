import { z } from 'zod'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().default('./data/rendi.db'),
  /** Rutas relativas al directorio de trabajo (apps/api, también en systemd). */
  MIGRATIONS_DIR: z.string().default('./drizzle'),
  /** Cookie de sesión solo por HTTPS. Por defecto: sí en producción, no en desarrollo. */
  COOKIE_SECURE: z.stringbool().optional(),
  /** Consultar Open Food Facts al escanear un código desconocido. */
  OPEN_FOOD_FACTS: z.stringbool().default(true),
})

export type Env = z.infer<typeof EnvSchema> & { COOKIE_SECURE: boolean }

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('Configuración inválida:', z.prettifyError(parsed.error))
    process.exit(1)
  }
  return {
    ...parsed.data,
    COOKIE_SECURE: parsed.data.COOKIE_SECURE ?? parsed.data.NODE_ENV === 'production',
  }
}

export const env = loadEnv()
