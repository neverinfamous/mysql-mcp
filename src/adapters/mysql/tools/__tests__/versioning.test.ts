import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createEnableVersioningTool,
  createDisableVersioningTool,
  createCheckVersionTool,
  createConditionalUpdateTool,
} from "../core/versioning.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
} from "../../../../__tests__/mocks/index.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";

describe("Versioning Tools", () => {
  let adapter: any;
  const context = createMockRequestContext();

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createMockMySQLAdapter();
  });

  describe("mysql_enable_versioning", () => {
    it("should return TABLE_NOT_FOUND if table does not exist", async () => {
      const tool = createEnableVersioningTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({ columns: [] });

      const result = await tool.handler({ table: "missing_table" }, context) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should add _version column and trigger if not present", async () => {
      const tool = createEnableVersioningTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({
        columns: [{ name: "id" }],
      });

      const result = await tool.handler({ table: "my_table" }, context) as any;
      expect(result.success).toBe(true);
      
      // Verify ALTER TABLE was called
      expect(adapter.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining("ALTER TABLE `my_table` ADD COLUMN _version"),
        []
      );
      // Verify DROP TRIGGER was called
      expect(adapter.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining("DROP TRIGGER IF EXISTS `_mcp_version_my_table`"),
        []
      );
      // Verify CREATE TRIGGER was called
      expect(adapter.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TRIGGER `_mcp_version_my_table`"),
        []
      );
    });

    it("should only ensure trigger if _version column already exists", async () => {
      const tool = createEnableVersioningTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({
        columns: [{ name: "id" }, { name: "_version" }],
      });

      const result = await tool.handler({ table: "my_table" }, context) as any;
      expect(result.success).toBe(true);
      
      // Verify ALTER TABLE was NOT called
      expect(adapter.executeWriteQuery).not.toHaveBeenCalledWith(
        expect.stringContaining("ALTER TABLE"),
        expect.any(Array)
      );
      
      // Verify CREATE TRIGGER was still called
      expect(adapter.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TRIGGER `_mcp_version_my_table`"),
        []
      );
    });

    it("should handle error gracefully", async () => {
      const tool = createEnableVersioningTool(adapter);
      adapter.describeTable.mockRejectedValueOnce(new Error("DB Error"));

      const result = await tool.handler({ table: "my_table" }, context) as any;
      expect(result.success).toBe(false);
    });
  });

  describe("mysql_disable_versioning", () => {
    it("should return TABLE_NOT_FOUND if table does not exist and ifExists is false", async () => {
      const tool = createDisableVersioningTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({ columns: [] });

      const result = await tool.handler({ table: "missing_table", ifExists: false }, context) as any;
      expect(result.success).toBe(false);
    });

    it("should succeed and do nothing if table does not exist and ifExists is true", async () => {
      const tool = createDisableVersioningTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({ columns: [] });

      const result = await tool.handler({ table: "missing_table", ifExists: true }, context) as any;
      expect(result.success).toBe(true);
    });

    it("should drop trigger and _version column if present", async () => {
      const tool = createDisableVersioningTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({
        columns: [{ name: "id" }, { name: "_version" }],
      });

      const result = await tool.handler({ table: "my_table" }, context) as any;
      expect(result.success).toBe(true);
      
      expect(adapter.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining("DROP TRIGGER IF EXISTS `_mcp_version_my_table`"),
        []
      );
      expect(adapter.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining("ALTER TABLE `my_table` DROP COLUMN _version"),
        []
      );
    });

    it("should only drop trigger if _version column is missing", async () => {
      const tool = createDisableVersioningTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({
        columns: [{ name: "id" }],
      });

      const result = await tool.handler({ table: "my_table" }, context) as any;
      expect(result.success).toBe(true);
      
      expect(adapter.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining("DROP TRIGGER IF EXISTS `_mcp_version_my_table`"),
        []
      );
      expect(adapter.executeWriteQuery).not.toHaveBeenCalledWith(
        expect.stringContaining("DROP COLUMN"),
        expect.any(Array)
      );
    });

    it("should handle error gracefully", async () => {
      const tool = createDisableVersioningTool(adapter);
      adapter.describeTable.mockRejectedValueOnce(new Error("DB Error"));

      const result = await tool.handler({ table: "my_table" }, context) as any;
      expect(result.success).toBe(false);
    });
  });

  describe("mysql_check_version", () => {
    it("should return TABLE_NOT_FOUND if table does not exist", async () => {
      const tool = createCheckVersionTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({ columns: [] });

      const result = await tool.handler({ table: "missing_table", rowId: 1 }, context) as any;
      expect(result.success).toBe(false);
    });

    it("should return ROW_NOT_FOUND if row does not exist", async () => {
      const tool = createCheckVersionTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({ columns: [{ name: "id" }] });
      adapter.executeReadQuery.mockResolvedValueOnce({ rows: [] });

      const result = await tool.handler({ table: "my_table", rowId: 1 }, context) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("Row not found");
    });

    it("should return TABLE_NOT_FOUND if row lacks _version column", async () => {
      const tool = createCheckVersionTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({ columns: [{ name: "id" }] });
      adapter.executeReadQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await tool.handler({ table: "my_table", rowId: 1 }, context) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("does not appear to have versioning enabled");
    });

    it("should return version and row data if successful", async () => {
      const tool = createCheckVersionTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({ columns: [{ name: "id" }, { name: "_version" }] });
      adapter.executeReadQuery.mockResolvedValueOnce({ rows: [{ id: 1, _version: 42 }] });

      const result = await tool.handler({ table: "my_table", rowId: 1 }, context) as any;
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        version: 42,
        row: { id: 1, _version: 42 },
      });
    });

    it("should handle error gracefully", async () => {
      const tool = createCheckVersionTool(adapter);
      adapter.describeTable.mockRejectedValueOnce(new Error("DB Error"));

      const result = await tool.handler({ table: "my_table", rowId: 1 }, context) as any;
      expect(result.success).toBe(false);
    });
  });

  describe("mysql_conditional_update", () => {
    it("should return VALIDATION_ERROR if data is empty", async () => {
      const tool = createConditionalUpdateTool(adapter);
      const result = await tool.handler({ table: "my_table", data: {}, conditions: [{ column: "id", value: 1 }], expectedVersion: 1 }, context) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("data is required");
    });

    it("should return VALIDATION_ERROR if conditions are empty", async () => {
      const tool = createConditionalUpdateTool(adapter);
      const result = await tool.handler({ table: "my_table", data: { name: "test" }, conditions: [], expectedVersion: 1 }, context) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("conditions array is required");
    });

    it("should return TABLE_NOT_FOUND if table does not exist", async () => {
      const tool = createConditionalUpdateTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({ columns: [] });

      const result = await tool.handler({ table: "my_table", data: { name: "test" }, conditions: [{ column: "id", value: 1 }], expectedVersion: 1 }, context) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should execute update successfully", async () => {
      const tool = createConditionalUpdateTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({ columns: [{ name: "id" }] });
      adapter.executeWriteQuery.mockResolvedValueOnce({ rowsAffected: 1 });

      const result = await tool.handler({ table: "my_table", data: { name: "test" }, conditions: [{ column: "id", value: 1 }], expectedVersion: 1 }, context) as any;
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        rowsAffected: 1,
        currentVersion: 2,
      });

      expect(adapter.executeWriteQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE `my_table` SET `name` = ? WHERE (`id` = ?) AND _version = ?"),
        ["test", 1, 1]
      );
    });

    it("should handle version mismatch (ConflictError)", async () => {
      const tool = createConditionalUpdateTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({ columns: [{ name: "id" }] });
      adapter.executeWriteQuery.mockResolvedValueOnce({ rowsAffected: 0 }); // update failed
      adapter.executeReadQuery.mockResolvedValueOnce({ rows: [{ _version: 2 }] }); // check row version

      const result = await tool.handler({ table: "my_table", data: { name: "test" }, conditions: [{ column: "id", value: 1 }], expectedVersion: 1 }, context) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("Version conflict");
    });

    it("should handle ROW_NOT_FOUND on update failure", async () => {
      const tool = createConditionalUpdateTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({ columns: [{ name: "id" }] });
      adapter.executeWriteQuery.mockResolvedValueOnce({ rowsAffected: 0 }); // update failed
      adapter.executeReadQuery.mockResolvedValueOnce({ rows: [] }); // check row version

      const result = await tool.handler({ table: "my_table", data: { name: "test" }, conditions: [{ column: "id", value: 1 }], expectedVersion: 1 }, context) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("Row not found");
    });

    it("should handle TABLE_NOT_FOUND (missing _version) on update failure", async () => {
      const tool = createConditionalUpdateTool(adapter);
      adapter.describeTable.mockResolvedValueOnce({ columns: [{ name: "id" }] });
      adapter.executeWriteQuery.mockResolvedValueOnce({ rowsAffected: 0 }); // update failed
      adapter.executeReadQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // check row version (missing _version)

      const result = await tool.handler({ table: "my_table", data: { name: "test" }, conditions: [{ column: "id", value: 1 }], expectedVersion: 1 }, context) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("missing _version column");
    });

    it("should handle error gracefully", async () => {
      const tool = createConditionalUpdateTool(adapter);
      adapter.describeTable.mockRejectedValueOnce(new Error("DB Error"));

      const result = await tool.handler({ table: "my_table", data: { name: "test" }, conditions: [{ column: "id", value: 1 }], expectedVersion: 1 }, context) as any;
      expect(result.success).toBe(false);
    });
  });
});
