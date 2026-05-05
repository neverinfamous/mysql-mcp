/**
 * E2E Tests: MCP Prompt Reads via SDK Client
 *
 * Verifies all 19 prompts are registered and return structured
 * content when invoked via the MCP SDK client.
 */

import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

test.describe.configure({ mode: "serial" });

test.describe("E2E Prompt Reads (via MCP SDK Client)", () => {
  let client: Client;

  test.beforeAll(async () => {
    const transport = new SSEClientTransport(
      new URL("http://localhost:3000/sse"),
    );
    client = new Client(
      { name: "playwright-prompt-test", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
  });

  test.afterAll(async () => {
    await client.close();
  });

  const EXPECTED_PROMPTS = [
    "mysql_query_builder",
    "mysql_tool_index",
    "mysql_quick_query",
    "mysql_quick_schema",
    "mysql_schema_design",
    "mysql_performance_analysis",
    "mysql_migration",
    "mysql_database_health_check",
    "mysql_backup_strategy",
    "mysql_index_tuning",
    "mysql_setup_router",
    "mysql_setup_proxysql",
    "mysql_setup_replication",
    "mysql_setup_shell",
    "mysql_setup_events",
    "mysql_sys_schema_guide",
    "mysql_setup_spatial",
    "mysql_setup_cluster",
    "mysql_setup_docstore",
  ];

  test("should list all 19 prompts", async () => {
    const listResponse = await client.listPrompts();

    expect(listResponse.prompts).toBeDefined();
    expect(listResponse.prompts.length).toBe(19);

    const names = listResponse.prompts.map((p) => p.name);
    for (const expected of EXPECTED_PROMPTS) {
      expect(names).toContain(expected);
    }
  });

  test("should get mysql_query_builder prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_query_builder",
      arguments: { operation: "SELECT", table: "users" },
    });

    expect(response.messages).toBeDefined();
    expect(response.messages.length).toBeGreaterThan(0);
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("query");
  });

  test("should get mysql_tool_index prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_tool_index",
      arguments: {},
    });

    expect(response.messages).toBeDefined();
    expect(response.messages.length).toBeGreaterThan(0);
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("tool");
  });

  test("should get mysql_quick_query prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_quick_query",
      arguments: { sql: "SELECT * FROM users" },
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("mysql_read_query");
  });

  test("should get mysql_quick_schema prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_quick_schema",
      arguments: {},
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("mysql_list_tables");
  });

  test("should get mysql_schema_design prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_schema_design",
      arguments: { entity: "User" },
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("CREATE TABLE");
  });

  test("should get mysql_performance_analysis prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_performance_analysis",
      arguments: { query: "SELECT * FROM slow_table" },
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("EXPLAIN");
  });

  test("should get mysql_migration prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_migration",
      arguments: { change: "Add column", table: "users" },
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("migration");
  });

  test("should get mysql_database_health_check prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_database_health_check",
      arguments: {},
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("health");
  });

  test("should get mysql_backup_strategy prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_backup_strategy",
      arguments: { rpo: "15 minutes", rto: "1 hour" },
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("backup");
  });

  test("should get mysql_index_tuning prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_index_tuning",
      arguments: { table: "test_products" },
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text.toLowerCase()).toContain("index");
  });

  test("should get mysql_setup_router prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_setup_router",
      arguments: {},
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("Router");
  });

  test("should get mysql_setup_proxysql prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_setup_proxysql",
      arguments: {},
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("ProxySQL");
  });

  test("should get mysql_setup_replication prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_setup_replication",
      arguments: {},
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("replication");
  });

  test("should get mysql_setup_shell prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_setup_shell",
      arguments: {},
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("MySQL Shell");
  });

  test("should get mysql_setup_events prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_setup_events",
      arguments: {},
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("event");
  });

  test("should get mysql_sys_schema_guide prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_sys_schema_guide",
      arguments: {},
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("sys");
  });

  test("should get mysql_setup_spatial prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_setup_spatial",
      arguments: {},
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("spatial");
  });

  test("should get mysql_setup_cluster prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_setup_cluster",
      arguments: {},
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("cluster");
  });

  test("should get mysql_setup_docstore prompt", async () => {
    const response = await client.getPrompt({
      name: "mysql_setup_docstore",
      arguments: {},
    });

    expect(response.messages).toBeDefined();
    const text = (response.messages[0].content as any).text as string;
    expect(text).toContain("document");
  });
});
