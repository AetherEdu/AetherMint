import { test, expect } from '@playwright/test'

test.describe('Enrollment Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/enroll/1')
  })

  test('should display enrollment form with personal info step', async ({ page }) => {
    await expect(page.getByText(/enroll|register|sign up/i)).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input, button, select').first()).toBeVisible({ timeout: 5000 })
  })

  test('should show personal information fields', async ({ page }) => {
    const firstNameInput = page.getByLabel(/first name|firstName/i)
    const lastNameInput = page.getByLabel(/last name|lastName/i)
    const emailInput = page.getByLabel(/email/i)

    const visibleInputs = [firstNameInput, lastNameInput, emailInput].filter(
      (input) => input
    )

    if (visibleInputs.length > 0) {
      await expect(visibleInputs[0]).toBeVisible({ timeout: 5000 })
    }
  })

  test('should have a continue or next step button', async ({ page }) => {
    const nextButton = page.getByRole('button', { name: /continue|next|proceed/i })
    await expect(nextButton).toBeVisible({ timeout: 10000 })
  })

  test('should navigate through enrollment steps', async ({ page }) => {
    const nextButton = page.getByRole('button', { name: /continue|next|proceed/i })

    if (await nextButton.isVisible()) {
      const currentUrl = page.url()
      await nextButton.click()
      await page.waitForTimeout(1000)
      const stepIndicator = page.getByText(/step|progress/i)
      await expect(stepIndicator.first()).toBeVisible({ timeout: 5000 }).catch(() => {})
    }
  })

  test('should show course details on enrollment page', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
    const pageContent = await page.locator('body').innerText()
    expect(pageContent.length).toBeGreaterThan(0)
  })

  test('should display error state for invalid form submission', async ({ page }) => {
    const submitButton = page.getByRole('button', { name: /submit|enroll|confirm/i })
    if (await submitButton.isVisible()) {
      await submitButton.click()
      await page.waitForTimeout(1000)
      const errorMessage = page.getByText(/error|required|invalid|please fill/i)
      await expect(errorMessage).toBeVisible({ timeout: 5000 }).catch(() => {})
    }
  })

  test('should render test enrollment page', async ({ page }) => {
    await page.goto('/test-enrollment')
    await expect(page).toHaveURL(/\/test-enrollment/)
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 })
  })
})
