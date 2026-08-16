/**
 * E2E Tests: Streamable HTTP Transport (MCP 2025-03-26)
 *
 * Validates that the modern Streamable HTTP transport works
 * alongside the legacy SSE transport for all MCP operations.
 */

import { test, expect } from "@playwright/test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { callToolAndParse } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Streamable HTTP Transport (MCP 2025-03-26)", () => {
  let client: Client;

  test.beforeAll(async () => {
    const transport = new StreamableHTTPClientTransport(
      new URL("http://127.0.0.1:3103/mcp"),
    );
    client = new Client(
      { name: "playwright-streamable-test", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
  });

  test.afterAll(async () => {
    await client.close();
  });

  test("should initialize via Streamable HTTP", async () => {
    const listResponse = await client.listTools();

    expect(listResponse.tools).toBeDefined();
    expect(Array.isArray(listResponse.tools)).toBe(true);
    expect(listResponse.tools.length).toBeGreaterThan(0);
  });

  test("should list and execute tools via Streamable HTTP", async () => {
    const parsed = await callToolAndParse(client, "mysql_list_tables", {});
    expect(parsed.data).toHaveProperty("tables");
  });

  test("should call a read tool via Streamable HTTP", async () => {
    const parsed = await callToolAndParse(client, "mysql_read_query", { 
      query: "SELECT 1 AS test_value" 
    });
    expect(parsed.success).toBe(true);
  });

  test("should list resources via Streamable HTTP", async () => {
    const response = await client.listResources();

    expect(response.resources).toBeDefined();
    expect(Array.isArray(response.resources)).toBe(true);
    expect(response.resources.length).toBeGreaterThan(0);
  });

  test("should read a resource via Streamable HTTP", async () => {
    const response = await client.readResource({
      uri: "mysql://status",
    });

    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);
  });

  test("should list and get prompts via Streamable HTTP", async () => {
    const listResponse = await client.listPrompts();
    expect(listResponse.prompts).toBeDefined();
    expect(listResponse.prompts.length).toBeGreaterThan(0);

    const response = await client.getPrompt({
      name: "mysql_tool_index",
      arguments: {},
    });
    expect(response.messages).toBeDefined();
    expect(response.messages.length).toBeGreaterThan(0);
  });
});

