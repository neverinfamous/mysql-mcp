import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse, skipIfSuperReadOnly } from "./helpers.js";
import type { Client } from "@modelcontextprotocol/client";

test.describe.configure({ mode: "serial" });

test.describe("E2E Tool Execution (via MCP SDK Client)", () => {
  let client: Client;

  test.beforeAll(async () => {
    client = await createClient();
  });

  test.afterAll(async () => {
    await client.close();
  });

  test("should list available tools", async () => {
    const listResponse = await client.listTools();

    expect(listResponse.tools).toBeDefined();
    expect(Array.isArray(listResponse.tools)).toBe(true);
    expect(listResponse.tools.length).toBeGreaterThan(0);

    const toolNames = listResponse.tools.map((t) => t.name);
    expect(toolNames).toContain("mysql_list_tables");
    expect(toolNames).toContain("mysql_read_query");
  });

  test("should execute a read tool successfully (mysql_list_tables)", async () => {
    const parsed = await callToolAndParse(client, "mysql_list_tables", {});
    console.log("PARSED_DATA_LOG:", JSON.stringify(parsed, null, 2));
    expect(parsed.data).toHaveProperty("tables");
    expect(Array.isArray(parsed.data?.tables)).toBe(true);
    expect(parsed.data).toHaveProperty("count");
    expect(typeof parsed.data?.count).toBe("number");
  });

  test("should return formatted MCP error for validation failures (mysql_read_query)", async () => {
    try {
      const parsed = await callToolAndParse(client, "mysql_read_query", {});
      // Usually validation errors come back as structured JSON errors from the wrapper
      expect(parsed.success).toBe(false);
      expect(typeof parsed.error).toBe("string");
      expect((parsed.error as string).toLowerCase()).toContain("required");
    } catch (error: unknown) {
      // Or they might throw an SDK error
      const message = error instanceof Error ? error.message : String(error);
      expect(message.toLowerCase()).toContain("required");
    }
  });

  test("should execute a write tool successfully (mysql_write_query)", async () => {
    await skipIfSuperReadOnly(client);
    const createParsed = await callToolAndParse(client, "mysql_write_query", {
      query:
        "CREATE TABLE IF NOT EXISTS _e2e_test_write (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255))",
    });
    if (!createParsed.success) console.log('ERROR:', createParsed.error);
    expect(createParsed.success).toBe(true);

    await callToolAndParse(client, "mysql_write_query", { 
      query: "DROP TABLE IF EXISTS _e2e_test_write" 
    });
  });

  test("should execute code mode (mysql_execute_code)", async () => {
    const parsed = await callToolAndParse(client, "mysql_execute_code", {
      code: "const tables = await mysql.core.listTables(); return tables;",
    });

    expect(parsed).toHaveProperty("result");
    expect((parsed as Record<string, unknown>).result).toBeDefined();
  });

  // --- Cross-group tool coverage (all standard groups via --tool-filter -ecosystem,+codemode) ---

  test("should describe a table (core: mysql_describe_table)", async () => {
    const parsed = await callToolAndParse(client, "mysql_describe_table", { 
      table: "test_products" 
    });

    expect(parsed.data).toHaveProperty("columns");
    expect(Array.isArray(parsed.data?.columns)).toBe(true);
  });

  test("should extract JSON (json: mysql_json_extract)", async () => {
    const parsed = await callToolAndParse(client, "mysql_json_extract", {
      table: "test_json_docs",
      column: "doc",
      path: "$.type",
    });

    expect(parsed.success).toBe(true);
  });

  test("should get indexes (core: mysql_get_indexes)", async () => {
    const parsed = await callToolAndParse(client, "mysql_get_indexes", { 
      table: "test_products" 
    });

    expect(parsed.data).toHaveProperty("indexes");
    expect(Array.isArray(parsed.data?.indexes)).toBe(true);
  });

  test("should begin and rollback transaction (transactions group)", async () => {
    const beginParsed = await callToolAndParse(client, "mysql_transaction_begin", {});

    expect(beginParsed).toHaveProperty("data.transactionId");

    const rollbackParsed = await callToolAndParse(client, "mysql_transaction_rollback", { 
      transactionId: beginParsed.data?.transactionId 
    });

    expect(rollbackParsed.success).toBe(true);
  });

  test("should search with LIKE (text: mysql_like_search)", async () => {
    const parsed = await callToolAndParse(client, "mysql_like_search", {
      table: "test_products",
      column: "name",
      pattern: "%Pro%",
    });

    expect(parsed.success).toBe(true);
  });

  test("should explain a query (performance: mysql_explain)", async () => {
    const parsed = await callToolAndParse(client, "mysql_explain", { 
      query: "SELECT * FROM test_products WHERE id = 1" 
    });

    expect(parsed.success).toBe(true);
  });

  test("should show server status (monitoring: mysql_show_status)", async () => {
    const parsed = await callToolAndParse(client, "mysql_show_status", {});
    expect(parsed.success).toBe(true);
  });

  test("should list schemas (schema: mysql_list_schemas)", async () => {
    const parsed = await callToolAndParse(client, "mysql_list_schemas", {});
    expect(parsed.success).toBe(true);
  });

  test("should check SSL status (security: mysql_security_ssl_status)", async () => {
    const parsed = await callToolAndParse(client, "mysql_security_ssl_status", {});
    expect(parsed.success).toBe(true);
  });

  test("should compute stats (stats: mysql_stats_descriptive)", async () => {
    const parsed = await callToolAndParse(client, "mysql_stats_descriptive", { 
      table: "test_products", column: "price" 
    });

    expect(parsed.success).toBe(true);
  });

  test("should list doc collections (docstore: mysql_doc_list_collections)", async () => {
    const parsed = await callToolAndParse(client, "mysql_doc_list_collections", {});
    expect(parsed.success).toBe(true);
  });

  test("should search fulltext (fulltext: mysql_fulltext_search)", async () => {
    const parsed = await callToolAndParse(client, "mysql_fulltext_search", {
      table: "test_articles",
      columns: ["title", "body"],
      query: "MySQL database",
    });

    expect(parsed.success).toBe(true);
  });

  test("should check scheduler status (events: mysql_scheduler_status)", async () => {
    const parsed = await callToolAndParse(client, "mysql_scheduler_status", {});
    expect(parsed.success).toBe(true);
  });
});
