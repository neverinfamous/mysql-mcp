import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

test.describe.configure({ mode: "serial" });

test.describe("E2E Tool Execution (via MCP SDK Client)", () => {
  let client: Client;

  test.beforeAll(async () => {
    const transport = new SSEClientTransport(
      new URL("http://localhost:3000/sse"),
    );
    client = new Client(
      { name: "playwright-test-client", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
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
    const response = await client.callTool({
      name: "mysql_list_tables",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.content[0].type).toBe("text");
    const textOutput = (response.content[0] as any).text as string;
    const parsed = JSON.parse(textOutput);
    expect(parsed).toHaveProperty("tables");
    expect(Array.isArray(parsed.tables)).toBe(true);
    expect(parsed).toHaveProperty("count");
    expect(typeof parsed.count).toBe("number");
  });

  test("should return formatted MCP error for validation failures (mysql_read_query)", async () => {
    try {
      const response = await client.callTool({
        name: "mysql_read_query",
        arguments: {},
      });

      expect(Array.isArray(response.content)).toBe(true);
      if (response.content.length > 0) {
        expect(response.content[0].type).toBe("text");
        const errorText = (response.content[0] as any).text as string;
        expect(errorText.toLowerCase()).toContain("required");
      }
    } catch (error: any) {
      expect(error.message.toLowerCase()).toContain("required");
    }
  });

  test("should execute a write tool successfully (mysql_write_query)", async () => {
    const createResponse = await client.callTool({
      name: "mysql_write_query",
      arguments: {
        query:
          "CREATE TABLE IF NOT EXISTS _e2e_test_write (id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255))",
      },
    });

    expect(createResponse.isError).toBeUndefined();
    expect(Array.isArray(createResponse.content)).toBe(true);

    await client.callTool({
      name: "mysql_write_query",
      arguments: { query: "DROP TABLE IF EXISTS _e2e_test_write" },
    });
  });

  test("should execute code mode (mysql_execute_code)", async () => {
    const response = await client.callTool({
      name: "mysql_execute_code",
      arguments: {
        code: "const tables = await mysql.core.listTables(); return tables;",
      },
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.content[0].type).toBe("text");

    const textOutput = (response.content[0] as any).text as string;
    const parsed = JSON.parse(textOutput);
    expect(parsed).toHaveProperty("result");
    expect(parsed.result).toHaveProperty("tables");
  });

  // --- Cross-group tool coverage (all standard groups via --tool-filter -ecosystem,+codemode) ---

  test("should describe a table (core: mysql_describe_table)", async () => {
    const response = await client.callTool({
      name: "mysql_describe_table",
      arguments: { table: "test_products" },
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray(response.content)).toBe(true);
    const parsed = JSON.parse((response.content[0] as any).text);
    expect(parsed).toHaveProperty("columns");
    expect(Array.isArray(parsed.columns)).toBe(true);
  });

  test("should extract JSON (json: mysql_json_extract)", async () => {
    const response = await client.callTool({
      name: "mysql_json_extract",
      arguments: {
        table: "test_json_docs",
        column: "doc",
        path: "$.type",
      },
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.content[0].type).toBe("text");
  });

  test("should get indexes (core: mysql_get_indexes)", async () => {
    const response = await client.callTool({
      name: "mysql_get_indexes",
      arguments: { table: "test_products" },
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray(response.content)).toBe(true);
    const parsed = JSON.parse((response.content[0] as any).text);
    expect(parsed).toHaveProperty("indexes");
    expect(Array.isArray(parsed.indexes)).toBe(true);
  });

  test("should begin and rollback transaction (transactions group)", async () => {
    const beginResponse = await client.callTool({
      name: "mysql_transaction_begin",
      arguments: {},
    });

    expect(beginResponse.isError).toBeUndefined();
    const beginParsed = JSON.parse(
      (beginResponse.content[0] as any).text,
    );
    expect(beginParsed).toHaveProperty("transactionId");

    const rollbackResponse = await client.callTool({
      name: "mysql_transaction_rollback",
      arguments: { transactionId: beginParsed.transactionId },
    });

    expect(rollbackResponse.isError).toBeUndefined();
  });

  test("should search with LIKE (text: mysql_like_search)", async () => {
    const response = await client.callTool({
      name: "mysql_like_search",
      arguments: {
        table: "test_products",
        column: "name",
        pattern: "%Pro%",
      },
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content.length).toBeGreaterThan(0);
    expect(response.content[0].type).toBe("text");
  });

  test("should explain a query (performance: mysql_explain)", async () => {
    const response = await client.callTool({
      name: "mysql_explain",
      arguments: { query: "SELECT * FROM test_products WHERE id = 1" },
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content.length).toBeGreaterThan(0);
  });

  test("should show server status (monitoring: mysql_show_status)", async () => {
    const response = await client.callTool({
      name: "mysql_show_status",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content.length).toBeGreaterThan(0);
  });

  test("should list schemas (schema: mysql_list_schemas)", async () => {
    const response = await client.callTool({
      name: "mysql_list_schemas",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content.length).toBeGreaterThan(0);
  });

  test("should check SSL status (security: mysql_security_ssl_status)", async () => {
    const response = await client.callTool({
      name: "mysql_security_ssl_status",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content.length).toBeGreaterThan(0);
  });

  test("should compute stats (stats: mysql_stats_descriptive)", async () => {
    const response = await client.callTool({
      name: "mysql_stats_descriptive",
      arguments: { table: "test_products", column: "price" },
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content.length).toBeGreaterThan(0);
  });

  test("should list doc collections (docstore: mysql_doc_list_collections)", async () => {
    const response = await client.callTool({
      name: "mysql_doc_list_collections",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content.length).toBeGreaterThan(0);
  });

  test("should search fulltext (fulltext: mysql_fulltext_search)", async () => {
    const response = await client.callTool({
      name: "mysql_fulltext_search",
      arguments: {
        table: "test_articles",
        columns: ["title", "body"],
        query: "MySQL database",
      },
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content.length).toBeGreaterThan(0);
  });

  test("should check scheduler status (events: mysql_scheduler_status)", async () => {
    const response = await client.callTool({
      name: "mysql_scheduler_status",
      arguments: {},
    });

    expect(response.isError).toBeUndefined();
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content.length).toBeGreaterThan(0);
  });
});
