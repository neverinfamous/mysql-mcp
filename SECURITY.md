# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
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

### Router API TLS Certificate Bypass

When connecting to MySQL Router's REST API with self-signed certificates, set `MYSQL_ROUTER_INSECURE=true`. This **temporarily disables TLS certificate validation** for Router API requests only.

> **⚠️ CAUTION**: This bypasses certificate validation and is vulnerable to man-in-the-middle attacks. Only use in development/testing environments with trusted networks.

### Automated Security Scanning

- **Docker Scout** - CVE scanning on every build
- **CodeQL** - Static analysis for code vulnerabilities
- **Dependabot** - Automated dependency updates

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
