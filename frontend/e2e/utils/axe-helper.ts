import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * Core user-facing routes included in accessibility coverage.
 * Kept in sync with the primary flows exercised by the other e2e specs.
 */
export const CORE_ROUTES: ReadonlyArray<{ name: string; path: string }> = [
  { name: 'Home', path: '/' },
  { name: 'Campus', path: '/campus' },
  { name: 'Lab', path: '/lab' },
  { name: 'Performance', path: '/performance' },
  { name: 'Profile', path: '/profile' },
  { name: 'Notification settings', path: '/settings/notifications' },
  { name: 'Demo', path: '/demo' },
  { name: 'Enrollment', path: '/enroll/1' },
];

/**
 * WCAG tags scanned by default (2.0 / 2.1, levels A and AA) - the common
 * baseline for production web applications.
 */
export const DEFAULT_AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Known accessibility issues that are tracked but not yet fixed. Adding an
 * axe rule id here stops it from failing the suite while it is being worked
 * on. Keep this list as small as possible and reference a tracking issue.
 */
export const BASELINE_RULES: ReadonlyArray<string> = [
  // 'color-contrast', // tracked in #<issue>
];

export interface ViolationSummary {
  id: string;
  impact: string | null | undefined;
  help: string;
  nodes: number;
}

const IMPACT_ORDER = ['minor', 'moderate', 'serious', 'critical'];

/**
 * Runs an axe-core scan against the current page and returns a simplified
 * list of violations, excluding any rule ids listed in BASELINE_RULES.
 */
export async function scanCurrentPage(page: Page): Promise<ViolationSummary[]> {
  const results = await new AxeBuilder({ page })
    .withTags([...DEFAULT_AXE_TAGS])
    .analyze();

  return results.violations
    .filter((violation) => !BASELINE_RULES.includes(violation.id))
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.length,
    }));
}

/**
 * Filters violations to those at or above the given impact level.
 * axe impact order: minor < moderate < serious < critical.
 */
export function atOrAboveImpact(
  violations: ViolationSummary[],
  minimum: 'minor' | 'moderate' | 'serious' | 'critical',
): ViolationSummary[] {
  const threshold = IMPACT_ORDER.indexOf(minimum);
  return violations.filter(
    (violation) => IMPACT_ORDER.indexOf(violation.impact ?? 'minor') >= threshold,
  );
}

/**
 * Formats violations into a readable, multi-line string for test output.
 */
export function formatViolations(violations: ViolationSummary[]): string {
  if (violations.length === 0) {
    return 'No accessibility violations found.';
  }

  return violations
    .map(
      (violation) =>
        `- [${violation.impact ?? 'unknown'}] ${violation.id}: ${violation.help} (${violation.nodes} node(s))`,
    )
    .join('\n');
}