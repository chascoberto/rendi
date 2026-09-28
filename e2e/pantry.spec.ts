import { expect, type Page, test } from '@playwright/test'
import { login } from './helpers'

// Cada prueba usa un producto distinto del seed: la base se siembra una vez por corrida.

test.beforeEach(async ({ page }) => {
  await login(page)
})

async function openProduct(page: Page, name: string) {
  await page.getByLabel('Buscar producto').fill(name)
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}

const total = (page: Page) => page.getByTestId('stock-total')
const toast = (page: Page) => page.getByRole('status', { name: 'Aviso' })

test('usé uno descuenta y "Deshacer" lo revierte', async ({ page }) => {
  await openProduct(page, 'Atún lomitos en agua')
  await expect(total(page)).toHaveText('4 unidades')

  await page.getByRole('button', { name: 'Usé uno' }).click()
  await expect(total(page)).toHaveText('3 unidades')
  await expect(toast(page)).toContainText('Usaste uno: Atún lomitos en agua')

  await toast(page).getByRole('button', { name: 'Deshacer' }).click()
  await expect(total(page)).toHaveText('4 unidades')
  await expect(toast(page)).toContainText('Acción deshecha')
})

test('compré agrega un lote con vencimiento y se puede ajustar', async ({ page }) => {
  await openProduct(page, 'Arroz grado 2')
  await expect(total(page)).toHaveText('2 unidades')

  await page.getByRole('button', { name: 'Compré' }).click()
  const sheet = page.getByRole('dialog', { name: 'Compré' })
  await sheet.getByRole('button', { name: 'Más' }).click()
  await sheet.getByLabel('Vence (opcional)').fill('2030-03-15')
  await sheet.getByRole('button', { name: 'Agregar al stock' }).click()

  await expect(total(page)).toHaveText('4 unidades')
  const lots = page.getByRole('list', { name: 'Lotes' })
  await expect(lots.getByRole('button')).toHaveCount(2)
  await expect(lots.getByRole('button').first()).toContainText('Vence el 15 mar')

  // Ajuste manual del lote sin vencimiento.
  await lots.getByRole('button', { name: /Sin vencimiento/ }).click()
  const edit = page.getByRole('dialog', { name: 'Ajustar lote' })
  await edit.getByLabel('Unidades en este lote').fill('5')
  await edit.getByLabel('Unidades en este lote').blur()
  await edit.getByRole('button', { name: 'Guardar lote' }).click()
  await expect(total(page)).toHaveText('7 unidades')
})

test('a granel se elige el nivel, sin cantidades', async ({ page }) => {
  await openProduct(page, 'Plátano')
  const levels = page.getByRole('radiogroup', { name: 'Nivel' })
  await expect(levels.getByRole('radio', { name: 'Queda poco' })).toBeChecked()
  const stock = page.getByRole('region', { name: 'Stock' })
  await expect(stock.getByRole('spinbutton')).toHaveCount(0)
  await expect(stock.getByRole('button', { name: 'Usé uno' })).toHaveCount(0)

  await levels.getByRole('radio', { name: 'Hay' }).click()
  await expect(levels.getByRole('radio', { name: 'Hay' })).toBeChecked()
  await expect(toast(page)).toContainText('Plátano: hay')
})

test('usé uno desde la lista de la despensa', async ({ page }) => {
  const list = page.getByRole('list', { name: 'Productos' })
  await page.getByLabel('Buscar producto').fill('espirales')
  await expect(list.getByRole('link', { name: /Espirales.*2 en stock/ })).toBeVisible()

  await list.getByRole('button', { name: 'Usé uno: Espirales' }).click()
  await expect(list.getByRole('link', { name: /Espirales.*1 en stock/ })).toBeVisible()
  await list.getByRole('button', { name: 'Usé uno: Espirales' }).click()
  await expect(list.getByRole('link', { name: /Espirales.*Sin stock/ })).toBeVisible()
  await expect(list.getByRole('button', { name: 'Usé uno: Espirales' })).toHaveCount(0)
})

test('por vencer agrupa por urgencia y permite descartar un lote', async ({ page }) => {
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Vence' })
    .click()
  await expect(page.getByRole('heading', { name: 'Por vencer' })).toBeVisible()

  const soon = page.getByRole('list', { name: 'Hoy y mañana' })
  await expect(
    soon.getByRole('link', { name: /Pechuga de pollo.*Refrigerador.*Vence mañana/ }),
  ).toBeVisible()
  const week = page.getByRole('list', { name: 'Esta semana' })
  await expect(
    week.getByRole('link', { name: /Yogur batido frutilla.*Vence en 2 días/ }),
  ).toBeVisible()

  await soon.getByRole('button', { name: 'Descartar lote: Pechuga de pollo deshuesada' }).click()
  await expect(toast(page)).toContainText('Lote descartado: Pechuga de pollo deshuesada')
  await expect(page.getByRole('link', { name: /Pechuga de pollo.*Refrigerador/ })).toHaveCount(0)
})
