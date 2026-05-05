/**
 * E2E Tests: MCP Resource Reads via SDK Client
 *
 * Uses the official @modelcontextprotocol/sdk client to connect
 * via Legacy SSE transport and read resources end-to-end.
 */

import { test, expect } from "@playwright/test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

test.describe.configure({ mode: "serial" });

/**
 * Parse resource content that may be double-wrapped by the SDK.
 * mysql-mcp handlers return `{ contents: [{ text: JSON }] }` which the SDK
 * may wrap inside another `contents` layer.
 */
function parseResourceText(text: string): unknown {
  const outer = JSON.parse(text);
  if (outer.contents?.[0]?.text) {
    return JSON.parse(outer.contents[0].text);
  }
  return outer;
}

test.describe("E2E Resource Reads (via MCP SDK Client)", () => {
  let client: Client;

  test.beforeAll(async () => {
    const transport = new SSEClientTransport(
      new URL("http://localhost:3000/sse"),
    );
    client = new Client(
      { name: "playwright-resource-test", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
  });

  test.afterAll(async () => {
    await client.close();
  });

  test("should list available resources", async () => {
    const listResponse = await client.listResources();

    expect(listResponse.resources).toBeDefined();
    expect(Array.isArray(listResponse.resources)).toBe(true);
    expect(listResponse.resources.length).toBeGreaterThan(0);

    const uris = listResponse.resources.map((r) => r.uri);
    expect(uris).toContain("mysql://schema");
    expect(uris).toContain("mysql://tables");
    expect(uris).toContain("mysql://health");
  });

  test("should read mysql://schema resource", async () => {
    const response = await client.readResource({ uri: "mysql://schema" });

    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);

    const schema = parseResourceText(response.contents[0]!.text as string);
    expect(schema).toHaveProperty("tables");
    expect(Array.isArray((schema as any).tables)).toBe(true);
  });

  test("should read mysql://tables resource", async () => {
    const response = await client.readResource({ uri: "mysql://tables" });

    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);

    const tables = parseResourceText(response.contents[0]!.text as string);
    expect(tables).toBeDefined();
  });

  test("should read mysql://health resource", async () => {
    const response = await client.readResource({ uri: "mysql://health" });

    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);

    const health = parseResourceText(
      response.contents[0]!.text as string,
    ) as any;
    // mysql-mcp health resource returns connection and server info
    expect(health).toBeDefined();
    expect(typeof health).toBe("object");
  });

  test("should read mysql://status resource", async () => {
    const response = await client.readResource({ uri: "mysql://status" });

    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);

    const status = parseResourceText(response.contents[0]!.text as string);
    expect(status).toBeDefined();
  });

  test("should read mysql://variables resource", async () => {
    const response = await client.readResource({ uri: "mysql://variables" });

    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);

    const variables = parseResourceText(response.contents[0]!.text as string);
    expect(variables).toBeDefined();
  });

  test("should read mysql://processlist resource", async () => {
    const response = await client.readResource({
      uri: "mysql://processlist",
    });

    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);

    const processlist = parseResourceText(
      response.contents[0]!.text as string,
    );
    expect(processlist).toBeDefined();
  });

  test("should read mysql://pool resource", async () => {
    const response = await client.readResource({ uri: "mysql://pool" });

    expect(response.contents).toBeDefined();
    expect(response.contents.length).toBeGreaterThan(0);

    const pool = parseResourceText(response.contents[0]!.text as string);
    expect(pool).toBeDefined();
  });

  test("should list resource templates", async () => {
    const response = await client.listResourceTemplates();

    expect(response.resourceTemplates).toBeDefined();
    expect(Array.isArray(response.resourceTemplates)).toBe(true);
  });
});
