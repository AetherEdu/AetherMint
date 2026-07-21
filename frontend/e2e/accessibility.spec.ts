import { test, expect } from '@playwright/test';
import {
  CORE_ROUTES,
  scanCurrentPage,
  atOrAboveImpact,
  formatViolations,
} from './utils/axe-helper';

/**
 * End-to-end accessibility checks.
 *
 * For each core route we navigate, wait for the page to settle, run an
 * axe-core scan, and fail on any *critical* violation. Serious, moderate,
 * and minor issues are logged (not failed) so they stay visible and can be
 * promoted to failures - or added to the baseline - as accessibility improves.
 */
test.describe('Accessibility (axe-core)', () => {
  for (const route of CORE_ROUTES) {
    test(`${route.name} (${route.path}) has no critical a11y violations`, async ({
      page,
    }) => {
      await page.goto(route.path);
      // Allow client-side rendering and data fetching to settle.
      await page.waitForLoadState('networkidle').catch(() => {});

      const violations = await scanCurrentPage(page);
      const critical = atOrAboveImpact(violations, 'critical');

      if (violations.length > 0) {
        console.log(
          `\nAccessibility findings for ${route.path}:\n${formatViolations(violations)}`,
        );
      }

      expect(
        critical,
        `Critical accessibility violations on ${route.path}:\n${formatViolations(critical)}`,
      ).toEqual([]);
    });
  }
});