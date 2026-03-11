/**
 * E2E Tests: Structured Error Responses
 *
 * Validates that tools return consistent structured error responses
 * instead of crashing or returning unstructured text.
 */

import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

test.describe.configure({ mode: "serial" });

test.describe("Structured Error Responses", () => {
  let client: Client;

  test.beforeAll(async () => {
    const transport = new SSEClientTransport(
      new URL("http://localhost:3000/sse"),
    );
    client = new Client(
      { name: "playwright-errors-test", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
  });

  test.afterAll(async () => {
    await client.close();
  });

  test("should return structured error for nonexistent table", async () => {
    const response = await client.callTool({
      name: "mysql_read_query",
      arguments: { query: "SELECT * FROM nonexistent_table_xyz" },
    });

    expect(Array.isArray(response.content)).toBe(true);
    const parsed = JSON.parse((response.content[0] as any).text);
    expect(parsed.success).toBe(false);
    expect(typeof parsed.error).toBe("string");
  });

  test("should return error for nonexistent column", async () => {
    const response = await client.callTool({
      name: "mysql_stats_descriptive",
      arguments: {
        table: "test_products",
        column: "nonexistent_column_xyz",
      },
    });

    expect(Array.isArray(response.content)).toBe(true);
    const parsed = JSON.parse((response.content[0] as any).text);
    expect(parsed.success).toBe(false);
    expect(typeof parsed.error).toBe("string");
  });

  test("should reject INSERT in read_query", async () => {
    try {
      const response = await client.callTool({
        name: "mysql_read_query",
        arguments: { query: "INSERT INTO test_products (name) VALUES ('bad')" },
      });

      expect(Array.isArray(response.content)).toBe(true);
      const text = (response.content[0] as any).text as string;
      // Should reject mutation in read_query (either structured error or MCP error)
      expect(text.toLowerCase()).toMatch(/not allowed|read-only|invalid|error/);
    } catch (error: unknown) {
      // MCP protocol error is also acceptable
      const message = error instanceof Error ? error.message : String(error);
      expect(message.toLowerCase()).toMatch(/not allowed|read-only|invalid/);
    }
  });

  test("should reject SELECT in write_query", async () => {
    try {
      const response = await client.callTool({
        name: "mysql_write_query",
        arguments: { query: "SELECT * FROM test_products" },
      });

      expect(Array.isArray(response.content)).toBe(true);
      const text = (response.content[0] as any).text as string;
      expect(text.toLowerCase()).toMatch(/not allowed|write|invalid|error/);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message.toLowerCase()).toMatch(/not allowed|write|invalid/);
    }
  });

  test("should return structured error for invalid JSON path", async () => {
    const response = await client.callTool({
      name: "mysql_json_extract",
      arguments: {
        table: "test_json_docs",
        column: "doc",
        path: "!!!invalid!!!",
      },
    });

    expect(Array.isArray(response.content)).toBe(true);
    const parsed = JSON.parse((response.content[0] as any).text);
    expect(parsed.success).toBe(false);
    expect(typeof parsed.error).toBe("string");
  });

  test("should return structured error for describe nonexistent table", async () => {
    const response = await client.callTool({
      name: "mysql_describe_table",
      arguments: { table: "nonexistent_table_xyz" },
    });

    expect(Array.isArray(response.content)).toBe(true);
    const parsed = JSON.parse((response.content[0] as any).text);
    // mysql_describe_table uses { exists: false } pattern (P154)
    expect(parsed.exists).toBe(false);
  });
});
