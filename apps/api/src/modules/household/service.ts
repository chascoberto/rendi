import type {
  AdultCreateInput,
  ChildCreateInput,
  FoodPrefCreateInput,
  FoodPrefUpdateInput,
  MemberUpdateInput,
} from '@rendi/shared'
import { and, asc, count, eq } from 'drizzle-orm'
import type { Db, DbOrTx } from '../../db/client'
import { foods, households, locations, memberFoodPrefs, members, users } from '../../db/schema'
import { AppError, notFound } from '../../lib/errors'
import { hashPassword } from '../auth/password'
import { createAdultUser } from '../auth/service'
import { findOrCreateFood } from '../catalog/foods'

export const DEFAULT_LOCATIONS = ['Despensa', 'Refrigerador', 'Congelador'] as const

/** Crea un hogar con sus ubicaciones por defecto. */
export function createHousehold(db: DbOrTx, input: { name: string }) {
  return db.transaction((tx) => {
    const [household] = tx.insert(households).values({ name: input.name }).returning().all()
    if (!household) throw new Error('No se pudo crear el hogar')
    const locs = tx
      .insert(locations)
      .values(
        DEFAULT_LOCATIONS.map((name, i) => ({ householdId: household.id, name, sortOrder: i })),
      )
      .returning()
      .all()
    return { household, locations: locs }
  })
}

/** El hogar con sus miembros; los adultos incluyen su nombre de usuario. */
export function getHousehold(db: DbOrTx, householdId: string) {
  const household = db.select().from(households).where(eq(households.id, householdId)).get()
  if (!household) throw notFound('Hogar no encontrado')
  const rows = db
    .select({
      id: members.id,
      name: members.name,
      kind: members.kind,
      birthDate: members.birthDate,
      notes: members.notes,
      avatarEmoji: members.avatarEmoji,
      username: users.username,
    })
    .from(members)
    .leftJoin(users, eq(users.memberId, members.id))
    .where(eq(members.householdId, householdId))
    .orderBy(asc(members.kind), asc(members.createdAt))
    .all()
  return { household: { id: household.id, name: household.name }, members: rows }
}

/** Adultos con cuenta del hogar, indexados por `userId` (para mostrar quién hizo algo). */
export function listUsers(db: DbOrTx, householdId: string) {
  const rows = db
    .select({
      userId: users.id,
      memberId: members.id,
      name: members.name,
      avatarEmoji: members.avatarEmoji,
    })
    .from(users)
    .innerJoin(members, eq(members.id, users.memberId))
    .where(eq(members.householdId, householdId))
    .all()
  return new Map(rows.map((r) => [r.userId, r]))
}

/** Obtiene un miembro verificando que pertenezca al hogar. */
export function getMember(db: DbOrTx, householdId: string, memberId: string) {
  const member = db
    .select()
    .from(members)
    .where(and(eq(members.id, memberId), eq(members.householdId, householdId)))
    .get()
  if (!member) throw notFound('Miembro no encontrado')
  return member
}

/** Crea un adulto con cuenta. El nombre de usuario es único en toda la instalación. */
export async function createAdult(db: Db, householdId: string, input: AdultCreateInput) {
  if (db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).get()) {
    throw new AppError(409, 'username_taken', 'Ese nombre de usuario ya existe')
  }
  const passwordHash = await hashPassword(input.password)
  const { member } = createAdultUser(db, {
    householdId,
    name: input.name,
    username: input.username,
    passwordHash,
  })
  return member
}

export function createChild(db: DbOrTx, householdId: string, input: ChildCreateInput) {
  const [member] = db
    .insert(members)
    .values({
      householdId,
      kind: 'child',
      name: input.name,
      birthDate: input.birthDate ?? null,
      notes: input.notes ?? null,
      avatarEmoji: input.avatarEmoji ?? null,
    })
    .returning()
    .all()
  return member!
}

export function updateMember(
  db: DbOrTx,
  householdId: string,
  memberId: string,
  input: MemberUpdateInput,
) {
  getMember(db, householdId, memberId)
  const [member] = db.update(members).set(input).where(eq(members.id, memberId)).returning().all()
  return member!
}

/**
 * Elimina un miembro (y, si es adulto, su cuenta y sesiones, por cascada).
 * Nadie puede eliminar su propia cuenta y el hogar nunca queda sin adultos.
 */
export function deleteMember(
  db: DbOrTx,
  householdId: string,
  memberId: string,
  actingMemberId: string,
) {
  const member = getMember(db, householdId, memberId)
  if (member.kind === 'adult') {
    if (member.id === actingMemberId) {
      throw new AppError(409, 'cannot_delete_self', 'No puedes eliminar tu propia cuenta')
    }
    const [adults] = db
      .select({ n: count() })
      .from(members)
      .where(and(eq(members.householdId, householdId), eq(members.kind, 'adult')))
      .all()
    if ((adults?.n ?? 0) <= 1) {
      throw new AppError(409, 'last_adult', 'El hogar debe tener al menos un adulto')
    }
  }
  db.delete(members).where(eq(members.id, memberId)).run()
}

export function listFoodPrefs(db: DbOrTx, householdId: string, memberId: string) {
  getMember(db, householdId, memberId)
  return db
    .select({
      foodId: memberFoodPrefs.foodId,
      foodName: foods.name,
      stance: memberFoodPrefs.stance,
      notes: memberFoodPrefs.notes,
    })
    .from(memberFoodPrefs)
    .innerJoin(foods, eq(foods.id, memberFoodPrefs.foodId))
    .where(eq(memberFoodPrefs.memberId, memberId))
    .orderBy(asc(foods.searchText))
    .all()
}

/** Agrega o reemplaza la preferencia sobre un alimento (creándolo si no existe). */
export function upsertFoodPref(
  db: DbOrTx,
  householdId: string,
  memberId: string,
  input: FoodPrefCreateInput,
) {
  return db.transaction((tx) => {
    getMember(tx, householdId, memberId)
    const food = findOrCreateFood(tx, householdId, input.foodName)
    const values = { stance: input.stance, notes: input.notes ?? null }
    tx.insert(memberFoodPrefs)
      .values({ memberId, foodId: food.id, ...values })
      .onConflictDoUpdate({
        target: [memberFoodPrefs.memberId, memberFoodPrefs.foodId],
        set: values,
      })
      .run()
    return { foodId: food.id, foodName: food.name, ...values }
  })
}

function prefWhere(memberId: string, foodId: string) {
  return and(eq(memberFoodPrefs.memberId, memberId), eq(memberFoodPrefs.foodId, foodId))
}

export function updateFoodPref(
  db: DbOrTx,
  householdId: string,
  memberId: string,
  foodId: string,
  input: FoodPrefUpdateInput,
) {
  getMember(db, householdId, memberId)
  const [pref] = db
    .update(memberFoodPrefs)
    .set(input)
    .where(prefWhere(memberId, foodId))
    .returning()
    .all()
  if (!pref) throw notFound('Preferencia no encontrada')
  return pref
}

export function deleteFoodPref(db: DbOrTx, householdId: string, memberId: string, foodId: string) {
  getMember(db, householdId, memberId)
  db.delete(memberFoodPrefs).where(prefWhere(memberId, foodId)).run()
}
