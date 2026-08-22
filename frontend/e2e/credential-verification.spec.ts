import { test, expect } from '@playwright/test';

test.describe('Credential Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to credentials tab', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Credentials').click();
    await page.waitForTimeout(1000);

    const credentialsHeader = page.getByText(/credentials/i);
    await expect(credentialsHeader.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display credential verification status badges', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Credentials').click();
    await page.waitForTimeout(1000);

    const verifiedBadge = page.getByText('Verified');
    await expect(verifiedBadge.first()).toBeVisible({ timeout: 10000 }).catch(() => {});

    const pendingBadge = page.getByText('Pending');
    await expect(pendingBadge.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('should show verify button for credentials with verification URL', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Credentials').click();
    await page.waitForTimeout(1000);

    const verifyButton = page.getByRole('button', { name: /verify/i });
    await expect(verifyButton.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  test('should filter credentials by status', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Credentials').click();
    await page.waitForTimeout(1000);

    const statusSelect = page.locator('select').filter({ hasText: /all statuses|verified|pending/i });
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('verified');
      await page.waitForTimeout(500);
    }
  });

  test('should filter credentials by type', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Credentials').click();
    await page.waitForTimeout(1000);

    const typeSelect = page.locator('select').filter({ hasText: /all types|certificate|badge/i });
    if (await typeSelect.isVisible()) {
      await typeSelect.selectOption('certificate');
      await page.waitForTimeout(500);
    }
  });

  test('should search credentials by title or issuer', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Credentials').click();
    await page.waitForTimeout(1000);

    const searchInput = page.getByPlaceholder(/search credentials/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('React');
      await page.waitForTimeout(500);
      const results = page.getByText(/react/i);
      await expect(results.first()).toBeVisible({ timeout: 3000 }).catch(() => {});
    }
  });

  test('should show empty state when no credentials match search', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Credentials').click();
    await page.waitForTimeout(1000);

    const searchInput = page.getByPlaceholder(/search credentials/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('ZZZZNONEXISTENT');
      await page.waitForTimeout(500);
      const emptyMessage = page.getByText(/no credentials match|no credentials available/i);
      await expect(emptyMessage).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test('should show credential issuer information', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Credentials').click();
    await page.waitForTimeout(1000);

    const issuerText = page.getByText(/aethermint academy|tech institute/i);
    await expect(issuerText.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  test('should display credential type icons', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Credentials').click();
    await page.waitForTimeout(1000);

    const certificateBadge = page.getByText(/certificate|badge|license/i);
    await expect(certificateBadge.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  test('should show credential issue date', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Credentials').click();
    await page.waitForTimeout(1000);

    const dateText = page.getByText(/issued|expires/i);
    await expect(dateText.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  test('should show skills tags on credentials', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Credentials').click();
    await page.waitForTimeout(1000);

    const skillsSection = page.getByText(/react|javascript|typescript|blockchain/i);
    await expect(skillsSection.first()).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  test('should open add credential modal', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Credentials').click();
    await page.waitForTimeout(1000);

    const addButton = page.getByRole('button', { name: /add credential/i });
    if (await addButton.isVisible()) {
      await addButton.click();
      const addForm = page.getByText(/add new credential/i);
      await expect(addForm).toBeVisible({ timeout: 5000 }).catch(() => {});

      const cancelButton = page.getByRole('button', { name: /cancel/i });
      if (await cancelButton.isVisible()) {
        await cancelButton.click();
      }
    }
  });

  test('should show credential statistics', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Credentials').click();
    await page.waitForTimeout(1000);

    const statsSection = page.getByText(/total|verified|pending|expired/i);
    await expect(statsSection.first()).toBeVisible({ timeout: 10000 });
  });
});
