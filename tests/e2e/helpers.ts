/**
 * Shared E2E test helpers for mysql-mcp payload contract tests.
 *
 * Provides createClient / callToolAndParse / expectSuccess utilities
 * matching the mysql-mcp SSE transport pattern, plus startServer /
 * stopServer for isolated server instances with custom CLI flags.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

export const BASE_URL = "http://127.0.0.1:3103";
export const SSE_CONNECT_TIMEOUT_MS = 3000;
export const HEALTH_QUERY = "SELECT 1";

export const TIMEOUTS = {
  SHORT: 3000,
  DEFAULT: 60000,
  LONG: 120_000,
};

export const SEED_TABLES = {
  BASIC_TYPES: "_e2e_basic_types",
  DATE_TYPES: "_e2e_date_types",
  JSON_TYPES: "_e2e_json_types",
  UUID_TYPES: "_e2e_uuid_types",
};

export const SCOPE_ERROR_MSG = "insufficient scope";
export const BACKUP_DISABLED_PATTERN = /not enabled|not available/i;

export const TEST_DB_NAME = "testdb";

/** MCP protocol versions */
export const MCP_PROTOCOL_STREAMABLE = "2025-03-26";
export const MCP_PROTOCOL_LEGACY = "2024-11-05";

/** Common headers for raw MCP HTTP requests */
export const MCP_JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
} as const;

export function getDefaultMysqlUrl(): string {
  return process.env.MYSQL_URL || 'mysql://root:root@127.0.0.1:6446/testdb';
}

/**
 * Generate a unique temp file path for an audit log.
 * Exported so individual spec files don't need to duplicate this helper.
 */
export function auditLogPath(prefix: string, suffix: string): string {
  return join(tmpdir(), `mysql-${prefix}-e2e-${suffix}-${Date.now()}.jsonl`);
}

// ─── Client creation ────────────────────────────────────────────────────────

/**
 * Create a connected MCP client via SSE transport.
 *
 * @param baseURL - Server base URL. Defaults to `http://127.0.0.1:3103`.
 */
export async function createClient(baseURL?: string): Promise<Client> {
  const url = new URL(`${baseURL ?? BASE_URL}/mcp`);
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const transport = new StreamableHTTPClientTransport(url);
      const client = new Client(
        { name: "payload-test-client", version: "1.0.0" },
        { capabilities: {} },
      );
      await client.connect(transport);
      return client;
    } catch {
      if (attempt === maxRetries - 1)
        throw new Error(
          `Failed to connect to ${url.toString()} after ${maxRetries} attempts`,
        );
      await delay(500);
    }
  }

  throw new Error("Unreachable");
}

// ─── Tool call helpers ──────────────────────────────────────────────────────

/**
 * Call a tool and return the parsed JSON payload.
 */
import { z } from "zod";

export const McpPayloadSchema = z.object({
  success: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
  _meta: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export type McpPayload = z.infer<typeof McpPayloadSchema>;

export async function callToolAndParse(
  client: Client,
  toolName: string,
  args: Record<string, unknown> = {},
  timeoutMs: number = TIMEOUTS.LONG
): Promise<McpPayload> {
  const response = await client.callTool(
    { name: toolName, arguments: args },
    { timeout: timeoutMs }
  );

  expect(Array.isArray(response.content)).toBe(true);
  const content = response.content as Array<{ type: string; text?: string }>;
  expect(content.length).toBeGreaterThan(0);

  const first = content[0]!;
  expect(first.type).toBe("text");

  try {
    const raw = JSON.parse(first.text!);
    return McpPayloadSchema.parse(raw);
  } catch (err: unknown) {
    throw new Error(
      `Failed to parse tool response as JSON. Response text was:\n${first.text}\n\nOriginal error: ${(err as Error).message}`,
    );
  }
}

export async function skipIfSuperReadOnly(client: Client): Promise<void> {
  let isReadOnly = false;
  try {
    const response = await client.callTool({ name: "mysql_read_query", arguments: { query: "SELECT @@global.super_read_only as ro;" } });
    if (response.content.some(c => c.type === 'text' && c.text?.includes('"ro": 1'))) {
      isReadOnly = true;
    }
  } catch (e) {
    // ignore MCP connection errors
  }
  
  if (isReadOnly) {
    test.skip(true, 'Skipped because Router is in super_read_only mode');
  }
}

/**
 * Call a tool and return the raw MCP response (without parsing).
 * Useful for inspecting isError, checking raw text, or handling non-JSON.
 */
export async function callToolRaw(
  client: Client,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number = TIMEOUTS.LONG
): Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}> {
  const response = await client.callTool(
    { name: toolName, arguments: args },
    { timeout: timeoutMs }
  );
  return response as {
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  };
}

// ─── Assertion helpers ──────────────────────────────────────────────────────

/**
 * Assert payload.success is truthy, with a descriptive error message on failure.
 */
export function expectSuccess(payload: Record<string, unknown>): void {
  const msg = !payload.success
    ? `Tool error: ${JSON.stringify(payload, null, 2)}`
    : "";
  expect(payload.success, msg).toBe(true);
}

/**
 * Assert that a payload IS a structured handler error.
 * Checks for `{ success: false, error: "..." }` shape.
 */
export function expectHandlerError(
  payload: Record<string, unknown>,
  expectedMessage?: string | RegExp,
): void {
  expect(
    payload.success,
    `Expected handler error, got: ${JSON.stringify(payload)}`,
  ).toBe(false);
  expect(
    typeof payload.error,
    `Missing error string in: ${JSON.stringify(payload)}`,
  ).toBe("string");

  if (expectedMessage instanceof RegExp) {
    expect(payload.error as string).toMatch(expectedMessage);
  } else if (typeof expectedMessage === "string") {
    expect((payload.error as string).toLowerCase()).toContain(
      expectedMessage.toLowerCase(),
    );
  }
}

// ─── Server process management ──────────────────────────────────────────────

const serverProcesses = new Map<number, ChildProcess>();

/**
 * Start a mysql-mcp server on a custom port.
 *
 * Spawns `node dist/cli.js` with HTTP transport and waits
 * for the /health endpoint to respond.
 *
 * @param port - Port to run the server on.
 * @param extraArgs - Additional CLI arguments (e.g., `--audit-log`).
 * @param label - Debug label for error messages.
 * @param extraEnv - Additional environment variables to merge (e.g., `{ MCP_RATE_LIMIT_MAX: "5" }`).
 */
export async function startServer(
  port: number,
  extraArgs: string[] = [],
  label = "test",
  extraEnv: Record<string, string> = {},
): Promise<void> {
  const hasMysql = extraArgs.includes("--mysql");
  const proc = spawn(
    "node",
    [
      "dist/cli.js",
      "--server-host",
      "127.0.0.1",
      "--transport",
      "http",
      "--port",
      String(port),
      ...(!hasMysql ? ["--mysql", getDefaultMysqlUrl()] : []),
      ...extraArgs,
    ],
    {
      cwd: process.cwd(),
      stdio: "pipe",
      env: {
        ...process.env,
        MCP_RATE_LIMIT_MAX: "10000",
        ALLOWED_IO_ROOTS: `C:/temp,C:/tmp,/tmp,${tmpdir()}`,
        ...extraEnv,
      },
    },
  );

  proc.stderr?.on("data", (data) => {
    console.error(`[${label}:${port}] STDERR: ${String(data)}`);
  });
  proc.stdout?.on("data", (data) => {
    console.log(`[${label}:${port}] STDOUT: ${String(data)}`);
  });

  serverProcesses.set(port, proc);

  // Wait for server readiness
  const maxAttempts = 120;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      if (res.ok) return;
    } catch {
      // Not ready yet
    }
    await delay(500);
  }

  throw new Error(
    `[${label}] Server on port ${port} did not start within ${maxAttempts * 500}ms`,
  );
}

/**
 * Stop a server started by `startServer()`.
 */
import { execSync } from "node:child_process";

export function stopServer(port: number): void {
  const proc = serverProcesses.get(port);
  if (proc) {
    if (process.platform === "win32" && proc.pid) {
      try {
        execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: "ignore" });
      } catch {
        // ignore
      }
    } else {
      proc.kill("SIGKILL");
    }
    serverProcesses.delete(port);
  }
}

/**
 * Clean up all files generated by the audit logger and SystemDb.
 */
export async function cleanupAuditFiles(logPath: string): Promise<void> {
  const sqlitePath = logPath.replace(/\.jsonl$/, "") + ".sqlite";
  
  const files = [
    logPath,
    sqlitePath,
    `${sqlitePath}-shm`,
    `${sqlitePath}-wal`,
    // Rotation files
    ...Array.from({length: 10}, (_, i) => `${logPath}.${i+1}`)
  ];

  for (const file of files) {
    try {
      await rm(file, { force: true });
    } catch {
      // Ignore
    }
  }
}

