# 🔒 Security Policy

MySQL MCP implements security controls for database connections. It supports stdio and HTTP transports. It utilizes MCP v2 stateless architecture.

## 🛡️ Defend Your Database Infrastructure

### Eradicate SQL Injection Vulnerabilities

**Identifier Sanitization** (`src/adapters/mysql/schemas/`)

- ✅ **Zod schemas** — Validates and quotes all table, column, schema, and index names across all tool groups.
- ✅ **MySQL identifier rules enforced** — start with letter/underscore, contain only alphanumerics, underscores, or $ signs
- ✅ **64-character limit** enforced (MySQL maximum)
- ✅ **Invalid identifiers** throw `InvalidIdentifierError`

**Parameterized Queries**

- ✅ **All user-provided values** use parameterized queries via `mysql2` library
- ✅ **Identifier sanitization** complements parameterized values — defense in depth

### Prevent Data Leaks with Structured Errors

Every tool returns structured error responses — never raw exceptions or internal details:

```json
{
  "success": false,
  "error": "Descriptive message with context",
  "code": "MODULE_ERROR_CODE",
  "category": "VALIDATION_ERROR",
  "suggestion": "Actionable remediation hint",
  "recoverable": true
}
```

Error logic leverages the `MySQLMcpError` hierarchy (multiple distinct categories). It returns enriched payloads via `formatHandlerErrorResponse()`. Error codes are module-prefixed. The server logs internal stack traces but never exposes them to clients.

## 🔐 Ensure Integrity with Input Validation

- ✅ **Zod schemas** — Validate all tool inputs at tool boundaries before database operations
- ✅ **Parameterized queries** — Use parameterized queries throughout — never string interpolation
- ✅ **Audit filters required** — Audit log queries must provide at least one filter to prevent mass data extraction
- ✅ **Data masking aliases** — Validate aliases strictly at the MCP boundary to prevent evasion
- ✅ **Identifier sanitization** — Validate table, column, schema, and index names against injection

## 📁 Sandbox Operations with Filesystem Boundaries

A dedicated security sandbox strictly confines all file I/O operations exposed by the server. This includes MySQL Shell operations and Audit Subsystem snapshots.

- ✅ **`ALLOWED_IO_ROOTS` Enforcement** — operations must target absolute paths within administrator-configured directories. HTTP transports hard-fail on startup if omitted.
- ✅ **Path Traversal Prevention** — blocks traversal sequences (`..`), null bytes, and query parameters.
- ✅ **Symlink Awareness** — resolves and asserts `realpath` to prevent escaping the sandbox via symlink targets.
- ✅ **Hidden Files Protection** — rejects dotfiles and hidden directories unless explicitly authorized.
- ✅ **Drive Letter Validation** — cross-platform compatible with strict Windows drive letter and UNC path checking.

## 🧪 Isolate Threats in Code Mode Sandbox

Code Mode executes user-provided JavaScript in a hardened `isolated-vm` sandbox. This includes multiple layers of defense-in-depth and fleet-standard restrictions. **These features are detailed prominently in the [README.md](README.md#optimize-token-usage-with-code-mode).**

### Enforce Engine-Level Restrictions

- ✅ **Strict V8 Isolate Boundary** — executes within a physically separate V8 isolate. It ensures native objects and prototypes cannot cross the boundary.
- ✅ **Memory & CPU Constraints** — enforced at the C++ level. This includes synchronous timeouts and strict heap limits.
- ✅ **API Bindings via Reference** — Injects MySQL methods securely using `ivm.Reference` wrappers.

### Validate Code Statically

- ✅ **Comprehensive blocked patterns** — regex rules block `require()`, `import()`, `eval()`, `Function`, `process`, and `__proto__`. They also block filesystem/network access and system commands.
- ✅ **Unicode & Comment Sanitization** — Strips comments and performs NFKC normalization to prevent regex evasion.
- ✅ **Configurable code input limit** — prevents payload-based resource exhaustion.

### Protect the Runtime

- ✅ **RPC Quotas** — Caps RPC API calls per execution. This prevents unbounded loops.
- ✅ **Execution timeout** — Enforces timeouts to prevent resource exhaustion. Configurable via schema `timeout`.
- ✅ **Egress boundary enforcement** — streaming `JSON.stringify` serialization aborts mid-flight when exceeding size caps.
- ✅ **Rate limiting** — Enforces per-client rate limits. Configure via CODEMODE_RATE_LIMIT_MAX. Uses Redis with in-memory fallbacks.
- ✅ **Readonly enforcement** — when `readonly: true`, write methods return structured errors instead of executing.
- ✅ **Audit logging** — Logs every execution with UUID, client ID, metrics, and redacted code preview.
- ✅ **Admin scope** — Code Mode requires `admin` scope when OAuth is enabled.
- ✅ **Full API access** — Exposes all tool groups via the `mysql.*` namespace.

## 🌐 Fortify Remote HTTP Transports

When running in HTTP mode (`--transport http`), the following security measures apply:

### Add Security Headers

- ✅ **DNS Rebinding Protection** — `validateHostHeader()` strictly validates `Host` headers
- ✅ **X-Content-Type-Options: nosniff** — prevents MIME sniffing
- ✅ **X-Frame-Options: DENY** — prevents clickjacking
- ✅ **Content-Security-Policy: default-src 'none'; frame-ancestors 'none'** — prevents XSS and framing
- ✅ **Cache-Control: no-store, no-cache, must-revalidate** — prevents caching of sensitive data
- ✅ **Referrer-Policy: no-referrer** — prevents referrer leakage
- ✅ **Permissions-Policy: camera=(), microphone=(), geolocation=()** — restricts browser APIs

### Support HSTS

- ✅ **Strict-Transport-Security** header for HTTPS deployments
- ✅ Enable via `--enable-hsts` flag or `MCP_ENABLE_HSTS=true`

### Configure CORS

- ✅ **Origin whitelist** with `Vary: Origin` header for caching
- ✅ **Optional credentials support** (`corsAllowCredentials`)
- ✅ **MCP-specific headers** allowed (`X-Session-ID`, `mcp-session-id`)

### Apply Rate Limiting

- ✅ **Built-in Rate Limiting** — Configurable rate limiting per IP. Configure limits via `MCP_RATE_LIMIT_MAX`. Distribute limits across deployments via Redis using graceful in-memory fallbacks.
- ✅ **Health Endpoint Bypass** — `/health` bypasses limits to ensure reliable load balancer checks
- ✅ **Returns 429 Too Many Requests** with proper `Retry-After` headers when limits are exceeded
- ✅ **Slowloris DoS Protection** — strictly enforced timeouts at the transport layer (120s request timeout, 65s headers timeout, 66s keep-alive timeout) prevent connection exhaustion

> **Reverse Proxy Note:** The server uses `req.socket.remoteAddress` for rate limiting. All requests may share the same IP behind reverse proxies. You must ensure your proxy forwards distinct client IPs. Pass `--trust-proxy` or set `TRUST_PROXY=true`. This trusts the `X-Forwarded-For` header. Alternatively, you can apply rate limiting at the proxy layer instead.

### Restrict Request Limits

- ✅ **Memory Exhaustion Protection** — Strict request bounds prevent memory exhaustion DoS

## 🔑 Control Access via OAuth 2.1 & Bearer Tokens

The server supports full OAuth 2.1 for production multi-tenant deployments. **These enterprise security features are detailed prominently in the [README.md](README.md#protect-your-data-with-authentication).**

- ✅ **RFC 9728** Protected Resource Metadata (`/.well-known/oauth-protected-resource`)
- ✅ **RFC 8414** Authorization Server Discovery with caching
- ✅ **RFC 7591** OAuth 2.1 Dynamic Client Registration
- ✅ **JWT validation** with JWKS support (TTL: 1 hour)
- ✅ **MySQL-specific scopes**: `read`, `write`, `admin`, `full`, `db:{name}`, `table:{db}:{table}`
- ✅ **Per-tool scope enforcement** via `AsyncLocalStorage` context threading
- ✅ **Bearer Token Auth**: Use `MCP_AUTH_TOKEN` for straightforward token authentication to avoid OAuth overhead.

> **⚠️ HTTP without Authentication:** Exposing HTTP transport without authentication grants unrestricted access to all clients.

## 🐳 Deploy Secure Docker Containers

### Run as Non-Root User

- ✅ **Dedicated user**: `app` (UID 1001) with minimal privileges
- ✅ **Restricted group**: `app` (GID 1001)

> **Note:** Administrators must restrict `/app/data` directory permissions on the host system.

### Harden the Container

- ✅ **Minimal base image**: Node.js Alpine image
- ✅ **Multi-stage build**: Build dependencies not in production image
- ✅ **Production pruning**: Uses pnpm install --prod and pnpm store prune in the runtime stage
- ✅ **Process isolation** from host system

### Patch Dependencies

The Dockerfile explicitly patches npm-bundled transitive dependencies for Docker Scout compliance.

### Mount Volumes Securely

```bash
# Secure volume mounting
docker run -i --rm -v ./data:/app/data writenotenow/mysql-mcp:latest --transport stdio --allowed-io-roots /app/data --mysql "mysql://mcp_user:secure_password@host.docker.internal:3306/testdb"
```

### Apply Resource Limits

```bash
# Apply resource limits
docker run -i --memory=1g --cpus=1 -v ./data:/app/data:rw -e ALLOWED_IO_ROOTS=/app/data writenotenow/mysql-mcp:latest --transport stdio --mysql "mysql://mcp_user:secure_password@host.docker.internal:3306/testdb"
```

## 🔐 Maintain Compliance with Secure Logs

### Enable Audit Subsystem

- ✅ **Dual Audit Log Architecture** — Primary MCP server writes to mcp-audit.jsonl. Grafana Alloy ingests mcp-audit.jsonl and routes to Loki. Exporter reads from mcp-audit.jsonl via AUDIT_LOG_PATH to compute metrics. Exporter isolates its own writes by setting `--audit-log` to exporter-audit.jsonl. The metrics server and exporter share a single process. Both operate on port 3000. This prevents port contention.
- ✅ **Exporter Healthcheck**: `wget --spider -q http://127.0.0.1:3000/metrics`
- ✅ **Full JSONL Audit Trails** — comprehensive logging array capturing mutations, Code Mode executions, and system events
- ✅ **Session Token Estimates** — robust burn-rate tracking appended to log entries
- ✅ **Pre-Mutation Snapshots (Backup)** — interceptor captures table states before destructive administration operations

### Redact Credentials

- ✅ **Redact Sensitive Fields** — The `--audit-redact` flag redacts sensitive data in logs.
- ✅ **Recursive sanitization** for nested objects

### Prevent Log Injection

- ✅ **Control character sanitization** (ASCII 0x00-0x1F except tab/newline, 0x7F, C1 characters)
- ✅ **Prevents log forging** and escape sequence attacks

## 🔄 Automate Security in CI/CD Pipelines

- ✅ **CodeQL analysis** — automated static analysis on push/PR
- ✅ **pnpm audit** — dependency vulnerability checking (audit-level: moderate)
- ✅ **Dependabot** — automated dependency update PRs (weekly for npm and GitHub Actions)
- ✅ **Secrets scanning** — dedicated workflow for leaked credential detection
- ✅ **E2E transport parity** — Playwright suite validates streamable and stateless HTTP behavior

## 🚨 Implement Operational Security Best Practices

### Follow Best Practices for Users

1. **Never commit database credentials** to version control — use environment variables
2. **Require OAuth 2.1 authentication for HTTP transport in production.**
3. **Restrict database user permissions** to minimum required
4. **Enable SSL** for database connections in production (`ssl=true` in connection string)
5. **Enable HSTS** when running over HTTPS (`--enable-hsts`)
6. **Configure CORS origins explicitly** — avoid wildcards
7. **Use resource limits** — apply Docker `--memory` and `--cpus` limits
8. **Apply rate limiting at the proxy layer** when deploying behind a reverse proxy
9. **Consider SHA-pinning** critical GitHub Actions in CI workflows for supply-chain defense-in-depth

### Follow Best Practices for Developers

1. **Parameterized queries only** — never interpolate user input into SQL strings
2. **Zod validation** — all tool inputs validated via schemas at tool boundaries
3. **No secrets in code** — use environment variables (`.env` files are gitignored)
4. **Typed error classes** — descriptive messages with context; don't expose internals
5. **Regular updates** — keep Node.js and pnpm dependencies updated
6. **Security scanning** — regularly scan Docker images for vulnerabilities

## 📋 Verify with the Security Checklist

- [x] Parameterized SQL queries throughout
- [x] Identifier sanitization (table, column, schema, index names)
- [x] Input validation via Zod schemas
- [x] Filesystem boundary sandbox (`ALLOWED_IO_ROOTS`) for all file I/O operations
- [x] Code Mode sandbox isolation (true separate V8 isolate via isolated-vm)
- [x] Code Mode native prototype isolation (objects cannot cross isolate boundary)
- [x] Code Mode blocked patterns (comprehensive static regex rules + Unicode/NFKC validation)
- [x] Code Mode egress streaming boundary (abort serialization on oversized results)
- [x] Code Mode RPC Quotas
- [x] Code Mode execution timeout (dynamically configurable)
- [x] Code Mode rate limiting (configurable via `CODEMODE_RATE_LIMIT_MAX`, Redis-backed with in-memory fallback)
- [x] Code Mode audit logging
- [x] HTTP bounds limits
- [x] Configurable CORS with origin whitelist
- [x] Rate limiting (configurable via `MCP_RATE_LIMIT_MAX`, Redis-backed with in-memory fallback)
- [x] Slowloris DoS timeouts (strictly enforced at transport layer)
- [x] DNS rebinding protection via Host header validation
- [x] Security headers (CSP, X-Content-Type-Options, X-Frame-Options, Cache-Control, Referrer-Policy, Permissions-Policy)
- [x] HSTS (opt-in)
- [x] OAuth 2.1 with JWT/JWKS validation (RFC 9728, RFC 8414)
- [x] MySQL-specific scope enforcement (`read`, `write`, `admin`, `full`, `db:{name}`, `table:{db}:{table}`)
- [x] Per-tool scope enforcement via `AsyncLocalStorage`
- [x] Credential redaction in logs
- [x] Log injection prevention
- [x] Non-root Docker user
- [x] Multi-stage Docker build with production pruning
- [x] Transitive dependency CVE patching in Dockerfile
- [x] CI/CD security pipeline (CodeQL, pnpm audit, secrets scanning)
- [x] Structured error responses (no internal details leaked)
- [x] Comprehensive security documentation

## 🚨 Disclose Vulnerabilities Responsibly

| Version | Supported |
| ------- | --------- |
| Current Major Version | ✅        |
| Previous Major Version | ✅        |

If you discover a security vulnerability:

1. **Do not** open a public GitHub issue
2. **Email** security concerns to: **admin@adamic.tech**
3. **Include** detailed reproduction steps and potential impact
4. **Allow** reasonable time for a fix before public disclosure

### Review Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity

We appreciate responsible disclosure. We will acknowledge your contribution in our release notes.

## 🔄 Maintain Protection with Security Updates

- **Container updates**: Rebuild Docker images when base images are updated
- **Dependency updates**: Keep npm packages updated via `pnpm audit` and Dependabot
- **Database maintenance**: Run `OPTIMIZE TABLE` and `ANALYZE TABLE` regularly for optimal performance
- **Security patches**: Apply host system security updates

Security-first principles drive the mysql-mcp server design. It protects your databases. It maintains excellent performance and full MySQL capability.


