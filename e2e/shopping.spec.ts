import { devices, expect, type Page, test } from '@playwright/test'
import { login, USERS } from './helpers'

// Seed: Tallarines N°5 (1 de mín. 2) y Papel higiénico (0 de mín. 1) están en la lista por stock
// bajo; Pan amasado, Velas de cumpleaños, Pescado y Yogur son ítems manuales.

const list = (page: Page, name: string) => page.getByRole('list', { name })
const item = (page: Page, name: string) => page.getByRole('checkbox', { name, exact: true })
const toast = (page: Page) => page.getByRole('status', { name: 'Aviso' })

async function openList(page: Page) {
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Lista' })
    .click()
  await expect(page.getByRole('heading', { name: 'Lista de compras' })).toBeVisible()
}

test('muestra lo automático y lo manual, y agrega, edita y quita ítems', async ({ page }) => {
  await login(page)
  await openList(page)

  const abarrotes = list(page, 'Abarrotes')
  await expect(abarrotes.getByRole('listitem').filter({ hasText: 'Tallarines N°5' })).toContainText(
    'Quedan 1 (mín. 2)',
  )
  await expect(item(page, 'Pan amasado')).toBeVisible()
  await expect(list(page, 'Otros').getByText('De la panadería')).toBeVisible()

  // Texto libre con Enter.
  const input = page.getByLabel('Agregar a la lista')
  await input.fill('servilletas')
  await input.press('Enter')
  await expect(item(page, 'Servilletas')).toBeVisible()
  await expect(input).toHaveValue('')

  // Producto del catálogo desde las sugerencias; repetirlo avisa que ya está.
  await input.fill('lentej')
  await page
    .getByRole('list', { name: 'Sugerencias' })
    .getByRole('button', { name: /Lentejas/ })
    .first()
    .click()
  await expect(abarrotes.getByRole('checkbox', { name: 'Lentejas' })).toBeVisible()
  await input.fill('lentej')
  await page
    .getByRole('list', { name: 'Sugerencias' })
    .getByRole('button', { name: /Lentejas/ })
    .first()
    .click()
  await expect(page.getByRole('alert')).toHaveText('Ya está en la lista')

  // Editar cantidad y quitar.
  await input.fill('')
  await page.getByRole('button', { name: 'Servilletas' }).click()
  const sheet = page.getByRole('dialog', { name: 'Servilletas' })
  await sheet.getByRole('button', { name: 'Más' }).click()
  await sheet.getByRole('button', { name: 'Más' }).click()
  await sheet.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByRole('button', { name: /Servilletas.*×2/ })).toBeVisible()
  await page.getByRole('button', { name: /Servilletas/ }).click()
  await sheet.getByRole('button', { name: 'Quitar de la lista' }).click()
  await expect(item(page, 'Servilletas')).toHaveCount(0)
})

test('finaliza solo lo marcado por quien compra y lo pasa al stock', async ({ page, browser }) => {
  await login(page)
  await openList(page)

  // Diego, en su celular, marca el pan.
  const diegoContext = await browser.newContext({
    ...devices['Pixel 7'],
    baseURL: test.info().project.use.baseURL,
  })
  const diego = await diegoContext.newPage()
  await login(diego, USERS.diego)
  await openList(diego)
  await item(diego, 'Pan amasado').click()
  await expect(list(diego, 'En el carro').getByText('Diego')).toBeVisible()

  await item(page, 'Tallarines N°5').click()
  await item(page, 'Velas de cumpleaños').click()
  await page.reload()
  const cart = list(page, 'En el carro')
  await expect(cart.getByRole('listitem')).toHaveCount(3)
  await expect(cart.getByRole('listitem').filter({ hasText: 'Pan amasado' })).toContainText('Diego')
  await expect(cart.getByRole('listitem').filter({ hasText: 'Velas' })).toContainText('Camila')

  await page.getByRole('button', { name: 'Finalizar compra (2)' }).click()
  const sheet = page.getByRole('dialog', { name: 'Finalizar compra' })
  await sheet.getByLabel('Supermercado').selectOption({ label: 'Jumbo' })
  // Sugerido: lo que falta para el mínimo (2 − 1 = 1); compramos 3.
  const tallarines = sheet.getByLabel('Tallarines N°5')
  await expect(tallarines).toHaveValue('1')
  await tallarines.fill('3')
  await tallarines.blur()
  await sheet.getByRole('button', { name: 'Registrar compra' }).click()

  await expect(toast(page)).toContainText('Compra en Jumbo: 1 producto al stock')
  await expect(item(page, 'Tallarines N°5')).toHaveCount(0)
  await expect(item(page, 'Velas de cumpleaños')).toHaveCount(0)
  await expect(item(page, 'Pan amasado')).toBeChecked()

  await page.goto('/')
  await page.getByLabel('Buscar producto').fill('tallarines')
  await expect(page.getByRole('link', { name: /Tallarines N°5.*4 en stock/ })).toBeVisible()
  await diegoContext.close()
})

test('sin conexión se puede marcar y se sincroniza al volver', async ({ page, context }) => {
  await login(page)
  await openList(page)

  await context.setOffline(true)
  await item(page, 'Pescado').click()
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible()
  await expect(item(page, 'Pescado')).toBeChecked()
  await expect(page.getByRole('img', { name: 'Sin sincronizar' })).toBeVisible()

  await context.setOffline(false)
  await expect(page.getByRole('img', { name: 'Sin sincronizar' })).toHaveCount(0)
  await page.reload()
  await expect(item(page, 'Pescado')).toBeChecked()
})

test('reponer el stock retira el ítem automático', async ({ page }) => {
  await login(page)
  await openList(page)
  await expect(item(page, 'Papel higiénico doble hoja')).toBeVisible()

  await page.goto('/')
  await page.getByLabel('Buscar producto').fill('papel')
  await page.getByRole('link', { name: /Papel higiénico/ }).click()
  await page.getByRole('button', { name: 'Compré' }).click()
  await page
    .getByRole('dialog', { name: 'Compré' })
    .getByRole('button', { name: 'Agregar al stock' })
    .click()
  await expect(page.getByTestId('stock-total')).toHaveText('1 unidad')

  await openList(page)
  await expect(item(page, 'Pan amasado')).toBeVisible()
  await expect(item(page, 'Papel higiénico doble hoja')).toHaveCount(0)
})
