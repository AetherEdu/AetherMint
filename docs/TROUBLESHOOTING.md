# AetherMint Troubleshooting Guide

> A searchable reference for diagnosing and resolving common issues across all areas of AetherMint development and deployment.

## Table of Contents

- [Smart Contracts (Soroban)](#-smart-contracts-soroban)
  - [Build Errors](#build-errors)
  - [Deploy Errors](#deploy-errors)
  - [Test Failures](#test-failures)
- [Backend](#-backend)
  - [Database Connection Issues](#database-connection-issues)
  - [Database Migration Issues](#database-migration-issues)
  - [API Errors](#api-errors)
  - [IPFS Integration](#ipfs-integration)
  - [Redis Issues](#redis-issues)
- [Frontend](#-frontend)
  - [Build and Dependency Issues](#build-and-dependency-issues)
  - [Stellar Wallet Integration](#stellar-wallet-integration)
  - [Runtime Errors](#runtime-errors)
- [Infrastructure](#-infrastructure)
  - [Docker and Docker Compose](#docker-and-docker-compose)
  - [Environment Configuration](#environment-configuration)
  
- [General Development](#-general-development)
  - [Node.js and npm/pnpm](#nodejs-and-npmpnpm)
  - [Git and Branching](#git-and-branching)

---

## 🔗 Smart Contracts (Soroban)

**Tags:** `contracts` `soroban` `rust` `wasm` `stellar-cli` `build` `deploy` `test`

### Build Errors

---

#### Error: `error[E0463]: can't find crate for 'std'`

**Symptom:**
```
error[E0463]: can't find crate for `std`
  --> src/lib.rs:1:1
   |
   = note: the `wasm32-unknown-unknown` target may not support the standard library
```

**Cause:** You are building with the wrong WASM target for your Rust version. Rust 1.84+ requires `wasm32v1-none`; the legacy `wasm32-unknown-unknown` target no longer works.

**Solution:**
```bash
# Add the correct target for Rust 1.84+
rustup target add wasm32v1-none

# Build with the correct target
cargo build --target wasm32v1-none --release

# Or use the stellar CLI (recommended — it picks the right target automatically)
stellar contract build
```

> **Note:** If you are on Rust 1.81 or earlier, use `wasm32-unknown-unknown`. Rust 1.82 and 1.83 are not supported — upgrade to 1.84+ or downgrade to 1.81.

---

#### Error: `could not find `Cargo.toml`` / wrong directory

**Symptom:**
```
error: could not find `Cargo.toml` in `/workspaces/AetherMint` or any parent directory
```

**Cause:** Running `cargo build` from the project root instead of the `contracts/` directory.

**Solution:**
```bash
cd contracts
cargo build --target wasm32v1-none --release
```

---

#### Error: `package soroban-sdk version mismatch`

**Symptom:**
```
error: failed to select a version for `soroban-sdk`.
required by package `aethermint-education-contracts v0.1.0`
```

**Cause:** `Cargo.toml` pins `soroban-sdk = "=26.1.0"` (exact version). A different version is installed or the lock file is stale.

**Solution:**
```bash
# Clean and regenerate the lock file
cd contracts
cargo clean
cargo update
cargo build --target wasm32v1-none --release
```

If you manually edited `Cargo.toml`, make sure the version stays pinned:
```toml
[dependencies]
soroban-sdk = "=26.1.0"
```

---

#### Error: Rust toolchain version wrong

**Symptom:**
```
error: package `soroban-sdk v26.1.0` cannot be built because it requires rustc 1.84.0 or newer
```

**Solution:**
```bash
# Check current version
rustc --version

# Update to latest stable
rustup update stable

# Or pin to a specific version
rustup install 1.84.0
rustup default 1.84.0
```

---

### Deploy Errors

---

#### Error: `stellar: command not found`

**Symptom:**
```
bash: stellar: command not found
```

**Cause:** Stellar CLI (formerly Soroban CLI) is not installed or not in `PATH`.

**Solution:**
```bash
# Install the version matching the SDK
cargo install --locked stellar-cli --version 26.1.0

# Verify
stellar version

# If still not found, ensure ~/.cargo/bin is in PATH
export PATH="$HOME/.cargo/bin:$PATH"
# Add the above to your ~/.bashrc or ~/.zshrc to persist
```

---

#### Error: `stellar-cli version mismatch`

**Symptom:**
```
Error: XDR decoding error / incompatible version
```

**Cause:** The `stellar-cli` version does not match `soroban-sdk = "=26.1.0"`.

**Solution:**
```bash
# Uninstall the current version and reinstall the correct one
cargo install --locked stellar-cli --version 26.1.0 --force

# Confirm both versions match
stellar version
grep soroban-sdk contracts/Cargo.toml
```

---

#### Error: `No such network: testnet` / network not configured

**Symptom:**
```
Error: No such network: testnet
```

**Solution:**
```bash
# Add testnet configuration
stellar network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

# Add local standalone network
stellar network add standalone \
  --rpc-url http://localhost:8000/soroban/rpc \
  --network-passphrase "Standalone Network ; February 2017"

# Verify
stellar network ls
```

---

#### Error: `account not found` when deploying

**Symptom:**
```
Error: account not found: GA...
```

**Cause:** The deployer account has no XLM balance on testnet.

**Solution:**
```bash
# Fund your account via Friendbot (testnet only)
curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"

# Or use the CLI
stellar keys fund MY_KEY --network testnet
```

---

### Test Failures

---

#### Error: `thread 'main' panicked` in contract tests

**Symptom:**
```
thread 'main' panicked at 'called `Result::unwrap()` on an `Err` value: ...'
```

**Diagnosis:**
```bash
# Run tests with full output to see the panic location
cd contracts
cargo test -- --nocapture 2>&1 | head -100
```

**Common causes:**
- Missing `testutils` feature — ensure dev-dependencies include it:
  ```toml
  [dev-dependencies]
  soroban-sdk = { version = "=26.1.0", features = ["testutils"] }
  ```
- Incorrect contract initialization order in tests.

---

#### Contract tests pass locally but fail on another machine

**Cause:** The other machine may use a different Rust version or missing target.

**Solution:** Ensure the machine has the correct Rust toolchain and `wasm32v1-none` target installed:
```bash
rustup target add wasm32v1-none
```

---

## 🖥️ Backend

**Tags:** `backend` `nodejs` `express` `postgresql` `redis` `prisma` `jwt` `api` `ipfs`

### Database Connection Issues

---

#### Error: `ECONNREFUSED 127.0.0.1:5432` (PostgreSQL)

**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Diagnosis steps:**
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql
# or with Docker
docker ps | grep postgres

# Test connection manually
psql -h localhost -U your_user -d your_database
```

**Solutions:**

1. Start PostgreSQL:
   ```bash
   sudo systemctl start postgresql
   # or with Docker Compose
   docker compose up -d db
   ```

2. Verify `DATABASE_URL` in `.env`:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/aethermint
   ```

3. If using Docker, ensure the container port is mapped:
   ```yaml
   # docker-compose.yml
   ports:
     - "5432:5432"
   ```

---

#### Error: `password authentication failed for user`

**Symptom:**
```
error: password authentication failed for user "aethermint"
```

**Solution:**
```bash
# Reset the password in PostgreSQL
sudo -u postgres psql
ALTER USER aethermint WITH PASSWORD 'your_new_password';
\q

# Update your .env accordingly
DATABASE_URL=postgresql://aethermint:your_new_password@localhost:5432/aethermint
```

---

#### Error: `database "aethermint" does not exist`

**Solution:**
```bash
sudo -u postgres psql
CREATE DATABASE aethermint;
GRANT ALL PRIVILEGES ON DATABASE aethermint TO aethermint;
\q
```

---

### Database Migration Issues

---

#### Error: Migrations fail or are out of order

**Symptom:**
```
Error: migration file 002 has already been applied
```

**Diagnosis:**
```bash
# Check migration status
cd backend
node migrations/status.js
# or with Prisma
npx prisma migrate status
```

**Solution:**
```bash
# Apply pending migrations in order
cd backend
node migrations/001_add_content_versions.js
node migrations/002_add_user_roles.js
node migrations/003_add_enrollments.js

# For a clean dev reset (destroys data — dev only)
npx prisma migrate reset
```

---

#### Error: `column does not exist` after migration

**Cause:** A migration was added but not applied to the running database.

**Solution:**
```bash
cd backend
npx prisma migrate deploy   # for production
# or
npx prisma migrate dev      # for development (runs and applies)
```

---

### API Errors

---

#### Error: `401 Unauthorized` on protected endpoints

**Symptom:**
```json
{ "error": "Unauthorized", "message": "No token provided" }
```

**Solution:**
- Include the JWT token in the `Authorization` header:
  ```
  Authorization: Bearer <your_token>
  ```
- Check that `JWT_SECRET` in `.env` matches what was used to sign the token.
- Tokens expire — re-authenticate via `POST /api/auth/login` to get a fresh token.

---

#### Error: `500 Internal Server Error` on startup

**Diagnosis:**
```bash
cd backend
npm run dev 2>&1 | head -50
```

**Common causes and fixes:**

| Cause | Fix |
|-------|-----|
| Missing `.env` file | `cp .env.example .env` and fill in values |
| Database not running | Start PostgreSQL and Redis |
| Missing `node_modules` | Run `npm install` or `pnpm install` |
| Port already in use | Change `PORT` in `.env` or kill the conflicting process |

**Find and kill a process using port 3000:**
```bash
lsof -ti:3000 | xargs kill -9
```

---

### IPFS Integration

---

#### Error: `IPFS connection refused` / upload fails

**Symptom:**
```
Error: connect ECONNREFUSED 127.0.0.1:5001
```

**Diagnosis:**
```bash
# Check IPFS daemon status
curl http://localhost:5001/api/v0/version
```

**Solution:**

1. Start a local IPFS daemon:
   ```bash
   ipfs daemon
   ```

2. Or configure to use a remote IPFS gateway in `backend/.env`:
   ```env
   IPFS_HOST=ipfs.infura.io
   IPFS_PORT=5001
   IPFS_PROTOCOL=https
   IPFS_PROJECT_ID=your_project_id
   IPFS_PROJECT_SECRET=your_secret
   ```

3. Check IPFS health endpoint:
   ```bash
   curl http://localhost:3001/api/content/health
   ```

---

#### Error: `Content CID not found`

**Cause:** Content was uploaded but not pinned, and the IPFS node garbage-collected it.

**Solution:**
```bash
# Pin the content via API
curl -X POST http://localhost:3001/api/content/<cid>/pin \
  -H "Authorization: Bearer <token>"
```

---

### Redis Issues

---

#### Error: `ECONNREFUSED 127.0.0.1:6379`

**Solution:**
```bash
# Start Redis
sudo systemctl start redis
# or
redis-server

# Verify
redis-cli ping   # should return PONG
```

Check `REDIS_URL` in `.env`:
```env
REDIS_URL=redis://localhost:6379
```

---

## 🌐 Frontend

**Tags:** `frontend` `nextjs` `typescript` `tailwind` `wallet` `freighter` `stellar`

### Build and Dependency Issues

---

#### Error: `Module not found` after cloning

**Symptom:**
```
Error: Cannot find module '@/components/...'
```

**Solution:**
```bash
cd frontend
npm install
# or
pnpm install

npm run build
```

---

#### Error: Next.js build fails with TypeScript errors

**Solution:**
```bash
cd frontend
# Check for TypeScript errors
npx tsc --noEmit

# Or skip type-checking during build (not recommended for production)
# Add to next.config.js:
# typescript: { ignoreBuildErrors: true }
```

---

#### Error: `ENOENT: no such file or directory, open '.env.local'`

**Solution:**
```bash
cd frontend
cp .env.example .env.local
# Fill in required values like NEXT_PUBLIC_STELLAR_NETWORK, etc.
```

---

#### Error: TailwindCSS classes not applying

**Solution:**
```bash
# Rebuild CSS
cd frontend
npm run dev

# Verify tailwind.config.js content paths include your file patterns
# content: ["./src/**/*.{ts,tsx}"]
```

---

### Stellar Wallet Integration

---

#### Error: Freighter wallet not detected / `window.freighter is undefined`

**Symptom:** Connect wallet button shows no wallet detected.

**Diagnosis steps:**
1. Ensure the Freighter browser extension is installed: https://freighter.app
2. Check that you're running on `http://localhost` or `https://` — Freighter blocks `file://` origins.
3. Open the browser console and run:
   ```js
   console.log(window.freighter)
   ```

**Solution:**
```typescript
// Graceful detection with fallback message
import { isConnected } from "@stellar/freighter-api";

const connected = await isConnected();
if (!connected) {
  alert("Please install the Freighter wallet extension.");
}
```

---

#### Error: `Transaction rejected by user`

**Cause:** User denied the signing request in the wallet popup.

**Solution:** This is expected behavior. Handle the rejection gracefully:
```typescript
try {
  const signedTx = await signTransaction(xdr);
} catch (err) {
  if (err.message.includes("rejected")) {
    // User cancelled — show friendly message, do not throw
    console.warn("User rejected the transaction.");
  } else {
    throw err;
  }
}
```

---

#### Error: `Network mismatch` — wallet on wrong network

**Symptom:**
```
Error: Transaction network mismatch. Expected testnet, got mainnet.
```

**Solution:**
1. Open Freighter extension → Settings → Network → select **Testnet**.
2. Verify `NEXT_PUBLIC_STELLAR_NETWORK=testnet` in `frontend/.env.local`.

---

#### Error: `Insufficient balance` when submitting a transaction

**Solution:**
- Fund your testnet account using [Stellar Friendbot](https://friendbot.stellar.org):
  ```
  https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY
  ```
- Ensure the account has at least 1 XLM for the base reserve plus transaction fees.

---

### Runtime Errors

---

#### Error: `Hydration mismatch` in Next.js

**Symptom:**
```
Error: Hydration failed because the initial UI does not match what was rendered on the server.
```

**Cause:** Wallet state (which is client-only) being accessed during SSR.

**Solution:** Wrap wallet-dependent components with a client-side check:
```tsx
import { useEffect, useState } from "react";

export default function WalletButton() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  // render wallet UI here
}
```

---

#### Error: `CORS error` calling backend API from frontend

**Symptom:**
```
Access to fetch at 'http://localhost:3001/api/...' has been blocked by CORS policy
```

**Solution:**

1. Verify `NEXT_PUBLIC_API_URL` in `frontend/.env.local` points to the correct backend URL.
2. Ensure the backend allows the frontend origin in its CORS config:
   ```typescript
   // backend/src/index.ts
   app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
   ```
3. Restart the backend after changing env vars.

---

## 🏗️ Infrastructure

**Tags:** `infrastructure` `docker` `docker-compose` `env` `deployment`

### Docker and Docker Compose

---

#### Error: `port is already allocated`

**Symptom:**
```
Error: bind: address already in use / port is already allocated
```

**Solution:**
```bash
# Find the process using the port (e.g., 5432)
lsof -ti:5432 | xargs kill -9

# Or change the host port in docker-compose.yml
ports:
  - "5433:5432"   # map to 5433 on the host instead

# Then update DATABASE_URL accordingly
DATABASE_URL=postgresql://user:password@localhost:5433/aethermint
```

---

#### Error: `Cannot connect to the Docker daemon`

**Solution:**
```bash
# Start Docker daemon
sudo systemctl start docker

# Verify
docker info

# If permission denied, add your user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

---

#### Error: containers exit immediately after `docker compose up`

**Diagnosis:**
```bash
docker compose logs backend
docker compose logs frontend
docker compose logs db
```

**Common causes:**
- Missing environment variables — verify all required vars are in `.env`
- Database not healthy yet — add a `depends_on` healthcheck in `docker-compose.yml`
- Build error in the image — run `docker compose build --no-cache` to rebuild

---

### Environment Configuration

---

#### Missing required environment variables

**Symptom:** App starts but features fail with cryptic errors.

**Solution:**
```bash
# Copy example env files and fill in all required values
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

**Required variables checklist:**

| Variable | Location | Description |
|----------|----------|-------------|
| `DATABASE_URL` | `backend/.env` | PostgreSQL connection string |
| `REDIS_URL` | `backend/.env` | Redis connection string |
| `JWT_SECRET` | `backend/.env` | Must be long, random, and secret |
| `STELLAR_NETWORK` | `backend/.env` | `testnet` or `standalone` |
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | Backend API base URL |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `frontend/.env.local` | `testnet` or `mainnet` |

---

#### Error: `.env` changes not taking effect

**Cause:** The server process cached the old environment.

**Solution:**
```bash
# Restart the dev server after changing .env
# Kill the running process and restart
npm run dev

# With Docker Compose
docker compose down && docker compose up
```

---



---

## 🛠️ General Development

**Tags:** `general` `nodejs` `npm` `pnpm` `git` `setup`

### Node.js and npm/pnpm

---

#### Error: `node: command not found` or wrong Node.js version

**Solution:**
```bash
# Check current version
node --version   # requires v18+

# Install/switch versions using nvm
nvm install 18
nvm use 18

# Verify
node --version
npm --version
```

---

#### Error: `pnpm: command not found`

**Solution:**
```bash
npm install -g pnpm

# Or via corepack (Node.js 16.9+)
corepack enable
corepack prepare pnpm@latest --activate
```

---

#### Error: `ERESOLVE unable to resolve dependency tree`

**Solution:**
```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Or with pnpm
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

---

#### Running the full stack locally

```bash
# 1. Install all dependencies from the project root
npm run install:all

# 2. Start local Stellar network
stellar network add standalone \
  --rpc-url http://localhost:8000/soroban/rpc \
  --network-passphrase "Standalone Network ; February 2017"
stellar standalone start

# 3. Deploy contracts
cd contracts
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/aethermint_education_contracts.wasm \
  --network standalone

# 4. Start backend (new terminal)
cd backend && npm run dev

# 5. Start frontend (new terminal)
cd frontend && npm run dev
```

---

### Git and Branching

---

#### Starting work on a new issue

```bash
# Always branch from an up-to-date main
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name

# After changes, push to your fork
git push -u origin feature/your-feature-name
```

---

#### Keeping your fork up to date

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

---

#### Commit message format

Follow the convention used in this project:

```
type: short description

# Types: feat | fix | docs | chore | refactor | test
# Examples:
feat: add credential revocation to registry contract
fix: resolve JWT expiry validation error
docs: add IPFS integration troubleshooting section
```

---

## 📋 Quick Diagnostic Checklist

Before opening an issue, run through this checklist:

- [ ] Is the correct Rust version installed? (`rustc --version` → 1.84+)
- [ ] Is `wasm32v1-none` added? (`rustup target list --installed | grep wasm`)
- [ ] Is `stellar-cli` version 26.1.0? (`stellar version`)
- [ ] Are all `.env` files populated? (compare against `.env.example`)
- [ ] Is PostgreSQL running and reachable?
- [ ] Is Redis running and reachable?
- [ ] Are `node_modules` installed in all subdirectories?
- [ ] Is Node.js v18 or higher?
- [ ] Is the Freighter extension installed and set to the correct network?

---

## 🐛 Reporting a New Issue

If this guide does not solve your problem:

1. Search [existing issues](https://github.com/AetherEdu/AetherMint/issues) first.
2. Collect relevant information:
   - Error message (full stack trace)
   - OS and environment (`node --version`, `rustc --version`, `stellar version`)
   - Steps to reproduce
3. [Open a new issue](https://github.com/AetherEdu/AetherMint/issues/new?assignees=&labels=bug&template=bug_report.md) using the bug report template.

---

*Last updated: July 2026 · Maintained by the AetherMint community*
