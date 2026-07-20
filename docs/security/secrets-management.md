# Secrets Management

This document describes how AetherMint handles application secrets, the
guardrails that keep them out of source control, and the proposed design for a
managed secret store with rotation. It supports issue #288.

## Goals

- Keep secrets out of source control and CI logs.
- Move runtime secrets into a managed secret store.
- Apply a predictable rotation policy.
- Keep an audit trail of secret access.

## Current guardrails (implemented)

- Real secrets live only in local, git-ignored .env files. Only .env.example is
  committed, and it contains placeholder values only.
- A gitleaks secret scan runs on every push and pull request. See the workflow
  at .github/workflows/secret-scan.yml. It runs in report-only mode, so it
  surfaces findings without blocking the build. Once the repository is confirmed
  clean, it can be made blocking by changing its exit code from 0 to 1.
- The existing Trivy job in the CI pipeline continues to scan dependencies for
  known vulnerabilities.

## Configuration files

- .env.example documents every variable the app expects, using placeholder
  values only. Contributors copy it to a local .env, which is never committed.
- .gitleaks.toml extends the default gitleaks rules and allowlists documented
  placeholders and public test values so the scan stays low-noise.

## Proposed design (requires maintainer infrastructure)

The items below need cloud accounts and infrastructure that are outside the
scope of this change. They are recorded here as a plan for maintainers.

### Managed secret store

Move runtime secrets out of environment files and CI variables into a managed
store, such as a cloud provider secret manager or a self-hosted vault.
Applications read secrets at start-up from the store rather than from committed
files. Local development continues to use a local .env for convenience.

### CI and CD injection

CI reads secrets from the repository or environment secret settings and injects
them into jobs at run time. Secrets are never written to the repository or
printed to logs.

### Rotation policy

| Secret type          | Rotation interval |
| -------------------- | ----------------- |
| API keys and tokens  | 90 days           |
| Database credentials | 30 days           |

Rotation should be automated where the provider supports it, using overlapping
validity windows so running services are not interrupted during a rotation.

### Audit logging

Every secret read should be recorded with the caller identity, a timestamp, and
the secret name (never its value). Audit records should be retained according to
the project retention policy.

## Handling rules for contributors

- Never commit real secrets. If a secret is committed by accident, rotate it
  immediately and remove it from history.
- Never log secret values. Redact sensitive fields before logging errors.
- Do not embed secrets in code, tests, or fixtures. Use environment variables.

## References

- Issue #288: Implement secrets management with rotation policy.
- .github/workflows/secret-scan.yml
- .gitleaks.toml
- .env.example