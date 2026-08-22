# Docker Image Optimization

How AetherMint's container images are kept small, reproducible, and secure, and
how CI enforces those properties.

Related issue: #282 (Optimize Docker images with multi-stage builds and layer
caching).

## Images

| Image | Dockerfile | Base | Runtime user | Port |
| ----- | ---------- | ---- | ------------ | ---- |
| Backend (Express API) | `backend/Dockerfile` | `node:20-alpine` | `nodejs` (uid 1001) | 3001 |
| Frontend (Next.js) | `frontend/Dockerfile` | `node:20-alpine` | `nextjs` (uid 1001) | 3000 |

Both images build from the repository root so the npm workspace lockfile
(`package-lock.json`) resolves correctly.

## Multi-stage builds

Each image separates build-time tooling from the runtime layer, so compilers,
dev dependencies, and source files never ship in the final image.

### Backend (`backend/Dockerfile`)

1. **builder** - installs the backend workspace with dev dependencies and
   compiles TypeScript to `dist/`.
2. **deps** - installs production-only dependencies (`npm ci --omit=dev`) plus
   any Python requirements needed by native modules.
3. **runner** - `node:20-alpine` with only the compiled `dist/`, production
   `node_modules`, a non-root user, and a health check.

### Frontend (`frontend/Dockerfile`)

1. **deps** - installs the frontend workspace dependencies.
2. **builder** - builds Next.js using standalone output
   (https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
3. **runner** - copies only `.next/standalone`, `.next/static`, and `public/`,
   runs as a non-root user, and health-checks `/api/health`.

Next.js standalone output ships only the minimal server plus traced
dependencies, which is the biggest single lever on frontend image size.

## Layer ordering & caching

Layers are ordered least- to most-frequently changing so the build cache is
reused as often as possible:

1. OS packages (`apk add ...`).
2. `package.json` + lockfile, then `npm ci` - re-runs only when dependencies
   change, not on every source edit.
3. Application source, then the build step.

Because dependency installation is isolated from source copies, editing app
code does not invalidate the dependency layer.

## `.dockerignore`

`.dockerignore` keeps the build context small and prevents secrets and build
artifacts from entering any layer. It excludes `node_modules`, build outputs
(`.next/`, `dist/`, `build/`), tests, docs, `.git`, every `.env*` variant,
`*.pem`, and `contracts/` (not needed by the JS images).

## Size budget

Target: **< 200 MB per image**. CI measures each built image and emits a
warning annotation when an image exceeds the budget. The budget is defined once
as `MAX_IMAGE_MB` in `.github/workflows/docker-images.yml` and is tunable.

Measure locally (optional):

​
docker build -f backend/Dockerfile -t aethermint-backend:local .
docker image inspect aethermint-backend:local --format '{{.Size}}'

## Security scanning

Two complementary scans run in CI:

- **Source / filesystem scan** - `ci-pr.yml` runs `npm audit`, `cargo audit`,
  and Trivy in `fs` mode over the repository.
- **Final image scan** - `.github/workflows/docker-images.yml` builds each
  image and runs Trivy in `image` mode against the built artifact, surfacing
  fixable `HIGH`/`CRITICAL` vulnerabilities that only exist in the runtime
  layers (base image, OS packages).

## CI workflow

`.github/workflows/docker-images.yml` runs on pull requests that touch the
images or their inputs. For each image it:

1. Builds the production image with Buildx.
2. Reports image size against `MAX_IMAGE_MB` (warning if exceeded).
3. Scans the final image with Trivy (`HIGH,CRITICAL`, unfixed ignored).

It uses `pull_request` (not `pull_request_target`) and passes a fallback for
`NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS`, so it runs safely on fork PRs without
secrets, consistent with `ci-pr.yml`.

## Acceptance criteria mapping (#282)

| Criterion | Where |
| --------- | ----- |
| Multi-stage build separating build and runtime | `backend/Dockerfile`, `frontend/Dockerfile` |
| Alpine-based runtime images | `node:20-alpine` runner stages |
| `.dockerignore` optimization | `.dockerignore` |
| Layer ordering for maximum cache hits | Dockerfile layer order (deps before source) |
| Target < 200 MB per image | `MAX_IMAGE_MB` budget check in CI |
| Security scanning of final images | Trivy `image` scan in `docker-images.yml` |