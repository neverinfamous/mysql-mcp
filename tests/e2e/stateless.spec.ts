import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const STATELESS_PORT = 3102;
const STATELESS_BASE = `http://localhost:${String(STATELESS_PORT)}`;

let statelessServer: ChildProcess;

test.describe("Stateless HTTP Mode", () => {
  test.beforeAll(async () => {
    statelessServer = spawn(
      "node",
      [
        "dist/cli.js",
        "--transport",
        "http",
        "--port",
        String(STATELESS_PORT),
        "--stateless",
        "--tool-filter",
        "core",
        "--mysql",
        process.env["MYSQL_TEST_URL"] ??
          "mysql://root:root@localhost:3307/testdb",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          MCP_RATE_LIMIT_MAX: "10000",
        },
      },
    );

    // Wait for server to become healthy
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`${STATELESS_BASE}/health`);
        if (res.ok) break;
      } catch {
        // Server not ready yet
      }
      await delay(500);
    }
  });

  test.afterAll(async () => {
    statelessServer?.kill("SIGTERM");
    await delay(500);
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
          protocolVersion: "2025-03-26",
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

  test("GET /sse should return 404 (legacy SSE unavailable in stateless)", async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(`${STATELESS_BASE}/sse`, {
        signal: controller.signal,
      });
      expect(response.status).toBe(404);
    } finally {
      clearTimeout(timeout);
    }
  });
});
