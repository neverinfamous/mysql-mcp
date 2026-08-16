import { test, expect } from "@playwright/test";
import { setTimeout as delay } from "node:timers/promises";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { randomUUID } from "node:crypto";
import { BASE_URL, skipIfSuperReadOnly } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("E2E MCP Subscriptions", () => {
  let client: Client;
  let receivedNotifications: string[] = [];

  test.beforeAll(async () => {
    const transport = new StreamableHTTPClientTransport(
      new URL(`${BASE_URL}/mcp`),
    );
    client = new Client(
      { name: "playwright-subscription-test", version: "1.0.0" },
      { capabilities: {} },
    );
    
    client.setNotificationHandler('notifications/resources/updated', (notification) => {
      if (notification.params.uri) {
        receivedNotifications.push(notification.params.uri);
      }
    });

    await client.connect(transport);
  });

  test.afterAll(async () => {
    await client.close();
  });

  test.beforeEach(() => {
    receivedNotifications = [];
  });

  test("should successfully subscribe to mysql://schema", async () => {
    // Should resolve without error
    await client.subscribeResource({ uri: "mysql://schema" });
  });

  test("should fail to subscribe to unsupported uri", async () => {
    await expect(client.subscribeResource({ uri: "mysql://nonexistent" })).rejects.toThrow();
  });

  test("should receive resource update notification on schema change", async () => {
    await skipIfSuperReadOnly(client);
    // We are subscribed to mysql://schema. Let's trigger a schema change.
    const tableName = `test_e2e_sub_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
    
    // Create a temporary table to trigger clearSchemaCache and emit schemaChanged
    await client.callTool({
      name: "mysql_write_query",
      arguments: {
        query: `CREATE TABLE ${tableName} (id INT PRIMARY KEY)`,
      },
    });

    // Wait briefly for notification to arrive
    await delay(500);

    expect(receivedNotifications).toContain("mysql://schema");

    // Clean up
    await client.callTool({
      name: "mysql_write_query",
      arguments: {
        query: `DROP TABLE IF EXISTS ${tableName}`,
      },
    });
  });

  test("should successfully unsubscribe from mysql://schema", async () => {
    await client.unsubscribeResource({ uri: "mysql://schema" });
    receivedNotifications = [];

    const tableName = `test_e2e_sub_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
    await client.callTool({
      name: "mysql_write_query",
      arguments: {
        query: `CREATE TABLE ${tableName} (id INT PRIMARY KEY)`,
      },
    });

    await delay(500);

    // Should NOT receive notification
    expect(receivedNotifications).not.toContain("mysql://schema");

    await client.callTool({
      name: "mysql_write_query",
      arguments: {
        query: `DROP TABLE IF EXISTS ${tableName}`,
      },
    });
  });
});
