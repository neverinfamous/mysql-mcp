/**
 * E2E Tests: Audit Log
 *
 * Spawns a server with --audit-log enabled and verifies:
 * 1. Write-scoped tool calls produce JSONL audit entries on disk
 * 2. Read-scoped tool calls (core group) are NOT logged
 * 3. mysql://audit resource returns recent entries
 * 4. --audit-redact omits tool arguments from entries
 * 5. --audit-reads logs read-scoped tools with compact entries
 * 6. Audit entries include tokenEstimate > 0
 * 7. mysql://audit resource includes summary block
 * 8. Audit log correctly ignores corrupted entries
 *
 * NOTE: The audit interceptor only logs tools whose group maps to
 * "write" or "admin" scope (see auth/scopes.ts). The "core" group
 * (which includes mysql_write_query) maps to "read" scope, so we use
 * transaction tools (write scope) to generate audit entries.
 */

import { readFile, rm, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";

import { test, expect } from "@playwright/test";
import {
  startServer,
  stopServer,
  createClient,
  callToolRaw,
  callToolAndParse,
} from "./helpers.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

// Force sequential execution to prevent parallel workers from colliding on manual ports/files
test.describe.configure({ mode: "serial", timeout: 120_000 });

const AUDIT_PORT_BASE = 3150;

/** Tool filter that includes core+transactions (write-scope) and monitoring (read-scope) */
const AUDIT_FILTER = "core,transactions,monitoring";

/** Generate a unique temp file path for each test */
function auditLogPath(suffix: string): string {
  return join(tmpdir(), `mysql-audit-e2e-${suffix}-${Date.now()}.jsonl`);
}

/**
 * Retry reading the audit log file until it exists and has entries.
 * The server runs in a separate process with an async flush buffer,
 * so we need to poll.
 */
async function readAuditLogWithRetry(
  path: string,
  maxAttempts = 15,
  intervalMs = 500,
): Promise<Array<Record<string, unknown>>> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const content = await readFile(path, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);
      if (lines.length > 0) {
        return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
      }
    } catch {
      // File doesn't exist yet — keep trying
    }
    await delay(intervalMs);
  }
  throw new Error(
    `Audit log file ${path} not found or empty after ${maxAttempts * intervalMs}ms`,
  );
}

test.describe("Audit Log", () => {
  test("write-scoped tool calls produce audit entries", async () => {
    const port = AUDIT_PORT_BASE;
    const logPath = auditLogPath("write");

    await startServer(
      port,
      ["--audit-log", logPath, "--tool-filter", AUDIT_FILTER],
      "audit-write",
    );

    let client: Client | undefined;
    try {
      client = await createClient(`http://localhost:${port}`);

      // Begin a transaction (write scope) — should be logged
      await callToolRaw(client, "mysql_transaction_begin", {});

      const entries = await readAuditLogWithRetry(logPath);
      expect(entries.length).toBeGreaterThanOrEqual(1);

      const entry = entries[entries.length - 1]!;
      expect(entry.tool).toBe("mysql_transaction_begin");
      expect(entry.category).toBe("write");
      expect(entry.success).toBe(true);
      expect(typeof entry.timestamp).toBe("string");
      expect(typeof entry.durationMs).toBe("number");
      expect(entry.args).toBeDefined();

      // Rollback the transaction to clean up
      const beginParsed = await callToolAndParse(
        client,
        "mysql_transaction_begin",
        {},
      );
      if (beginParsed.transactionId) {
        await callToolRaw(client, "mysql_transaction_rollback", {
          transactionId: beginParsed.transactionId,
        });
      }
    } finally {
      if (client) await client.close();
      stopServer(port);
      await rm(logPath, { force: true });
    }
  });

  test("read-scoped tool calls are NOT logged", async () => {
    const port = AUDIT_PORT_BASE + 1;
    const logPath = auditLogPath("readonly");

    await startServer(
      port,
      ["--audit-log", logPath, "--tool-filter", AUDIT_FILTER],
      "audit-readonly",
    );

    let client: Client | undefined;
    try {
      client = await createClient(`http://localhost:${port}`);

      // Execute only read-scope tools (monitoring group = read scope)
      await callToolRaw(client, "mysql_show_status", {});
      await callToolRaw(client, "mysql_pool_stats", {});

      // Wait generously — longer than the flush interval
      await delay(2000);

      // Audit log file should not exist (no write/admin scoped tools invoked)
      let fileExists = false;
      try {
        await readFile(logPath, "utf-8");
        fileExists = true;
      } catch {
        // Expected — file should not exist
      }
      expect(fileExists).toBe(false);
    } finally {
      if (client) await client.close();
      stopServer(port);
      await rm(logPath, { force: true });
    }
  });

  test("mysql://audit resource returns recent entries", async () => {
    const port = AUDIT_PORT_BASE + 2;
    const logPath = auditLogPath("resource");

    await startServer(
      port,
      ["--audit-log", logPath, "--tool-filter", AUDIT_FILTER],
      "audit-resource",
    );

    let client: Client | undefined;
    try {
      client = await createClient(`http://localhost:${port}`);

      // Create an audit entry via a write-scope tool
      await callToolRaw(client, "mysql_transaction_begin", {});

      // Wait for the server's async buffer to flush to disk
      await readAuditLogWithRetry(logPath);

      // Read the audit resource — returns { summary: {...}, recent: [...] }
      const resource = await client.readResource({ uri: "mysql://audit" });
      expect(resource.contents).toBeDefined();
      expect(resource.contents.length).toBeGreaterThan(0);

      const text = (resource.contents[0] as { text: string }).text;
      const body = JSON.parse(text) as {
        summary: Record<string, unknown>;
        recent: Array<Record<string, unknown>>;
      };
      expect(body.recent.length).toBeGreaterThanOrEqual(1);
      expect(body.summary.entries).toBeGreaterThanOrEqual(1);
      expect(body.recent[body.recent.length - 1]!.tool).toBe(
        "mysql_transaction_begin",
      );
    } finally {
      if (client) await client.close();
      stopServer(port);
      await rm(logPath, { force: true });
    }
  });

  test("--audit-redact omits tool arguments from entries", async () => {
    const port = AUDIT_PORT_BASE + 3;
    const logPath = auditLogPath("redact");

    await startServer(
      port,
      ["--audit-log", logPath, "--audit-redact", "--tool-filter", AUDIT_FILTER],
      "audit-redact",
    );

    let client: Client | undefined;
    try {
      client = await createClient(`http://localhost:${port}`);

      // Begin a transaction (write scope) with redact enabled
      await callToolRaw(client, "mysql_transaction_begin", {});

      const entries = await readAuditLogWithRetry(logPath);
      expect(entries.length).toBeGreaterThanOrEqual(1);

      const entry = entries[entries.length - 1]!;
      expect(entry.tool).toBe("mysql_transaction_begin");
      expect(entry.success).toBe(true);
      // Args should be redacted (undefined / not present)
      expect(entry.args).toBeUndefined();
    } finally {
      if (client) await client.close();
      stopServer(port);
      await rm(logPath, { force: true });
    }
  });

  test("--audit-reads logs read-scoped tools with compact entries", async () => {
    const port = AUDIT_PORT_BASE + 4;
    const logPath = auditLogPath("reads");

    await startServer(
      port,
      ["--audit-log", logPath, "--audit-reads", "--tool-filter", AUDIT_FILTER],
      "audit-reads",
    );

    let client: Client | undefined;
    try {
      client = await createClient(`http://localhost:${port}`);

      // Execute a read-scope tool (monitoring group = read scope)
      await callToolRaw(client, "mysql_show_status", {});

      const entries = await readAuditLogWithRetry(logPath);
      expect(entries.length).toBeGreaterThanOrEqual(1);

      // Find the read entry
      const readEntry = entries.find((e) => e.tool === "mysql_show_status");
      expect(readEntry).toBeDefined();
      expect(readEntry!.category).toBe("read");
      expect(readEntry!.success).toBe(true);

      // Compact format: no args, user, scopes
      expect(readEntry!.args).toBeUndefined();
      expect(readEntry!.user).toBeUndefined();
      expect(readEntry!.scopes).toBeUndefined();
    } finally {
      if (client) await client.close();
      stopServer(port);
      await rm(logPath, { force: true });
    }
  });

  test("audit entries include tokenEstimate > 0", async () => {
    const port = AUDIT_PORT_BASE + 5;
    const logPath = auditLogPath("tokens");

    await startServer(
      port,
      ["--audit-log", logPath, "--tool-filter", AUDIT_FILTER],
      "audit-tokens",
    );

    let client: Client | undefined;
    try {
      client = await createClient(`http://localhost:${port}`);

      // Begin a transaction (write scope) — should be logged with tokenEstimate
      await callToolRaw(client, "mysql_transaction_begin", {});

      const entries = await readAuditLogWithRetry(logPath);
      expect(entries.length).toBeGreaterThanOrEqual(1);

      const entry = entries[entries.length - 1]!;
      expect(entry.tool).toBe("mysql_transaction_begin");
      expect(typeof entry.tokenEstimate).toBe("number");
      expect(entry.tokenEstimate as number).toBeGreaterThan(0);
    } finally {
      if (client) await client.close();
      stopServer(port);
      await rm(logPath, { force: true });
    }
  });

  test("mysql://audit resource includes summary block", async () => {
    const port = AUDIT_PORT_BASE + 6;
    const logPath = auditLogPath("summary");

    await startServer(
      port,
      ["--audit-log", logPath, "--tool-filter", AUDIT_FILTER],
      "audit-summary",
    );

    let client: Client | undefined;
    try {
      client = await createClient(`http://localhost:${port}`);

      // Create an audit entry via a write-scope tool
      await callToolRaw(client, "mysql_transaction_begin", {});

      // Wait for the server's async buffer to flush to disk
      await readAuditLogWithRetry(logPath);

      // Read the audit resource
      const resource = await client.readResource({ uri: "mysql://audit" });
      expect(resource.contents).toBeDefined();
      expect(resource.contents.length).toBeGreaterThan(0);

      const text = (resource.contents[0] as { text: string }).text;
      const body = JSON.parse(text) as {
        summary: {
          entries: number;
          errors: number;
          tokenEstimate: number;
          topTools: Array<{ name: string; count: number }>;
        };
        recent: Array<Record<string, unknown>>;
      };

      // Verify summary block structure
      expect(body.summary).toBeDefined();
      expect(typeof body.summary.entries).toBe("number");
      expect(body.summary.entries).toBeGreaterThanOrEqual(1);
      expect(typeof body.summary.tokenEstimate).toBe("number");
      expect(body.summary.tokenEstimate).toBeGreaterThan(0);
      expect(typeof body.summary.errors).toBe("number");
      expect(Array.isArray(body.summary.topTools)).toBe(true);
      expect(body.summary.topTools.length).toBeGreaterThanOrEqual(1);

      // Verify top tools structure
      const topTool = body.summary.topTools[0]!;
      expect(topTool.name).toBe("mysql_transaction_begin");
      expect(topTool.count).toBeGreaterThanOrEqual(1);
    } finally {
      if (client) await client.close();
      stopServer(port);
      await rm(logPath, { force: true });
    }
  });

  test("audit log correctly ignores and recovers from corrupted entries", async () => {
    const port = AUDIT_PORT_BASE + 8;
    const logPath = auditLogPath("corrupted");

    // Manually write a corrupted log file before server starts
    await appendFile(
      logPath,
      '{"tool":"mysql_transaction_begin","category":"wri\n',
    ); // Incomplete JSON
    await appendFile(
      logPath,
      '{"tool":"mysql_transaction_rollback","category":"write","success":true,"timestamp":"2023-10-10T10:00:00.000Z","durationMs":0,"args":{}}\n',
    ); // Valid JSON

    await startServer(
      port,
      ["--audit-log", logPath, "--tool-filter", AUDIT_FILTER],
      "audit-corrupted",
    );

    let client: Client | undefined;
    try {
      client = await createClient(`http://localhost:${port}`);

      // Perform a new write
      await callToolRaw(client, "mysql_transaction_begin", {});

      // Wait generous amount for background flush to disk
      await delay(2000);

      // Read via resource which is evaluated natively by AuditLogger
      const resource = await client.readResource({ uri: "mysql://audit" });
      const text = (resource.contents[0] as { text: string }).text;
      const body = JSON.parse(text) as {
        recent: Array<Record<string, unknown>>;
        summary: Record<string, unknown>;
      };

      // Corrupted line is ignored, valid previous line + new lines are read
      const toolsRead = body.recent.map((e) => e.tool);
      expect(toolsRead).toContain("mysql_transaction_rollback");
      expect(toolsRead).toContain("mysql_transaction_begin");
    } finally {
      if (client) await client.close();
      stopServer(port);
      await rm(logPath, { force: true });
    }
  });
});

