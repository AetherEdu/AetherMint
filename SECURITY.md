# Security Policy

## Supported Versions

The following versions of this project are currently being supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Vulnerability Scanning

AetherMint supports running dependency scans locally:

- **npm audit** — scans all JavaScript/TypeScript workspaces for known vulnerabilities
- **cargo audit** — scans Rust contract dependencies against the RustSec advisory database
- **Trivy** — filesystem scanner for comprehensive vulnerability detection

For details on how to run scans and respond to findings, see [docs/VULNERABILITY-SCANNING.md](docs/VULNERABILITY-SCANNING.md).

## Reporting a Vulnerability

We take the security of this project seriously. If you discover any security vulnerabilities, please do not report them via public issues. Instead, please report them directly to the maintainers.

To report a vulnerability, please send an email to: security@aetheredu.xyz

Please include the following details in your report:
- Type of issue (e.g., buffer overflow, SQL injection)
- Step-by-step instructions to reproduce the issue
- Potential impact of the vulnerability

We will acknowledge receipt of your vulnerability report within 48 hours and strive to send a follow-up response defining the next steps within 7 days.
