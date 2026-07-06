# 🔒 Security Policy

The mysql-mcp MySQL MCP server implements comprehensive security measures to protect your databases across stdio, HTTP, and SSE transports.

## 🛡️ **Secure Your Database**

### Prevent SQL Injection

**Identifier Sanitization** (`src/utils/identifiers.ts`)

- ✅ **Comprehensive coverage** — validates and quotes all table, column, schema, and index names across all 28 tool groups.
- ✅ **MySQL identifier rules enforced** — start with letter/underscore, contain only alphanumerics, underscores, or $ signs
- ✅ **64-character limit** enforced (MySQL maximum)
- ✅ **Invalid identifiers** throw `InvalidIdentifierError`

Key functions:

- `sanitizeIdentifier(name)` — Validates and double-quotes an identifier
- `sanitizeTableName(table, schema?)` — Handles schema-qualified table references
- `sanitizeColumnRef(column, table?)` — Handles column references with optional table qualifier
- `sanitizeIdentifiers(names[])` — Batch sanitization for column lists

**Parameterized Queries**

- ✅ **All user-provided values** use parameterized queries via `mysql2` library
- ✅ **Identifier sanitization** complements parameterized values — defense in depth

### Handle Errors Structurally

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

Error logic leverages the `MySQLMcpError` hierarchy (9 distinct categories). It returns enriched payloads via `formatHandlerError()`. Error codes are module-prefixed. Internal stack traces are logged server-side but never exposed to clients.

## 🔐 **Validate Your Inputs**

- ✅ **Zod schemas** — all tool inputs validated at tool boundaries before database operations
- ✅ **Parameterized queries** used throughout — never string interpolation
- ✅ **Audit filters required** — audit log queries must provide at least one filter to prevent mass data extraction
- ✅ **Data masking aliases** — validated strictly at the MCP boundary to prevent evasion
- ✅ **Identifier sanitization** — table, column, schema, and index names validated against injection

## 📁 **Enforce Filesystem Boundaries**

A dedicated security sandbox strictly confines all file I/O operations exposed by the server. This includes MySQL Shell operations and Audit Subsystem snapshots.

- ✅ **`ALLOWED_IO_ROOTS` Enforcement** — operations must target absolute paths within administrator-configured directories. HTTP transports hard-fail on startup if omitted.
- ✅ **Path Traversal Prevention** — blocks directory traversal sequences (`..`), null bytes, and query parameters in path inputs.
- ✅ **Symlink Awareness** — resolves and asserts `realpath` to prevent escaping the sandbox via symlink targets.
- ✅ **Hidden Files Protection** — rejects dotfiles and hidden directories (unless explicitly authorized by the root config).
- ✅ **Drive Letter Validation** — fully cross-platform compatible with strict Windows drive letter (`C:\`) and UNC path checking.

## 🧪 **Secure Code Mode Sandbox**

Code Mode executes user-provided JavaScript in a hardened `isolated-vm` sandbox. This includes multiple layers of defense-in-depth and fleet-standard restrictions. **These features are detailed prominently in the [README.md](README.md#maximize-efficiency-with-code-mode).**

### Enforce Engine-Level Restrictions

- ✅ **Strict V8 Isolate Boundary** — executes within a physically separate V8 isolate. It ensures native objects and prototypes cannot cross the boundary.
- ✅ **Memory & CPU Constraints** — enforced at the C++ level. This includes synchronous timeouts and strict heap limits.
- ✅ **API Bindings via Reference** — all MySQL API methods are securely injected into the isolate using `ivm.Reference` wrappers.

### Validate Code Statically

- ✅ **29 blocked patterns** — regex rules block `require()`, `import()`, `eval()`, `process`, and `__proto__`. They also block filesystem/network access and system commands.
- ✅ **Unicode & Comment Sanitization** — performs NFKC normalization and strips all comments before pattern validation to prevent regex evasion.
- ✅ **50KB code input limit** — prevents payload-based resource exhaustion.

### Protect the Runtime

- ✅ **RPC Quotas** — strict cap of 100 API calls per execution to prevent unbounded loops.
- ✅ **Execution timeout** — 30s hard limit (not configurable, enforced by the isolate engine) to prevent resource exhaustion.
- ✅ **Egress boundary enforcement** — streaming `JSON.stringify` serialization aborts mid-flight when exceeding size caps.
- ✅ **Rate limiting** — 60 executions per minute per client. Distributed across deployments via Redis if `REDIS_URL` is provided, with graceful in-memory fallback.
- ✅ **Readonly enforcement** — when `readonly: true`, write methods return structured errors instead of executing.
- ✅ **Audit logging** — every execution logged with UUID, client ID, metrics, and redacted code preview.
- ✅ **Admin scope** — Code Mode requires `admin` scope when OAuth is enabled.

## 🌐 **Secure HTTP Transports**

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

- ✅ **Built-in Rate Limiting** — 100 requests/minute per IP. Distributed across deployments via Redis if `REDIS_URL` is provided, with graceful in-memory fallback.
- ✅ **Health Endpoint Bypass** — `/health` bypasses limits to ensure reliable load balancer checks
- ✅ **Returns 429 Too Many Requests** with proper `Retry-After` headers when limits are exceeded
- ✅ **Slowloris DoS Protection** — configurable read timeouts via `MCP_REQUEST_TIMEOUT` and `MCP_HEADERS_TIMEOUT`

> **Reverse Proxy Note:** The server uses `req.socket.remoteAddress` for rate limiting. Behind a reverse proxy (e.g., nginx, Cloudflare Tunnel), all requests may share the same source IP. You must ensure your proxy forwards distinct client IPs. Alternatively, you can apply rate limiting at the proxy layer instead.

### Restrict Request Limits

- ✅ **Memory Exhaustion Protection** — Strict request bounds prevent memory exhaustion DoS

## 🔑 **Authenticate with OAuth 2.1**

Full OAuth 2.1 for production multi-tenant deployments is supported. **These enterprise security features are detailed prominently in the [README.md](README.md#secure-access-with-authentication).**

- ✅ **RFC 9728** Protected Resource Metadata (`/.well-known/oauth-protected-resource`)
- ✅ **RFC 8414** Authorization Server Discovery with caching
- ✅ **JWT validation** with JWKS support (TTL: 1 hour, configurable)
- ✅ **MySQL-specific scopes**: `read`, `write`, `admin`, `full`, `db:{name}`, `schema:{name}`, `table:{schema}:{table}`
- ✅ **Per-tool scope enforcement** via `AsyncLocalStorage` context threading

> **⚠️ HTTP without OAuth:** When OAuth is not configured, all scope checks are bypassed. If you expose the HTTP transport without enabling OAuth, any client has full unrestricted access. Always enable OAuth for production HTTP deployments.

## 🐳 **Harden Docker Containers**

### Run as Non-Root User

- ✅ **Dedicated user**: `app` (UID 1001) with minimal privileges
- ✅ **Restricted group**: `app` (GID 1001)
- ✅ **Restricted data directory**: `700` permissions

### Harden the Container

- ✅ **Minimal base image**: `node:24-alpine`
- ✅ **Multi-stage build**: Build dependencies not in production image
- ✅ **Production pruning**: `npm prune --omit=dev` after build
- ✅ **Health check**: Built-in `HEALTHCHECK` instruction (transport-aware for HTTP/SSE/stdio)
- ✅ **Process isolation** from host system

### Patch Dependencies

The Dockerfile patches npm-bundled transitive dependencies for Docker Scout compliance:

- ✅ `cross-spawn` — CVE-2024-21538
- ✅ `glob` — CVE-2025-64756
- ✅ `@isaacs/brace-expansion@5.0.1` — CVE-2025-5889
- ✅ `tar@7.5.19` — CVE-2026-26960
- ✅ `minimatch@10.2.5` — CVE-2026-27904, CVE-2026-27903

### Mount Volumes Securely

```bash
# Secure volume mounting
docker run -v ./data:/app/data:rw,noexec,nosuid,nodev writenotenow/mysql-mcp:latest
```

### Apply Resource Limits

```bash
# Apply resource limits
docker run --memory=1g --cpus=1 writenotenow/mysql-mcp:latest
```

## 🔐 **Secure Your Logs**

### Enable Audit Subsystem

- ✅ **Full JSONL Audit Trails** — comprehensive logging array capturing mutations, Code Mode executions, and system events
- ✅ **Session Token Estimates** — robust burn-rate tracking appended to log entries
- ✅ **Pre-Mutation Snapshots** — interceptor captures table states before destructive administration operations

### Redact Credentials

- ✅ **Sensitive fields automatically redacted** in logs: `password`, `secret`, `token`, `apikey`, `issuer`, `audience`, `jwksUri`, `credentials`, etc.
- ✅ **Recursive sanitization** for nested objects

### Prevent Log Injection

- ✅ **Control character sanitization** (ASCII 0x00-0x1F except tab/newline, 0x7F, C1 characters)
- ✅ **Prevents log forging** and escape sequence attacks

## 🔄 **Secure CI/CD Pipelines**

- ✅ **CodeQL analysis** — automated static analysis on push/PR
- ✅ **pnpm audit** — dependency vulnerability checking (audit-level: moderate)
- ✅ **Dependabot** — automated dependency update PRs (weekly for npm and GitHub Actions)
- ✅ **Secrets scanning** — dedicated workflow for leaked credential detection
- ✅ **E2E transport parity** — Playwright suite validates HTTP/SSE security behavior

## 🚨 **Follow Security Best Practices**

### Best Practices for Users

1. **Never commit database credentials** to version control — use environment variables
2. **Use OAuth 2.1 authentication** for HTTP transport in production — never expose HTTP transport without OAuth
3. **Restrict database user permissions** to minimum required
4. **Enable SSL** for database connections in production (`ssl=true` in connection string)
5. **Enable HSTS** when running over HTTPS (`--enable-hsts`)
6. **Configure CORS origins explicitly** — avoid wildcards
7. **Use resource limits** — apply Docker `--memory` and `--cpus` limits
8. **Apply rate limiting at the proxy layer** when deploying behind a reverse proxy
9. **Consider SHA-pinning** critical GitHub Actions in CI workflows for supply-chain defense-in-depth

### Best Practices for Developers

1. **Parameterized queries only** — never interpolate user input into SQL strings
2. **Zod validation** — all tool inputs validated via schemas at tool boundaries
3. **No secrets in code** — use environment variables (`.env` files are gitignored)
4. **Typed error classes** — descriptive messages with context; don't expose internals
5. **Regular updates** — keep Node.js and npm dependencies updated
6. **Security scanning** — regularly scan Docker images for vulnerabilities

## 📋 **Complete the Security Checklist**

- [x] Parameterized SQL queries throughout
- [x] Identifier sanitization (table, column, schema, index names)
- [x] Input validation via Zod schemas
- [x] Filesystem boundary sandbox (`ALLOWED_IO_ROOTS`) for all file I/O operations
- [x] Code Mode sandbox isolation (true separate V8 isolate via isolated-vm)
- [x] Code Mode V8 codeGeneration restrictions (eval/Function disabled at engine level)
- [x] Code Mode native prototype isolation (objects cannot cross isolate boundary)
- [x] Code Mode blocked patterns (29 static regex rules + Unicode/NFKC validation)
- [x] Code Mode RPC quotas (100 calls per execution)
- [x] Code Mode streaming egress boundary (abort serialization on oversized results)
- [x] Code Mode execution timeout (30s hard limit)
- [x] Code Mode rate limiting (60 executions/min, Redis-backed with in-memory fallback)
- [x] Code Mode audit logging
- [x] HTTP bounds limits
- [x] Configurable CORS with origin whitelist
- [x] Rate limiting (100 req/min per IP, Redis-backed with in-memory fallback)
- [x] Slowloris DoS timeouts (`MCP_REQUEST_TIMEOUT`, `MCP_HEADERS_TIMEOUT`)
- [x] DNS rebinding protection via Host header validation
- [x] Security headers (CSP, X-Content-Type-Options, X-Frame-Options, Cache-Control, Referrer-Policy, Permissions-Policy)
- [x] HSTS (opt-in)
- [x] OAuth 2.1 with JWT/JWKS validation (RFC 9728, RFC 8414)
- [x] MySQL-specific scope enforcement (`read`, `write`, `admin`, `full`, `db:*`, `schema:*`, `table:*:*`)
- [x] Per-tool scope enforcement via `AsyncLocalStorage`
- [x] Credential redaction in logs
- [x] Log injection prevention
- [x] Non-root Docker user
- [x] Multi-stage Docker build with production pruning
- [x] Transitive dependency CVE patching in Dockerfile
- [x] CI/CD security pipeline (CodeQL, pnpm audit, secrets scanning)
- [x] Structured error responses (no internal details leaked)
- [x] Comprehensive security documentation

## 🚨 **Report Security Issues**

| Version | Supported |
| ------- | --------- |
| 3.x.x   | ✅        |
| 2.x.x   | ✅        |
| 1.x.x   | ✅        |
| < 1.0   | ❌        |

If you discover a security vulnerability:

1. **Do not** open a public GitHub issue
2. **Email** security concerns to: **admin@adamic.tech**
3. **Include** detailed reproduction steps and potential impact
4. **Allow** reasonable time for a fix before public disclosure

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity

We appreciate responsible disclosure and will acknowledge your contribution in our release notes (unless you prefer to remain anonymous).

## 🔄 **Apply Security Updates**

- **Container updates**: Rebuild Docker images when base images are updated
- **Dependency updates**: Keep npm packages updated via `pnpm audit` and Dependabot
- **Database maintenance**: Run `OPTIMIZE TABLE` and `ANALYZE TABLE` regularly for optimal performance
- **Security patches**: Apply host system security updates

The mysql-mcp MySQL MCP server is designed with **security-first principles** to protect your databases while maintaining excellent performance and full MySQL capability.
