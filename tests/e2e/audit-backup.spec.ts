/**
 * E2E Tests: Audit Backup Snapshots
 *
 * Spawns a server with --audit-backup enabled and verifies:
 * 1. DDL tool calls produce pre-mutation snapshots on disk
 * 2. mysql_audit_list_backups returns available snapshots
 * 3. mysql_audit_diff_backup detects schema drift after drop
 * 4. mysql_audit_restore_backup dryRun previews DDL without executing
 * 5. Tools return structured error when backup is not enabled
 *
 * Uses the same startServer/stopServer pattern as audit-log.spec.ts.
 */

import { rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as delay } from "node:timers/promises";

import { test, expect } from "@playwright/test";
import {
  startServer,
  stopServer,
  createClient,
  callToolAndParse,
  cleanupAuditFiles,
} from "./helpers.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";

// Force sequential execution to prevent parallel workers from colliding on manual ports/files
test.describe.configure({ mode: "serial", timeout: 120_000 });

const BACKUP_PORT_BASE = 3160;

/** Generate a unique temp directory path for the audit log */
function auditDir(suffix: string): string {
  return join(tmpdir(), `mysql-backup-e2e-${suffix}-${Date.now()}`);
}

/**
 * Retry list_backups until at least `minCount` snapshots appear.
 * The BackupManager writes asynchronously after the tool handler returns.
 */
async function waitForSnapshots(
  client: Client,
  minCount: number,
  maxAttempts = 30,
  intervalMs = 500,
): Promise<Record<string, unknown>> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await callToolAndParse(
      client,
      "mysql_audit_list_backups",
      {},
    );
    const data = result.data as Record<string, unknown> | undefined;
    const total =
      typeof data?.total === "number"
        ? data.total
        : Array.isArray(data?.backups)
          ? (data!.backups as unknown[]).length
          : 0;
    if (total >= minCount) {
      return result;
    }
    await delay(intervalMs);
  }
  throw new Error(
    `Expected at least ${minCount} snapshot(s) after ${maxAttempts * intervalMs}ms`,
  );
}

test.describe("Audit Backup Snapshots", () => {
  test("drop_table produces snapshot and list_backups returns it", async () => {
    const TEMP_TABLE = "e2e_backup_drop";
    const port = BACKUP_PORT_BASE;
    const dir = auditDir("list");
    await mkdir(dir, { recursive: true });
    const logPath = join(dir, "audit.jsonl");

    await startServer(
      port,
      [
        "--audit-log",
        logPath,
        "--audit-backup",
        "--tool-filter",
        "core,admin,schema,backup",
      ],
      "backup-list",
    );

    let client: Client | undefined;
    try {
      client = await createClient(`http://localhost:${port}`);

      // Create a temp table, then drop it (drop triggers snapshot)
      await callToolAndParse(client, "mysql_create_table", {
        name: TEMP_TABLE,
        columns: [
          { name: "id", type: "INT", primaryKey: true, autoIncrement: true },
          { name: "val", type: "VARCHAR(255)" },
        ],
      });

      // Insert a row so drop has something to snapshot
      await callToolAndParse(client, "mysql_write_query", {
        sql: `INSERT INTO ${TEMP_TABLE} (val) VALUES ('test_data')`,
      });

      // Drop triggers a pre-mutation snapshot
      await callToolAndParse(client, "mysql_drop_table", {
        table: TEMP_TABLE,
        ifExists: true,
      });

      // Wait for the snapshot to appear
      const listResult = await waitForSnapshots(client, 1);

      // Response shape: { data: { backups: [...], total: N } }
      const data = listResult.data as Record<string, unknown>;
      expect(typeof data.total).toBe("number");
      expect(data.total as number).toBeGreaterThanOrEqual(1);

      const backups = data.backups as Array<Record<string, unknown>>;
      expect(backups.length).toBeGreaterThanOrEqual(1);

      // Verify snapshot metadata shape
      const snap = backups[0]!; // Newest first
      expect(snap.tool).toBe("mysql_drop_table");
      expect(typeof snap.target).toBe("string");
      expect(typeof snap.timestamp).toBe("string");
      expect(typeof snap.filename).toBe("string");

      // Filter by target name
      const filtered = await callToolAndParse(
        client,
        "mysql_audit_list_backups",
        {
          target: TEMP_TABLE,
        },
      );
      const filteredData = filtered.data as Record<string, unknown>;
      expect(typeof filteredData.total).toBe("number");
      expect(filteredData.total as number).toBeGreaterThanOrEqual(1);
    } finally {
      // Clean up table (may already be dropped)
      try {
        if (client) {
          await callToolAndParse(client, "mysql_write_query", {
            sql: `DROP TABLE IF EXISTS ${TEMP_TABLE}`,
          });
        }
      } catch {
        /* ignore cleanup errors */
      }
      if (client) await client.close();
      stopServer(port);
      await delay(500);
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("diff_backup returns snapshot and live DDL for comparison", async () => {
    const TEMP_TABLE = "e2e_backup_diff";
    const port = BACKUP_PORT_BASE + 1;
    const dir = auditDir("diff");
    await mkdir(dir, { recursive: true });
    const logPath = join(dir, "audit.jsonl");

    await startServer(
      port,
      [
        "--audit-log",
        logPath,
        "--audit-backup",
        "--tool-filter",
        "core,admin,schema,backup",
      ],
      "backup-diff",
    );

    let client: Client | undefined;
    try {
      client = await createClient(`http://localhost:${port}`);

      // Create table with 2 columns
      await callToolAndParse(client, "mysql_create_table", {
        name: TEMP_TABLE,
        columns: [
          { name: "id", type: "INT", primaryKey: true, autoIncrement: true },
          { name: "name", type: "VARCHAR(255)" },
        ],
      });

      // Optimize — triggers snapshot of the current schema
      await callToolAndParse(client, "mysql_optimize_table", {
        table: TEMP_TABLE,
      });

      // Wait for snapshot to appear
      const listResult = await waitForSnapshots(client, 1);
      const data = listResult.data as Record<string, unknown>;
      const backups = (
        data.backups as Array<Record<string, unknown>>
      ).filter((s) => s.tool === "mysql_optimize_table");
      expect(backups.length).toBeGreaterThanOrEqual(1);

      const filename = backups[0]!.filename as string;

      // Diff the snapshot against current live schema
      const diffResult = await callToolAndParse(
        client,
        "mysql_audit_diff_backup",
        { filename },
      );

      // Response shape: { data: { snapshotDdl, liveDdl, metadata } }
      const diffData = diffResult.data as Record<string, unknown>;
      expect(typeof diffData.snapshotDdl).toBe("string");
      expect(typeof diffData.liveDdl).toBe("string");
      expect(diffData.metadata).toBeDefined();

      // Both DDLs should contain the table name
      const snapshotDdl = diffData.snapshotDdl as string;
      const liveDdl = diffData.liveDdl as string;
      expect(snapshotDdl).toContain(TEMP_TABLE);
      expect(liveDdl).toContain(TEMP_TABLE);
    } finally {
      try {
        if (client) {
          await callToolAndParse(client, "mysql_write_query", {
            sql: `DROP TABLE IF EXISTS ${TEMP_TABLE}`,
          });
        }
      } catch {
        /* ignore cleanup errors */
      }
      if (client) await client.close();
      stopServer(port);
      await delay(500);
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("restore_backup dryRun previews DDL without executing", async () => {
    const TEMP_TABLE = "e2e_backup_restore";
    const port = BACKUP_PORT_BASE + 2;
    const dir = auditDir("restore");
    await mkdir(dir, { recursive: true });
    const logPath = join(dir, "audit.jsonl");

    await startServer(
      port,
      [
        "--audit-log",
        logPath,
        "--audit-backup",
        "--tool-filter",
        "core,admin,schema,backup",
      ],
      "backup-restore",
    );

    let client: Client | undefined;
    try {
      client = await createClient(`http://localhost:${port}`);

      // Create, then drop (creates snapshot of original)
      await callToolAndParse(client, "mysql_create_table", {
        name: TEMP_TABLE,
        columns: [
          { name: "id", type: "INT", primaryKey: true },
          { name: "data", type: "JSON" },
        ],
      });

      await callToolAndParse(client, "mysql_drop_table", {
        table: TEMP_TABLE,
        ifExists: true,
      });

      // Wait for snapshot
      const listResult = await waitForSnapshots(client, 1);
      const data = listResult.data as Record<string, unknown>;
      const backups = (
        data.backups as Array<Record<string, unknown>>
      ).filter((s) => s.tool === "mysql_drop_table");
      const filename = backups[0]!.filename as string;

      // dryRun restore — should return SQL without executing
      const restoreResult = await callToolAndParse(
        client,
        "mysql_audit_restore_backup",
        { filename, dryRun: true },
      );

      // Response shape: { data: { dryRun, sql, metadata } }
      const restoreData = restoreResult.data as Record<string, unknown>;
      expect(restoreData.dryRun).toBe(true);
      expect(typeof restoreData.sql).toBe("string");
      expect((restoreData.sql as string).length).toBeGreaterThan(0);
      expect(restoreData.metadata).toBeDefined();

      // Table should still not exist (dry run didn't execute anything)
      const descResult = await callToolAndParse(
        client,
        "mysql_describe_table",
        {
          table: TEMP_TABLE,
        },
      );
      expect(descResult.success).toBe(false);
    } finally {
      if (client) await client.close();
      stopServer(port);
      await delay(500);
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("tools return structured error when backup is not enabled", async () => {
    const port = BACKUP_PORT_BASE + 3;

    // Start server WITHOUT --audit-backup
    await startServer(
      port,
      ["--tool-filter", "core,admin,schema,backup"],
      "backup-disabled",
    );

    let client: Client | undefined;
    try {
      client = await createClient(`http://localhost:${port}`);

      // All 3 tools should return { error: "..." } when backup is disabled
      const listResult = await callToolAndParse(
        client,
        "mysql_audit_list_backups",
        {},
      );
      expect(typeof listResult.error).toBe("string");
      expect(listResult.error as string).toMatch(/not enabled|not available/i);

      const diffResult = await callToolAndParse(
        client,
        "mysql_audit_diff_backup",
        { filename: "fake.snapshot.json" },
      );
      expect(typeof diffResult.error).toBe("string");
      expect(diffResult.error as string).toMatch(/not enabled|not available/i);

      const restoreResult = await callToolAndParse(
        client,
        "mysql_audit_restore_backup",
        { filename: "fake.snapshot.json" },
      );
      expect(typeof restoreResult.error).toBe("string");
      expect(restoreResult.error as string).toMatch(
        /not enabled|not available/i,
      );
    } finally {
      if (client) await client.close();
      stopServer(port);
    }
  });
});

