import { sql } from 'drizzle-orm'
import { check, index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { calendarDate, createdAt, id, timestamp } from './_columns'
import { foods } from './catalog'

export const households = sqliteTable('households', {
  id: id(),
  name: text().notNull(),
  timezone: text().notNull().default('America/Santiago'),
  currency: text().notNull().default('CLP'),
  createdAt: createdAt(),
})

/** Personas del hogar. Un adulto es el miembro que además tiene un `user`. */
export const members = sqliteTable(
  'members',
  {
    id: id(),
    householdId: text()
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    kind: text({ enum: ['adult', 'child'] }).notNull(),
    birthDate: calendarDate(),
    notes: text(),
    /** Emoji de avatar (uno solo, validado con `avatarEmojiSchema`); null = inicial del nombre. */
    avatarEmoji: text(),
    /** Perfil alimentario (Fase 5). JSON libre hasta que se defina su forma. */
    dietProfile: text({ mode: 'json' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('members_household_idx').on(t.householdId),
    check('members_kind_check', sql`${t.kind} IN ('adult', 'child')`),
  ],
)

export const users = sqliteTable('users', {
  id: id(),
  memberId: text()
    .notNull()
    .unique()
    .references(() => members.id, { onDelete: 'cascade' }),
  username: text().notNull().unique(),
  passwordHash: text().notNull(),
  createdAt: createdAt(),
})

/** Sesiones de login. El id es el SHA-256 del token de la cookie: la base nunca guarda el token. */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)

/** Alimentos que un miembro acepta o rechaza (clave para el planificador de menús). */
export const memberFoodPrefs = sqliteTable(
  'member_food_prefs',
  {
    memberId: text()
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    foodId: text()
      .notNull()
      .references(() => foods.id, { onDelete: 'cascade' }),
    stance: text({ enum: ['accepts', 'rejects'] }).notNull(),
    notes: text(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.memberId, t.foodId] }),
    check('member_food_prefs_stance_check', sql`${t.stance} IN ('accepts', 'rejects')`),
  ],
)
