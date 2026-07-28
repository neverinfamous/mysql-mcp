import { test, expect } from "@playwright/test";
import { setTimeout as delay } from "node:timers/promises";
import { startServer, stopServer, MCP_PROTOCOL_STREAMABLE, SSE_CONNECT_TIMEOUT_MS } from "./helpers.js";

const STATELESS_PORT = 3103;
const STATELESS_BASE = `http://localhost:${String(STATELESS_PORT)}`;

test.describe("Stateless HTTP Mode", () => {
  test.beforeAll(async () => {
    await startServer(STATELESS_PORT, [
      "--stateless",
      "--tool-filter",
      "core",
    ], "stateless-server");
  });

  test.afterAll(() => {
    stopServer(STATELESS_PORT);
  });

  test("POST /mcp should accept requests without session ID (stateless)", async () => {
    const response = await fetch(`${STATELESS_BASE}/mcp`, {
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
          clientInfo: { name: "stateless-test", version: "1.0" },
        },
      }),
    });

    expect(response.status).toBe(200);
  });

  test("GET /mcp should return 405 (SSE not available in stateless)", async () => {
    const response = await fetch(`${STATELESS_BASE}/mcp`);

    expect(response.status).toBe(405);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("error");
  });

  test("DELETE /mcp should return 204 (no-op in stateless)", async () => {
    const response = await fetch(`${STATELESS_BASE}/mcp`, {
      method: "DELETE",
    });

    expect(response.status).toBe(204);
  });

});
