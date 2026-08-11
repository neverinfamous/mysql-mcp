/**
 * mysql-mcp - DocStore Tools Unit Tests
 *
 * Tests for document store tool definitions and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDocStoreTools } from "../docstore/index.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult } from "../../../../__tests__/mocks/index.js";

describe("getDocStoreTools", () => {
  let tools: ReturnType<typeof getDocStoreTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getDocStoreTools(
      createMockMySQLAdapter(),
    );
  });

  it("should return 9 docstore tools", () => {
    expect(tools).toHaveLength(9);
  });

  it("should have docstore group for all tools", () => {
    for (const tool of tools) {
      expect(tool.group).toBe("docstore");
    }
  });

  it("should have handler functions for all tools", () => {
    for (const tool of tools) {
      expect(typeof tool.handler).toBe("function");
    }
  });

  it("should have inputSchema for all tools", () => {
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it("should include expected tool names", () => {
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("mysql_doc_list_collections");
    expect(toolNames).toContain("mysql_doc_create_collection");
    expect(toolNames).toContain("mysql_doc_drop_collection");
    expect(toolNames).toContain("mysql_doc_find");
    expect(toolNames).toContain("mysql_doc_add");
    expect(toolNames).toContain("mysql_doc_modify");
    expect(toolNames).toContain("mysql_doc_remove");
    expect(toolNames).toContain("mysql_doc_create_index");
    expect(toolNames).toContain("mysql_doc_collection_info");
  });
});

describe("Handler Execution", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getDocStoreTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getDocStoreTools(mockAdapter);
    mockContext = createMockRequestContext();
  });

  describe("mysql_doc_list_collections", () => {
    it("should list document collections", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ Name: "users_collection", Rows: 100 }]),
      );

      const tool = tools.find((t) => t.name === "mysql_doc_list_collections");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toHaveProperty("data.collections");
      expect(result).toHaveProperty("data.count");
    });

    it("should filter by schema", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ SCHEMA_NAME: "mydb" }])) // schema exists
        .mockResolvedValueOnce(createMockQueryResult([])); // collections query

      const tool = tools.find((t) => t.name === "mysql_doc_list_collections");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler({ schema: "mydb" }, mockContext);

      // First call: schema existence check
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);
      expect(mockAdapter.executeQuery).toHaveBeenNthCalledWith(
        1,
        "SHOW SCHEMAS LIKE 'mydb'"
      );
      // Second call: collections query with schema params
      expect(mockAdapter.executeQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("SHOW TABLE STATUS FROM `mydb`")
      );
      // Third call: information_schema columns query
      expect(mockAdapter.executeQuery).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM information_schema.columns")
      );
    });

    it("should return exists: false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(Object.assign(new Error("Unknown database 'nonexistent_schema'"), { code: "ER_BAD_DB_ERROR" }));

      const tool = tools.find((t) => t.name === "mysql_doc_list_collections");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        { schema: "nonexistent_schema" },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        success: false,
        error: "Unknown database 'nonexistent_schema'",
        code: "SCHEMA_NOT_FOUND",
                category: "resource",
        metrics: { tokenEstimate: expect.any(Number) } });
    });
  });

  describe("mysql_doc_create_collection", () => {
    it("should create a new collection", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_collection");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler({ name: "products" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0];
      expect(call).toContain("CREATE TABLE");
      expect(call).toContain("doc JSON");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("data.collection", "products");
    });

    it("should reject invalid collection names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_create_collection");
      if (!tool) throw new Error('Tool not found');;

      const result = await tool.handler({ name: "invalid-name" }, mockContext);
      expect(result).toMatchObject({
        success: false,
        error: "Invalid collection name",
        code: "VALIDATION_ERROR",
        category: "validation",
        metrics: { tokenEstimate: expect.any(Number) } });
    });

    it("should add validation when specified", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_collection");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        {
          name: "validated_docs",
          validation: { level: "STRICT", schema: { type: "object" } } },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0];
      expect(call).toContain("JSON_SCHEMA_VALID");
    });

    it("should use default validation level when not specified", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_collection");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler({ name: "default_val" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0];
      expect(call).not.toContain("JSON_SCHEMA_VALID");
    });

    it("should support ifNotExists parameter", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([])) // checkCollectionExists → false
        .mockResolvedValue(createMockQueryResult([])); // CREATE TABLE succeeds

      const tool = tools.find((t) => t.name === "mysql_doc_create_collection");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        { name: "my_collection", ifNotExists: true },
        mockContext,
      );

      const calls = mockAdapter.executeQuery.mock.calls;
      const createCall = calls[calls.length - 1][0];
      expect(createCall).toContain("CREATE TABLE IF NOT EXISTS");
    });

    it("should return skipped when collection already exists with ifNotExists", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ Field: "doc", Type: "json" }, { Field: "_id", Type: "varchar(32)" }]), // checkCollectionExists → true
      );

      const tool = tools.find((t) => t.name === "mysql_doc_create_collection");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        { name: "my_collection", ifNotExists: true },
        mockContext,
      );

      expect(result).toMatchObject({
        success: true,
        data: {
          skipped: true,
          collection: "my_collection",
          reason: "Collection already exists" },
        metrics: { tokenEstimate: expect.any(Number) } });
      // Should NOT have called CREATE TABLE
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
    });

    it("should not use IF NOT EXISTS by default", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_collection");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler({ name: "my_collection" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0];
      expect(call).toContain("CREATE TABLE");
      expect(call).toContain("`my_collection`");
      expect(call).not.toContain("IF NOT EXISTS");
    });

    it("should return graceful error when collection already exists", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Table 'my_collection' already exists"),
      );

      const tool = tools.find((t) => t.name === "mysql_doc_create_collection");
      if (!tool) throw new Error('Tool not found');;
      const result = (await tool.handler(
        { name: "my_collection" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty(
        "error",
        "Collection 'my_collection' already exists",
      );
    });

    it("should return exists: false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error(
          "Query failed: Execute failed: Unknown database 'fake_schema'",
        ),
      );

      const tool = tools.find((t) => t.name === "mysql_doc_create_collection");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        { name: "my_collection", schema: "fake_schema" },
        mockContext,
      );

      expect(result).toMatchObject({
        success: false,
        error: "Schema 'fake_schema' does not exist",
        code: "SCHEMA_NOT_FOUND",
        category: "resource"
      });
    });
  });

  describe("mysql_doc_drop_collection", () => {
    it("should drop collection without IF EXISTS when false", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ Field: "doc", Type: "json" }, { Field: "_id", Type: "varchar(32)" }])) // pre-check
        .mockResolvedValueOnce(createMockQueryResult([])); // DROP TABLE

      const tool = tools.find((t) => t.name === "mysql_doc_drop_collection");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler({ name: "users", ifExists: false }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      const dropCall = mockAdapter.executeQuery.mock.calls[1][0];
      expect(dropCall).toContain("DROP TABLE `users`");
      expect(result).toHaveProperty("success", true);
      expect(result).not.toHaveProperty("message");
    });

    it("should return informative message when collection did not exist with ifExists", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([])); // pre-check: collection does not exist

      const tool = tools.find((t) => t.name === "mysql_doc_drop_collection");
      if (!tool) throw new Error('Tool not found');;
      const result = (await tool.handler(
        { name: "nonexistent", ifExists: true },
        mockContext,
      )) as { success: boolean; data: { collection: string; reason: string } };

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("data.collection", "nonexistent");
      expect(result).toHaveProperty("data.reason", "Collection did not exist");
    });

    it("should drop collection with IF EXISTS when requested", async () => {
      mockAdapter.executeQuery // pre-check
        .mockResolvedValueOnce(
          createMockQueryResult([{ Field: "doc", Type: "json" }, { Field: "_id", Type: "varchar(32)" }]),
        )
        .mockResolvedValueOnce(createMockQueryResult([])); // drop

      const tool = tools.find((t) => t.name === "mysql_doc_drop_collection");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler({ name: "users", ifExists: true }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[1][0];
      expect(call).toBe("DROP TABLE IF EXISTS `users`");
    });

    it("should reject invalid collection names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_drop_collection");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        { name: "bad;drop table users" },
        mockContext,
      );
      expect(result).toMatchObject({
        success: false,
        error: "Invalid collection name",
        code: "VALIDATION_ERROR",
        category: "validation",
        metrics: { tokenEstimate: expect.any(Number) } });
    });

    it("should return graceful error when collection does not exist", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Unknown table 'testdb.nonexistent'"),
      );

      const tool = tools.find((t) => t.name === "mysql_doc_drop_collection");
      if (!tool) throw new Error('Tool not found');;
      const result = (await tool.handler(
        { name: "nonexistent", ifExists: false },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty(
        "error",
        "Collection 'nonexistent' does not exist",
      );
    });

    it("should return exists: false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(Object.assign(new Error("Unknown database 'nonexistent_schema'"), { code: "ER_BAD_DB_ERROR" }));

      const tool = tools.find((t) => t.name === "mysql_doc_drop_collection");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        { name: "users", schema: "nonexistent_schema" },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        success: false,
        error: "Unknown database 'nonexistent_schema'",
        code: "SCHEMA_NOT_FOUND",
                category: "resource",
        metrics: { tokenEstimate: expect.any(Number) } });
    });
  });

  describe("mysql_doc_find", () => {
    it("should query documents with valid filter", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ doc: '{"name": "test"}' }]),
        );

      const tool = tools.find((t) => t.name === "mysql_doc_find");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "users",
          filter: "$.age" },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
      const call = mockAdapter.executeQuery.mock.calls[0][0];
      const params = mockAdapter.executeQuery.mock.calls[0][1];
      expect(call).toContain("WHERE JSON_EXTRACT(doc, ?) IS NOT NULL");
      expect(params).toContain("$.age");
      expect(result).toHaveProperty("data.documents");
    });

    it("should reject SQL injection in filter", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ Field: "doc", Type: "json" }, { Field: "_id", Type: "varchar(32)" }]),
      ); // collection exists

      const tool = tools.find((t) => t.name === "mysql_doc_find");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "users",
          filter: "$') IS NOT NULL OR 1=1 -- " },
        mockContext,
      );

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      // Should NOT have executed the document query
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(0);
    });

    it("should reject invalid JSON path in filter", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ Field: "doc", Type: "json" }, { Field: "_id", Type: "varchar(32)" }]),
      ); // collection exists

      const tool = tools.find((t) => t.name === "mysql_doc_find");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "users",
          filter: "$.age > 20" },
        mockContext,
      );

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
    });

    it("should use schema parameter for collection lookup", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_find");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        { collection: "my_coll", schema: "otherdb" },
        mockContext,
      );

      // Query should use qualified table ref
      const queryCall = mockAdapter.executeQuery.mock.calls[0][0];
      expect(queryCall).toContain("`otherdb`.`my_coll`");
    });

    it("should return exists: false without error field for nonexistent collection", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(Object.assign(new Error("Table 'nonexistent' doesn't exist"), { code: "ER_NO_SUCH_TABLE" }));

      const tool = tools.find((t) => t.name === "mysql_doc_find");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        { collection: "nonexistent_col" },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        success: false,
        error: "Table 'nonexistent' does not exist",
        code: "TABLE_NOT_FOUND",
                category: "resource",
        metrics: { tokenEstimate: expect.any(Number) } });
    });

    it("should handle pre-parsed JSON documents", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ doc: { id: 2, name: "test2" } }]),
        );

      const tool = tools.find((t) => t.name === "mysql_doc_find");
      if (!tool) throw new Error('Tool not found');;
      const result = (await tool.handler(
        { collection: "users" },
        mockContext,
      )) as { data: { documents: any[] } };

      expect(result.data.documents[0]).toEqual({ id: 2, name: "test2" });
    });

    it("should apply filter", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_find");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        { collection: "users", filter: "$.name" },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0];
      const params = mockAdapter.executeQuery.mock.calls[0][1];
      expect(call).toContain("JSON_EXTRACT");
      expect(params).toContain("$.name");
    });

    it("should support field projection", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_find");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        {
          collection: "users",
          fields: ["name", "email"] },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0];
      // Verify exact SQL generation for projection
      expect(call).toContain(
        "JSON_OBJECT('name', JSON_EXTRACT(doc, '$.name'), 'email', JSON_EXTRACT(doc, '$.email')) as doc",
      );
      expect(call).toContain("FROM `users`");
    });

    it("should validate collection name", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_find");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        { collection: "invalid-name; --" },
        mockContext,
      );
      expect(result).toMatchObject({
        success: false,
        error: "Invalid collection name",
        code: "VALIDATION_ERROR",
        category: "validation",
        metrics: { tokenEstimate: expect.any(Number) } });
    });

    it("should return graceful response when collection does not exist", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(Object.assign(new Error("Table 'nonexistent' doesn't exist"), { code: "ER_NO_SUCH_TABLE" }));

      const tool = tools.find((t) => t.name === "mysql_doc_find");
      if (!tool) throw new Error('Tool not found');;
      const result = (await tool.handler(
        { collection: "nonexistent" },
        mockContext,
      )) as { success: boolean; error: string; code: string; category: string };

      expect(result).toMatchObject({
        success: false,
        error: "Table 'nonexistent' does not exist",
        code: "TABLE_NOT_FOUND",
                category: "resource",
        metrics: { tokenEstimate: expect.any(Number) } });

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
    });

    it("should return exists: false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(Object.assign(new Error("Unknown database 'nonexistent_schema'"), { code: "ER_BAD_DB_ERROR" }));

      const tool = tools.find((t) => t.name === "mysql_doc_find");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        { collection: "users", schema: "nonexistent_schema" },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        success: false,
        error: "Unknown database 'nonexistent_schema'",
        code: "SCHEMA_NOT_FOUND",
                category: "resource",
        metrics: { tokenEstimate: expect.any(Number) } });
    });
  });

  describe("mysql_doc_add", () => {
    it("should add documents to collection", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([], 1));

      const tool = tools.find((t) => t.name === "mysql_doc_add");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "users",
          documents: [{ name: "test" }] },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("data.inserted", 1);
    });

    it("should handle multiple documents", async () => {
      mockAdapter.executeQuery
        .mockResolvedValue(createMockQueryResult([], 3));

      const tool = tools.find((t) => t.name === "mysql_doc_add");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "users",
          documents: [{ name: "user1" }, { name: "user2" }, { name: "user3" }] },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1); // 1 bulk insert
      expect(result).toHaveProperty("data.inserted", 3);
    });

    it("should reject invalid collection names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_add");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "invalid-name",
          documents: [{ name: "test" }] },
        mockContext,
      );
      expect(result).toMatchObject({
        success: false,
        error: "Invalid collection name",
        code: "VALIDATION_ERROR",
        category: "validation",
        metrics: { tokenEstimate: expect.any(Number) } });
    });

    it("should return graceful response when collection does not exist", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(Object.assign(new Error("Table 'nonexistent' doesn't exist"), { code: "ER_NO_SUCH_TABLE" }));

      const tool = tools.find((t) => t.name === "mysql_doc_add");
      if (!tool) throw new Error('Tool not found');;
      const result = (await tool.handler(
        {
          collection: "nonexistent",
          documents: [{ name: "test" }] },
        mockContext,
      )) as { success: boolean; error: string; code: string; category: string };

      expect(result).toMatchObject({
        success: false,
        error: "Table 'nonexistent' does not exist",
        code: "TABLE_NOT_FOUND",
                category: "resource",
        metrics: { tokenEstimate: expect.any(Number) } });
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
    });

    it("should return exists: false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(Object.assign(new Error("Unknown database 'nonexistent_schema'"), { code: "ER_BAD_DB_ERROR" }));

      const tool = tools.find((t) => t.name === "mysql_doc_add");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "users",
          schema: "nonexistent_schema",
          documents: [{ name: "test" }] },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        success: false,
        error: "Unknown database 'nonexistent_schema'",
        code: "SCHEMA_NOT_FOUND",
                category: "resource",
        metrics: { tokenEstimate: expect.any(Number) } });
    });

    it("should use schema parameter for collection lookup", async () => {
      mockAdapter.executeQuery
        .mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_add");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        {
          collection: "my_coll",
          schema: "otherdb",
          documents: [{ name: "test" }] },
        mockContext,
      );

      // Insert should use qualified table ref
      const insertCall = mockAdapter.executeQuery.mock.calls[0][0];
      expect(insertCall).toContain("`otherdb`.`my_coll`");
    });
  });

  describe("mysql_doc_modify", () => {
    it("should modify documents with set operation", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([], 5));

      const tool = tools.find((t) => t.name === "mysql_doc_modify");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "users",
          filter: "$.active",
          set: { status: "updated" } },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0];
      expect(call).toContain("JSON_SET");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("data.modified");
    });

    it("should modify with unset operation", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([], 2));

      const tool = tools.find((t) => t.name === "mysql_doc_modify");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        {
          collection: "users",
          filter: "$.deprecated",
          unset: ["oldField"] },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0];
      expect(call).toContain("JSON_REMOVE");
    });

    it("should modify with both set and unset operations", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([], 2));

      const tool = tools.find((t) => t.name === "mysql_doc_modify");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        {
          collection: "users",
          filter: "$.id",
          set: { status: "active" },
          unset: ["temp"] },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0];
      expect(call).toContain("JSON_SET");
      expect(call).toContain("JSON_REMOVE");
      expect(call).toContain("UPDATE `users` SET");
    });

    it("should return error if no modifications specified", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ Field: "doc", Type: "json" }, { Field: "_id", Type: "varchar(32)" }])
      );

      const tool = tools.find((t) => t.name === "mysql_doc_modify");
      if (!tool) throw new Error('Tool not found');;

      const result = await tool.handler(
        {
          collection: "users",
          filter: "$.active" },
        mockContext,
      );
      expect(result).toMatchObject({
        success: false,
        error: "No modifications specified",
        code: "VALIDATION_ERROR",
        category: "validation",
        metrics: { tokenEstimate: expect.any(Number) } });
    });

    it("should reject invalid collection names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_modify");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "invalid-name",
          filter: "$.id",
          set: { a: 1 } },
        mockContext,
      );
      expect(result).toMatchObject({
        success: false,
        error: "Invalid collection name",
        code: "VALIDATION_ERROR",
        category: "validation",
        metrics: { tokenEstimate: expect.any(Number) } });
    });

    it("should return graceful response when collection does not exist", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(Object.assign(new Error("Table 'nonexistent' doesn't exist"), { code: "ER_NO_SUCH_TABLE" }));

      const tool = tools.find((t) => t.name === "mysql_doc_modify");
      if (!tool) throw new Error('Tool not found');;
      const result = (await tool.handler(
        {
          collection: "nonexistent",
          filter: "$.name",
          set: { status: "active" } },
        mockContext,
      )) as { success: boolean; error: string; code: string; category: string };

      expect(result).toMatchObject({
        success: false,
        error: "Table 'nonexistent' does not exist",
        code: "TABLE_NOT_FOUND",
                category: "resource",
        metrics: { tokenEstimate: expect.any(Number) } });
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
    });

    it("should return exists: false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(Object.assign(new Error("Unknown database 'nonexistent_schema'"), { code: "ER_BAD_DB_ERROR" }));

      const tool = tools.find((t) => t.name === "mysql_doc_modify");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "users",
          schema: "nonexistent_schema",
          filter: "$.name",
          set: { status: "active" } },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        success: false,
        error: "Unknown database 'nonexistent_schema'",
        code: "SCHEMA_NOT_FOUND",
                category: "resource",
        metrics: { tokenEstimate: expect.any(Number) } });
    });

    it("should use schema parameter for collection lookup", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([], 2));

      const tool = tools.find((t) => t.name === "mysql_doc_modify");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        {
          collection: "my_coll",
          schema: "otherdb",
          filter: "$.name",
          set: { status: "active" } },
        mockContext,
      );

      const updateCall = mockAdapter.executeQuery.mock.calls[0][0];
      expect(updateCall).toContain("`otherdb`.`my_coll`");
    });
  });

  describe("mysql_doc_remove", () => {
    it("should remove documents matching filter", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([], 3));

      const tool = tools.find((t) => t.name === "mysql_doc_remove");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "users",
          filter: "$.inactive" },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0];
      expect(call).toContain("DELETE FROM");
      expect(call).toContain("JSON_EXTRACT");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("data.removed");
    });

    it("should reject invalid collection names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_remove");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "invalid-name",
          filter: "$.id" },
        mockContext,
      );
      expect(result).toMatchObject({
        success: false,
        error: "Invalid collection name",
        code: "VALIDATION_ERROR",
        category: "validation",
        metrics: { tokenEstimate: expect.any(Number) } });
    });

    it("should return graceful response when collection does not exist", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(Object.assign(new Error("Table 'nonexistent' doesn't exist"), { code: "ER_NO_SUCH_TABLE" }));

      const tool = tools.find((t) => t.name === "mysql_doc_remove");
      if (!tool) throw new Error('Tool not found');;
      const result = (await tool.handler(
        {
          collection: "nonexistent",
          filter: "$.id" },
        mockContext,
      )) as { success: boolean; error: string; code: string; category: string };

      expect(result).toMatchObject({
        success: false,
        error: "Table 'nonexistent' does not exist",
        code: "TABLE_NOT_FOUND",
                category: "resource",
        metrics: { tokenEstimate: expect.any(Number) } });
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
    });

    it("should return exists: false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(Object.assign(new Error("Unknown database 'nonexistent_schema'"), { code: "ER_BAD_DB_ERROR" }));

      const tool = tools.find((t) => t.name === "mysql_doc_remove");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "users",
          schema: "nonexistent_schema",
          filter: "$.id" },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        success: false,
        error: "Unknown database 'nonexistent_schema'",
        code: "SCHEMA_NOT_FOUND",
                category: "resource",
        metrics: { tokenEstimate: expect.any(Number) } });
    });

    it("should use schema parameter for collection lookup", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([], 1));

      const tool = tools.find((t) => t.name === "mysql_doc_remove");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        {
          collection: "my_coll",
          schema: "otherdb",
          filter: "$.name" },
        mockContext,
      );

      const deleteCall = mockAdapter.executeQuery.mock.calls[0][0];
      expect(deleteCall).toContain("`otherdb`.`my_coll`");
    });
  });

  describe("mysql_doc_create_index", () => {
    it("should create index on document fields", async () => {
      mockAdapter.executeQuery
        .mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_index");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "users",
          name: "idx_email",
          fields: [{ path: "email", type: "TEXT" }] },
        mockContext,
      );

      // existence check + adds generated column + creates index
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("data.index", "idx_email");
    });

    it("should create composite index with multiple fields", async () => {
      mockAdapter.executeQuery
        .mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_index");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        {
          collection: "users",
          name: "idx_name_age",
          fields: [
            { path: "name", type: "TEXT" },
            { path: "age", type: "INT" },
          ] },
        mockContext,
      );

      // existence check + 2 generated columns + 1 index creation
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);

      const calls = mockAdapter.executeQuery.mock.calls;
      const indexCall = calls[calls.length - 1][0];
      expect(indexCall).toContain("CREATE INDEX `idx_name_age`");
      expect(indexCall).toContain("_idx_name");
      expect(indexCall).toContain("_idx_age");
    });

    it("should create unique index", async () => {
      mockAdapter.executeQuery
        .mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_index");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        {
          collection: "users",
          name: "idx_unique_email",
          fields: [{ path: "email", type: "TEXT" }],
          unique: true },
        mockContext,
      );

      const calls = mockAdapter.executeQuery.mock.calls;
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall).toContain("UNIQUE INDEX");
    });

    it("should reject invalid collection names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_create_index");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "invalid-name",
          name: "index",
          fields: [{ path: "email", type: "TEXT" }] },
        mockContext,
      );
      expect(result).toMatchObject({
        success: false,
        error: "Invalid collection name",
        code: "VALIDATION_ERROR",
        category: "validation",
        metrics: { tokenEstimate: expect.any(Number) } });
    });

    it("should reject invalid index names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_create_index");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "valid_coll",
          name: "invalid-index",
          fields: [{ path: "email", type: "TEXT" }] },
        mockContext,
      );
      expect(result).toMatchObject({
        success: false,
        error: "Invalid index name",
        code: "VALIDATION_ERROR",
        category: "validation",
        metrics: { tokenEstimate: expect.any(Number) } });
    });

    it("should return graceful response when collection does not exist", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(Object.assign(new Error("Table 'nonexistent' doesn't exist"), { code: "ER_NO_SUCH_TABLE" }));

      const tool = tools.find((t) => t.name === "mysql_doc_create_index");
      if (!tool) throw new Error('Tool not found');;
      const result = (await tool.handler(
        {
          collection: "nonexistent",
          name: "idx_test",
          fields: [{ path: "email", type: "TEXT" }] },
        mockContext,
      )) as { success: boolean; error: string; code: string; category: string };

      expect(result).toMatchObject({
        success: false,
        error: "Table 'nonexistent' does not exist",
        code: "TABLE_NOT_FOUND",
                category: "resource",
        metrics: { tokenEstimate: expect.any(Number) } });
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
    });

    it("should return exists: false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(Object.assign(new Error("Unknown database 'nonexistent_schema'"), { code: "ER_BAD_DB_ERROR" }));

      const tool = tools.find((t) => t.name === "mysql_doc_create_index");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        {
          collection: "users",
          schema: "nonexistent_schema",
          name: "idx_test",
          fields: [{ path: "email", type: "TEXT" }] },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        success: false,
        error: "Unknown database 'nonexistent_schema'",
        code: "SCHEMA_NOT_FOUND",
                category: "resource",
        metrics: { tokenEstimate: expect.any(Number) } });
    });

    it("should use schema parameter for collection lookup", async () => {
      mockAdapter.executeQuery
        .mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_index");
      if (!tool) throw new Error('Tool not found');;
      await tool.handler(
        {
          collection: "my_coll",
          schema: "otherdb",
          name: "idx_name",
          fields: [{ path: "name", type: "TEXT" }] },
        mockContext,
      );

      // ALTER TABLE and CREATE INDEX should use qualified table ref
      const alterCall = mockAdapter.executeQuery.mock.calls[0][0];
      expect(alterCall).toContain("`otherdb`.`my_coll`");
      const indexCall = mockAdapter.executeQuery.mock.calls[1][0];
      expect(indexCall).toContain("`otherdb`.`my_coll`");
    });

    it("should return graceful error on duplicate column", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([])) // ALTER TABLE (ignored if it throws duplicate column, but let's resolve it)
        .mockRejectedValueOnce(new Error("Duplicate key name 'idx_email'"));

      const tool = tools.find((t) => t.name === "mysql_doc_create_index");
      if (!tool) throw new Error('Tool not found');;
      const result = (await tool.handler(
        {
          collection: "users",
          name: "idx_email",
          fields: [{ path: "email", type: "TEXT" }] },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result).toHaveProperty("success", false);
      expect((result as any).error).toContain("already exist");
    });
  });

  describe("mysql_doc_collection_info", () => {
    it("should get collection statistics", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ Field: "doc", Type: "json" }, { Field: "_id", Type: "varbinary(32)" }])) // checkCollectionExists
        .mockResolvedValueOnce(createMockQueryResult([{ Rows: 1000, Data_length: 50000, Index_length: 10000 }])) // SHOW TABLE STATUS
        .mockResolvedValueOnce(createMockQueryResult([{ Key_name: "PRIMARY", Column_name: "_id", Seq_in_index: 1, Non_unique: 0 }])); // SHOW KEYS

      const tool = tools.find((t) => t.name === "mysql_doc_collection_info");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler({ collection: "users" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);
      expect(result).toHaveProperty("data.collection", "users");
      expect(result).toHaveProperty("data.info");
      expect(result).toHaveProperty("data.info.indexes");
    });

    it("should reject invalid collection names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_collection_info");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        { collection: "invalid-nam$" },
        mockContext,
      );
      expect(result).toMatchObject({
        success: false,
        error: "Invalid collection name",
        code: "VALIDATION_ERROR",
        category: "validation",
        metrics: { tokenEstimate: expect.any(Number) } });
    });

    it("should return graceful response when collection does not exist", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(Object.assign(new Error("Table 'nonexistent' doesn't exist"), { code: "ER_NO_SUCH_TABLE" })); 

      const tool = tools.find((t) => t.name === "mysql_doc_collection_info");
      if (!tool) throw new Error('Tool not found');;
      const result = (await tool.handler(
        { collection: "nonexistent" },
        mockContext,
      )) as { success: boolean; error: string; code: string; category: string };

      expect(result).toMatchObject({
        success: false,
        error: "Collection 'nonexistent' does not exist",
        code: "TABLE_NOT_FOUND",
                category: "resource",
        metrics: { tokenEstimate: expect.any(Number) } });
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
    });

    it("should return exists: false for nonexistent schema", async () => {
      const dbError = new Error("Unknown database 'nonexistent_schema'");
      (dbError as any).code = "ER_BAD_DB_ERROR";
      mockAdapter.executeQuery.mockRejectedValueOnce(dbError);

      const tool = tools.find((t) => t.name === "mysql_doc_collection_info");
      if (!tool) throw new Error('Tool not found');;
      const result = await tool.handler(
        { collection: "users", schema: "nonexistent_schema" },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        success: false,
        error: "Unknown database 'nonexistent_schema'",
        code: "SCHEMA_NOT_FOUND",
        metrics: { tokenEstimate: expect.any(Number) } });
    });
  });
});
