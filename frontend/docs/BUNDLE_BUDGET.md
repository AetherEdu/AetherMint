# Frontend Performance Budget

Issue #273 sets a target of **< 200 KB initial JavaScript (gzipped)** and asks for
that budget to be enforced in CI. The bundle analyzer and route-based code
splitting are already wired up (`npm run analyze`, and the `splitChunks` cache
groups in `next.config.js`); this adds the missing **measurement and enforcement**
layer.

## What it measures

`scripts/check-bundle-budget.mjs` reads the Next.js build manifests
(`.next/build-manifest.json` and `.next/app-build-manifest.json`) after a build,
gzips every first-load JavaScript chunk per route, and compares the largest route
against the budget. It is dependency-free (Node built-ins only), so it runs in CI
without an extra install step.

## Configuration

`performance-budget.json` (in the `frontend/` root):
{
"maxInitialJsGzipKb": 200,
"enforce": false,
"ignoreRoutes": ["/_error", "/404", "/500"]
}

- `maxInitialJsGzipKb` - the gzipped first-load budget, in KB.
- `enforce` - when `true`, the check exits non-zero if any route is over budget.
  Left `false` initially so the gate can be adopted without breaking existing
  builds, then flipped on once routes are under budget.
- `ignoreRoutes` - routes excluded from the check.

Overrides: `--budget=<kb>`, `--enforce`, or env `BUNDLE_BUDGET_KB` /
`BUNDLE_BUDGET_ENFORCE`.

## Run it locally

​
npm run build
npm run bundle-budget

## CI

`.github/workflows/bundle-budget.yml` builds the frontend and runs the check on
every pull request that touches `frontend/**`. It is **report-only** while
`enforce` is `false`: the budget table shows up in the job log without failing the
build. Flip `enforce` to `true` in `performance-budget.json` to make it a blocking
gate.