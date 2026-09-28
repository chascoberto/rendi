import {
  addDays,
  bulkLevelInputSchema,
  lotTargetSchema,
  lotUpdateSchema,
  purchaseInputSchema,
  toCalendarDate,
} from '@rendi/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AuthEnv } from '../../lib/context'
import { validate } from '../../lib/validation'
import { requireAuth } from '../auth/middleware'
import { listLocations } from './service'
import * as stock from './stock'

export const pantryRoutes = new Hono<AuthEnv>()
  .use(requireAuth)
  .get('/locations', (c) => c.json({ locations: listLocations(c.var.db, c.var.user.householdId) }))
  .get(
    '/expiring',
    validate('query', z.object({ days: z.coerce.number().int().min(0).max(365).default(30) })),
    (c) => {
      const today = toCalendarDate()
      const until = addDays(today, c.req.valid('query').days)
      return c.json({ today, lots: stock.listExpiring(c.var.db, c.var.user.householdId, until) })
    },
  )
  .post('/products/:id/consume', validate('json', lotTargetSchema), (c) =>
    c.json(stock.consumeOne(c.var.db, c.var.user, c.req.param('id'), c.req.valid('json'))),
  )
  .post('/products/:id/deplete', validate('json', lotTargetSchema), (c) =>
    c.json(stock.deplete(c.var.db, c.var.user, c.req.param('id'), c.req.valid('json'))),
  )
  .post('/products/:id/purchase', validate('json', purchaseInputSchema), (c) =>
    c.json(stock.purchase(c.var.db, c.var.user, c.req.param('id'), c.req.valid('json'))),
  )
  .put('/products/:id/level', validate('json', bulkLevelInputSchema), (c) =>
    c.json(stock.setBulkLevel(c.var.db, c.var.user, c.req.param('id'), c.req.valid('json').level)),
  )
  .patch('/lots/:id', validate('json', lotUpdateSchema), (c) =>
    c.json(stock.updateLot(c.var.db, c.var.user, c.req.param('id'), c.req.valid('json'))),
  )
  .post('/actions/:id/undo', (c) =>
    c.json(stock.undoAction(c.var.db, c.var.user, c.req.param('id'))),
  )
