import { expect, test } from '@playwright/test'
import { login, USERS } from './helpers'

test('sin sesión redirige al login, sin mostrar la barra inferior', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Rendi' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toHaveCount(0)
})

test('iniciar sesión lleva a la despensa', async ({ page }) => {
  await login(page)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Despensa' })).toBeVisible()
})

test('credenciales incorrectas muestran un error y no navegan', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Usuario').fill(USERS.diego.username)
  await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toHaveText('Usuario o contraseña incorrectos')
  await expect(page).toHaveURL(/\/login$/)
})

test('el botón del ojo muestra y oculta la contraseña', async ({ page }) => {
  await page.goto('/login')
  const password = page.getByLabel('Contraseña', { exact: true })
  await password.fill('secreto')
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Ocultar contraseña' }).click()
  await expect(password).toHaveAttribute('type', 'password')
})

test('un enlace directo vuelve a su destino después del login', async ({ page }) => {
  await page.goto('/hogar')
  await expect(page).toHaveURL(/\/login\?redirect=(%2F|\/)hogar$/)
  await page.getByLabel('Usuario').fill(USERS.camila.username)
  await page.getByLabel('Contraseña', { exact: true }).fill(USERS.camila.password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/hogar$/)
})

test('cerrar sesión vuelve al login y protege las rutas', async ({ page }) => {
  await login(page)
  await page.getByRole('link', { name: 'Hogar' }).click()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/hogar')
  await expect(page).toHaveURL(/\/login/)
})
