import { test, expect } from "@playwright/test";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  CallToolResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "./helpers.js";

test.describe.configure({ mode: "serial" });

test.describe("Progress Notifications (Transport Layer)", () => {
  let client: Client;

  test.beforeAll(async () => {
    client = await createClient();
  });

  test.afterAll(async () => {
    await client.close();
  });

  test("mysql_export_table emits progress events", async () => {
    const notifications: Array<{ progress: number; total?: number }> = [];

    // We use callTool with the onprogress option
    const response = await client.callTool(
      {
        name: "mysql_export_table",
        arguments: {
          table: "test_products",
          limit: 5, // keep it small for speed
        },
      },
      CallToolResultSchema,
      {
        onprogress: (progress) => {
          notifications.push({
            progress: progress.progress,
            total: progress.total,
          });
        },
      }
    );

    // Wait a brief moment to allow SSE stream to flush any trailing notifications
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify the tool actually completed
    console.log("RECEIVED NOTIFICATIONS:", notifications);
    const content = response.content as Array<{ type: string; text?: string }>;
    expect(content.length).toBeGreaterThan(0);
    expect(response.isError).toBeFalsy();

    // Verify progress notifications were emitted and received over the transport
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    
    // The last notification should indicate completion or progress
    const last = notifications[notifications.length - 1];
    expect(last.progress).toBeGreaterThan(0);
  });
});
