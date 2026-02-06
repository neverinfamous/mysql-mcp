/**
 * mysql-mcp - DocStore Tools Unit Tests
 *
 * Tests for document store tool definitions and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getDocStoreTools } from "../docstore.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../__tests__/mocks/index.js";

describe("getDocStoreTools", () => {
  let tools: ReturnType<typeof getDocStoreTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getDocStoreTools(
      createMockMySQLAdapter() as unknown as MySQLAdapter,
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
    tools = getDocStoreTools(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  describe("mysql_doc_list_collections", () => {
    it("should list document collections", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ name: "users_collection", rowCount: 100 }]),
      );

      const tool = tools.find((t) => t.name === "mysql_doc_list_collections")!;
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toHaveProperty("collections");
      expect(result).toHaveProperty("count");
    });

    it("should filter by schema", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_list_collections")!;
      await tool.handler({ schema: "mydb" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        ["mydb", "mydb"],
      );
    });
  });

  describe("mysql_doc_create_collection", () => {
    it("should create a new collection", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_collection")!;
      const result = await tool.handler({ name: "products" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("CREATE TABLE");
      expect(call).toContain("doc JSON");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("collection", "products");
    });

    it("should reject invalid collection names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_create_collection")!;

      await expect(
        tool.handler({ name: "invalid-name" }, mockContext),
      ).rejects.toThrow("Invalid collection name");
    });

    it("should add validation when specified", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_collection")!;
      await tool.handler(
        {
          name: "validated_docs",
          validation: { level: "STRICT", schema: { type: "object" } },
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_SCHEMA_VALID");
    });

    it("should use default validation level when not specified", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_collection")!;
      await tool.handler({ name: "default_val" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).not.toContain("JSON_SCHEMA_VALID");
    });

    it("should support ifNotExists parameter", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_collection")!;
      await tool.handler(
        { name: "my_collection", ifNotExists: true },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("CREATE TABLE IF NOT EXISTS");
    });

    it("should not use IF NOT EXISTS by default", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_collection")!;
      await tool.handler({ name: "my_collection" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("CREATE TABLE `my_collection`");
      expect(call).not.toContain("IF NOT EXISTS");
    });
  });

  describe("mysql_doc_drop_collection", () => {
    it("should drop collection with IF EXISTS by default", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_drop_collection")!;
      const result = await tool.handler({ name: "users" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("DROP TABLE IF EXISTS `users`");
      expect(result).toHaveProperty("success", true);
    });

    it("should drop collection without IF EXISTS when requested", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_drop_collection")!;
      await tool.handler({ name: "users", ifExists: false }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toBe("DROP TABLE `users`");
    });

    it("should reject invalid collection names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_drop_collection")!;
      await expect(
        tool.handler({ name: "bad;drop table users" }, mockContext),
      ).rejects.toThrow("Invalid collection name");
    });
  });

  describe("mysql_doc_find", () => {
    it("should query documents with filters", async () => {
      // First call: collection existence check
      // Second call: actual document query
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ "1": 1 }])) // collection exists
        .mockResolvedValueOnce(
          createMockQueryResult([{ doc: '{"name": "test"}' }]),
        );

      const tool = tools.find((t) => t.name === "mysql_doc_find")!;
      const result = await tool.handler(
        {
          collection: "users",
          filter: "$.age > 20",
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      const call = mockAdapter.executeQuery.mock.calls[1][0] as string;
      expect(call).toContain(
        "WHERE JSON_EXTRACT(doc, '$.age > 20') IS NOT NULL",
      );
      expect(result).toHaveProperty("documents");
    });

    it("should handle pre-parsed JSON documents", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ "1": 1 }])) // collection exists
        .mockResolvedValueOnce(
          createMockQueryResult([{ doc: { id: 2, name: "test2" } }]),
        );

      const tool = tools.find((t) => t.name === "mysql_doc_find")!;
      const result = (await tool.handler(
        { collection: "users" },
        mockContext,
      )) as { documents: any[] };

      expect(result.documents[0]).toEqual({ id: 2, name: "test2" });
    });

    it("should apply filter", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ "1": 1 }])) // collection exists
        .mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_find")!;
      await tool.handler(
        { collection: "users", filter: "$.name" },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[1][0] as string;
      expect(call).toContain("JSON_EXTRACT");
      expect(call).toContain("$.name");
    });

    it("should support field projection", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ "1": 1 }])) // collection exists
        .mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_find")!;
      await tool.handler(
        {
          collection: "users",
          fields: ["name", "email"],
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[1][0] as string;
      // Verify exact SQL generation for projection
      expect(call).toContain(
        "JSON_OBJECT('name', JSON_EXTRACT(doc, '$.name'), 'email', JSON_EXTRACT(doc, '$.email')) as doc",
      );
      expect(call).toContain("FROM `users`");
    });

    it("should validate collection name", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_find")!;
      await expect(
        tool.handler({ collection: "invalid-name; --" }, mockContext),
      ).rejects.toThrow("Invalid collection name");
    });

    it("should return graceful response when collection does not exist", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([])); // collection does not exist

      const tool = tools.find((t) => t.name === "mysql_doc_find")!;
      const result = (await tool.handler(
        { collection: "nonexistent" },
        mockContext,
      )) as {
        exists: boolean;
        error: string;
        documents: unknown[];
        count: number;
      };

      expect(result).toHaveProperty("exists", false);
      expect(result).toHaveProperty("error", "Collection does not exist");
      expect(result).toHaveProperty("documents", []);
      expect(result).toHaveProperty("count", 0);
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe("mysql_doc_add", () => {
    it("should add documents to collection", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_add")!;
      const result = await tool.handler(
        {
          collection: "users",
          documents: [{ name: "test" }],
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("inserted", 1);
    });

    it("should handle multiple documents", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_add")!;
      const result = await tool.handler(
        {
          collection: "users",
          documents: [{ name: "user1" }, { name: "user2" }, { name: "user3" }],
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);
      expect(result).toHaveProperty("inserted", 3);
    });

    it("should reject invalid collection names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_add")!;
      await expect(
        tool.handler(
          {
            collection: "invalid-name",
            documents: [{ name: "test" }],
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid collection name");
    });
  });

  describe("mysql_doc_modify", () => {
    it("should modify documents with set operation", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([], 5));

      const tool = tools.find((t) => t.name === "mysql_doc_modify")!;
      const result = await tool.handler(
        {
          collection: "users",
          filter: "$.active",
          set: { status: "updated" },
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_SET");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("modified");
    });

    it("should modify with unset operation", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([], 2));

      const tool = tools.find((t) => t.name === "mysql_doc_modify")!;
      await tool.handler(
        {
          collection: "users",
          filter: "$.deprecated",
          unset: ["oldField"],
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_REMOVE");
    });

    it("should modify with both set and unset operations", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([], 2));

      const tool = tools.find((t) => t.name === "mysql_doc_modify")!;
      await tool.handler(
        {
          collection: "users",
          filter: "$.id",
          set: { status: "active" },
          unset: ["temp"],
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_SET");
      expect(call).toContain("JSON_REMOVE");
      expect(call).toContain("UPDATE `users` SET");
    });

    it("should throw if no modifications specified", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_modify")!;

      await expect(
        tool.handler(
          {
            collection: "users",
            filter: "$.active",
          },
          mockContext,
        ),
      ).rejects.toThrow("No modifications specified");
    });

    it("should reject invalid collection names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_modify")!;
      await expect(
        tool.handler(
          {
            collection: "invalid-name",
            filter: "$.id",
            set: { a: 1 },
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid collection name");
    });
  });

  describe("mysql_doc_remove", () => {
    it("should remove documents matching filter", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([], 3));

      const tool = tools.find((t) => t.name === "mysql_doc_remove")!;
      const result = await tool.handler(
        {
          collection: "users",
          filter: "$.inactive",
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("DELETE FROM");
      expect(call).toContain("JSON_EXTRACT");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("removed");
    });

    it("should reject invalid collection names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_remove")!;
      await expect(
        tool.handler(
          {
            collection: "invalid-name",
            filter: "$.id",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid collection name");
    });
  });

  describe("mysql_doc_create_index", () => {
    it("should create index on document fields", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_index")!;
      const result = await tool.handler(
        {
          collection: "users",
          name: "idx_email",
          fields: [{ path: "email", type: "TEXT" }],
        },
        mockContext,
      );

      // First adds generated column, then creates index
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("index", "idx_email");
    });

    it("should create composite index with multiple fields", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_index")!;
      await tool.handler(
        {
          collection: "users",
          name: "idx_name_age",
          fields: [
            { path: "name", type: "TEXT" },
            { path: "age", type: "INT" },
          ],
        },
        mockContext,
      );

      // 2 generated columns + 1 index creation
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);

      const calls = mockAdapter.executeQuery.mock.calls;
      const indexCall = calls[calls.length - 1][0] as string;
      expect(indexCall).toContain("CREATE INDEX `idx_name_age`");
      expect(indexCall).toContain("_idx_name");
      expect(indexCall).toContain("_idx_age");
    });

    it("should create unique index", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_doc_create_index")!;
      await tool.handler(
        {
          collection: "users",
          name: "idx_unique_email",
          fields: [{ path: "email", type: "TEXT" }],
          unique: true,
        },
        mockContext,
      );

      const calls = mockAdapter.executeQuery.mock.calls;
      const lastCall = calls[calls.length - 1][0] as string;
      expect(lastCall).toContain("UNIQUE INDEX");
    });

    it("should reject invalid collection names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_create_index")!;
      await expect(
        tool.handler(
          {
            collection: "invalid-name",
            name: "index",
            fields: [{ path: "email", type: "TEXT" }],
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid collection name");
    });

    it("should reject invalid index names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_create_index")!;
      await expect(
        tool.handler(
          {
            collection: "valid_coll",
            name: "invalid-index",
            fields: [{ path: "email", type: "TEXT" }],
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid index name");
    });
  });

  describe("mysql_doc_collection_info", () => {
    it("should get collection statistics", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ rowCount: 1000 }])) // COUNT(*) query
        .mockResolvedValueOnce(
          createMockQueryResult([{ dataSize: 50000, indexSize: 10000 }]),
        ) // INFORMATION_SCHEMA.TABLES
        .mockResolvedValueOnce(
          createMockQueryResult([{ INDEX_NAME: "PRIMARY" }]),
        ); // INFORMATION_SCHEMA.STATISTICS

      const tool = tools.find((t) => t.name === "mysql_doc_collection_info")!;
      const result = await tool.handler({ collection: "users" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);
      expect(result).toHaveProperty("collection", "users");
      expect(result).toHaveProperty("stats");
      expect(result).toHaveProperty("indexes");
    });

    it("should reject invalid collection names", async () => {
      const tool = tools.find((t) => t.name === "mysql_doc_collection_info")!;
      await expect(
        tool.handler({ collection: "invalid-nam$" }, mockContext),
      ).rejects.toThrow("Invalid collection name");
    });
  });
});
