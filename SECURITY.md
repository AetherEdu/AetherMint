# Security Policy

AetherMint handles educational credentials, on-chain transactions, and user
identity data. We take security seriously and appreciate responsible disclosure
from the community.

## Supported Versions

AetherMint is currently in **alpha** (`0.1.x`). Security fixes are applied to
the latest release on the `main` branch only; older development snapshots are
not supported.

| Version | Supported |
|---------|-----------|
| `0.1.x` (latest `main`) | :white_check_mark: |
| older snapshots | :x: |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Report privately by email to:

**security@aetheredu.xyz**

Include as much of the following as you can:

- A description of the vulnerability and its impact
- The component affected (smart contract, backend API, frontend, infrastructure)
- Step-by-step instructions to reproduce the issue
- A proof of concept, if available
- Any suggested remediation
- Whether you would like to be credited

You may optionally encrypt sensitive details, but a plain report is fine.

## What to Expect

| Stage | Target |
|-------|--------|
| Acknowledgement of your report | within **48 hours** |
| Initial assessment and next steps | within **7 days** |
| Fix or mitigation for confirmed issues | as soon as practical, based on severity |
| Public disclosure | coordinated with you after a fix is available |

We will keep you informed throughout the process and credit you in the release
notes unless you prefer to remain anonymous.

## Scope

In scope:

- Soroban smart contracts in `contracts/`
- Backend API and authentication in `backend/`
- Frontend application in `frontend/`
- Infrastructure and deployment configuration in `infra/` and `scripts/`

Out of scope:

- Vulnerabilities in third-party dependencies without a demonstrated project
  impact (report those upstream, and see below)
- Denial-of-service against public test networks
- Issues requiring a compromised developer machine or leaked credentials
- Social engineering

## Safer by default

- The project targets **Stellar Testnet** during development. Do not use
  production keys or real user data in local/test environments.
- Never commit secrets. `.env` files are git-ignored; CI runs secret scanning
  (see `.gitleaks.toml`).
- Contract deployment is gated on the upstream repository (fork builds stop
  before deploy).

## Dependency Scanning

AetherMint can run dependency scans locally:

- **npm audit** — scans JavaScript/TypeScript workspaces for known vulnerabilities
- **cargo audit** — scans Rust contract dependencies against the RustSec advisory database
- **Trivy** — filesystem scanner for comprehensive vulnerability detection

For details on running scans and responding to findings, see
[docs/VULNERABILITY-SCANNING.md](docs/VULNERABILITY-SCANNING.md).
