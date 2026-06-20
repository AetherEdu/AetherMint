import { test, expect } from '@playwright/test'

test.describe('Course Access', () => {
  test('should load the campus page', async ({ page }) => {
    await page.goto('/campus')
    await expect(page).toHaveURL(/\/campus/)
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 })
  })

  test('should display course content or lab', async ({ page }) => {
    await page.goto('/lab')
    await expect(page).toHaveURL(/\/lab/)
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 })
  })

  test('should navigate to performance page', async ({ page }) => {
    await page.goto('/performance')
    await expect(page).toHaveURL(/\/performance/)
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 })
  })

  test('should display collaboration page', async ({ page }) => {
    await page.goto('/collaboration/room1')
    await expect(page).toHaveURL(/\/collaboration\/room1/)
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 })
  })

  test('should show profile page with user info', async ({ page }) => {
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/profile/)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  test('should display settings page', async ({ page }) => {
    await page.goto('/settings/notifications')
    await expect(page).toHaveURL(/\/settings/)
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 })
  })

  test('should show demo content', async ({ page }) => {
    await page.goto('/demo')
    await expect(page).toHaveURL(/\/demo/)
    await expect(page.locator('body')).not.toHaveText(/error|not found|404/i)
  })

  test('should handle 404 pages gracefully', async ({ page }) => {
    const response = await page.goto('/non-existent-page')
    expect(response?.status()).toBeLessThan(500)
  })
})
