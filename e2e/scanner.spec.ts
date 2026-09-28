import { expect, test } from '@playwright/test'
import { SCANNED_EAN } from './fixtures/constants'
import { login } from './helpers'

test('escanear con la cámara: código nuevo → crear producto → volver a escanearlo', async ({
  page,
}) => {
  // El lector debe funcionar sin internet: cualquier intento de usar un CDN hace fallar la prueba.
  const cdnRequests: string[] = []
  await page.route(/jsdelivr|unpkg/, (route) => {
    cdnRequests.push(route.request().url())
    return route.abort()
  })
  await login(page)
  await page.getByRole('link', { name: 'Escanear' }).first().click()

  // La cámara falsa muestra SCANNED_EAN: el detector (zxing WASM servido por la app) lo lee.
  const sheet = page.getByRole('dialog', { name: 'Código escaneado' })
  await expect(sheet.getByText('Este código no está en tu catálogo.')).toBeVisible({
    timeout: 15_000,
  })
  await expect(sheet.getByText(SCANNED_EAN)).toBeVisible()
  await sheet.getByRole('button', { name: 'Crear producto' }).click()

  await expect(page.getByRole('heading', { name: 'Nuevo producto' })).toBeVisible()
  await expect(page.getByText(`Código ${SCANNED_EAN}`)).toBeVisible()
  await page.getByLabel('Nombre').fill('galletas de prueba')
  await page.getByLabel('Cantidad').fill('140')
  await page.getByLabel('Unidad', { exact: true }).selectOption('g')
  await page.getByRole('button', { name: 'Crear producto' }).click()

  await expect(page.getByRole('heading', { name: 'Galletas de prueba' })).toBeVisible()
  await expect(page.getByText(SCANNED_EAN)).toBeVisible()

  await page.getByRole('link', { name: 'Escanear' }).first().click()
  await expect(sheet.getByText('Galletas de prueba')).toBeVisible({ timeout: 15_000 })
  await sheet.getByRole('button', { name: 'Ver producto' }).click()
  await expect(page.getByRole('heading', { name: 'Galletas de prueba' })).toBeVisible()
  expect(cdnRequests).toEqual([])
})
