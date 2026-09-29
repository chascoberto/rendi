import { expect, type Page, test } from '@playwright/test'
import { login } from '../helpers'

/** Espera a que el service worker controle la página (tras instalarse, hace falta recargar). */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
}

test('la API sirve la app, el manifest y las rutas del SPA', async ({ page, request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest).toMatchObject({ name: 'Rendi', lang: 'es-CL', display: 'standalone' })
  expect((await request.get('/api/no-existe')).status()).toBe(404)

  // Enlace directo a una ruta del SPA: el servidor entrega index.html y el router la resuelve.
  await page.goto('/lista')
  await expect(page.getByLabel('Usuario')).toBeVisible()
  expect(page.url()).toContain('redirect=/lista')
})

test('la lista de compras abre y se marca sin conexión', async ({ page, context }) => {
  await login(page)
  await page.goto('/lista')
  await expect(page.getByRole('checkbox', { name: 'Pan amasado' })).toBeVisible()
  await waitForServiceWorker(page)
  await expect(page.getByRole('checkbox', { name: 'Pan amasado' })).toBeVisible()

  // Sin red, recargar la app entrega la última lista que vio el service worker.
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Lista de compras' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión' })).toBeVisible()
  const pan = page.getByRole('checkbox', { name: 'Pan amasado' })
  await pan.click()
  await expect(pan).toBeChecked()
  await expect(page.getByRole('img', { name: 'Sin sincronizar' })).toBeVisible()

  // Al volver la red, la marca llega al servidor.
  await context.setOffline(false)
  await expect(page.getByRole('img', { name: 'Sin sincronizar' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('checkbox', { name: 'Pan amasado' })).toBeChecked()
})

test('cerrar sesión borra las copias de la API guardadas para usar sin conexión', async ({
  page,
}) => {
  await login(page)
  await page.goto('/lista')
  await waitForServiceWorker(page)
  await expect(page.getByRole('checkbox', { name: 'Pan amasado' })).toBeVisible()
  expect(await page.evaluate(() => caches.has('rendi-api'))).toBe(true)

  await page.goto('/hogar')
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page.getByLabel('Usuario')).toBeVisible()
  await expect.poll(() => page.evaluate(() => caches.has('rendi-api'))).toBe(false)
})
