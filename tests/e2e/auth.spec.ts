import { test, expect } from "@playwright/test";

import { startServer, stopServer, MCP_PROTOCOL_STREAMABLE, SSE_CONNECT_TIMEOUT_MS } from "./helpers.js";

const AUTH_PORT = 3155 + Number(process.env.TEST_WORKER_INDEX || 0);
const AUTH_BASE = `http://127.0.0.1:${String(AUTH_PORT)}`;
const AUTH_TOKEN = "test-secret-token-e2e";

test.describe("Bearer Token Authentication", () => {
  test.beforeAll(async () => {
    await startServer(AUTH_PORT, [
      "--auth-token",
      AUTH_TOKEN,
      "--tool-filter",
      "core",
    ], "auth-server");
  });

  test.afterAll(() => {
    stopServer(AUTH_PORT);
  });

  test("/health should be accessible without token", async () => {
    const response = await fetch(`${AUTH_BASE}/health`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("status", "healthy");
  });

  test("/ (root) should be accessible without token", async () => {
    const response = await fetch(`${AUTH_BASE}/`);
    expect(response.status).toBe(200);
  });

  test("POST /mcp without token should return 401", async () => {
    const response = await fetch(`${AUTH_BASE}/mcp`, {
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
          clientInfo: { name: "test", version: "1.0" },
        },
      }),
    });

    expect(response.status).toBe(401);
    const wwwAuth = response.headers.get("www-authenticate");
    expect(wwwAuth).toContain("Bearer");
  });

  test("POST /mcp with wrong token should return 401", async () => {
    const response = await fetch(`${AUTH_BASE}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: "Bearer wrong-token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: MCP_PROTOCOL_STREAMABLE,
          capabilities: {},
          clientInfo: { name: "test", version: "1.0" },
        },
      }),
    });

    expect(response.status).toBe(401);
    const wwwAuth = response.headers.get("www-authenticate");
    expect(wwwAuth).toContain("invalid_token");
  });

  test("POST /mcp with correct token should succeed", async () => {
    const response = await fetch(`${AUTH_BASE}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: MCP_PROTOCOL_STREAMABLE,
          capabilities: {},
          clientInfo: { name: "test", version: "1.0" },
        },
      }),
    });

    expect(response.status).toBe(200);
  });

  test("GET /mcp without token should return 401", async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SSE_CONNECT_TIMEOUT_MS);

    try {
      const response = await fetch(`${AUTH_BASE}/mcp`, {
        signal: controller.signal,
      });
      expect(response.status).toBe(401);
    } finally {
      clearTimeout(timeout);
    }
  });
});
