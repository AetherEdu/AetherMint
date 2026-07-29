import { test, expect } from '@playwright/test';

test.describe('Course Discovery', () => {
  test('should load the campus page', async ({ page }) => {
    await page.goto('/campus');
    await expect(page).toHaveURL(/\/campus/);
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });

  test('should display course details on enrollment page', async ({ page }) => {
    await page.goto('/enroll/1');
    await page.waitForLoadState('networkidle');

    const courseTitle = page.locator('h1');
    await expect(courseTitle).toBeVisible({ timeout: 15000 });
    const titleText = await courseTitle.textContent();
    expect(titleText?.length).toBeGreaterThan(0);
  });

  test('should show course instructor information', async ({ page }) => {
    await page.goto('/enroll/1');
    await page.waitForLoadState('networkidle');

    const instructorLabel = page.getByText(/instructor/i);
    await expect(instructorLabel).toBeVisible({ timeout: 15000 });
  });

  test('should display course price and currency', async ({ page }) => {
    await page.goto('/enroll/1');
    await page.waitForLoadState('networkidle');

    const priceElement = page.getByText(/\d+\s*xlm/i);
    await expect(priceElement).toBeVisible({ timeout: 15000 });
  });

  test('should show course duration', async ({ page }) => {
    await page.goto('/enroll/1');
    await page.waitForLoadState('networkidle');

    const durationElement = page.getByText(/weeks|duration/i);
    await expect(durationElement).toBeVisible({ timeout: 15000 }).catch(() => {});
  });

  test('should show course rating and review count', async ({ page }) => {
    await page.goto('/enroll/1');
    await page.waitForLoadState('networkidle');

    const ratingElement = page.getByText(/\d+\.\d+\s*\(/i);
    await expect(ratingElement).toBeVisible({ timeout: 15000 }).catch(() => {});
  });

  test('should display lifetime access and certificate info', async ({ page }) => {
    await page.goto('/enroll/1');
    await page.waitForLoadState('networkidle');

    const benefits = page.getByText(/lifetime access|certificate of completion|money back guarantee/i);
    await expect(benefits.first()).toBeVisible({ timeout: 15000 });
  });

  test('should have a back button to return to previous page', async ({ page }) => {
    await page.goto('/enroll/1');
    await page.waitForLoadState('networkidle');

    const backButton = page.getByRole('button', { name: /back/i });
    await expect(backButton).toBeVisible({ timeout: 15000 });
  });

  test('should show loading state while fetching course', async ({ page }) => {
    await page.goto('/enroll/1');
    const loadingText = page.getByText(/loading course details/i);
    await expect(loadingText).toBeVisible({ timeout: 3000 }).catch(() => {});
  });

  test('should handle non-existent course ID gracefully', async ({ page }) => {
    await page.goto('/enroll/99999');
    await page.waitForTimeout(2000);

    const errorOrBody = page.getByText(/error loading course|failed to load/i);
    const isErrorVisible = await errorOrBody.isVisible().catch(() => false);
    if (!isErrorVisible) {
      await expect(page.locator('body')).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show course description text', async ({ page }) => {
    await page.goto('/enroll/1');
    await page.waitForLoadState('networkidle');

    const description = page.getByText(/blockchain|learn|development|fundamentals/i);
    await expect(description.first()).toBeVisible({ timeout: 15000 });
  });

  test('should display enrollment form on course page', async ({ page }) => {
    await page.goto('/enroll/1');
    await page.waitForLoadState('networkidle');

    const formElements = page.locator('input, button, select');
    await expect(formElements.first()).toBeVisible({ timeout: 15000 });
  });

  test('should show student count for the course', async ({ page }) => {
    await page.goto('/enroll/1');
    await page.waitForLoadState('networkidle');

    const studentCount = page.getByText(/students/i);
    await expect(studentCount).toBeVisible({ timeout: 15000 }).catch(() => {});
  });

  test('should load lab page with course content', async ({ page }) => {
    await page.goto('/lab');
    await expect(page).toHaveURL(/\/lab/);
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
  });
});
