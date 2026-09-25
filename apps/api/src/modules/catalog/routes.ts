import { Hono } from 'hono'
import { z } from 'zod'
import type { AuthEnv } from '../../lib/context'
import { validate } from '../../lib/validation'
import { requireAuth } from '../auth/middleware'
import { searchFoods } from './foods'

export const catalogRoutes = new Hono<AuthEnv>().use(requireAuth).get(
  '/foods',
  validate(
    'query',
    z.object({
      q: z.string().max(60).default(''),
      limit: z.coerce.number().int().min(1).max(50).default(10),
    }),
  ),
  (c) => {
    const { q, limit } = c.req.valid('query')
    return c.json({ foods: searchFoods(c.var.db, c.var.user.householdId, q, limit) })
  },
)
