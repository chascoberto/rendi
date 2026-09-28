import { expect, type Page, test } from '@playwright/test'
import { login } from './helpers'

// EAN-13 válido que no está en el seed (se usa como código de un pack).
const PACK_EAN = '5901234123457'

test.beforeEach(async ({ page }) => {
  await login(page)
})

async function enterCode(page: Page, code: string) {
  await page.goto('/escanear')
  await page.getByRole('button', { name: 'Ingresar código a mano' }).click()
  await page.getByLabel('Código de barras').fill(code)
  await page.getByRole('button', { name: 'Buscar' }).click()
  return page.getByRole('dialog', { name: 'Código escaneado' })
}

test('la despensa lista y busca productos sin tildes, con filtro por categoría', async ({
  page,
}) => {
  const list = page.getByRole('list', { name: 'Productos' })
  await expect(list.getByRole('link', { name: /Leche entera/ })).toBeVisible()

  await page.getByLabel('Buscar producto').fill('platano')
  await expect(list.getByRole('link')).toHaveCount(1)
  await expect(list.getByRole('link', { name: /Plátano.*Granel/ })).toBeVisible()

  await page.getByLabel('Buscar producto').fill('')
  await page.getByRole('radio', { name: 'Limpieza' }).click()
  await expect(list.getByRole('link')).toHaveCount(1)
  await expect(list.getByRole('link', { name: /Lavalozas/ })).toBeVisible()
})

test('crea un producto a mano y lo edita', async ({ page }) => {
  await page.getByRole('link', { name: 'Nuevo producto' }).click()
  await page.getByLabel('Nombre').fill('porotos negros')
  await page.getByLabel('Marca (opcional)').fill('wasil')
  await page.getByLabel('Alimento genérico').fill('Poro')
  await page.getByRole('button', { name: 'Porotos' }).click() // sugerencia del seed
  await page.getByLabel('Categoría').selectOption({ label: 'Abarrotes' })
  await page.getByLabel('Cantidad').fill('1')
  await page.getByLabel('Unidad', { exact: true }).selectOption('kg')
  await page.getByRole('button', { name: 'Más' }).first().click() // mínimo 1
  await page.getByRole('button', { name: 'Crear producto' }).click()

  await expect(page.getByRole('heading', { name: 'Porotos negros' })).toBeVisible()
  await expect(page.getByLabel('Alimento genérico')).toHaveValue('Porotos')
  await expect(page.getByLabel('Agregar a la lista cuando queden menos de')).toHaveValue('1')

  await page.getByRole('radio', { name: 'A granel' }).click()
  await expect(page.getByRole('switch', { name: /quede poco/ })).toBeVisible()
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Porotos negros.*Wasil.*Granel/ })).toBeVisible()
})

test('asocia el código de un pack a un producto existente', async ({ page }) => {
  let sheet = await enterCode(page, PACK_EAN)
  await expect(sheet.getByText('Este código no está en tu catálogo.')).toBeVisible()
  await sheet.getByRole('button', { name: 'Asociar a un producto existente' }).click()
  await sheet.getByLabel('Buscar producto para asociar').fill('leche entera')
  await sheet.getByRole('button', { name: /Leche entera/ }).click()
  await sheet.getByRole('button', { name: 'Más' }).click()
  await sheet.getByRole('spinbutton').fill('6')
  await sheet.getByRole('spinbutton').blur()
  await sheet.getByRole('button', { name: 'Asociar código' }).click()

  await expect(page.getByRole('heading', { name: 'Leche entera' })).toBeVisible()
  await expect(page.getByText('Pack de 6')).toBeVisible()

  sheet = await enterCode(page, PACK_EAN)
  await expect(sheet.getByText('Pack de 6 unidades')).toBeVisible()
})

test('reconoce códigos de peso variable', async ({ page }) => {
  const sheet = await enterCode(page, '2012345012342')
  await expect(sheet.getByText('Código de peso variable')).toBeVisible()
})
