/**
 * mysql-mcp — Backup Manager Tests
 *
 * Tests the BackupManager snapshot system:
 * - shouldSnapshot filtering
 * - createSnapshot DDL capture
 * - createSnapshot data capture
 * - listSnapshots / getSnapshot
 * - cleanup retention policy
 * - getStats
 * - Non-blocking error handling
 * - Path traversal sanitization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { rm, writeFile, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { BackupManager, type SnapshotQueryAdapter } from "./backup-manager.js";
import type { BackupConfig } from "./types.js";

/** Helper: create a unique temp directory using mkdtemp (atomic, no TOCTOU) */
async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "mysql-backup-test-"));
}

/** Helper: build a default BackupConfig */
function defaultConfig(overrides: Partial<BackupConfig> = {}): BackupConfig {
  return {
    enabled: true,
    includeData: false,
    maxAgeDays: 30,
    maxCount: 100,
    maxDataSizeBytes: 50 * 1024 * 1024,
    ...overrides,
  };
}

/** Helper: create a mock SnapshotQueryAdapter */
function mockAdapter(
  overrides: Partial<SnapshotQueryAdapter> = {},
): SnapshotQueryAdapter {
  return {
    executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
    describeTable: vi.fn().mockResolvedValue({
      columns: [
        { name: "id", type: "int", nullable: false },
        { name: "name", type: "varchar(255)", nullable: true },
      ],
    }),
    ...overrides,
  };
}

describe("BackupManager", () => {
  let dir: string;
  let logPath: string;

  beforeEach(async () => {
    dir = await createTempDir();
    logPath = join(dir, "audit.jsonl");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  // =========================================================================
  // shouldSnapshot
  // =========================================================================

  describe("shouldSnapshot", () => {
    it("should return true for snapshotted tools", () => {
      const mgr = new BackupManager(defaultConfig(), logPath);
      expect(mgr.shouldSnapshot("mysql_drop_table")).toBe(true);
      expect(mgr.shouldSnapshot("mysql_optimize_table")).toBe(true);
      expect(mgr.shouldSnapshot("mysql_drop_schema")).toBe(true);
      expect(mgr.shouldSnapshot("mysql_import_data")).toBe(true);
    });

    it("should return false for non-snapshotted tools", () => {
      const mgr = new BackupManager(defaultConfig(), logPath);
      expect(mgr.shouldSnapshot("mysql_read_query")).toBe(false);
      expect(mgr.shouldSnapshot("mysql_write_query")).toBe(false);
      expect(mgr.shouldSnapshot("mysql_list_tables")).toBe(false);
    });

    it("should return false when disabled", () => {
      const mgr = new BackupManager(defaultConfig({ enabled: false }), logPath);
      expect(mgr.shouldSnapshot("mysql_drop_table")).toBe(false);
    });
  });

  // =========================================================================
  // createSnapshot
  // =========================================================================

  describe("createSnapshot", () => {
    it("should capture DDL snapshot for a table tool", async () => {
      const adapter = mockAdapter({
        executeQuery: vi
          .fn()
          .mockResolvedValueOnce({ rows: [{ db: "testdb" }] }) // SELECT DATABASE()
          .mockResolvedValueOnce({
            rows: [
              {
                "Create Table":
                  "CREATE TABLE `users` (`id` int NOT NULL) ENGINE=InnoDB",
              },
            ],
          }) // SHOW CREATE TABLE
          .mockResolvedValueOnce({
            rows: [{ row_count: 10, total_size_bytes: 16384 }],
          }), // information_schema
      });
      const mgr = new BackupManager(defaultConfig(), logPath);

      const filename = await mgr.createSnapshot(
        "mysql_drop_table",
        { table: "users" },
        "req-001",
        adapter,
      );

      expect(filename).toBeDefined();
      expect(filename).toContain("mysql_drop_table");
      expect(filename).toContain("users");
      expect(filename).toMatch(/\.snapshot\.json\.gz$/);
    });

    it("should return undefined for non-snapshotted tools", async () => {
      const adapter = mockAdapter();
      const mgr = new BackupManager(defaultConfig(), logPath);

      const filename = await mgr.createSnapshot(
        "mysql_read_query",
        { sql: "SELECT 1" },
        "req-002",
        adapter,
      );

      expect(filename).toBeUndefined();
    });

    it("should include data when configured", async () => {
      const adapter = mockAdapter({
        executeQuery: vi
          .fn()
          .mockResolvedValueOnce({ rows: [{ db: "testdb" }] }) // SELECT DATABASE()
          .mockResolvedValueOnce({
            rows: [
              {
                "Create Table":
                  "CREATE TABLE `users` (`id` int, `name` varchar(255))",
              },
            ],
          }) // SHOW CREATE TABLE
          .mockResolvedValueOnce({
            rows: [{ row_count: 2, total_size_bytes: 1024 }],
          }) // information_schema
          .mockResolvedValueOnce({
            rows: [
              { id: 1, name: "Alice" },
              { id: 2, name: "Bob" },
            ],
          }), // SELECT * for data
      });
      const mgr = new BackupManager(
        defaultConfig({ includeData: true }),
        logPath,
      );

      const filename = await mgr.createSnapshot(
        "mysql_drop_table",
        { table: "users" },
        "req-004",
        adapter,
      );

      expect(filename).toBeDefined();

      // Flush async writes before reading back
      await mgr.flush();

      // Read the stored snapshot and verify data
      const snapshot = await mgr.getSnapshot(filename!);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.metadata.type).toBe("ddl+data");
      expect(snapshot!.data).toContain("INSERT INTO");
      expect(snapshot!.data).toContain("Alice");
    });

    it("should capture schema drop snapshots", async () => {
      // Schema drop calls executeQuery twice: tables then views.
      // Use implementation that checks the SQL to return correct results.
      const adapter = mockAdapter({
        executeQuery: vi.fn().mockImplementation((sql: string) => {
          if (typeof sql === "string" && sql.includes("information_schema.TABLES")) {
            return Promise.resolve({
              rows: [{ TABLE_NAME: "users" }, { TABLE_NAME: "orders" }],
            });
          }
          if (typeof sql === "string" && sql.includes("information_schema.VIEWS")) {
            return Promise.resolve({ rows: [] });
          }
          return Promise.resolve({ rows: [] });
        }),
      });
      const mgr = new BackupManager(defaultConfig(), logPath);

      const filename = await mgr.createSnapshot(
        "mysql_drop_schema",
        { schema: "old_schema" },
        "req-006",
        adapter,
      );

      expect(filename).toBeDefined();
      await mgr.flush();
      const snapshot = await mgr.getSnapshot(filename!);
      expect(snapshot!.ddl).toContain(
        'Pre-drop snapshot of database "old_schema"',
      );
      expect(snapshot!.ddl).toContain("users");
    });

    it("should handle adapter errors gracefully (non-throwing)", async () => {
      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      // The mysql backup manager calls SELECT DATABASE() first (which fails),
      // falls back to schema='mysql', then fails on SHOW CREATE TABLE.
      // Because buildTableDdl catches its own error and returns a fallback DDL
      // string, the overall snapshot still succeeds with a placeholder DDL.
      // We verify the snapshot includes the error fallback DDL.
      const adapter = mockAdapter({
        executeQuery: vi.fn().mockRejectedValue(new Error("Connection lost")),
        describeTable: vi.fn().mockRejectedValue(new Error("Connection lost")),
      });
      const mgr = new BackupManager(defaultConfig(), logPath);

      const filename = await mgr.createSnapshot(
        "mysql_drop_table",
        { table: "users" },
        "req-007",
        adapter,
      );

      // The mysql implementation catches internal errors gracefully
      // and produces a snapshot with fallback DDL
      expect(filename).toBeDefined();
      await mgr.flush();
      const snapshot = await mgr.getSnapshot(filename!);
      expect(snapshot!.ddl).toContain("does not exist or cannot be described");
      stderrSpy.mockRestore();
    });

    it("should default target to 'unknown' for non-string args", async () => {
      const adapter = mockAdapter({
        executeQuery: vi
          .fn()
          .mockResolvedValueOnce({ rows: [{ db: "testdb" }] }) // SELECT DATABASE()
          .mockResolvedValueOnce({ rows: [] }) // SHOW CREATE TABLE (empty)
          .mockResolvedValueOnce({ rows: [] }), // information_schema
      });
      const mgr = new BackupManager(defaultConfig(), logPath);

      const filename = await mgr.createSnapshot(
        "mysql_drop_table",
        { table: 42 } as unknown as Record<string, unknown>,
        "req-008",
        adapter,
      );

      expect(filename).toBeDefined();
      expect(filename).toContain("unknown");
    });
  });

  // =========================================================================
  // listSnapshots / getSnapshot
  // =========================================================================

  describe("listSnapshots", () => {
    it("should list created snapshots sorted newest first", async () => {
      const adapter = mockAdapter({
        executeQuery: vi
          .fn()
          .mockResolvedValue({ rows: [{ db: "testdb" }] })
          .mockResolvedValue({ rows: [] }),
      });
      const mgr = new BackupManager(defaultConfig(), logPath);

      await mgr.createSnapshot(
        "mysql_drop_table",
        { table: "first" },
        "req-a",
        adapter,
      );
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10));
      await mgr.createSnapshot(
        "mysql_optimize_table",
        { table: "second" },
        "req-b",
        adapter,
      );

      await mgr.flush();
      const snapshots = await mgr.listSnapshots();
      expect(snapshots).toHaveLength(2);
      // Newest first
      expect(snapshots[0]!.target).toBe("second");
      expect(snapshots[1]!.target).toBe("first");
    });

    it("should return empty array when no snapshots", async () => {
      const mgr = new BackupManager(defaultConfig(), logPath);
      const snapshots = await mgr.listSnapshots();
      expect(snapshots).toEqual([]);
    });
  });

  describe("getSnapshot", () => {
    it("should return snapshot content by filename", async () => {
      const adapter = mockAdapter({
        executeQuery: vi
          .fn()
          .mockResolvedValueOnce({ rows: [{ db: "testdb" }] })
          .mockResolvedValueOnce({
            rows: [
              {
                "Create Table":
                  "CREATE TABLE `users` (`id` int NOT NULL) ENGINE=InnoDB",
              },
            ],
          })
          .mockResolvedValueOnce({
            rows: [{ row_count: 5, total_size_bytes: 8192 }],
          }),
      });
      const mgr = new BackupManager(defaultConfig(), logPath);

      const filename = await mgr.createSnapshot(
        "mysql_drop_table",
        { table: "users" },
        "req-010",
        adapter,
      );

      await mgr.flush();
      const snapshot = await mgr.getSnapshot(filename!);
      expect(snapshot).not.toBeNull();
      expect(snapshot!.metadata.tool).toBe("mysql_drop_table");
      expect(snapshot!.metadata.target).toBe("users");
      expect(snapshot!.ddl).toContain("CREATE TABLE");
    });

    it("should return null for non-existent snapshot", async () => {
      const mgr = new BackupManager(defaultConfig(), logPath);
      const snapshot = await mgr.getSnapshot("does-not-exist.snapshot.json");
      expect(snapshot).toBeNull();
    });

    it("should sanitize path traversal attempts", async () => {
      const mgr = new BackupManager(defaultConfig(), logPath);
      const snapshot = await mgr.getSnapshot("../../../etc/passwd");
      expect(snapshot).toBeNull();
    });
  });

  // =========================================================================
  // cleanup
  // =========================================================================

  describe("cleanup", () => {
    it("should delete snapshots exceeding maxCount", async () => {
      const adapter = mockAdapter({
        executeQuery: vi
          .fn()
          .mockResolvedValue({ rows: [{ db: "testdb" }] })
          .mockResolvedValue({ rows: [] }),
      });
      const mgr = new BackupManager(defaultConfig({ maxCount: 2 }), logPath);

      // Create 3 snapshots
      await mgr.createSnapshot(
        "mysql_drop_table",
        { table: "a" },
        "req-a",
        adapter,
      );
      await new Promise((r) => setTimeout(r, 10));
      await mgr.createSnapshot(
        "mysql_drop_table",
        { table: "b" },
        "req-b",
        adapter,
      );
      await new Promise((r) => setTimeout(r, 10));
      await mgr.createSnapshot(
        "mysql_drop_table",
        { table: "c" },
        "req-c",
        adapter,
      );

      await mgr.flush();
      const stderrSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true);
      const deleted = await mgr.cleanup();
      stderrSpy.mockRestore();

      expect(deleted).toBe(1);
      const remaining = await mgr.listSnapshots();
      expect(remaining).toHaveLength(2);
    });

    it("should return 0 when disabled", async () => {
      const mgr = new BackupManager(defaultConfig({ enabled: false }), logPath);
      const deleted = await mgr.cleanup();
      expect(deleted).toBe(0);
    });

    it("should return 0 when no snapshots exist", async () => {
      const mgr = new BackupManager(defaultConfig(), logPath);
      // Ensure directory exists but is empty
      await mkdir(join(dir, "snapshots"), { recursive: true });
      const deleted = await mgr.cleanup();
      expect(deleted).toBe(0);
    });
  });

  // =========================================================================
  // getStats
  // =========================================================================

  describe("getStats", () => {
    it("should return stats for existing snapshots", async () => {
      const adapter = mockAdapter({
        executeQuery: vi
          .fn()
          .mockResolvedValue({ rows: [{ db: "testdb" }] })
          .mockResolvedValue({ rows: [] }),
      });
      const mgr = new BackupManager(defaultConfig(), logPath);

      await mgr.createSnapshot(
        "mysql_drop_table",
        { table: "users" },
        "req-s1",
        adapter,
      );

      await mgr.flush();
      const stats = await mgr.getStats();
      expect(stats.count).toBe(1);
      expect(stats.totalSizeKB).toBeGreaterThanOrEqual(0);
      expect(stats.oldestAge).toBeDefined();
    });

    it("should return zeros when no snapshots", async () => {
      const mgr = new BackupManager(defaultConfig(), logPath);
      const stats = await mgr.getStats();
      expect(stats.count).toBe(0);
      expect(stats.totalSizeKB).toBe(0);
      expect(stats.oldestAge).toBeUndefined();
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe("edge cases", () => {
    it("should handle corrupt snapshot files in listSnapshots", async () => {
      const mgr = new BackupManager(defaultConfig(), logPath);
      const snapshotDir = join(dir, "snapshots");
      await mkdir(snapshotDir, { recursive: true });

      // Write a corrupt file
      await writeFile(
        join(snapshotDir, "corrupt.snapshot.json"),
        "NOT VALID JSON{{{",
        "utf-8",
      );

      const snapshots = await mgr.listSnapshots();
      expect(snapshots).toEqual([]);
    });

    it("should ignore non-snapshot files in directory", async () => {
      const adapter = mockAdapter({
        executeQuery: vi
          .fn()
          .mockResolvedValue({ rows: [{ db: "testdb" }] })
          .mockResolvedValue({ rows: [] }),
      });
      const mgr = new BackupManager(defaultConfig(), logPath);

      await mgr.createSnapshot(
        "mysql_drop_table",
        { table: "t" },
        "req-x",
        adapter,
      );

      // Write a non-snapshot file
      await mgr.flush();
      const snapshotDir = join(dir, "snapshots");
      await writeFile(join(snapshotDir, "notes.txt"), "hello", "utf-8");

      const snapshots = await mgr.listSnapshots();
      expect(snapshots).toHaveLength(1);
    });

    it("should handle data capture failure gracefully", async () => {
      const execMock = vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ db: "testdb" }] }) // SELECT DATABASE()
        .mockResolvedValueOnce({
          rows: [
            {
              "Create Table":
                "CREATE TABLE `users` (`id` int NOT NULL) ENGINE=InnoDB",
            },
          ],
        }) // SHOW CREATE TABLE
        .mockResolvedValueOnce({
          rows: [{ row_count: 5, total_size_bytes: 1024 }],
        }) // volume metadata
        .mockRejectedValueOnce(new Error("query failed")); // data capture fails
      const adapter = mockAdapter({
        executeQuery: execMock,
      });
      const mgr = new BackupManager(
        defaultConfig({ includeData: true }),
        logPath,
      );

      const filename = await mgr.createSnapshot(
        "mysql_drop_table",
        { table: "users" },
        "req-data-err",
        adapter,
      );

      expect(filename).toBeDefined();
      await mgr.flush();
      const snapshot = await mgr.getSnapshot(filename!);
      expect(snapshot!.metadata.type).toBe("ddl");
      expect(snapshot!.data).toBeUndefined();
    });

    it("should handle schema drop when object enumeration fails", async () => {
      const adapter = mockAdapter({
        executeQuery: vi.fn().mockRejectedValue(new Error("perm denied")),
      });
      const mgr = new BackupManager(defaultConfig(), logPath);

      const filename = await mgr.createSnapshot(
        "mysql_drop_schema",
        { schema: "gone" },
        "req-enum-err",
        adapter,
      );

      expect(filename).toBeDefined();
      await mgr.flush();
      const snapshot = await mgr.getSnapshot(filename!);
      expect(snapshot!.ddl).toContain(
        "Could not enumerate database objects",
      );
    });
  });
});
