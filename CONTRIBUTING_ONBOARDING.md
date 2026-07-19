# Contributor Onboarding Guide

Welcome to **AetherMint** — a decentralized learning and credential verification platform powered by the Stellar blockchain! This guide will get you from zero to your first merged pull request.

---

## Table of Contents

1. [Prerequisites Checklist](#1-prerequisites-checklist)
2. [Step-by-Step Local Environment Setup](#2-step-by-step-local-environment-setup)
3. [Development Workflow](#3-development-workflow)
4. [How to Find and Claim Good First Issues](#4-how-to-find-and-claim-good-first-issues)
5. [Common Troubleshooting Solutions](#5-common-troubleshooting-solutions)
6. [Video Walkthrough](#6-video-walkthrough)
7. [Additional Resources](#7-additional-resources)

---

## 1. Prerequisites Checklist

Before cloning the repository, make sure all of the following tools are installed and at the correct version.

| Tool | Minimum Version | Check Command |
|------|----------------|---------------|
| **Node.js** | 18.x | `node --version` |
| **npm** | 9.x (bundled with Node 18) | `npm --version` |
| **Rust** (stable) | 1.84.0+ | `rustc --version` |
| **PostgreSQL** | 13.x | `psql --version` |
| **Redis** | 6.x | `redis-server --version` |
| **Git** | 2.x | `git --version` |
| **Stellar CLI** | 26.1.0 | `stellar version` |

> **Note on Rust versions**: Rust 1.82–1.83 is **not supported**. Use 1.84+ (recommended) or 1.81 and earlier. The wasm build target differs between these ranges — see the [smart contracts section](#building-smart-contracts) for details.

### Installing Prerequisites

<details>
<summary><strong>Node.js (v18+)</strong></summary>

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc   # or ~/.zshrc
nvm install 18
nvm use 18

# Or download directly from https://nodejs.org/en/download
```

</details>

<details>
<summary><strong>Rust (1.84+)</strong></summary>

```bash
# Install rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Add the WASM build target required by Rust 1.84+
rustup target add wasm32v1-none

# Verify
rustc --version   # should print 1.84.x or higher
```

> If you are on Rust 1.81 or earlier, add `wasm32-unknown-unknown` instead:
> ```bash
> rustup target add wasm32-unknown-unknown
> ```

</details>

<details>
<summary><strong>PostgreSQL (v13+)</strong></summary>

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y postgresql postgresql-contrib

# macOS (Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Windows — download installer from https://www.postgresql.org/download/windows/
```

</details>

<details>
<summary><strong>Redis (v6+)</strong></summary>

```bash
# Ubuntu / Debian
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# macOS (Homebrew)
brew install redis
brew services start redis

# Verify
redis-cli ping   # should return: PONG
```

</details>

<details>
<summary><strong>Stellar CLI (v26.1.0)</strong></summary>

Stellar CLI is installed via Cargo, so Rust must be installed first.

```bash
# Install the exact pinned version
cargo install --locked stellar-cli --version 26.1.0

# Verify
stellar version   # should print 26.1.0
```

> The SDK and CLI versions **must match** (both `26.1.0`). Using a different CLI version will cause contract build or deployment failures.

</details>

---

## 2. Step-by-Step Local Environment Setup

### Step 1 — Fork and Clone

1. Open [AetherEdu/AetherMint](https://github.com/AetherEdu/AetherMint) on GitHub.
2. Click **Fork** (top-right) to create a copy under your own account.
3. Clone your fork locally:

```bash
git clone https://github.com/<YOUR_USERNAME>/AetherMint.git
cd AetherMint
```

4. Add the upstream remote so you can pull in future changes:

```bash
git remote add upstream https://github.com/AetherEdu/AetherMint.git

# Verify both remotes exist
git remote -v
```

---

### Step 2 — Install Node Dependencies

The project uses npm workspaces. A single install from the root covers both the `backend` and `frontend` packages:

```bash
npm install
```

> If you prefer `pnpm`, the repo also ships a `pnpm-lock.yaml`:
> ```bash
> npm install -g pnpm
> pnpm install
> ```

---

### Step 3 — Configure Environment Variables

The repo ships two `.env.example` files — one at the root and one inside `backend/`. Copy both and fill in the placeholders:

```bash
# Root-level env (frontend + shared config)
cp .env.example .env

# Backend-specific env
cp backend/.env.example backend/.env
```

Open each `.env` file and set the values relevant to your local setup. The critical ones to get started are:

```dotenv
# .env (root)
DATABASE_URL=postgresql://aethermint_user:password@localhost:5432/aethermint_education
REDIS_URL=redis://localhost:6379
JWT_SECRET=<generate a random string, e.g. `openssl rand -hex 32`>
STELLAR_NETWORK=testnet
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
```

Leave Stellar contract addresses empty for now — they will be populated after you deploy the contracts locally (optional for most contributions).

---

### Step 4 — Set Up PostgreSQL

```bash
# Connect to PostgreSQL as the superuser
sudo -u postgres psql

# Inside the psql prompt:
CREATE DATABASE aethermint_education;
CREATE USER aethermint_user WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE aethermint_education TO aethermint_user;
\q
```

Run database migrations:

```bash
cd backend
npm run migrate
```

> You can optionally seed test data:
> ```bash
> npm run seed
> ```

---

### Step 5 — Build Smart Contracts (Optional)

Skip this step if you are working on the frontend or backend only. Required if you are modifying Soroban contracts.

```bash
cd contracts

# Rust 1.84+ (recommended)
cargo build --target wasm32v1-none --release

# OR Rust 1.81 or earlier
cargo build --target wasm32-unknown-unknown --release

# Run contract tests
cargo test
```

The compiled WASM binary is output to:
- `target/wasm32v1-none/release/` (Rust 1.84+)
- `target/wasm32-unknown-unknown/release/` (Rust 1.81-)

---

### Step 6 — Start a Local Stellar Network (Optional)

Required only when testing contract deployment or Stellar transactions locally:

```bash
# Start a local standalone Stellar node
stellar standalone start

# Deploy contracts to the local network
cd contracts
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/aethermint_education_contracts.wasm \
  --network standalone
```

Copy the printed contract address into your `.env` as `CONTRACT_ADDRESS`.

---

### Step 7 — Run the Application

Open two terminals (or use the provided `concurrently` script):

```bash
# Terminal 1 — start everything together
npm run dev

# — OR — start individually:

# Terminal 1: backend (http://localhost:3001)
cd backend && npm run dev

# Terminal 2: frontend (http://localhost:3000)
cd frontend && npm run dev
```

Visit `http://localhost:3000` in your browser. The backend health endpoint is available at `http://localhost:3001/api/health`.

---

### Step 8 — Docker Compose Setup (Alternative)

If you prefer a fully containerised setup without installing PostgreSQL or Redis locally:

```bash
# Start all services (app + postgres + redis)
docker-compose up -d

# Stop all services
docker-compose down
```

The `docker-compose.yml` at the repo root wires up the correct environment variables automatically.

---

## 3. Development Workflow

### Branching

Always branch off `main`. Use descriptive names that follow this pattern:

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<short-description>` | `feature/credential-revocation` |
| Bug fix | `fix/<short-description>` | `fix/login-redirect-loop` |
| Documentation | `docs/<short-description>` | `docs/contributor-onboarding` |
| Refactor | `refactor/<short-description>` | `refactor/auth-middleware` |

```bash
# Make sure your main branch is up to date first
git checkout main
git pull upstream main

# Create and switch to your new branch
git checkout -b feature/your-feature-name
```

---

### Making Changes

1. Write your code following the project's style (TypeScript with ESLint + Prettier for JS/TS; `rustfmt` + Clippy for Rust).
2. Run the formatter and linter before committing:

```bash
# Frontend / backend (JavaScript / TypeScript)
cd frontend && npm run lint
cd backend && npm run lint

# Smart contracts (Rust)
cd contracts
cargo fmt
cargo clippy -- -D warnings
```

---

### Committing

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<optional scope>): <short summary>
```

Common types:

| Type | When to use |
|------|------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change that is not a fix or feature |
| `test` | Adding or updating tests |
| `chore` | Maintenance, dependency updates |

Examples:

```bash
git commit -m "feat(credentials): add credential revocation endpoint"
git commit -m "fix(auth): resolve token refresh race condition"
git commit -m "docs: add contributor onboarding guide"
```

---

### Running Tests

Always run the relevant test suite before pushing:

```bash
# All backend tests
cd backend && npm test

# With coverage report
cd backend && npm run test:coverage

# Specific test file
npm test -- tests/transactionQueue.test.js

# Smart contract tests
cd contracts && cargo test

# Frontend unit tests
cd frontend && npm test

# End-to-end tests (requires running application)
cd frontend && npx playwright test
```

---

### Submitting a Pull Request

1. Push your branch to your fork:

```bash
git push -u origin feature/your-feature-name
```

2. Go to your fork on GitHub and click **Compare & pull request**.
3. Set the **base repository** to `AetherEdu/AetherMint` and **base branch** to `main`.
4. Fill in the PR template:
   - **Title**: concise summary (≤ 70 characters), e.g. `feat: add credential revocation`
   - **Description**: what changed, why, and how it was tested
   - **Closes**: reference the issue with `Closes #<issue-number>` to auto-close it on merge
5. Ensure all CI checks pass (contract build, backend build, frontend build, security scan).
6. Request a review from a maintainer or wait for one to be assigned.

> **PR checklist before opening:**
> - [ ] All existing tests pass
> - [ ] New code has corresponding tests
> - [ ] Linter passes with zero errors
> - [ ] `.env` files and secrets are **not** committed
> - [ ] PR description references the issue with `Closes #NNN`

---

### Keeping Your Branch Up to Date

If `main` receives new commits while you are working, rebase to avoid merge conflicts:

```bash
git fetch upstream
git rebase upstream/main
```

Resolve any conflicts, then force-push to your fork branch:

```bash
git push --force-with-lease origin feature/your-feature-name
```

---

## 4. How to Find and Claim Good First Issues

### Finding Issues

1. Go to the [Issues tab](https://github.com/AetherEdu/AetherMint/issues) of the upstream repository.
2. Filter by the **`good first issue`** label — these are specifically selected for new contributors and have clear acceptance criteria.
3. Other useful labels to explore:
   - `documentation` — writing or improving docs (no Stellar/Rust knowledge required)
   - `bug` — confirmed problems with reproduction steps
   - `enhancement` — well-scoped feature requests
   - `medium-priority` — good scope for a meaningful first contribution

### Claiming an Issue

1. Read the issue description carefully, including the acceptance criteria.
2. Check whether anyone is already assigned or has recently commented claiming it.
3. Leave a comment such as:

   > "Hi, I'd like to work on this. I plan to approach it by [brief plan]. Could I be assigned?"

4. Wait for a maintainer to assign it to you before starting work. This prevents duplicated effort.

### Tips for a Smooth First Contribution

- Start with `documentation` or small `bug` issues to learn the codebase before tackling large features.
- Ask questions directly in the issue thread — maintainers are happy to clarify scope or point you to relevant code.
- Keep your PR focused on the single issue. Avoid bundling unrelated changes.
- Smaller PRs get reviewed faster.

---

## 5. Common Troubleshooting Solutions

### Node.js / npm

<details>
<summary><code>npm ci</code> fails with dependency errors</summary>

```bash
# Delete node_modules and reinstall from the lockfile
rm -rf node_modules frontend/node_modules backend/node_modules
npm ci
```

If the error persists, ensure your Node.js version is 18+:

```bash
node --version
nvm use 18   # if using nvm
```

</details>

<details>
<summary>Port 3000 or 3001 already in use</summary>

```bash
# Find the process using the port
lsof -i :3001

# Kill it
kill -9 <PID>
```

Or change the port in your `.env`:
```dotenv
PORT=3002
```

</details>

---

### PostgreSQL

<details>
<summary>Connection refused / <code>ECONNREFUSED 127.0.0.1:5432</code></summary>

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Start it if not running
sudo systemctl start postgresql

# Verify the DATABASE_URL in your .env matches your local credentials
psql -h localhost -U aethermint_user -d aethermint_education
```

</details>

<details>
<summary>Role or database does not exist</summary>

```bash
sudo -u postgres psql
CREATE DATABASE aethermint_education;
CREATE USER aethermint_user WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE aethermint_education TO aethermint_user;
\q
```

</details>

---

### Redis

<details>
<summary><code>Redis connection failed</code> or <code>ECONNREFUSED 127.0.0.1:6379</code></summary>

```bash
# Check Redis status
redis-cli ping          # should return PONG

# Start Redis if not running
sudo systemctl start redis-server   # Linux
brew services start redis           # macOS

# Check logs
sudo journalctl -u redis-server -n 50
```

</details>

---

### Rust / Cargo

<details>
<summary><code>error: failed to run custom build command for `soroban-sdk`</code></summary>

Ensure you are using Rust 1.84+ and have the correct wasm target:

```bash
rustup update stable
rustup target add wasm32v1-none
```

If you are intentionally on Rust 1.81 or earlier:

```bash
rustup target add wasm32-unknown-unknown
```

</details>

<details>
<summary><code>cargo clippy</code> reports warnings-as-errors in CI</summary>

Run Clippy locally before pushing:

```bash
cd contracts
cargo clippy -- -D warnings
```

Fix all reported issues. The CI enforces `warnings = errors` via the `-- -D warnings` flag.

</details>

<details>
<summary>Slow Cargo builds</summary>

Cargo caches compiled dependencies in `~/.cargo/registry`. Subsequent builds of the same dependency tree are much faster. If you need to clear the cache:

```bash
cargo clean          # removes target/ directory only
rm -rf ~/.cargo/registry   # full cache clear (use sparingly)
```

</details>

---

### Stellar CLI

<details>
<summary><code>stellar: command not found</code> after <code>cargo install</code></summary>

The Cargo bin directory is not on your `PATH`. Add it:

```bash
echo 'export PATH="$HOME/.cargo/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
stellar version
```

</details>

<details>
<summary>Version mismatch between SDK and CLI</summary>

The project pins both `soroban-sdk` and `stellar-cli` to `26.1.0`. If you see errors like `incompatible interface version`, reinstall the CLI at the exact version:

```bash
cargo install --locked stellar-cli --version 26.1.0 --force
```

</details>

<details>
<summary>Contract deployment fails on testnet</summary>

```bash
# Check that your Stellar account is funded on testnet
stellar account fund <YOUR_PUBLIC_KEY> --network testnet

# Verify the RPC endpoint is reachable
curl https://soroban-testnet.stellar.org/
```

</details>

---

### Environment Variables

<details>
<summary>App starts but returns 500 errors</summary>

Most 500 errors on a fresh install are caused by missing or incorrect environment variables. Double-check:

- `DATABASE_URL` points to a running PostgreSQL instance with the correct credentials.
- `REDIS_URL` points to a running Redis instance.
- `JWT_SECRET` is set to a non-empty string.
- `STELLAR_NETWORK` is set to `testnet` (not `mainnet`) for local development.

```bash
# Print all env vars the app will use (without revealing secrets)
grep -v '^#' .env | grep -v '^$' | cut -d= -f1
```

</details>

---

## 6. Video Walkthrough

> **Status**: Community contributions welcome — see below.

A video walkthrough lowers the barrier even further for contributors who learn better by watching than by reading.

### Available Recordings

| Title | Platform | Duration | Topics Covered |
|-------|----------|----------|----------------|
| *(Coming soon)* | — | — | Full setup from scratch |

> If you record a walkthrough and would like it listed here, open a PR that adds a row to the table above. Recordings should be publicly accessible (YouTube, Loom, Asciinema, etc.) and cover at least the local setup steps.

### Suggested Walkthrough Topics

If you would like to contribute a video, here are the topics that would be most useful to new contributors:

1. **Full setup from scratch** — Prerequisites → clone → env config → running the app (~15 min)
2. **Smart contract workflow** — Rust setup → build → test → deploy to testnet (~10 min)
3. **Making your first contribution** — Finding an issue → branch → code → test → PR (~10 min)
4. **Troubleshooting common errors** — PostgreSQL, Redis, and Stellar CLI gotchas (~8 min)

### Recording Tips

- Use a screen recorder with clear audio (OBS, Loom, or QuickTime).
- Start from a clean terminal / fresh shell session so viewers can see every step.
- Pause briefly after each command to let the output appear on screen.
- Upload to YouTube (unlisted or public) or Loom and share the link in the issue tracker or Discord.

---

## 7. Additional Resources

| Resource | Link |
|----------|------|
| Project README | [`README.md`](./README.md) |
| Contributing Guide (short) | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| Backend Setup Guide | [`backend/SETUP_GUIDE.md`](./backend/SETUP_GUIDE.md) |
| Architecture Decision Records | [`docs/adr/`](./docs/adr/README.md) |
| Code of Conduct | [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) |
| Security Policy | [`SECURITY.md`](./SECURITY.md) |
| PR Template | [`.github/PULL_REQUEST_TEMPLATE.md`](./.github/PULL_REQUEST_TEMPLATE.md) |
| Stellar Developer Docs | https://developers.stellar.org |
| Soroban Docs | https://developers.stellar.org/docs/smart-contracts |
| Rust Book | https://doc.rust-lang.org/book/ |
| GitHub Discussions | https://github.com/AetherEdu/AetherMint/discussions |

### Community

- **Discord**: https://discord.gg/aethermint-education
- **Twitter**: https://twitter.com/aethermint_education

---

> **Thank you for contributing to AetherMint!**
> Every contribution — no matter how small — helps make decentralized education more accessible. If anything in this guide is unclear or out of date, please open an issue or a PR to improve it.
