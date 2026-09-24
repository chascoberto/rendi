import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppEnv } from '../../lib/context'

export const systemRoutes = new Hono<AppEnv>().get('/health', (c) => {
  c.var.db.run(sql`SELECT 1`)
  return c.json({ status: 'ok' as const, time: new Date().toISOString() })
})
