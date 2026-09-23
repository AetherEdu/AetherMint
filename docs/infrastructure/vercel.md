# Deploying to Vercel

This document covers deploying **AetherMint** with [Vercel][vercel]. Vercel
hosts the **Next.js frontend** (`frontend/`). The Express backend is **not**
deployed to Vercel — see [Backend hosting](#backend-hosting) for why and where
it should go instead.

- [Current deployment](#current-deployment)
- [Frontend project (Vercel)](#frontend-project-vercel)
  - [Git integration (recommended)](#git-integration-recommended)
  - [CLI deploy](#cli-deploy)
- [Environment variables](#environment-variables)
- [Backend hosting](#backend-hosting)

## Current deployment

| | |
|---|---|
| Project | `aethermint` |
| Scope | `penielka` |
| Root Directory | `frontend` |
| Production URL | <https://aethermint.vercel.app> |
| Node.js | 20.x |

Production and Preview both have `NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS` set to
the Stellar **testnet placeholder**
(`GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA`). Replace it with
the real receiver key before accepting real payments:

```bash
cd frontend
npx vercel env rm NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS production
npx vercel env add NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS production
npx vercel deploy --prod          # NEXT_PUBLIC_* values are inlined at build time
```

### Auto-deploy on push

Git integration is **not** connected yet, so pushes do not trigger a
build. Connecting it requires a GitHub login connection on the Vercel account
(skipping it fails with *“You need to add a Login Connection to your GitHub
account first.”*):

1. Accept the GitHub integration for the Vercel account under
   **Account Settings → Login Connections**.
2. Then run `npx vercel git connect` from `frontend/`, or connect the repo from
   the project's **Settings → Git** page.

Until then, deploy with the CLI commands below.

## Frontend project (Vercel)

The repository is an npm workspace, but `frontend/` ships its own
`package-lock.json` and can be installed and built on its own. Vercel should be
pointed at the `frontend` directory.

Project settings:

| Setting | Value |
|---------|-------|
| Framework Preset | **Next.js** |
| Root Directory | `frontend` |
| Install Command | *(default)* `npm install` |
| Build Command | *(default)* `npm run build` |
| Output Directory | *(default)* `.next` |
| Node.js Version | **20.x** |

`frontend/vercel.json` pins the framework preset so the project builds the same
way whether it is created from the dashboard or the CLI.

> **Note:** `next.config.js` sets `output: 'standalone'`, which is used by the
> Docker image (`frontend/Dockerfile`). Vercel uses its own Next.js build
> output and ignores this setting, so no changes are required.

### Git integration (recommended)

1. In the Vercel dashboard choose **Add New → Project** and import
   `AetherEdu/AetherMint`.
2. Set **Root Directory** to `frontend`.
3. Add the required environment variables (see
   [Environment variables](#environment-variables)) for the **Production**,
   **Preview**, and **Development** environments as needed.
4. Deploy.

Every push to `main` then produces a production deployment, and every pull
request gets its own preview URL.

### CLI deploy

```bash
# One-off deploy from the frontend workspace.
cd frontend

# The receiver address is validated at build time by next.config.js, so it must
# be present or the build fails.
npx vercel deploy --prod \
  --token "$VERCEL_TOKEN" \
  --build-env NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS=G...

# Subsequent deploys (project already linked) only need:
npx vercel deploy --prod --token "$VERCEL_TOKEN"
```

## Environment variables

`NEXT_PUBLIC_*` variables are inlined into the client bundle at build time, so
changing them requires a new deployment. Anything without the `NEXT_PUBLIC_`
prefix is server-side only.

**Required**

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS` | Valid 56-character Stellar public key (`G...`). `next.config.js` rejects the build if it is missing or malformed. |

**Optional** (see `frontend/.env.example` for the full list)

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_BACKEND_URL` | Base URL of the deployed backend API. |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_API_BASE_URL` | API endpoints used by the discovery/consciousness services. |
| `NEXT_PUBLIC_WS_URL` / `NEXT_PUBLIC_SOCKET_URL` | Realtime (Socket.IO) endpoints. |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` | Canonical origin used for metadata, sitemap, and share links. |
| `NEXT_PUBLIC_STELLAR_RPC_URL` / `NEXT_PUBLIC_IPFS_GATEWAY_URL` | Only needed if the browser talks to Stellar/IPFS directly. |
| `ASSET_PREFIX` | CDN origin for `/_next/static` assets. Leave unset to serve from Vercel. |

Point each `NEXT_PUBLIC_*` API/WS variable at the deployed backend once it is
running, otherwise the frontend falls back to its localhost defaults.

### Dependency gotcha

Vercel installs only what `frontend/package.json` and
`frontend/package-lock.json` declare. In the local npm **workspace** install,
npm hoists the backend's dependencies to the repository root, so the frontend
can accidentally import a package it never declared and still build locally.
That is how `ml-matrix` (used by `src/lib/bci/bciService.ts`) shipped broken;
it is now a declared frontend dependency.

After adding a dependency, run `npm install` **inside `frontend/`** so
`frontend/package-lock.json` — the lockfile Vercel uses — is updated, and verify
with an isolated install:

```bash
cd frontend
npm ci --workspaces=false          # mirrors Vercel's install exactly
./node_modules/.bin/tsc --noEmit   # type-check against Vercel's versions
```

## Backend hosting

Vercel runs stateless serverless functions and explicitly does not target
long-running servers or database hosting. The backend (`backend/`) is a
long-lived Express + Socket.IO process, so it does not fit:

- Routes are resolved with dynamic `require()` at startup.
- Module import opens Redis, initialises Socket.IO, and wires a signaling
  service.
- Background workers (transaction queue, bridge monitor, RAG indexing), cron
  jobs, and migration auto-run assume a persistent process.
- It needs always-on PostgreSQL + MongoDB + Redis.

Deploy it as a **container** instead, using the existing `backend/Dockerfile`,
on a platform suited to long-running services (for example Render, Railway, or
Fly.io). Configure the same database/Redis/Stellar environment variables the
backend already reads from `backend/.env.example`.

[vercel]: https://vercel.com
