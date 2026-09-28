import { barcodeInputSchema, productCreateSchema, productUpdateSchema } from '@rendi/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import type { AuthEnv } from '../../lib/context'
import { validate } from '../../lib/validation'
import { requireAuth } from '../auth/middleware'
import { searchFoods } from './foods'
import * as catalog from './products'

export const catalogRoutes = new Hono<AuthEnv>()
  .use(requireAuth)
  .get(
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
  .get('/categories', (c) => c.json({ categories: catalog.listCategories(c.var.db) }))
  .get(
    '/products',
    validate(
      'query',
      z.object({
        q: z.string().max(80).optional(),
        categoryId: z.string().max(40).optional(),
        limit: z.coerce.number().int().min(1).max(500).optional(),
      }),
    ),
    (c) =>
      c.json({
        products: catalog.listProducts(c.var.db, c.var.user.householdId, c.req.valid('query')),
      }),
  )
  .post('/products', validate('json', productCreateSchema), (c) =>
    c.json(catalog.createProduct(c.var.db, c.var.user.householdId, c.req.valid('json')), 201),
  )
  .get('/products/:id', (c) =>
    c.json(catalog.getProduct(c.var.db, c.var.user.householdId, c.req.param('id'))),
  )
  .patch('/products/:id', validate('json', productUpdateSchema), (c) => {
    const { db, user } = c.var
    return c.json(
      catalog.updateProduct(
        db,
        user.householdId,
        c.req.param('id'),
        c.req.valid('json'),
        user.userId,
      ),
    )
  })
  .delete('/products/:id', (c) => {
    catalog.archiveProduct(c.var.db, c.var.user.householdId, c.req.param('id'))
    return c.json({ ok: true as const })
  })
  .post('/products/:id/barcodes', validate('json', barcodeInputSchema), (c) =>
    c.json(
      catalog.addBarcode(c.var.db, c.var.user.householdId, c.req.param('id'), c.req.valid('json')),
      201,
    ),
  )
  .delete('/products/:id/barcodes/:ean', (c) => {
    const { id, ean } = c.req.param()
    catalog.removeBarcode(c.var.db, c.var.user.householdId, id, ean)
    return c.json({ ok: true as const })
  })
  .get('/barcodes/:ean', async (c) =>
    c.json(
      await catalog.lookupBarcode(
        c.var.db,
        c.var.user.householdId,
        c.req.param('ean'),
        c.var.productLookup,
      ),
    ),
  )
