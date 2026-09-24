import { Hono } from 'hono'

export const systemRoutes = new Hono().get('/health', (c) =>
  c.json({ status: 'ok' as const, time: new Date().toISOString() }),
)
