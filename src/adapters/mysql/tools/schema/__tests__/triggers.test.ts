import { describe, it, expect, beforeEach } from "vitest";
import {
  createListTriggersTool,
  createCreateTriggerTool,
  createDropTriggerTool } from "../triggers.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult } from "../../../../../__tests__/mocks/index.js";
import { setupSchemaTest } from "./setup.js";

describe("Schema Trigger Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    ({ mockAdapter, mockContext } = setupSchemaTest());
  });

  describe("mysql_list_triggers", () => {
    it("should query INFORMATION_SCHEMA for triggers", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { TRIGGER_NAME: "before_insert", EVENT_MANIPULATION: "INSERT" },
        ]),
      );

      const tool = createListTriggersTool(
        mockAdapter,
      );
      const result = await tool.handler({ schema: "testdb" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[1][0];
      expect(call).toContain("information_schema.TRIGGERS");
      expect(result).toBeDefined();
    });

    it("should return exists false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createListTriggersTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { schema: "nonexistent_db" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should return exists false for nonexistent table", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ SCHEMA_NAME: "testdb" }]),
      );
      // Table existence check returns empty
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createListTriggersTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { schema: "testdb", table: "nonexistent_table" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should filter by table when provided", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ SCHEMA_NAME: "testdb" }]),
      );
      // Table existence check returns a row
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ TABLE_NAME: "users" }]),
      );
      // Triggers query returns empty
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createListTriggersTool(
        mockAdapter,
      );
      await tool.handler({ schema: "testdb", table: "users" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);
      const call = mockAdapter.executeQuery.mock.calls[2][0];
      expect(call).toContain("EVENT_OBJECT_TABLE = ?");
      const params = mockAdapter.executeQuery.mock.calls[2][1];
      expect(params).toContain("users");
    });
  });

  describe("mysql_create_trigger", () => {
    it("should execute CREATE TRIGGER query", async () => {
      // Schema check
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ SCHEMA_NAME: "testdb" }]));
      // Table check
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ TABLE_NAME: "users" }]));
      // Execute CREATE
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createCreateTriggerTool(mockAdapter);
      const result = await tool.handler({
        name: "test_trg",
        schema: "testdb",
        table: "users",
        timing: "BEFORE",
        event: "INSERT",
        body: "SET NEW.id = 1;"
      }, mockContext) as { success: boolean, data?: { triggerName: string } };

      expect(result.success).toBe(true);
      expect(result.data?.triggerName).toBe("testdb.test_trg");
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);
      
      const sqlCall = mockAdapter.executeQuery.mock.calls[2][0];
      expect(sqlCall).toContain("CREATE TRIGGER `testdb`.`test_trg` BEFORE INSERT ON `users` FOR EACH ROW");
      expect(sqlCall).toContain("SET NEW.id = 1;");
    });

    it("should resolve triggerName, tableName, and statement aliases", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ SCHEMA_NAME: "testdb" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ TABLE_NAME: "users" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createCreateTriggerTool(mockAdapter);
      const result = await tool.handler({
        triggerName: "test_trg",
        database: "testdb",
        tableName: "users",
        timing: "BEFORE",
        event: "INSERT",
        statement: "SET NEW.id = 1;"
      }, mockContext) as { success: boolean, data?: { triggerName: string } };

      expect(result.success).toBe(true);
      const sqlCall = mockAdapter.executeQuery.mock.calls[2][0];
      expect(sqlCall).toContain("CREATE TRIGGER `testdb`.`test_trg` BEFORE INSERT ON `users` FOR EACH ROW SET NEW.id = 1;");
    });

    it("should support ifNotExists", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ SCHEMA_NAME: "testdb" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ TABLE_NAME: "users" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createCreateTriggerTool(mockAdapter);
      await tool.handler({
        name: "test_trg",
        schema: "testdb",
        table: "users",
        timing: "BEFORE",
        event: "INSERT",
        body: "SET NEW.id = 1;",
        ifNotExists: true
      }, mockContext);

      const sqlCall = mockAdapter.executeQuery.mock.calls[2][0];
      expect(sqlCall).toContain("CREATE TRIGGER IF NOT EXISTS `testdb`.`test_trg`");
    });

    it("should support FOLLOWS ordering", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ SCHEMA_NAME: "testdb" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ TABLE_NAME: "users" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createCreateTriggerTool(mockAdapter);
      await tool.handler({
        name: "test_trg2",
        schema: "testdb",
        table: "users",
        timing: "BEFORE",
        event: "INSERT",
        body: "SET NEW.id = 2;",
        order: "FOLLOWS",
        otherTrigger: "test_trg1"
      }, mockContext);

      const sqlCall = mockAdapter.executeQuery.mock.calls[2][0];
      expect(sqlCall).toContain("FOR EACH ROW FOLLOWS `test_trg1` SET");
    });

    it("should clear schema cache on success", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ SCHEMA_NAME: "testdb" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ TABLE_NAME: "users" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createCreateTriggerTool(mockAdapter);
      await tool.handler({
        name: "test_trg",
        schema: "testdb",
        table: "users",
        timing: "BEFORE",
        event: "INSERT",
        body: "SET NEW.id = 1;"
      }, mockContext);

      expect(mockAdapter.clearSchemaCache).toHaveBeenCalled();
    });

    it("should return false when schema does not exist", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createCreateTriggerTool(mockAdapter);
      const result = await tool.handler({
        name: "test_trg",
        schema: "testdb",
        table: "users",
        timing: "BEFORE",
        event: "INSERT",
        body: "SET NEW.id = 1;"
      }, mockContext) as { success: boolean, error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Schema 'testdb' does not exist");
    });

    it("should return false when table does not exist", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ SCHEMA_NAME: "testdb" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createCreateTriggerTool(mockAdapter);
      const result = await tool.handler({
        name: "test_trg",
        schema: "testdb",
        table: "users",
        timing: "BEFORE",
        event: "INSERT",
        body: "SET NEW.id = 1;"
      }, mockContext) as { success: boolean, error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Table 'users' does not exist");
    });

    it("should return structured error when trigger already exists", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ SCHEMA_NAME: "testdb" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ TABLE_NAME: "users" }]));
      mockAdapter.executeQuery.mockRejectedValueOnce(new Error("Trigger 'testdb.test_trg' already exists"));

      const tool = createCreateTriggerTool(mockAdapter);
      const result = await tool.handler({
        name: "test_trg",
        schema: "testdb",
        table: "users",
        timing: "BEFORE",
        event: "INSERT",
        body: "SET NEW.id = 1;"
      }, mockContext) as { success: boolean, error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
    });
  });

  describe("mysql_drop_trigger", () => {
    it("should execute DROP TRIGGER query", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ SCHEMA_NAME: "testdb" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ TRIGGER_NAME: "test_trg" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createDropTriggerTool(mockAdapter);
      const result = await tool.handler({
        name: "test_trg",
        schema: "testdb"
      }, mockContext) as { success: boolean, data?: { triggerName: string } };

      expect(result.success).toBe(true);
      expect(result.data?.triggerName).toBe("testdb.test_trg");
      const sqlCall = mockAdapter.executeQuery.mock.calls[2][0];
      expect(sqlCall).toContain("DROP TRIGGER `testdb`.`test_trg`");
    });

    it("should handle ifExists true when trigger exists", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ SCHEMA_NAME: "testdb" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ TRIGGER_NAME: "test_trg" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createDropTriggerTool(mockAdapter);
      const result = await tool.handler({
        name: "test_trg",
        schema: "testdb",
        ifExists: true
      }, mockContext) as { success: boolean };

      expect(result.success).toBe(true);
      const sqlCall = mockAdapter.executeQuery.mock.calls[2][0];
      expect(sqlCall).toContain("DROP TRIGGER IF EXISTS `testdb`.`test_trg`");
    });

    it("should skip when ifExists true and trigger does not exist", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ SCHEMA_NAME: "testdb" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([])); // triggers absent

      const tool = createDropTriggerTool(mockAdapter);
      const result = await tool.handler({
        name: "test_trg",
        schema: "testdb",
        ifExists: true
      }, mockContext) as { success: boolean, data?: { skipped: boolean } };

      expect(result.success).toBe(true);
      expect(result.data?.skipped).toBe(true);
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2); // schema check, trigger check
    });

    it("should return error when ifExists false and trigger does not exist", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ SCHEMA_NAME: "testdb" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([])); // triggers absent

      const tool = createDropTriggerTool(mockAdapter);
      const result = await tool.handler({
        name: "test_trg",
        schema: "testdb",
        ifExists: false
      }, mockContext) as { success: boolean, error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown trigger");
    });

    it("should resolve triggerName alias", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ SCHEMA_NAME: "testdb" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ TRIGGER_NAME: "test_trg" }]));
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createDropTriggerTool(mockAdapter);
      await tool.handler({
        triggerName: "test_trg",
        schema: "testdb"
      }, mockContext);

      const sqlCall = mockAdapter.executeQuery.mock.calls[2][0];
      expect(sqlCall).toContain("DROP TRIGGER `testdb`.`test_trg`");
    });

    it("should return false when schema does not exist", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createDropTriggerTool(mockAdapter);
      const result = await tool.handler({
        name: "test_trg",
        schema: "testdb"
      }, mockContext) as { success: boolean, error?: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Schema 'testdb' does not exist");
    });
  });
});
