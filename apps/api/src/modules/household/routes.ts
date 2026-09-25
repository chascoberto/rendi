import {
  adultCreateSchema,
  childCreateSchema,
  foodPrefCreateSchema,
  foodPrefUpdateSchema,
  memberUpdateSchema,
} from '@rendi/shared'
import { Hono } from 'hono'
import type { AuthEnv } from '../../lib/context'
import { validate } from '../../lib/validation'
import { requireAuth } from '../auth/middleware'
import * as household from './service'

export const householdRoutes = new Hono<AuthEnv>()
  .use(requireAuth)
  .get('/', (c) => c.json(household.getHousehold(c.var.db, c.var.user.householdId)))
  .post('/adults', validate('json', adultCreateSchema), async (c) => {
    const member = await household.createAdult(
      c.var.db,
      c.var.user.householdId,
      c.req.valid('json'),
    )
    return c.json({ member }, 201)
  })
  .post('/members', validate('json', childCreateSchema), (c) => {
    const member = household.createChild(c.var.db, c.var.user.householdId, c.req.valid('json'))
    return c.json({ member }, 201)
  })
  .get('/members/:id', (c) => {
    const { db, user } = c.var
    const member = household.getMember(db, user.householdId, c.req.param('id'))
    const prefs = household.listFoodPrefs(db, user.householdId, member.id)
    return c.json({ member, prefs })
  })
  .patch('/members/:id', validate('json', memberUpdateSchema), (c) => {
    const { db, user } = c.var
    const member = household.updateMember(
      db,
      user.householdId,
      c.req.param('id'),
      c.req.valid('json'),
    )
    return c.json({ member })
  })
  .delete('/members/:id', (c) => {
    const { db, user } = c.var
    household.deleteMember(db, user.householdId, c.req.param('id'), user.memberId)
    return c.json({ ok: true as const })
  })
  .post('/members/:id/prefs', validate('json', foodPrefCreateSchema), (c) => {
    const { db, user } = c.var
    const pref = household.upsertFoodPref(
      db,
      user.householdId,
      c.req.param('id'),
      c.req.valid('json'),
    )
    return c.json({ pref }, 201)
  })
  .patch('/members/:id/prefs/:foodId', validate('json', foodPrefUpdateSchema), (c) => {
    const { db, user } = c.var
    const { id, foodId } = c.req.param()
    const pref = household.updateFoodPref(db, user.householdId, id, foodId, c.req.valid('json'))
    return c.json({ pref })
  })
  .delete('/members/:id/prefs/:foodId', (c) => {
    const { id, foodId } = c.req.param()
    household.deleteFoodPref(c.var.db, c.var.user.householdId, id, foodId)
    return c.json({ ok: true as const })
  })
