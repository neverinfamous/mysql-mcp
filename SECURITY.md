# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| 0.x.x   | :x:                |

## Security Measures

### Docker Image Security

Our Docker images are built with security best practices:

- **Multi-stage builds** - Minimal attack surface with only production dependencies
- **Non-root user** - Container runs as unprivileged `app` user (UID 1001)
- **Alpine base** - Minimal base image with regular security updates
- **npm updates** - npm upgraded to latest in image to patch bundled dependency CVEs
- **SBOM generation** - Software Bill of Materials included with each image
- **Provenance attestation** - Supply chain attestations for image verification

### Automated Security Scanning

- **Docker Scout** - CVE scanning on every build
- **CodeQL** - Static analysis for code vulnerabilities
- **Dependabot** - Automated dependency updates

## Vulnerability Remediation History

| Date | CVE | Package | Severity | Fixed In |
|------|-----|---------|----------|----------|
| 2025-12-13 | CVE-2024-21538 | cross-spawn | High (7.7) | v1.0.0 - npm upgrade |
| 2025-12-13 | CVE-2025-64756 | glob | High (7.5) | v1.0.0 - npm upgrade |
| 2025-12-13 | CVE-2025-5889 | brace-expansion | Low (1.3) | v1.0.0 - npm upgrade |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow these steps:

1. **DO NOT** create a public GitHub issue
2. Email security concerns to: **admin@adamic.tech**
3. Include detailed reproduction steps
4. Allow reasonable time for a fix before public disclosure

### What to Include

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity

We appreciate responsible disclosure and will acknowledge your contribution in our release notes (unless you prefer to remain anonymous).
