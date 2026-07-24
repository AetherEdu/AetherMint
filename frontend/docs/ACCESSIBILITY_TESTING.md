# Accessibility Testing

This project uses `@axe-core/playwright` to run automated accessibility (a11y)
scans against the frontend as part of the Playwright end-to-end suite.

## What it does

- Navigates each core user-facing route (see `CORE_ROUTES` in
  `e2e/utils/axe-helper.ts`).
- Runs an axe-core scan using the WCAG 2.0 / 2.1 A and AA rule sets.
- Fails the test on any critical violation.
- Reports (without failing) serious, moderate, and minor issues so they stay
  visible and can be addressed incrementally.

## Running locally

Install the Playwright browsers the first time:

    npm run test:e2e:install -w frontend

Then run the accessibility suite:

    npx playwright test e2e/accessibility.spec.ts

The Playwright config starts the dev server automatically (`npm run dev`) and
scans `http://localhost:3000`.

## Baseline for known issues

Fixing every existing issue at once is rarely practical. The `BASELINE_RULES`
array in `e2e/utils/axe-helper.ts` lets you temporarily exclude specific axe
rule ids from failing the suite:

    export const BASELINE_RULES: ReadonlyArray<string> = [
      'color-contrast', // tracked in #<issue>
    ];

Guidelines:

- Keep the list as small as possible.
- Reference a tracking issue for every entry.
- Remove entries as the underlying issues are fixed.

## Adjusting coverage

- Add a route: add an entry to `CORE_ROUTES` in `e2e/utils/axe-helper.ts`.
- Change the severity gate: the spec fails on `critical` today. To also fail
  on `serious`, change `atOrAboveImpact(violations, 'critical')` to `'serious'`
  in `e2e/accessibility.spec.ts`.

## Continuous integration

The accessibility suite is not wired into the main CI workflow yet. Two things
to note before enabling it:

1. Running Playwright in CI requires installing browsers
   (`playwright install --with-deps`), which adds time and download size.
2. This repository's CI (`.github/workflows/ci.yml`) uses the
   `pull_request_target` trigger. With that trigger the workflow definition is
   always taken from the base branch, so a workflow change in a pull request
   does not run against that same pull request; it only takes effect once
   merged.

Suggested standalone job (add to `.github/workflows/ci.yml` once reviewed):

    accessibility:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: 20
            cache: npm
        - run: npm ci
        - run: npx playwright install --with-deps chromium
          working-directory: frontend
        - run: npx playwright test e2e/accessibility.spec.ts
          working-directory: frontend

Until that job is enabled, run the suite locally before shipping changes that
affect markup, components, or navigation.