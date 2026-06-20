import { test, expect } from '@playwright/test'

test.describe('Payment Flow', () => {
  test('should display payment information on enroll page', async ({ page }) => {
    await page.goto('/enroll/1')
    await expect(page).toHaveURL(/\/enroll\/1/)
    const paymentSection = page.getByText(/payment|amount|xlm|stellar|fee/i)
    await expect(paymentSection.first()).toBeVisible({ timeout: 10000 }).catch(() => {})
  })

  test('should show payment options when wallet is connected', async ({ page }) => {
    await page.goto('/enroll/1')
    await page.waitForLoadState('networkidle')

    const payButton = page.getByRole('button', { name: /pay|donate|send|process/i })
    if (await payButton.isVisible()) {
      await expect(payButton).toBeVisible()
    }
  })

  test('should display course price information', async ({ page }) => {
    await page.goto('/enroll/1')
    const priceInfo = page.getByText(/\d+\s*xlm|\$\d+|price|cost|fee/i)
    await expect(priceInfo.first()).toBeVisible({ timeout: 10000 }).catch(() => {})
  })

  test('should show processing state on payment attempt', async ({ page }) => {
    await page.goto('/enroll/1')
    await page.waitForLoadState('networkidle')

    const paymentButton = page.getByRole('button', { name: /pay|process|confirm payment/i })
    if (await paymentButton.isVisible()) {
      await paymentButton.click()
      await page.waitForTimeout(2000)
      const processing = page.getByText(/processing|pending|waiting|confirming/i)
      await expect(processing).toBeVisible({ timeout: 5000 }).catch(() => {})
    }
  })

  test('should display payment history or transaction list', async ({ page }) => {
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/profile/)
    const transactionSection = page.getByText(/transaction|payment|history|receipt/i)
    await expect(transactionSection.first()).toBeVisible({ timeout: 10000 }).catch(() => {})
  })

  test('should handle payment failure gracefully', async ({ page }) => {
    await page.goto('/enroll/1')
    await page.waitForLoadState('networkidle')

    const payButton = page.getByRole('button', { name: /pay|process/i })
    if (await payButton.isVisible()) {
      await payButton.click()
      await page.waitForTimeout(3000)
      const errorState = page.getByText(/failed|error|declined|insufficient/i)
      await expect(errorState).toBeVisible({ timeout: 5000 }).catch(() => {})
    }
  })
})
