/**
 * E2E Tests: Structured Error Responses
 *
 * Validates that tools return consistent structured error responses
 * instead of crashing or returning unstructured text.
 */

import { test, expect } from "@playwright/test";
import { createClient, callToolAndParse, callToolRaw } from "./helpers.js";
import type { Client } from "@modelcontextprotocol/client";

test.describe.configure({ mode: "serial" });

test.describe("Structured Error Responses", () => {
  let client: Client;

  test.beforeAll(async () => {
    client = await createClient();
  });

  test.afterAll(async () => {
    await client.close();
  });

  test("should return structured error for nonexistent table", async () => {
    const parsed = await callToolAndParse(client, "mysql_read_query", { 
      query: "SELECT * FROM nonexistent_table_xyz" 
    });

    expect(parsed.success).toBe(false);
    expect(typeof parsed.error).toBe("string");
  });

  test("should return error for nonexistent column", async () => {
    const parsed = await callToolAndParse(client, "mysql_stats_descriptive", {
      table: "test_products",
      column: "nonexistent_column_xyz",
    });

    expect(parsed.success).toBe(false);
    expect(typeof parsed.error).toBe("string");
  });

  test("should reject INSERT in read_query", async () => {
    try {
      const response = await callToolRaw(client, "mysql_read_query", { 
        query: "INSERT INTO test_products (name) VALUES ('bad')" 
      });

      const text = response.content[0].text;
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
      const response = await callToolRaw(client, "mysql_write_query", { 
        query: "SELECT * FROM test_products" 
      });

      const text = response.content[0].text;
      expect(text.toLowerCase()).toMatch(/not allowed|write|invalid|error/);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message.toLowerCase()).toMatch(/not allowed|write|invalid/);
    }
  });

  test("should return structured error for invalid JSON path", async () => {
    const parsed = await callToolAndParse(client, "mysql_json_extract", {
      table: "test_json_docs",
      column: "doc",
      path: "!!!invalid!!!",
    });

    expect(parsed.success).toBe(false);
    expect(typeof parsed.error).toBe("string");
  });

  test("should return structured error for describe nonexistent table", async () => {
    const parsed = await callToolAndParse(client, "mysql_describe_table", { 
      table: "nonexistent_table_xyz" 
    });

    // mysql_describe_table now uses standard error pattern { success: false, error: ... }
    expect(parsed.success).toBe(false);
    expect(typeof parsed.error).toBe("string");
  });
});
