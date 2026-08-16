/**
 * E2E Tests: HTTP Transport Protocols
 *
 * Tests the Streamable HTTP and Legacy SSE transport endpoints,
 * including error handling for missing sessions and malformed requests.
 */

import { test, expect } from "@playwright/test";
import { MCP_PROTOCOL_STREAMABLE } from "./helpers.js";

test.describe("HTTP Transport Protocols", () => {
  test("should return server metadata on GET /", async ({ request }) => {
    const response = await request.get("/");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("name", "mysql-mcp");
    expect(body).toHaveProperty("endpoints");
    expect(body.endpoints).toHaveProperty("POST /mcp");
    expect(body.endpoints).toHaveProperty("GET /mcp");
  });

  test.describe(`Streamable HTTP (MCP ${MCP_PROTOCOL_STREAMABLE})`, () => {
    test("should reject generic payload on /mcp without a session ID", async ({
      request,
    }) => {
      // POST without mcp-session-id AND not an 'initialize' request
      const response = await request.post("/mcp", {
        headers: {
          Accept: "application/json, text/event-stream",
        },
        data: {
          jsonrpc: "2.0",
          id: 1,
          method: "ping",
        },
      });

      expect(response.status()).toBe(400);
      const body = await response.json();
      expect(body.error).toHaveProperty(
        "message",
        "Bad Request: No valid session ID provided",
      );
    });

    test("should reject invalid JSON string body on /mcp", async ({
      request,
    }) => {
      const response = await request.post("/mcp", {
        headers: {
          Accept: "application/json, text/event-stream",
          "Content-Type": "application/json",
        },
        data: Buffer.from('{"broken": json}'),
      });

      // Express's json() middleware intercepts malformed JSON
      // before the SDK transport, returning a 400 with its own error format
      expect(response.status()).toBe(400);
      const body = await response.text();
      expect(body.length).toBeGreaterThan(0);
    });
  });
});
