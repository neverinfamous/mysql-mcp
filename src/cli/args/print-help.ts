/**
 * Auto-generated CLI help text — derived from CLI_OPTIONS registry.
 */
import pc from "picocolors";

import { CLI_OPTIONS, type CliOptionGroup } from "./cli-options.js";
import type { CliOptionDef } from "./cli-options.js";

// ── Group display order and labels ─────────────────────────────

const GROUP_ORDER: readonly CliOptionGroup[] = [
  "connection",
  "pool",
  "server",
  "oauth",
  "security",
  "audit",
  "io",
  "other",
] as const;

const GROUP_LABELS: Record<CliOptionGroup, string> = {
  connection: "Connection Options",
  pool: "Pool Options",
  server: "Server Options",
  oauth: "OAuth Options",
  security: "Authentication & Security",
  audit: "Audit Options",
  io: "I/O Options",
  other: "Other",
};

// ── Additional env vars not backed by CLI flags ────────────────

const EXTRA_ENV_VARS: readonly (readonly [string, string])[] = [
  ["MYSQL_ROUTER_URL", "MySQL Router URL"],
  ["MYSQL_ROUTER_USER", "MySQL Router user"],
  ["MYSQL_ROUTER_PASSWORD", "MySQL Router password"],
  ["MYSQL_ROUTER_INSECURE", "Bypass Router TLS verification (true/false)"],
  ["PROXYSQL_HOST", "ProxySQL host"],
  ["PROXYSQL_PORT", "ProxySQL port"],
  ["PROXYSQL_USER", "ProxySQL user"],
  ["PROXYSQL_PASSWORD", "ProxySQL password"],
  ["MYSQLSH_PATH", "Path to MySQL Shell executable"],
  ["MYSQL_XPORT", "MySQL X Protocol port (default 33060)"],
  ["CODEMODE_ISOLATION", "Code mode isolation level"],
  ["CODEMODE_MAX_RESULT_SIZE", "Max Code Mode result payload in bytes"],
  ["METADATA_CACHE_TTL_MS", "Cache TTL for schema metadata"],
  ["MYSQLMCP_PORT", "Port for mysql-mcp"],
];

// ── Alignment constant ────────────────────────────────────────

const LEFT_COL_WIDTH = 30;

// ── Helpers ────────────────────────────────────────────────────

/** Derive a metavar hint from the option definition. */
function getMetavar(key: string, def: CliOptionDef): string {
  if (def.type === "boolean") return "";

  if (key === "mysql") return "<url>";
  if (key === "config") return "<path>";
  if (key === "transport") return "<type>";
  if (key === "port") return "<port>";
  if (key === "metrics-export") return "[format]";

  if (key.endsWith("-host")) return "<host>";
  if (key.endsWith("-port")) return "<port>";
  if (key.endsWith("-user")) return "<user>";
  if (key.endsWith("-password")) return "<pass>";
  if (key.endsWith("-database")) return "<db>";
  if (key.includes("uri") || key.includes("url") || key.includes("issuer"))
    return "<url>";
  if (key.includes("token")) return "<token>";
  if (key.includes("timeout")) return "<ms>";
  if (key.includes("tolerance")) return "<s>";
  if (key.includes("size") || key.includes("limit")) return "<n>";
  if (key.includes("path") || key.includes("log")) return "<path>";
  if (key.includes("filter")) return "<filter>";
  if (key.includes("level")) return "<level>";
  if (key.includes("name")) return "<name>";
  if (key.includes("roots")) return "<paths>";
  if (key.includes("audience")) return "<aud>";

  return "<value>";
}

/** Format a single option line. */
function formatOption(key: string, def: CliOptionDef): string {
  let left = `  --${key}`;
  if (def.short) left += `, -${def.short}`;

  const metavar = getMetavar(key, def);
  if (metavar) left += ` ${metavar}`;

  // Pad to alignment width
  const padding = Math.max(1, LEFT_COL_WIDTH - left.length);
  let right = def.description;
  if (def.defaultValue) {
    right += ` ${pc.dim(`(default: ${def.defaultValue})`)}`;
  }

  return `${left}${" ".repeat(padding)}${right}`;
}

/** Collect options for a given group in registry order. */
function optionsForGroup(group: CliOptionGroup): [string, CliOptionDef][] {
  return Object.entries(CLI_OPTIONS).filter(([, def]) => def.group === group);
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Print CLI help text to stderr.
 */
export function printHelp(): void {
  const lines: string[] = [];

  lines.push("");
  lines.push(`${pc.bold("mysql-mcp")} - Enterprise MySQL MCP Server`);
  lines.push("");
  lines.push(`Usage: mysql-mcp [options]`);

  // ── Option groups ──────────────────────────────────────────
  for (const group of GROUP_ORDER) {
    const opts = optionsForGroup(group);
    if (opts.length === 0) continue;

    lines.push("");
    lines.push(`${pc.bold(GROUP_LABELS[group])}:`);
    for (const [key, def] of opts) {
      lines.push(formatOption(key, def));
    }
  }

  // ── Environment Variables ──────────────────────────────────
  lines.push("");
  lines.push(`${pc.bold("Environment Variables")}:`);

  // First: env vars that map to CLI flags
  for (const [, def] of Object.entries(CLI_OPTIONS)) {
    if (!def.envVar) continue;
    const left = `  ${def.envVar}`;
    const padding = Math.max(1, LEFT_COL_WIDTH - left.length);
    lines.push(`${left}${" ".repeat(padding)}${def.description}`);
  }

  // Then: extra env vars with no CLI flag equivalent
  for (const [envVar, description] of EXTRA_ENV_VARS) {
    const left = `  ${envVar}`;
    const padding = Math.max(1, LEFT_COL_WIDTH - left.length);
    lines.push(`${left}${" ".repeat(padding)}${description}`);
  }

  lines.push("");

  process.stderr.write(lines.join("\n") + "\n");
}
