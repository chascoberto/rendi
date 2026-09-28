import { test } from '@playwright/test'
import { login } from './helpers'

/** Capturas para revisión visual, en tema claro y oscuro. No verifica nada: solo fotografía. */
for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`pantallas ${colorScheme} @screens`, () => {
    test.use({ colorScheme })

    test('capturas', async ({ page }) => {
      const shot = (name: string) =>
        page.screenshot({ path: `test-results/screens/${colorScheme}-${name}.png`, fullPage: true })

      await page.goto('/login')
      await page.getByLabel('Usuario').fill('camila')
      await shot('login')

      await login(page)
      await page.getByRole('list', { name: 'Productos' }).waitFor()
      await shot('despensa')
      await page.getByRole('link', { name: /Leche entera/ }).click()
      await page.getByRole('heading', { name: 'Códigos de barra' }).waitFor()
      await shot('producto')
      await page.goto('/escanear')
      await page.getByRole('button', { name: 'Ingresar código a mano' }).click()
      await page.getByLabel('Código de barras').fill('9780201379624')
      await page.getByRole('button', { name: 'Buscar' }).click()
      await page.getByRole('dialog').getByText('no está en tu catálogo').waitFor()
      await page.screenshot({
        path: `test-results/screens/${colorScheme}-escaneo.png`,
        animations: 'disabled',
      })
      await page.goto('/')
      await page.getByRole('link', { name: 'Hogar' }).click()
      await page.getByRole('link', { name: /Sofía/ }).waitFor()
      await shot('hogar')
      await page.getByRole('button', { name: 'Agregar adulto' }).click()
      await shot('hogar-agregar-adulto')
      await page.getByRole('button', { name: 'Cancelar' }).click()
      await page.getByRole('link', { name: /Sofía/ }).click()
      await page.getByRole('heading', { name: /^Rechaza/ }).waitFor()
      await shot('miembro')
      await page.getByRole('button', { name: 'Cambiar avatar' }).click()
      await page.getByRole('dialog').waitFor()
      await page.screenshot({
        path: `test-results/screens/${colorScheme}-avatar.png`,
        animations: 'disabled',
      })
    })
  })
}
