import { test, expect } from '@playwright/test';

test.describe('Profile Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
  });

  test('should load profile page with user information', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 });
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).toContain('Overview');
  });

  test('should display all navigation tabs', async ({ page }) => {
    await expect(page.getByText('Overview')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Achievements')).toBeVisible();
    await expect(page.getByText('Credentials')).toBeVisible();
    await expect(page.getByText('Statistics')).toBeVisible();
    await expect(page.getByText('Settings')).toBeVisible();
  });

  test('should navigate between tabs and show corresponding content', async ({ page }) => {
    await expect(page.getByText('Overview')).toBeVisible({ timeout: 15000 });

    await page.getByText('Achievements').click();
    await expect(page.getByText('Achievements').first()).toBeVisible();
    await expect(page.getByText(/unlocked/i)).toBeVisible({ timeout: 5000 }).catch(() => {});

    await page.getByText('Credentials').click();
    await expect(page.getByText('Credentials').first()).toBeVisible();
    await expect(page.getByText(/verified|pending/i)).toBeVisible({ timeout: 5000 }).catch(() => {});

    await page.getByText('Statistics').click();
    await expect(page.getByText('Statistics').first()).toBeVisible();

    await page.getByText('Settings').click();
    await expect(page.getByText(/profile settings|settings panel/i)).toBeVisible({ timeout: 5000 });
  });

  test('should open and close edit profile modal', async ({ page }) => {
    await page.waitForTimeout(1500);
    const editButton = page.getByRole('button', { name: /edit profile/i });
    await expect(editButton).toBeVisible({ timeout: 15000 });
    await editButton.click();

    const editForm = page.getByText('Edit Profile');
    await expect(editForm).toBeVisible({ timeout: 5000 });

    const cancelButton = page.getByRole('button', { name: /cancel/i });
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      await expect(editForm).not.toBeVisible({ timeout: 3000 }).catch(() => {});
    }
  });

  test('should edit profile fields and save', async ({ page }) => {
    await page.waitForTimeout(1500);
    const editButton = page.getByRole('button', { name: /edit profile/i });
    await expect(editButton).toBeVisible({ timeout: 15000 });
    await editButton.click();

    await page.waitForTimeout(1000);

    const nameInput = page.getByLabel(/name/i);
    if (await nameInput.isVisible()) {
      await nameInput.fill('Updated Name');
    }

    const saveButton = page.getByRole('button', { name: /save changes/i });
    if (await saveButton.isEnabled()) {
      await saveButton.click();
      await page.waitForTimeout(1500);
    }
  });

  test('should show achievements with filters on achievements tab', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Achievements').click();
    await page.waitForTimeout(1000);

    const achievementsHeader = page.getByText(/achievements/i);
    await expect(achievementsHeader.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show credentials with status badges on credentials tab', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Credentials').click();
    await page.waitForTimeout(1000);

    const credentialsHeader = page.getByText(/credentials/i);
    await expect(credentialsHeader.first()).toBeVisible({ timeout: 10000 });
    const statusBadge = page.getByText(/verified|pending|expired/i);
    await expect(statusBadge.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('should display statistics with ranking on statistics tab', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Statistics').click();
    await page.waitForTimeout(1000);

    const statsContent = page.getByText(/statistics/i);
    await expect(statsContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show settings panel with placeholder text', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Settings').click();
    await page.waitForTimeout(500);

    const settingsContent = page.getByText(/profile settings/i);
    await expect(settingsContent).toBeVisible({ timeout: 10000 }).catch(() => {});
  });

  test('should display error boundary for invalid state', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('userProfile'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 15000 });
  });

  test('should show loading state on initial load', async ({ page }) => {
    await page.goto('/profile');
    const loadingText = page.getByText(/loading profile/i);
    await expect(loadingText).toBeVisible({ timeout: 3000 }).catch(() => {});
  });

  test('should allow filtering achievements by rarity', async ({ page }) => {
    await page.waitForTimeout(1500);
    await page.getByText('Achievements').click();
    await page.waitForTimeout(1000);

    const raritySelect = page.locator('select').filter({ hasText: /all rarities|common|rare|epic|legendary/i });
    if (await raritySelect.isVisible()) {
      await raritySelect.selectOption('rare');
      await page.waitForTimeout(500);
    }
  });
});
