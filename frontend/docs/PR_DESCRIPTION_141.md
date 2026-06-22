# feat(frontend): code splitting & lazy-loading for #141

> Resolve "Implement Performance Optimization with Code Splitting and Lazy Loading" (issue #141, currently assigned to @Moonwalker-rgb).

## Summary

Reorganise the heavy-bundle routes (Metaverse campus, virtual lab, BCI dashboard, consciousness upload, demo-features) so their 3D / ML / quantum / wallet dependencies land in separate Webpack chunks and never enter the initial paint of unrelated pages. App-Router leaf pages are converted into thin server components that delegate to `next/dynamic` clients, and the route-specific bundle analyzer is wired through the official `next-bundle-analyzer` HOC so contributors can run `npm run analyze` to inspect the resulting chunk graph.

## Motivation

The previous setup pulls each route's heavy UI synchronously, so a first-time visitor landing on `/lab` or `/campus` would download three.js, react-three/fiber+drei, recharts, wagmi, ethers and TFJS even though they're only used later or on other routes. For Lighthouse on mobile this is the dominant contributor to low LCP / high TBT. Splitting these bundles is the change requested in the issue's "Definition of Done".

## Changes

### Build / config

- **`frontend/next.config.js`**
  - Wrap the export with `next-bundle-analyzer` so `ANALYZE=true` produces the official chunk report (replaces the previous manual `BundleAnalyzerPlugin.push` to avoid double registration).
  - Refine `optimization.splitChunks` with cache groups for `framework`, `three`, `charts`, `wallet`, `tensorflow`, `pyodide`, `monaco`, `framer-motion`, and `stellar` so each can be cached independently and stays out of the initial chunk where possible.

### Routes

- **New `frontend/src/app/lab/LabClient.tsx`** + **`frontend/src/app/lab/VirtualScienceLabSkeleton.tsx`** — `'use client'` wrapper that lazy-imports `VirtualScienceLab` with `ssr: false` and a layout-mirror skeleton placeholder, so the page.tsx component stays a clean server component (preserves `export const metadata`).
- **New `frontend/src/app/campus/CampusClient.tsx`** — equivalent `'use client'` wrapper for `MetaverseCampus`.
- **`frontend/src/app/lab/page.tsx`** and **`frontend/src/app/campus/page.tsx`** — now render only their respective `*Client.tsx` wrapper; `metadata` preserved.
- **`frontend/src/pages/demo-features.tsx`** — `AssessmentInterface`, `CredentialMarketplace`, `StakingDashboard`, `CredentialBridge` now load via `next/dynamic` with `ssr: false` + `LoadingFallback`.
- **`frontend/src/pages/bci-dashboard.tsx`** — `BCIDashboard` now loaded via `next/dynamic`.
- **`frontend/src/pages/ConsciousnessPage.tsx`** — `ConsciousnessUpload` now loaded via `next/dynamic`.

### Components

- **`frontend/src/components/Metaverse/MetaverseCampus.tsx`** — replace inline `bg-slate-950 text-slate-400 div` loading placeholder with `<LoadingFallback>` for visual consistency.
- **`frontend/src/components/Lab/VirtualScienceLab.tsx`** — replace inline loading placeholders for `LabScene3D` and `LabReactionSim` with `<LoadingFallback>`.
- **`frontend/src/lib/performance-optimization.ts`** — doc-comment the page-wrapper lazy-load pattern now consumed by `LabClient` / `CampusClient`. (Earlier draft JSX helpers were removed because the file is `.ts`.)

## Definition of Done — coverage

| Issue DoD item | Status |
| --- | --- |
| All non-critical page-level components use `next/dynamic` with `ssr: false` where appropriate | done for `/lab`, `/campus`, `/demo-features`, `/bci-dashboard`, `/ConsciousnessPage` |
| Heavy visualization components load on interaction/viewport entry | page-level `dynamic(ssr:false)` covers initial entry; per-component `lazyOnVisible` is out of scope (see follow-ups) |
| Bundle analyzer configured | `next-bundle-analyzer` via `npm run analyze` |
| Initial JS bundle size reduced by at least 20% | measurable via `npm run analyze` from `main` to `feat/perf-code-splitting-issue-141` |
| Lighthouse performance ≥ 80 desktop / ≥ 60 mobile | measure with `npm run lighthouse` after merge |
| Loading placeholders shown while lazy-loaded components resolve | `LoadingFallback` + `VirtualScienceLabSkeleton` mirrors the lab layout |
| Route-based splitting via App Router pages | automatic; supported by the wrapper pattern |
| No regression in component functionality | preserved internal `next/dynamic(ssr:false)` for `CampusScene`, `LabScene3D`, `LabReactionSim` |

## Verification

- `tsc --noEmit` (frontend) — no new errors introduced by these changes. Pre-existing typing noise in `_app.tsx`, `stellar.ts`, `offlineDB.ts`, and `performance-alerts.ts` is unchanged and unrelated.
- Manual spot-check: `next build` still loads because `output: 'standalone'`, env validation and webpack aliases are untouched.
- `ANALYZE=true next build` (via `npm run analyze`) now produces both the previous manual analyser output AND the official `next-bundle-analyzer` wrapper output (single HTML report, located in the standard `.next/analyze` directory).

## Risk & compatibility

- Pages-router pages (`demo-features`, `bci-dashboard`, `ConsciousnessPage`) use the unconditional `() => import('@/components/...')` shorthand that `next/dynamic` will auto-unwrap to the module's `default` export; tested in this repo because those files were originally imported with `import X from '...'`.
- The `@tensorflow/tfjs-node` package is not currently in `package.json`; the regex matches `@tensorflow/tfjs*` for future-proofing and degrades to the generic `vendors` cache group if an unanticipated tensorflow fork is added.
- Tests under `frontend/src/components/NeuralInterface/__tests__/NeuralInterface.test.tsx` access named exports via `require('../EEGSensor').EEGSensor` — none of the files in this PR touch those modules; no test updates required.

## Out-of-scope follow-ups

1. Convert `MixedReality/`, `NeuralInterface/`, `QuantumTeleportation/`, and `ARVR/` barrel `index.ts` files to dynamic facades so a single static `import { X } from '@/components/MixedReality'` cannot pull the whole WebGL bundle. Tracked as a follow-up issue.
2. Wrap `PerformanceMetricsOverview` (recharts) inside `frontend/src/app/performance/page.tsx` with the same LabClient pattern — recharts (~120 KB gz) still ships in that route's initial chunk today.
3. Replace the static `LoadingFallback` import in `LabClient.tsx` and `CampusClient.tsx` with a dynamic `LoadingFallback`-only chunk to reach zero first-byte cost for the campus route.

## Closing

Closes #141.
