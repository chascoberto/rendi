import { beforeEach, describe, expect, it } from 'vitest'
import { createTestApp, createTestHousehold } from '../../test/app'

let t: ReturnType<typeof createTestApp>
let cookie: string

beforeEach(async () => {
  t = createTestApp()
  createTestHousehold(t.db, 'camila')
  cookie = await t.login('camila')
})

async function createChild(name = 'Sofía') {
  const res = await t.request('/api/household/members', {
    method: 'POST',
    cookie,
    body: { name, birthDate: '2020-03-14' },
  })
  expect(res.status).toBe(201)
  return ((await res.json()) as { member: { id: string } }).member.id
}

describe('miembros', () => {
  it('lista adultos (con usuario) y niños', async () => {
    await createChild()
    const res = await t.request('/api/household', { cookie })
    const body = (await res.json()) as {
      members: { name: string; kind: string; username: string | null }[]
    }
    expect(body.members).toEqual([
      expect.objectContaining({ name: 'camila', kind: 'adult', username: 'camila' }),
      expect.objectContaining({ name: 'Sofía', kind: 'child', username: null }),
    ])
  })

  it('edita y elimina niños, pero no adultos', async () => {
    const id = await createChild()
    const patched = await t.request(`/api/household/members/${id}`, {
      method: 'PATCH',
      cookie,
      body: { notes: 'Come verduras en puré' },
    })
    expect(await patched.json()).toMatchObject({ member: { notes: 'Come verduras en puré' } })

    const { members } = (await (await t.request('/api/household', { cookie })).json()) as {
      members: { id: string; kind: string }[]
    }
    const adult = members.find((m) => m.kind === 'adult')!
    const res = await t.request(`/api/household/members/${adult.id}`, { method: 'DELETE', cookie })
    expect(res.status).toBe(409)
    expect(
      (await t.request(`/api/household/members/${id}`, { method: 'DELETE', cookie })).status,
    ).toBe(200)
  })

  it('no expone miembros de otro hogar', async () => {
    const id = await createChild()
    createTestHousehold(t.db, 'vecino', 'Otro hogar')
    const other = await t.login('vecino')
    expect((await t.request(`/api/household/members/${id}`, { cookie: other })).status).toBe(404)
    const del = await t.request(`/api/household/members/${id}`, { method: 'DELETE', cookie: other })
    expect(del.status).toBe(404)
  })
})

describe('preferencias alimentarias', () => {
  it('crea el alimento si no existe, sin duplicar por tildes o mayúsculas', async () => {
    const id = await createChild()
    const add = (foodName: string, stance: 'accepts' | 'rejects') =>
      t.request(`/api/household/members/${id}/prefs`, {
        method: 'POST',
        cookie,
        body: { foodName, stance },
      })
    expect((await add('Brócoli', 'rejects')).status).toBe(201)
    // Mismo alimento escrito distinto: actualiza la preferencia existente.
    await add('brocoli', 'accepts')

    const detail = (await (await t.request(`/api/household/members/${id}`, { cookie })).json()) as {
      prefs: { foodName: string; stance: string }[]
    }
    expect(detail.prefs).toEqual([
      expect.objectContaining({ foodName: 'Brócoli', stance: 'accepts' }),
    ])

    const foods = (await (await t.request('/api/catalog/foods?q=broc', { cookie })).json()) as {
      foods: { name: string }[]
    }
    expect(foods.foods.map((f) => f.name)).toEqual(['Brócoli'])
  })
})

describe('adultos', () => {
  const createAdult = (body: object) =>
    t.request('/api/household/adults', { method: 'POST', cookie, body })

  it('crea un adulto que puede iniciar sesión', async () => {
    const res = await createAdult({ name: 'diego', username: 'Diego', password: 'clave-diego-1' })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ member: { name: 'Diego', kind: 'adult' } })
    const diego = await t.login('diego', 'clave-diego-1')
    const me = await t.request('/api/auth/me', { cookie: diego })
    expect(await me.json()).toMatchObject({ user: { username: 'diego', name: 'Diego' } })
  })

  it('rechaza usuarios repetidos y contraseñas cortas', async () => {
    const dup = await createAdult({ name: 'Otra', username: 'camila', password: 'clave-larga-1' })
    expect(dup.status).toBe(409)
    expect(await dup.json()).toMatchObject({ error: { code: 'username_taken' } })
    const short = await createAdult({ name: 'Otra', username: 'otra', password: '123' })
    expect(short.status).toBe(400)
  })

  it('elimina a otro adulto y cierra sus sesiones, pero no a uno mismo', async () => {
    const res = await createAdult({ name: 'Diego', username: 'diego', password: 'clave-diego-1' })
    const { member } = (await res.json()) as { member: { id: string } }
    const diego = await t.login('diego', 'clave-diego-1')

    const me = (await (await t.request('/api/auth/me', { cookie })).json()) as {
      user: { memberId: string }
    }
    const self = await t.request(`/api/household/members/${me.user.memberId}`, {
      method: 'DELETE',
      cookie,
    })
    expect(self.status).toBe(409)
    expect(await self.json()).toMatchObject({ error: { code: 'cannot_delete_self' } })

    const del = await t.request(`/api/household/members/${member.id}`, { method: 'DELETE', cookie })
    expect(del.status).toBe(200)
    expect((await t.request('/api/auth/me', { cookie: diego })).status).toBe(401)
  })
})

describe('mayúscula inicial', () => {
  it('se aplica a nombres de miembros y alimentos al guardar', async () => {
    const id = await createChild('martina')
    const patched = await t.request(`/api/household/members/${id}`, {
      method: 'PATCH',
      cookie,
      body: { name: 'maría de los ángeles' },
    })
    expect(await patched.json()).toMatchObject({ member: { name: 'María de los Ángeles' } })

    const pref = await t.request(`/api/household/members/${id}/prefs`, {
      method: 'POST',
      cookie,
      body: { foodName: 'zapallo', stance: 'accepts' },
    })
    expect(await pref.json()).toMatchObject({ pref: { foodName: 'Zapallo' } })
  })
})

describe('avatar emoji', () => {
  const patch = (id: string, avatarEmoji: string | null) =>
    t.request(`/api/household/members/${id}`, { method: 'PATCH', cookie, body: { avatarEmoji } })

  it('guarda, cambia y quita el emoji', async () => {
    const id = await createChild()
    expect(await (await patch(id, '🦄')).json()).toMatchObject({ member: { avatarEmoji: '🦄' } })
    expect(await (await patch(id, '👨‍🍳')).json()).toMatchObject({ member: { avatarEmoji: '👨‍🍳' } })
    expect(await (await patch(id, null)).json()).toMatchObject({ member: { avatarEmoji: null } })
    const list = (await (await t.request('/api/household', { cookie })).json()) as {
      members: { id: string; avatarEmoji: string | null }[]
    }
    expect(list.members.find((m) => m.id === id)?.avatarEmoji).toBeNull()
  })

  it('rechaza texto o más de un emoji', async () => {
    const id = await createChild()
    for (const bad of ['S', 'hola', '🦄🦖']) {
      const res = await patch(id, bad)
      expect(res.status, bad).toBe(400)
      expect(await res.json()).toMatchObject({ error: { message: 'Elige un solo emoji' } })
    }
  })
})
