import { expect, type Page } from '@playwright/test'

/** Cuentas creadas por el seed de desarrollo. */
export const USERS = {
  camila: { username: 'camila', password: 'rendi1234' },
  diego: { username: 'diego', password: 'rendi1234' },
} as const

export async function login(
  page: Page,
  user: { username: string; password: string } = USERS.camila,
) {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(user.username)
  await page.getByLabel('Contraseña', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible()
}
