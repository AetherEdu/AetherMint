import { test, expect } from '@playwright/test'

test.describe('Wallet Connection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display wallet connect button on the page', async ({ page }) => {
    const connectButton = page.getByRole('button', { name: /connect wallet/i })
    await expect(connectButton).toBeVisible({ timeout: 10000 })
  })

  test('should show wallet options when connect is clicked', async ({ page }) => {
    const connectButton = page.getByRole('button', { name: /connect wallet/i })
    await connectButton.click()

    const walletOptions = page.getByText(/xbull|albedo|freighter|stellar/i)
    await expect(walletOptions.first()).toBeVisible({ timeout: 5000 })
  })

  test('should display wallet dialog with connect options', async ({ page }) => {
    const connectButton = page.getByRole('button', { name: /connect wallet/i })
    await connectButton.click()

    await expect(page.getByText(/connect|select wallet/i)).toBeVisible({ timeout: 5000 })
  })

  test('should navigate correctly without wallet', async ({ page }) => {
    await page.goto('/campus')
    await expect(page).toHaveURL(/\/campus/)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  test('should show demo page with wallet-related content', async ({ page }) => {
    await page.goto('/demo')
    await expect(page).toHaveURL(/\/demo/)
    await expect(page.locator('body')).not.toHaveText(/error|not found/i)
  })

  test('should handle disconnect gracefully', async ({ page }) => {
    const connectButton = page.getByRole('button', { name: /connect wallet/i })
    await expect(connectButton).toBeVisible({ timeout: 10000 })

    const disconnectButton = page.getByRole('button', { name: /disconnect/i })
    if (await disconnectButton.isVisible()) {
      await disconnectButton.click()
      await expect(connectButton).toBeVisible({ timeout: 5000 })
    }
  })

  test('should render wallet section on enroll page', async ({ page }) => {
    await page.goto('/enroll/1')
    await expect(page).toHaveURL(/\/enroll\/1/)
    const walletSection = page.getByText(/wallet|connect/i)
    await expect(walletSection.first()).toBeVisible({ timeout: 10000 })
  })
})
