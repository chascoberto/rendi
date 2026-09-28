import {
  listItemCheckSchema,
  listItemCreateSchema,
  listItemUpdateSchema,
  purchaseFinalizeSchema,
} from '@rendi/shared'
import { Hono } from 'hono'
import type { AuthEnv } from '../../lib/context'
import { validate } from '../../lib/validation'
import { requireAuth } from '../auth/middleware'
import * as shopping from './service'

export const shoppingRoutes = new Hono<AuthEnv>()
  .use(requireAuth)
  .get('/supermarkets', (c) => c.json({ supermarkets: shopping.listSupermarkets(c.var.db) }))
  .get('/items', (c) => c.json({ items: shopping.listItems(c.var.db, c.var.user.householdId) }))
  .post('/items', validate('json', listItemCreateSchema), (c) =>
    c.json({ item: shopping.addItem(c.var.db, c.var.user, c.req.valid('json')) }, 201),
  )
  .patch('/items/:id', validate('json', listItemUpdateSchema), (c) =>
    c.json({
      item: shopping.updateItem(
        c.var.db,
        c.var.user.householdId,
        c.req.param('id'),
        c.req.valid('json'),
      ),
    }),
  )
  .delete('/items/:id', (c) => {
    shopping.deleteItem(c.var.db, c.var.user.householdId, c.req.param('id'))
    return c.json({ ok: true as const })
  })
  .put('/items/:id/check', validate('json', listItemCheckSchema), (c) =>
    c.json(shopping.checkItem(c.var.db, c.var.user, c.req.param('id'), c.req.valid('json'))),
  )
  .post('/purchases', validate('json', purchaseFinalizeSchema), (c) =>
    c.json(shopping.finalizePurchase(c.var.db, c.var.user, c.req.valid('json')), 201),
  )
