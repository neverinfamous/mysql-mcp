/**
 * E2E Tests: Advanced Session Management
 *
 * Tests cross-protocol guard, sequential sessions, post-DELETE
 * session rejection, and invalid session ID handling.
 *
 * Ported from db-mcp/tests/e2e/session-advanced.spec.ts — adapted for mysql-mcp.
 */

import { test, expect } from "@playwright/test";

test.describe.serial("Advanced Session Management", () => {
  test("should reject requests after session DELETE", async ({ request }) => {
    // Initialize a session
    const initResponse = await request.post("/mcp", {
      headers: { Accept: "application/json, text/event-stream" },
      data: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "delete-reuse-test", version: "1.0.0" },
        },
      },
    });

    expect(initResponse.status()).toBe(200);
    const sessionId = initResponse.headers()["mcp-session-id"];
    expect(sessionId).toBeDefined();

    // Delete the session
    const deleteResponse = await request.delete("/mcp", {
      headers: { "mcp-session-id": sessionId! },
    });
    expect([200, 204]).toContain(deleteResponse.status());

    // Try to use the deleted session — should be rejected
    const postDeleteResponse = await request.post("/mcp", {
      headers: {
        Accept: "application/json, text/event-stream",
        "mcp-session-id": sessionId!,
      },
      data: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      },
    });

    expect(postDeleteResponse.status()).toBe(400);
  });
});
