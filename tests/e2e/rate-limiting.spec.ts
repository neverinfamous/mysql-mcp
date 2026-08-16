/**
 * E2E Tests: Rate Limiting
 *
 * Tests the built-in rate limiter by launching servers with very
 * low rate limits and verifying 429 behavior, Retry-After headers,
 * and health endpoint exemption.
 *
 * Each test spawns its own server process to control MCP_RATE_LIMIT_MAX.
 *
 * Ported from postgres-mcp/tests/e2e/rate-limiting.spec.ts — adapted for mysql-mcp.
 */

import { test, expect } from "@playwright/test";
import { startServer, stopServer, MCP_JSON_HEADERS, MCP_PROTOCOL_STREAMABLE } from "./helpers.js";



const INIT_BODY = (id: number, clientName: string) =>
  JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: MCP_PROTOCOL_STREAMABLE,
      capabilities: {},
      clientInfo: { name: clientName, version: "1.0" },
    },
  });

test.describe("Rate Limiting", () => {
  test("should return 429 after exceeding rate limit", async ({}, testInfo) => {
    const port = 8100 + testInfo.workerIndex * 10;
    await startServer(
      port,
      ["--tool-filter", "starter"],
      "rate-limit-429",
      { MCP_RATE_LIMIT_MAX: "5", REDIS_URL: "" },
    );
    const base = `http://127.0.0.1:${port}`;

    try {
      // Send 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`${base}/mcp`, {
          method: "POST",
          headers: MCP_JSON_HEADERS,
          body: INIT_BODY(i + 1, "rate-test"),
        });
        expect(res.status).not.toBe(429);
      }

      // 6th request should be rate-limited
      const limitedResponse = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: MCP_JSON_HEADERS,
        body: INIT_BODY(99, "rate-test"),
      });
      expect(limitedResponse.status).toBe(429);
    } finally {
      stopServer(port);
    }
  });

  test("should include Retry-After header on 429", async ({}, testInfo) => {
    const port = 8101 + testInfo.workerIndex * 10;
    await startServer(
      port,
      ["--tool-filter", "starter"],
      "rate-limit-retry-after",
      { MCP_RATE_LIMIT_MAX: "3", REDIS_URL: "" },
    );
    const base = `http://127.0.0.1:${port}`;

    try {
      // Exhaust the limit
      for (let i = 0; i < 3; i++) {
        await fetch(`${base}/mcp`, {
          method: "POST",
          headers: MCP_JSON_HEADERS,
          body: INIT_BODY(i + 1, "retry-test"),
        });
      }

      // Next request should be 429 with Retry-After
      const response = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: MCP_JSON_HEADERS,
        body: INIT_BODY(99, "retry-test"),
      });

      expect(response.status).toBe(429);
      const retryAfter = response.headers.get("retry-after");
      expect(retryAfter).toBeDefined();
      expect(Number(retryAfter)).toBeGreaterThan(0);
    } finally {
      stopServer(port);
    }
  });

  test("should exempt /health from rate limiting", async ({}, testInfo) => {
    const port = 8102 + testInfo.workerIndex * 10;
    await startServer(
      port,
      ["--tool-filter", "starter"],
      "rate-limit-health",
      { MCP_RATE_LIMIT_MAX: "2", REDIS_URL: "" },
    );
    const base = `http://127.0.0.1:${port}`;

    try {
      // Exhaust rate limit
      for (let i = 0; i < 2; i++) {
        await fetch(`${base}/mcp`, {
          method: "POST",
          headers: MCP_JSON_HEADERS,
          body: INIT_BODY(i + 1, "health-test"),
        });
      }

      // /health should still work
      const healthResponse = await fetch(`${base}/health`);
      expect(healthResponse.status).toBe(200);
      const body = (await healthResponse.json()) as { status: string };
      expect(body).toHaveProperty("status", "healthy");

      // But /mcp should be 429
      const mcpResponse = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: MCP_JSON_HEADERS,
        body: INIT_BODY(99, "health-test"),
      });
      expect(mcpResponse.status).toBe(429);
    } finally {
      stopServer(port);
    }
  });
});


