import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAuditListBackupsTool,
  createAuditRestoreBackupTool,
  createAuditDiffBackupTool,
} from "../audit-backup.js";

describe("Audit Backup Tools", () => {
  let mockAdapter: any;
  let mockBackupManager: any;
  let mockContext: any;

  beforeEach(() => {
    mockBackupManager = {
      listSnapshots: vi.fn(),
      getSnapshot: vi.fn(),
    };
    mockAdapter = {
      executeQuery: vi.fn(),
      executeWriteQuery: vi.fn(),
      executeReadQuery: vi.fn(),
      getBackupManager: vi.fn().mockImplementation(() => mockAdapter.backupManager),
      backupManager: mockBackupManager,
    };
    mockContext = { connectionId: "test" };
  });

  describe("mysql_audit_list_backups", () => {
    it("should return backups from backupManager", async () => {
      mockBackupManager.listSnapshots.mockResolvedValue([
        { target: "users", metadata: { ts: 1 } },
        { target: "posts", metadata: { ts: 2 } },
      ]);
      const tool = createAuditListBackupsTool(mockAdapter);
      const result = await tool.handler({}, mockContext);
      expect(result.success).toBe(true);
      expect(result.data.backups.length).toBe(2);
      expect(result.data.total).toBe(2);
    });

    it("should filter backups by target", async () => {
      mockBackupManager.listSnapshots.mockResolvedValue([
        { target: "users", metadata: { ts: 1 } },
        { target: "posts", metadata: { ts: 2 } },
      ]);
      const tool = createAuditListBackupsTool(mockAdapter);
      const result = await tool.handler(
        { target: "users" },
        mockContext,
      );
      expect(result.success).toBe(true);
      expect(result.data.backups.length).toBe(1);
      expect(result.data.backups[0].target).toBe("users");
    });

    it("should handle no backupManager", async () => {
      mockAdapter.backupManager = undefined;
      const tool = createAuditListBackupsTool(mockAdapter);
      const result = await tool.handler({}, mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Backup Manager is not enabled");
    });

    it("should handle error", async () => {
      mockBackupManager.listSnapshots.mockRejectedValue(
        new Error("unexpected"),
      );
      const tool = createAuditListBackupsTool(mockAdapter);
      const result = await tool.handler({}, mockContext);
      expect(result.success).toBe(false);
      expect(result.error).toContain("unexpected");
    });
  });

  describe("mysql_audit_restore_backup", () => {
    it("should restore a backup successfully", async () => {
      mockBackupManager.getSnapshot.mockResolvedValue({
        ddl: "CREATE TABLE users (id INT);",
        data: "INSERT INTO users VALUES (1);",
        metadata: { target: "users" },
      });
      const tool = createAuditRestoreBackupTool(mockAdapter);
      const result = await tool.handler(
        { filename: "backup.sql", includeData: true },
        mockContext,
      );
      expect(result.success).toBe(true);
      expect(result.data.restoredFilename).toBe("backup.sql");
      expect(mockAdapter.executeWriteQuery).toHaveBeenCalledWith(
        "CREATE TABLE users (id INT);\n\nINSERT INTO users VALUES (1);",
      );
    });

    it("should perform a dry run", async () => {
      mockBackupManager.getSnapshot.mockResolvedValue({
        ddl: "CREATE TABLE users (id INT);",
        metadata: { target: "users" },
      });
      const tool = createAuditRestoreBackupTool(mockAdapter);
      const result = await tool.handler(
        { filename: "backup.sql", dryRun: true },
        mockContext,
      );
      expect(result.success).toBe(true);
      expect(result.data.dryRun).toBe(true);
      expect(result.data.sql).toBe("CREATE TABLE users (id INT);");
      expect(mockAdapter.executeWriteQuery).not.toHaveBeenCalled();
    });

    it("should handle missing snapshot", async () => {
      mockBackupManager.getSnapshot.mockResolvedValue(null);
      const tool = createAuditRestoreBackupTool(mockAdapter);
      const result = await tool.handler(
        { filename: "backup.sql" },
        mockContext,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Snapshot not found");
    });

    it("should handle no backupManager", async () => {
      mockAdapter.backupManager = undefined;
      const tool = createAuditRestoreBackupTool(mockAdapter);
      const result = await tool.handler(
        { filename: "backup.sql" },
        mockContext,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Backup Manager is not enabled");
    });
  });

  describe("mysql_audit_diff_backup", () => {
    it("should return diff successfully", async () => {
      mockBackupManager.getSnapshot.mockResolvedValue({
        ddl: "CREATE TABLE users (id INT);",
        metadata: { target: "users", schema: "test" },
      });
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce({ rows: [{ db: "test" }] })
        .mockResolvedValueOnce({
          rows: [
            { "Create Table": "CREATE TABLE users (id INT, new_col INT);" },
          ],
        });

      const tool = createAuditDiffBackupTool(mockAdapter);
      const result = await tool.handler(
        { filename: "backup.sql" },
        mockContext,
      );
      expect(result.success).toBe(true);
      expect(result.data.snapshotDdl).toBe("CREATE TABLE users (id INT);");
      expect(result.data.liveDdl).toBe("CREATE TABLE users (id INT, new_col INT);");
    });

    it("should parse schema.table target format", async () => {
      mockBackupManager.getSnapshot.mockResolvedValue({
        ddl: "CREATE TABLE users (id INT);",
        metadata: { target: "db1.users" },
      });
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce({ rows: [{ db: "test" }] })
        .mockResolvedValueOnce({ rows: [{ "Create Table": "LIVE DDL" }] });

      const tool = createAuditDiffBackupTool(mockAdapter);
      const result = await tool.handler(
        { filename: "backup.sql" },
        mockContext,
      );
      expect(result.success).toBe(true);
      expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
        expect.stringContaining("`db1`.`users`"),
      );
      expect(result.data.liveDdl).toBe("LIVE DDL");
    });

    it("should return missing message if table not found", async () => {
      mockBackupManager.getSnapshot.mockResolvedValue({
        ddl: "CREATE TABLE users (id INT);",
        metadata: { target: "users", schema: "test" },
      });
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table missing"),
      );

      const tool = createAuditDiffBackupTool(mockAdapter);
      const result = await tool.handler(
        { filename: "backup.sql" },
        mockContext,
      );
      expect(result.success).toBe(true);
      expect(result.data.liveDdl).toContain("does not exist in current schema");
    });

    it("should handle missing snapshot", async () => {
      mockBackupManager.getSnapshot.mockResolvedValue(null);
      const tool = createAuditDiffBackupTool(mockAdapter);
      const result = await tool.handler(
        { filename: "backup.sql" },
        mockContext,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Snapshot not found");
    });

    it("should handle no backupManager", async () => {
      mockAdapter.backupManager = undefined;
      const tool = createAuditDiffBackupTool(mockAdapter);
      const result = await tool.handler(
        { filename: "backup.sql" },
        mockContext,
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("Backup Manager is not enabled");
    });
  });
});
