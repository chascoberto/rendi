import { expect, test } from '@playwright/test'
import { login } from './helpers'

test.beforeEach(async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Hogar' }).click()
})

test('muestra adultos y niños del hogar', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Hogar de ejemplo' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Camila.*tú/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Diego/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Sofía.*6 años/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Tomás.*4 años/ })).toBeVisible()
})

test('agrega, cambia y quita una preferencia de un niño', async ({ page }) => {
  await page.getByRole('link', { name: /Sofía/ }).click()
  await expect(page.getByRole('heading', { name: 'Sofía' })).toBeVisible()

  const accepts = page.getByRole('region', { name: 'Acepta' })
  const rejects = page.getByRole('region', { name: 'Rechaza' })

  await page.getByLabel('Agregar alimento').fill('Zapallo italiano')
  await page.getByRole('button', { name: 'Rechaza', exact: true }).click()
  await expect(rejects.getByRole('button', { name: /zapallo italiano/i })).toBeVisible()
  await expect(page.getByLabel('Agregar alimento')).toHaveValue('')

  await rejects.getByRole('button', { name: /zapallo italiano/i }).click()
  await page.getByPlaceholder('Nota (ej: cocido sí, crudo no)').fill('En puré sí')
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(rejects.getByRole('button', { name: /zapallo italiano/i })).toContainText('•')

  await rejects.getByRole('button', { name: /zapallo italiano/i }).click()
  await rejects.getByRole('button', { name: 'Acepta' }).click()
  await expect(accepts.getByRole('button', { name: /zapallo italiano/i })).toBeVisible()

  await accepts.getByRole('button', { name: /zapallo italiano/i }).click()
  await accepts.getByRole('button', { name: 'Quitar' }).click()
  await expect(page.getByRole('button', { name: /zapallo italiano/i })).toHaveCount(0)
})

test('agrega un niño y lo elimina', async ({ page }) => {
  await page.getByRole('button', { name: 'Agregar niño o niña' }).click()
  // Escrito en minúsculas: se guarda y muestra con mayúscula inicial.
  await page.getByLabel('Nombre').fill('martina')
  await page.getByRole('button', { name: 'Agregar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Martina', exact: true })).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Eliminar perfil' }).click()
  await expect(page).toHaveURL(/\/hogar$/)
  await expect(page.getByRole('link', { name: /Martina/ })).toHaveCount(0)
})

test('crea un adulto que puede entrar, y otro adulto lo elimina', async ({ page, browser }) => {
  await page.getByRole('button', { name: 'Agregar adulto' }).click()
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Crear cuenta' }) })
  await form.getByLabel('Nombre').fill('pedro')
  await form.getByLabel('Usuario').fill('pedro')
  await form.getByLabel('Contraseña', { exact: true }).fill('clave-pedro-1')
  await form.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByRole('link', { name: /Pedro.*@pedro/ })).toBeVisible()

  // Pedro entra desde otro navegador y no puede eliminarse a sí mismo.
  const other = await browser.newPage()
  await login(other, { username: 'pedro', password: 'clave-pedro-1' })
  await other.getByRole('link', { name: 'Hogar' }).click()
  await other.getByRole('link', { name: /Pedro.*tú/ }).click()
  await expect(other.getByRole('heading', { name: 'Pedro' })).toBeVisible()
  await expect(other.getByRole('button', { name: 'Eliminar cuenta' })).toHaveCount(0)

  // Camila elimina la cuenta de Pedro: su sesión deja de funcionar.
  await page.getByRole('link', { name: /Pedro/ }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Eliminar cuenta' }).click()
  await expect(page).toHaveURL(/\/hogar$/)
  await expect(page.getByRole('link', { name: /Pedro/ })).toHaveCount(0)

  await other.reload()
  await expect(other).toHaveURL(/\/login/)
  await other.close()
})

test('no muestra "Eliminar cuenta" en la ficha propia', async ({ page }) => {
  await page.getByRole('link', { name: /Camila.*tú/ }).click()
  await expect(page.getByRole('heading', { name: 'Camila' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Eliminar/ })).toHaveCount(0)
})

test('elige un avatar emoji, conserva lo escrito y lo quita', async ({ page }) => {
  await page.getByRole('link', { name: /Tomás/ }).click()
  await expect(page.getByRole('heading', { name: 'Tomás' })).toBeVisible()

  // Una nota a medio escribir no se pierde al cambiar el avatar.
  await page.getByLabel('Notas').fill('Nota sin guardar')

  await page.getByRole('button', { name: 'Cambiar avatar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Avatar de Tomás' })
  await expect(sheet).toBeVisible()
  await sheet.getByRole('button', { name: '🚀' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByLabel('Notas')).toHaveValue('Nota sin guardar')

  // Un emoji personalizado inválido muestra error; uno válido se guarda.
  await page.getByRole('button', { name: 'Cambiar avatar' }).click()
  await expect(sheet.getByRole('button', { name: '🚀' })).toHaveAttribute('aria-pressed', 'true')
  await sheet.getByLabel('Otro emoji').fill('hola')
  await sheet.getByRole('button', { name: 'Usar', exact: true }).click()
  await expect(sheet.getByText('Escribe o pega un solo emoji')).toBeVisible()
  await sheet.getByLabel('Otro emoji').fill('🐙')
  await sheet.getByRole('button', { name: 'Usar', exact: true }).click()
  await expect(sheet).toBeHidden()

  await page.getByRole('link', { name: 'Hogar' }).click()
  await expect(page.getByRole('link', { name: /Tomás/ })).toContainText('🐙')

  await page.getByRole('link', { name: /Tomás/ }).click()
  await page.getByRole('button', { name: 'Cambiar avatar' }).click()
  await page.getByRole('button', { name: 'Quitar avatar (usar la inicial)' }).click()
  await page.getByRole('link', { name: 'Hogar' }).click()
  await expect(page.getByRole('link', { name: /Tomás/ })).toContainText('T')
  await expect(page.getByRole('link', { name: /Tomás/ })).not.toContainText('🐙')
})
