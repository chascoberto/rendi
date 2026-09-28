import { Hono } from 'hono'
import type { AuthEnv } from '../../lib/context'
import { requireAuth } from '../auth/middleware'
import { listLocations } from './service'

export const pantryRoutes = new Hono<AuthEnv>()
  .use(requireAuth)
  .get('/locations', (c) => c.json({ locations: listLocations(c.var.db, c.var.user.householdId) }))
