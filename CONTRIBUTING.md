# Contributing to AetherMint

Thank you for your interest in contributing to **AetherMint** — a decentralized
learning and credential verification platform built on Stellar and Soroban.

This guide covers everything you need to build, test, and submit changes. For a
longer, step-by-step walkthrough (including troubleshooting), see the
[Contributor Onboarding Guide](CONTRIBUTING_ONBOARDING.md).

- [Code of Conduct](#code-of-conduct)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
- [Building and testing](#building-and-testing)
  - [Smart contracts (Rust / Soroban)](#smart-contracts-rust--soroban)
  - [Backend (Node.js / Express)](#backend-nodejs--express)
  - [Frontend (Next.js)](#frontend-nextjs)
- [Development workflow](#development-workflow)
- [Submitting a pull request](#submitting-a-pull-request)
- [Reporting bugs and requesting features](#reporting-bugs-and-requesting-features)

## Code of Conduct

By participating, you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).
Please report unacceptable behaviour to the maintainers.

## Repository layout

| Path | Contents |
|------|----------|
| `contracts/` | Soroban smart contracts (Rust) |
| `backend/` | Express/TypeScript API, plus the OpenAPI docs and developer portal in `backend/portal/` |
| `frontend/` | Next.js 14 app (App Router) |
| `docs/` | Architecture, ADRs, runbooks, and guides |
| `infra/` | Kubernetes, observability, and release configuration |
| `scripts/` | Deployment and utility scripts |

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 18+ (20 recommended) | `node --version` |
| npm | 9+ (bundled with Node 18) | `npm --version` |
| Rust (stable) | 1.84+ | `rustc --version` |
| `wasm32v1-none` target | via rustup | `rustup target list --installed` |
| Stellar CLI | 26.1.0 (must match SDK) | `stellar version` |
| PostgreSQL | 13+ | `psql --version` |
| Redis | 6+ | `redis-server --version` |

> **Rust target note:** Rust 1.84+ requires the `wasm32v1-none` target. Rust
> 1.82–1.83 is not supported; use 1.84+ or 1.81 and earlier (which uses the
> legacy `wasm32-unknown-unknown` target instead).

## Local setup

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/<YOUR_USERNAME>/AetherMint.git
cd AetherMint
git remote add upstream https://github.com/AetherEdu/AetherMint.git

# 2. Install both workspaces (backend + frontend) from the root
npm install

# 3. Configure environment variables
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Edit each file and fill in the placeholders.

# 4. Run the app (backend on :3001, frontend on :3000)
npm run dev
```

Alternatively, start PostgreSQL, Redis, and the app with Docker:

```bash
docker-compose up -d
```

## Building and testing

Run the relevant checks for anything you touch before opening a pull request.
CI enforces all of the checks below.

### Smart contracts (Rust / Soroban)

```bash
cd contracts

# Add the build target once
rustup target add wasm32v1-none

# Build for deployment (Rust 1.84+)
cargo build --target wasm32v1-none --release
# Legacy target for Rust 1.81 and earlier:
# cargo build --target wasm32-unknown-unknown --release

# Run all tests
cargo test --release

# Run a single test
cargo test --release test_credential_issuance

# Lint and format (CI fails on any Clippy warning)
cargo fmt --all -- --check
cargo clippy -- -D warnings
```

Compiled WASM is written to
`contracts/target/wasm32v1-none/release/aethermint_education_contracts.wasm`.

### Backend (Node.js / Express)

```bash
cd backend

npm run typecheck     # tsc --noEmit
npm run lint          # ESLint
npm test              # Jest
npm run test:coverage # Jest with coverage
npm run build         # compile to dist/
```

The API and interactive docs run at `http://localhost:3001/api/docs` once
`npm run dev` is running.

### Frontend (Next.js)

```bash
cd frontend

npm run type-check    # tsc --noEmit
npm run lint          # next lint
npm test              # Jest (React Testing Library)
npm run build         # production build — must succeed with no type errors

# End-to-end tests (requires a running app)
npx playwright install --with-deps
npm run test:e2e
```

## Development workflow

1. **Branch off `main`.** Use a descriptive name:
   - `feat/<short-description>` — new feature
   - `fix/<short-description>` — bug fix
   - `docs/<short-description>` — documentation
   - `refactor/<short-description>` — refactor

   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feat/credential-revocation
   ```

2. **Make focused changes.** Keep a pull request scoped to a single issue where
   possible; smaller PRs are reviewed faster.

3. **Follow the project's style.**
   - TypeScript: match existing patterns; run `npm run lint`.
   - Rust: run `cargo fmt` and `cargo clippy -- -D warnings`.

4. **Write tests** for new behaviour and make sure existing tests still pass.

5. **Use [Conventional Commits](https://www.conventionalcommits.org/):**

   ```
   feat(credentials): add credential revocation endpoint
   fix(auth): resolve token refresh race condition
   docs: add contributor onboarding guide
   ```

6. **Never commit secrets.** `.env` files, keys, and credentials must stay out
   of Git. Scans run in CI and locally (see [SECURITY.md](SECURITY.md)).

## Submitting a pull request

1. Push your branch to your fork:
   ```bash
   git push -u origin feat/credential-revocation
   ```
2. Open a PR against `AetherEdu/AetherMint:main`.
3. Fill in the PR template and reference the issue with `Closes #<number>`.
4. Ensure all CI checks pass (contracts, backend, frontend, security scan).
5. Request a review or wait for a maintainer to be assigned.

**PR checklist**

- [ ] All existing tests pass
- [ ] New code has corresponding tests
- [ ] Linters/type checks pass with zero errors
- [ ] No `.env` files or secrets are committed
- [ ] PR description references the issue (`Closes #NNN`)

## Reporting bugs and requesting features

- **Bug?** [Open a bug report](https://github.com/AetherEdu/AetherMint/issues/new?labels=bug&template=bug_report.md).
- **Feature idea?** [Open a feature request](https://github.com/AetherEdu/AetherMint/issues/new?labels=enhancement&template=feature_request.md).
- **Security issue?** Do **not** open a public issue — follow
  [SECURITY.md](SECURITY.md).

## Questions?

Ask in [GitHub Discussions](https://github.com/AetherEdu/AetherMint/discussions)
or in the issue thread you are working on.
