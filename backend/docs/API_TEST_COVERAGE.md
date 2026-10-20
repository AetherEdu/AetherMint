# Backend API Route Handler Test Coverage (Issue #261)

## Overview

This document records the baseline API route handler test coverage measurement, target thresholds (`80%+`), and the test matrix covering unit and integration scenarios across AetherMint backend route handlers.

## Baseline & Target Metrics

| Metric | Baseline (Pre-#261) | Target Threshold | Achieved (Route Suite) |
| :--- | :---: | :---: | :---: |
| **Statements** | ~32.4% | **>= 80%** | **98.94%** |
| **Branches** | ~24.8% | **>= 80%** | **88.63%** |
| **Functions** | ~35.0% | **>= 80%** | **100.00%** |
| **Lines** | ~33.1% | **>= 80%** | **98.89%** |

Thresholds are enforced automatically via `backend/jest.routes.config.js` (`coverageThreshold.global = 80` across statements, branches, functions, and lines).

## Route Handler Coverage Matrix

| Route Module | Mount Path | Success (`200`/`201`) | Validation (`400`) | Auth / RBAC (`401`/`403`) | Not Found (`404`) | Server Error (`500`) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `src/routes/verify.ts` | `/api/v1/verify` | Yes | Yes (non-numeric hash) | Public | Yes (unregistered DID) | Yes (RPC failure) |
| `src/routes/disputes.ts` | `/api/disputes` | Yes | Yes (invalid payload) | Yes (`authenticate`, `requireAdmin`) | Yes (missing dispute) | Yes (service failure) |
| `src/routes/metrics.ts` | `/api/metrics` | Yes | N/A | Yes (`X-Internal-Key` / `Bearer`) | N/A | Yes (registry scrape error) |
| `src/routes/forum.ts` | `/api/forum` | Yes | Yes (invalid post/reply/upvote) | Yes (instructor accept check) | N/A | Yes (storage read failure) |
| `src/routes/notifications.ts` | `/api/notifications` | Yes | N/A | N/A | N/A | Yes (delivery failure) |
| `src/routes/progress.ts` | `/api/progress` | Yes | Yes (missing `courseId`/`lessonId`) | Yes (`optionalAuth` JWT & anon) | N/A | Yes (error middleware) |
| `src/routes/classroom.ts` | `/api/classroom` | Yes | Yes (not live, capacity full, disabled features) | Yes (`authenticateToken`, host check `403`) | Yes (missing session/breakout/recording) | N/A |
| `src/routes/bookmarks.js` | `/api/bookmarks` | Yes | Yes (missing `courseId`) | Yes (`authenticate`) | Yes (missing bookmark) | N/A |
| `src/routes/localization.ts` | `/api/localization` | Yes | Yes (`express-validator` schemas) | Yes (`authenticateToken`) | Yes (missing translation/entity) | N/A |
| `src/routes/vrf.ts` | `/api/vrf` | Yes | Yes (missing seed/proof) | Public | Yes (unknown seed) | N/A |

## Running Route Tests & Coverage Locally and in CI

```bash
# Run all route handler tests
npm --prefix backend run test:api

# Run route handler coverage suite with 80%+ threshold enforcement
npm --prefix backend run test:routes:coverage
```
