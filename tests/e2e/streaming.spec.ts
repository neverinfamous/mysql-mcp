/**
 * E2E Tests: HTTP/SSE Streaming
 *
 * Validates raw SSE event stream behavior for both Streamable HTTP
 * (GET /mcp) and Legacy SSE (GET /mcp) transports.
 *
 * Uses a dedicated server on port 3130 to avoid disrupting SDK-based
 * tests on the shared port (raw SSE connections interfere with
 * McpServer.connect() single-transport state).
 *
 * Ported from db-mcp/tests/e2e/streaming.spec.ts — adapted for mysql-mcp.
 */

import { test, expect } from "@playwright/test";
import { startServer, stopServer, MCP_PROTOCOL_STREAMABLE } from "./helpers.js";

// Force sequential execution to prevent parallel workers from colliding on manual ports/files
test.describe.configure({ mode: "serial" });

const STREAM_PORT = 3130 + Number(process.env.TEST_WORKER_INDEX || 0);
const STREAM_BASE = `http://127.0.0.1:${STREAM_PORT}`;

test.describe("HTTP/SSE Streaming", () => {
  test.beforeAll(async () => {
    await startServer(STREAM_PORT, [], "streaming");
  });

  test.afterAll(() => {
    stopServer(STREAM_PORT);
  });

  test.describe("Streamable HTTP (GET /mcp)", () => {
    test("should require session ID for GET /mcp SSE stream", async () => {
      const response = await fetch(`${STREAM_BASE}/mcp`);
      expect(response.status).toBe(400);
    });

    test("should accept GET /mcp with valid session ID", async () => {
      // First, initialize a session
      const initResponse = await fetch(`${STREAM_BASE}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: MCP_PROTOCOL_STREAMABLE,
            capabilities: {},
            clientInfo: { name: "streaming-test", version: "1.0.0" },
          },
        }),
      });

      expect(initResponse.status).toBe(200);
      const sessionId = initResponse.headers.get("mcp-session-id");
      expect(sessionId).toBeDefined();

      // Open SSE stream with session ID — use raw fetch with AbortController
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3002);

      try {
        const sseResponse = await fetch(`${STREAM_BASE}/mcp`, {
          headers: {
            "mcp-session-id": sessionId!,
            Accept: "text/event-stream",
          },
          signal: controller.signal,
        });

        // Server should accept the SSE connection
        expect(sseResponse.status).toBe(200);
        expect(sseResponse.headers.get("content-type")).toContain(
          "text/event-stream",
        );
      } catch (error) {
        // AbortError is expected when we timeout the long-lived SSE stream
        if (error instanceof Error && error.name !== "AbortError") {
          throw error;
        }
      } finally {
        clearTimeout(timeout);
      }
    });
  });
});
