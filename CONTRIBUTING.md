# Contributing to mysql-mcp

Thank you for contributing to mysql-mcp. Help us build a robust, enterprise-grade AI-database integration. Your contributions make mysql-mcp faster, secure, and more powerful for mission-critical deployments.

## 🚀 Fast-Track Your First Contribution

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch** from `main`
4. **Make your changes** and test thoroughly
5. **Submit a pull request** with a clear description

## 🛠️ Prepare Your Development Environment

### Meet Prerequisites

- Node.js >= 24.0.0 (See `.node-version` for the pinned local development version)
- Bun (for executing repository automation scripts)
- Current pnpm version
- **Git** (for version control)
- **MySQL** (local instance or Docker)
- **Docker** (optional, for container testing)

### Develop Locally

```bash
# Clone your fork
git clone https://github.com/<your-github-username>/mysql-mcp.git
cd mysql-mcp

# Install dependencies
pnpm install

# Build TypeScript
pnpm run build

# Run the test suite
pnpm test

# Run the full quality check
pnpm run check   # Executes lint, typecheck, build, test, test:e2e
```

### Run the Server Locally

```bash
# Connect to a local MySQL instance via stdio
node dist/cli.js --transport stdio --mysql "mysql://mcp_user:secure_password@localhost:3306/testdb"

# HTTP transport (for testing with an MCP client)
node dist/cli.js --transport http --port 3000 --allowed-io-roots /path/to/data --mysql "mysql://mcp_user:secure_password@localhost:3306/testdb"
```

> **Connection string required.** The server requires a valid MySQL connection string. For local testing, use a `.env` file or pass the URI string via `--mysql`. You can also use individual environment variables. The `mcp-config-example.json` and `.env.example` files demonstrate this. Never commit credentials to version control.

### Develop with Docker

```bash
# Build the Docker image locally
docker build -f Dockerfile -t writenotenow/mysql-mcp-dev .

# Run with a connection string
docker run --rm -i -v ./data:/app/data writenotenow/mysql-mcp-dev --transport stdio --allowed-io-roots /app/data --mysql "mysql://mcp_user:secure_password@host.docker.internal:3306/testdb"
```

## 📋 Focus on High-Impact Contribution Goals

We especially welcome contributions in these areas:

### Tackle High Priority Goals

- **Bug fixes** and stability improvements
- **Performance improvements** (faster tool dispatch, reduced overhead, connection pool tuning)
- **New tools** that extend MySQL capabilities within existing groups
- **Better error messages** with actionable remediation hints

### Address Medium Priority Goals

- **Enhanced Code Mode** `isolated-vm` operations and sandbox capabilities
- **Additional MySQL feature coverage** (CTEs, window functions, JSON improvements)
- **Documentation improvements** and Playwright end-to-end examples

### Build Future Features

- **New tool groups** for specialized MySQL workflows
- **Additional MySQL ecosystem integrations**
- **Performance benchmarks** for new hot paths
- **IDE-specific integrations** beyond MCP

## 🧪 Guarantee Reliability Through Testing

> **⚠️ IMPORTANT:** The file `test-server/scripts/test-manifest.ts` is the single source of truth for generating markdown tests. Manual edits to generated spec files are strictly forbidden.

### Run Automated Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm run test:coverage

# Run a specific test file
pnpm run test src/__tests__/your-test-file.test.ts

# Run benchmarks
pnpm run bench
```

### Run Quality Checks

```bash
# Lint + type check (required before submitting)
pnpm run check   # Executes lint, typecheck, build, test, test:e2e

# Or individually
pnpm run lint        # ESLint only
pnpm run typecheck   # TypeScript strict-mode type checking
```

### Run End-to-End Tests

The Playwright E2E suite validates the HTTP transport. This includes Streamable HTTP endpoints. It also includes stateless HTTP architecture:

```bash
pnpm run test:e2e
```

### Test Manually with MCP

Add your local build to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mysql-mcp-dev": {
      "command": "node",
      "args": [
        "/absolute/path/to/your/mysql-mcp/dist/cli.js",
        "--transport",
        "stdio",
        "--mysql",
        "mysql://mcp_user:secure_password@localhost:3306/testdb"
      ]
    }
  }
}
```

### Test with Docker

```bash
# Build and run locally
docker build -f Dockerfile -t writenotenow/mysql-mcp-dev .
docker run --rm -i -v ./data:/app/data writenotenow/mysql-mcp-dev --transport stdio --allowed-io-roots /app/data --mysql "mysql://mcp_user:secure_password@host.docker.internal:3306/testdb"
```

## 📝 Maintain Quality with Coding Standards

### Follow TypeScript Code Style

- **Strict mode** — `tsconfig.json` enforces strict TypeScript
- **ESLint** — Run `pnpm run lint` to check, `pnpm run lint:fix` to auto-fix (when available)
- **Prettier** — Formatting is handled automatically during the release workflow
- **Type safety** — Avoid `any` (use `unknown` instead); use proper types, Zod schemas, and prefer union types over enums
- **Modularity** — Keep files concise; split into sub-modules when necessary
- **Error handling** — Use structured `{success, error, code, category, suggestion, recoverable}` responses in tool handlers

### Name Files Consistently

All files and directories use **kebab-case** (lowercase with dashes):

- ✅ `database-adapter.ts`, `tool-filter.ts`, `pool-manager/`
- ❌ `DatabaseAdapter.ts`, `toolFilter.ts`

### Handle Errors Structurally

Every tool must return structured error responses — never raw exceptions:

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

Error logic should leverage the `MySQLMcpError` hierarchy. Our Auto-refinement system automatically maps generic codes to specific ones. It also populates suggestions. Catch at the handler boundary and return `formatHandlerErrorResponse(error)` for JSON compliance. Always propagate stack traces — don't swallow errors.

### Validate Your Inputs

- **Dual-Schema Pattern** — Tools use a plain `z.object()` Base schema for visibility. A `z.preprocess()` wrapper supports aliases without breaking JSON Schema generation.
- **Zod schemas** validate parameters with explicit coercion controls. Do not use aggressive `z.coerce.number()`.
- Output schemas are strictly defined. This guarantees agents receive deterministic MCP-compliant structures.
- Invalid inputs must return structured errors. The `formatHandlerErrorResponse()` helper handles this without raw validation messages.
- SQL injection is prevented via **parameter binding**. Never interpolate user input into SQL strings.

### Log Structurally

Use the centralized logger with structured payloads. Include: `module`, `operation`, `entityId`, `context`, and `stack` (for errors). Severity levels: `error`, `warn`, `info`, `debug`.

### Follow Observability and Infrastructure Standards

- **Datadog Constraints** — Use `pup` CLI for authentication. Avoid duplicate autodiscovery configurations. Add standard tracking labels (`com.datadoghq.tags.env`, `com.datadoghq.tags.service`, `com.datadoghq.tags.version`) to your containers. Enforce `stop_grace_period: 30s`, `mem_limit: 1536m`, and OpenMetrics timeouts of `10s`. Use `DD_HOSTNAME` and native `/etc/docker/daemon.json` cgroup configurations (`"default-cgroupns-mode": "host"`). Disable `DD_EXTRA_PERFORMANCE_METRICS`.
- **OpenTelemetry Standards** — Telemetry implementations must adhere to the official OTel `gen_ai.*` semantic conventions. Use auto-instrumentation when possible. Ensure `traceparent` and `tracestate` propagation. Utilize batch processors and ensure logs are formatted as JSON logs.
- **Dual Audit Log Architecture** — Primary MCP server writes to mcp-audit.jsonl. Grafana Alloy ingests mcp-audit.jsonl and routes to Loki. Exporter reads from mcp-audit.jsonl via AUDIT_LOG_PATH to compute metrics. Exporter isolates its own writes by setting `--audit-log` to exporter-audit.jsonl. The metrics server and exporter are the exact same process operating on port 3000, preventing any port contention.
- **Exporter Healthcheck**: `wget --spider -q http://127.0.0.1:3000/metrics`

### Consider Docker Optimization

- **Multi-stage builds** — Keep images lean
- **Security** — Run as non-root user, minimal privileges
- **Multi-platform** — Test on both amd64 and arm64 when possible
- **Documentation** — Update Docker guides if needed

## 🔧 Expand Capabilities with New Tools

mysql-mcp organizes tools into various functional groups.

When adding a new tool:

1. **Define tool input and output schemas** using Zod in the appropriate src/adapters/mysql/schemas/ group.
2. **Implement the handler** in the corresponding adapter directory under `src/adapters/mysql/tools/`
3. **Add structured error handling** by letting the handler return `formatHandlerErrorResponse()` when exceptions are caught
4. **Write meaningful Vitest tests** and update E2E spec files if making systemic changes
5. **Add the tool to the group's help resource** (the markdown file under `src/constants/instructions/markdown/`)
6. **Verify OAuth Scope**. Ensure the new tool aligns with its group's base scope.

## 🐛 Improve Stability by Reporting Bugs

When reporting bugs, please include:

1. **Environment details** (OS, Node.js version, pnpm version)
2. **Steps to reproduce** the issue
3. **Expected vs actual behavior**
4. **MySQL version** and relevant extensions enabled
5. **MCP client details** (Cursor version, Claude Desktop, configuration)
6. **Relevant logs** or error messages

Use our [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md) for consistency.

## 💡 Drive Innovation with Feature Requests

For new features, please provide:

1. **Use case description** — What problem does this solve?
2. **Proposed solution** — How should it work?
3. **Tool group fit** — Which group does this belong to? Does it need a new one?
4. **Alternatives considered** — What other approaches did you think about?
5. **Implementation notes** — Any technical considerations

Use our [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md).

## 🔄 Deliver Value via Pull Requests

### Check Before Submitting

- [ ] **Fork** the repository and create a feature branch
- [ ] **Test** your changes (`pnpm run check`)
- [ ] **Update documentation** if you changed APIs or behavior
- [ ] **Add examples** for new features
- [ ] **Check** that existing functionality still works

### Write a Good PR Description

- **Summary** of changes made
- **Testing** performed (how did you verify it works?)
- **Breaking changes** (if any)
- **Related issues** (fixes #123)

### Follow the Review Process

1. **Automated checks** must pass (lint, typecheck, tests)
2. **Maintainer review** — we'll provide feedback
3. **Address feedback** — make requested changes
4. **Merge** — once approved, we'll merge your PR

### Pass CI Checks

| Workflow             | What It Does                                 |
| -------------------- | -------------------------------------------- |
| **Lint & Test**      | ESLint, TypeScript strict-mode, Vitest suite |
| **CodeQL**           | Static analysis for security vulnerabilities |
| **Secrets scanning** | Scans for exposed credentials and API keys   |
| **Trivy**            | Scans Docker images for vulnerabilities      |

All checks must pass before merge. Security steps **hard-fail on fixable issues** — this is intentional.

## 📄 Streamline Releases with Automated Changelogs

The project uses `bun ./.agents/scripts/commit.ts` for all commits with explicit file staging. **Do not use raw `git commit`.**

Log all changes directly via the wrapper using git trailers. We use an automated workflow that generates the changelog from commit history.

Example commit message:
```text
feat: add Code Mode limits

Changelog-Added: Implement maximum result size for Code Mode executions.
```

Available trailers:
- `Changelog-Added` — new features or tools
- `Changelog-Changed` — changes to existing functionality
- `Changelog-Fixed` — bug fixes
- `Changelog-Removed` — removed features
- `Changelog-Security` — vulnerability fixes

> **Do not edit `CHANGELOG.md` directly** — it is assembled automatically during the release process.

## 🎯 Accelerate Workflows with Development Tips

### Work with MCP

- **Test with a real MySQL instance** — behavior varies across versions and configuration
- **Check tool responses** — Ensure JSON responses are well-formed
- **Output schemas** — All tools have Zod output schemas; error responses must pass validation
- **Dual-schema pattern** — Base schemas for visibility, `z.preprocess()` wrappers for internal handling.

### Understand the Architecture

The `mysql-mcp` project is organized into modular directories under `src/`:

- `src/adapters/` — Database driver adapters and comprehensive suite of tool implementations using dual-schema validation.
- `src/audit/` — JSONL forensic logging and token tracking
- `src/auth/` — OAuth authentication flow
- `src/cli/` — CLI argument parsing and help output
- `src/codemode/` — Isolated-vm sandbox execution and TS type injection
- `src/constants/` — Static strings, error codes, and configuration defaults
- `src/filtering/` — Meta-group tool shortcuts and filtering logic
- `src/logging/` — Console logging utilities
- `src/observability/` — MCP resources and prompts for database diagnostics
- `src/pool/` — MySQL connection pool management
- `src/progress/` — Real-time progress notifications for long-running tasks
- `src/server/` — Core MCP server initialization and request handling
- `src/transports/` — HTTP transport layer supporting MCP v2 stateless architecture (NodeStreamableHTTPServerTransport)
- `src/types/` — Shared TypeScript interfaces and Zod schemas
- `src/utils/` — Helper functions and common utilities

### Use Available Scripts

| Script                  | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `pnpm run build`         | Production build via tsup                            |
| `pnpm run dev`           | Watch mode (fast unbundled hot reloads via tsx)      |
| `pnpm run check`         | **Quality gate** — lint, typecheck, build, test, test:e2e (run before PRs) |
| `pnpm run lint`          | ESLint only                                          |
| `pnpm run typecheck`     | TypeScript strict-mode type checking                 |
| `pnpm run test:zod`      | Validate Zod schemas                                 |
| `pnpm run generate:instructions` | Generate tool instructions                   |
| `pnpm test`              | Run all unit tests (Vitest)                          |
| `pnpm run test:coverage` | Tests with V8 coverage report                        |
| `pnpm run test:e2e`      | Playwright end-to-end tests (HTTP transport)     |
| `pnpm run bench`         | Performance benchmarks (tinybench via Vitest)        |

### Run Benchmarks

If your change touches a hot path, run benchmarks. This verifies you haven't introduced a regression:

```bash
pnpm run bench
```

**Benchmark Baselines:**
- parseToolFilter: ~32,000-62,000 ops/sec
- CodeModeSandbox.create cold start: ~2.78M ops/sec
- Sandbox dispose: ~2.37M ops/sec
- SandboxPool init: ~109k ops/sec
- Set.has tool check: ~4.4M ops/sec
- Map.get reverse lookup: ~4.5M ops/sec
- Map.get URI match: ~5.1M ops/sec
- validateCode safe short: ~173k ops/sec
- validateCode blocked: ~298k ops/sec
- checkRateLimit: ~205k ops/sec
- sanitizeResult small payload: ~1.49M ops/sec
- prompt schema parse: ~1.3M ops/sec

## 🔐 Safeguard the Community by Reporting Vulnerabilities

If you discover a security vulnerability, **do not** open a public issue. Please follow our [Security Policy](SECURITY.md) and report it to **admin@adamic.tech**.

When contributing code, follow these security practices:

- **Parameter binding** for all SQL — never string interpolation
- **Input validation** via Zod schemas at tool boundaries
- **No secrets in code** — use environment variables (`.env` files are gitignored)
- **Typed error classes** with descriptive messages — don't expose internal details to end users
- **Transport Security** — Preserve DNS rebinding protection and Slowloris DoS timeouts in HTTP layers

## 🤝 Collaborate with the Community

- **Be respectful** — Follow our [Code of Conduct](CODE_OF_CONDUCT.md)
- **Ask questions** — Use GitHub Issues for discussion
- **Share ideas** — Feature requests and feedback welcome
- **Help others** — Answer questions and review PRs

## 📞 Resolve Blockers Quickly

- **GitHub Issues** — Bug reports and feature requests
- **Documentation** — Check [README.md](README.md), [Wiki](https://github.com/neverinfamous/mysql-mcp/wiki), and Docker guides first
- **Email** — **admin@adamic.tech**

## 🏆 Build Your Open Source Profile

Contributors are recognized in:

- **Release notes** — Major contributions highlighted
- **README** — Contributor acknowledgments
- **Git history** — Your commits are permanent record

Thank you for helping make mysql-mcp better for the developer community! 🚀
