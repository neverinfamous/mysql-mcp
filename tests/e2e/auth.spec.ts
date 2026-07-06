import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { tmpdir } from "node:os";

const AUTH_PORT = 3101;
const AUTH_BASE = `http://localhost:${String(AUTH_PORT)}`;
const AUTH_TOKEN = "test-secret-token-e2e";

let authServer: ChildProcess;

test.describe("Bearer Token Authentication", () => {
  test.beforeAll(async () => {
    authServer = spawn(
      "node",
      [
        "dist/cli.js",
        "--transport",
        "http",
        "--port",
        String(AUTH_PORT),
        "--auth-token",
        AUTH_TOKEN,
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
          ALLOWED_IO_ROOTS: `C:/temp,/tmp,${tmpdir()}`,
        },
      },
    );

    // Wait for server to become healthy
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`${AUTH_BASE}/health`);
        if (res.ok) break;
      } catch {
        // Server not ready yet
      }
      await delay(500);
    }
  });

  test.afterAll(async () => {
    authServer?.kill("SIGTERM");
    await delay(500);
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
          protocolVersion: "2025-03-26",
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
          protocolVersion: "2025-03-26",
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
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test", version: "1.0" },
        },
      }),
    });

    expect(response.status).toBe(200);
  });

  test("GET /sse without token should return 401", async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(`${AUTH_BASE}/sse`, {
        signal: controller.signal,
      });
      expect(response.status).toBe(401);
    } finally {
      clearTimeout(timeout);
    }
  });
});
