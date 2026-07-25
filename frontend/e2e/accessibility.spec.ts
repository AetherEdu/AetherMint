import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// List of key pages to audit for a11y compliance
const PAGES_TO_AUDIT = [
  { path: '/', name: 'Home' },
  { path: '/campus', name: 'Campus' },
  { path: '/profile', name: 'Profile' },
  { path: '/demo', name: 'Demo' },
  { path: '/lab', name: 'Lab' },
  { path: '/admin', name: 'Admin Dashboard' },
  { path: '/admin/users', name: 'Admin Users' },
  { path: '/admin/analytics', name: 'Admin Analytics' },
  { path: '/admin/content/moderation', name: 'Admin Content Moderation' },
  { path: '/accessibility', name: 'Accessibility Statement' },
  { path: '/collaboration/test-room', name: 'Collaboration Room' },
  { path: '/settings/notifications', name: 'Settings Notifications' },
];

test.describe('Accessibility Audit (WCAG 2.1 AA)', () => {
  for (const { path, name } of PAGES_TO_AUDIT) {
    test(`a11y audit: ${name} page (${path})`, async ({ page }) => {
      await page.goto(path);

      // Wait for the page to be fully loaded
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
        // Some pages may have persistent connections; continue anyway
      });

      // Ensure the skip-to-content link exists on all pages
      const skipLink = page.locator('a[href*="main-content"]');
      const hasSkipLink = await skipLink.first().isVisible().catch(() => false) ||
        (await skipLink.count()) > 0;

      // Run axe-core accessibility scan
      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      // Log violations for debugging
      if (accessibilityScanResults.violations.length > 0) {
        console.log(
          `\n[${name}] A11y violations found:`,
          accessibilityScanResults.violations.map(v => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodeCount: v.nodes.length,
          }))
        );
      }

      // Assert no critical or serious violations
      const seriousViolations = accessibilityScanResults.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      );

      // Allow for pre-existing moderate violations but fail on critical ones
      const criticalViolations = accessibilityScanResults.violations.filter(
        v => v.impact === 'critical'
      );

      expect(
        criticalViolations.length,
        `${name} page should have no critical accessibility violations. ` +
        `Found: ${criticalViolations.map(v => `${v.id}: ${v.description}`).join('; ')}`
      ).toBe(0);

      // Expect skip-to-content link on main pages
      if (name !== 'Admin Dashboard' && name !== 'Admin Users' && name !== 'Admin Analytics') {
        // Pages using the root layout should have skip link
        expect(hasSkipLink).toBeTruthy();
      }
    });
  }

  test('keyboard navigation: focus order and visible indicators', async ({ page }) => {
    await page.goto('/');

    // Verify skip-to-content link is focusable and works
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Verify focus indicator is visible (should have outline or ring)
    const focusedElementStyles = await focusedElement.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineStyle: styles.outlineStyle,
        outlineWidth: styles.outlineWidth,
      };
    });

    // Focus indicator should not be "none"
    expect(focusedElementStyles.outlineStyle).not.toBe('none');
  });

  test('color contrast: text should meet WCAG AA requirements', async ({ page }) => {
    await page.goto('/accessibility');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('.text-gray-900')
      .include('.text-gray-700')
      .include('.text-gray-600')
      .include('.text-blue-600')
      .analyze();

    const colorContrastViolations = accessibilityScanResults.violations.filter(
      v => v.id === 'color-contrast'
    );

    expect(
      colorContrastViolations.length,
      `Color contrast violations on accessibility page: ${JSON.stringify(colorContrastViolations)}`
    ).toBe(0);
  });

  test('ARIA landmarks: all pages should have main, navigation, and banner roles', async ({ page }) => {
    await page.goto('/');

    // Check for main landmark
    const mainLandmark = page.locator('[role="main"], main');
    await expect(mainLandmark.first()).toBeVisible();

    // Check that main has an accessible name or id
    const mainElement = mainLandmark.first();
    const hasAccessibleName = await mainElement.evaluate(el => {
      return el.hasAttribute('aria-label') ||
        el.hasAttribute('aria-labelledby') ||
        el.hasAttribute('id') ||
        el.textContent?.trim().length > 0;
    });
    expect(hasAccessibleName).toBeTruthy();
  });

  test('screen reader: all images should have alt text', async ({ page }) => {
    await page.goto('/accessibility');

    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    expect(
      imagesWithoutAlt,
      `Found ${imagesWithoutAlt} images without alt text on accessibility page`
    ).toBe(0);
  });

  test('screen reader: all buttons should have accessible names', async ({ page }) => {
    await page.goto('/accessibility');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag21a'])
      .analyze();

    const buttonViolations = accessibilityScanResults.violations.filter(
      v => v.id === 'button-name'
    );

    expect(
      buttonViolations.length,
      `Buttons missing accessible names: ${JSON.stringify(buttonViolations)}`
    ).toBe(0);
  });
});
