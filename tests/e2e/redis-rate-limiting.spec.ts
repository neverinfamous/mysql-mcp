/**
 * E2E Tests: Redis Rate Limiting
 *
 * Tests the Redis-backed rate limiter by launching servers with very
 * low rate limits and verifying 429 behavior, Retry-After headers,
 * cross-process rate limit sharing, and health endpoint exemption.
 */

import { test, expect } from "@playwright/test";
import { startServer, stopServer, MCP_JSON_HEADERS, MCP_PROTOCOL_STREAMABLE } from "./helpers.js";
import net from "node:net";
import crypto from "node:crypto";



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

async function isRedisAvailable(): Promise<boolean> {
  if (process.env.REDIS_AVAILABLE === "true") return true;
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
    
    // Parse host/port from REDIS_URL if set, else 127.0.0.1:6379
    const url = process.env.REDIS_URL || "redis://192.168.55.39:6379";
    try {
      const parsed = new URL(url);
      socket.connect(parseInt(parsed.port || "6379", 10), parsed.hostname);
    } catch {
      socket.connect(6379, "127.0.0.1");
    }
  });
}

test.describe("Redis Rate Limiting", () => {
  let redisAvailable = false;

  test.beforeAll(async () => {
    redisAvailable = await isRedisAvailable();
  });

  test("should return 429 after exceeding rate limit using Redis", async ({}, testInfo) => {
    test.skip(!redisAvailable, "Redis not available");
    
    const port = 8200 + testInfo.workerIndex * 10;
    const testIp = `10.0.0.1-${crypto.randomUUID()}`;
    await startServer(
      port,
      ["--tool-filter", "starter"],
      "redis-rate-limit-429",
      { 
        MCP_RATE_LIMIT_MAX: "5",
        REDIS_URL: process.env.REDIS_URL || "redis://192.168.55.39:6379",
        TRUST_PROXY: "true"
      },
    );
    const base = `http://127.0.0.1:${port}`;

    try {
      // Wait for async Redis connect to settle in the server
      await expect.poll(async () => {
        try {
          const res = await fetch(`${base}/mcp`, {
            method: "POST",
            headers: { ...MCP_JSON_HEADERS, "x-forwarded-for": `${testIp}-wait` },
            body: INIT_BODY(999, "wait-redis"),
          });
          return res.status === 200;
        } catch {
          return false;
        }
      }, { timeout: 5000, intervals: [100] }).toBeTruthy();

      // Send 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        const res = await fetch(`${base}/mcp`, {
          method: "POST",
          headers: { ...MCP_JSON_HEADERS, "x-forwarded-for": testIp },
          body: INIT_BODY(i + 1, "rate-test-redis"),
        });
        expect(res.status).not.toBe(429);
      }

      // 6th request should be rate-limited
      const limitedResponse = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: { ...MCP_JSON_HEADERS, "x-forwarded-for": testIp },
        body: INIT_BODY(99, "rate-test-redis"),
      });
      expect(limitedResponse.status).toBe(429);
    } finally {
      stopServer(port);
    }
  });

  test("should include Retry-After header on 429 from Redis pTTL", async ({}, testInfo) => {
    test.skip(!redisAvailable, "Redis not available");

    const port = 8201 + testInfo.workerIndex * 10;
    const testIp = `10.0.0.2-${crypto.randomUUID()}`;
    await startServer(
      port,
      ["--tool-filter", "starter"],
      "redis-rate-limit-retry-after",
      { 
        MCP_RATE_LIMIT_MAX: "3",
        REDIS_URL: process.env.REDIS_URL || "redis://192.168.55.39:6379",
        TRUST_PROXY: "true"
      },
    );
    const base = `http://127.0.0.1:${port}`;

    try {
      await expect.poll(async () => {
        try {
          const res = await fetch(`${base}/mcp`, {
            method: "POST",
            headers: { ...MCP_JSON_HEADERS, "x-forwarded-for": `${testIp}-wait` },
            body: INIT_BODY(999, "wait-redis"),
          });
          return res.status === 200;
        } catch {
          return false;
        }
      }, { timeout: 5000, intervals: [100] }).toBeTruthy();

      // Exhaust the limit
      for (let i = 0; i < 3; i++) {
        await fetch(`${base}/mcp`, {
          method: "POST",
          headers: { ...MCP_JSON_HEADERS, "x-forwarded-for": testIp },
          body: INIT_BODY(i + 1, "retry-test-redis"),
        });
      }

      // Next request should be 429 with Retry-After
      const response = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: { ...MCP_JSON_HEADERS, "x-forwarded-for": testIp },
        body: INIT_BODY(99, "retry-test-redis"),
      });

      expect(response.status).toBe(429);
      const retryAfter = response.headers.get("retry-after");
      expect(retryAfter).toBeDefined();
      expect(Number(retryAfter)).toBeGreaterThan(0);
    } finally {
      stopServer(port);
    }
  });

  test("should share rate limits across multiple processes (Distributed)", async ({}, testInfo) => {
    test.skip(!redisAvailable, "Redis not available");

    const port1 = 8202 + testInfo.workerIndex * 10;
    const port2 = 8203 + testInfo.workerIndex * 10;
    const testIp = `10.0.0.3-${crypto.randomUUID()}`;
    
    // Server 1
    await startServer(
      port1,
      ["--tool-filter", "starter"],
      "redis-shared-1",
      { 
        MCP_RATE_LIMIT_MAX: "4",
        REDIS_URL: process.env.REDIS_URL || "redis://192.168.55.39:6379",
        TRUST_PROXY: "true"
      },
    );

    // Server 2
    await startServer(
      port2,
      ["--tool-filter", "starter"],
      "redis-shared-2",
      { 
        MCP_RATE_LIMIT_MAX: "4",
        REDIS_URL: process.env.REDIS_URL || "redis://192.168.55.39:6379",
        TRUST_PROXY: "true"
      },
    );

    const base1 = `http://127.0.0.1:${port1}`;
    const base2 = `http://127.0.0.1:${port2}`;

    try {
      await expect.poll(async () => {
        try {
          const res1 = await fetch(`${base1}/mcp`, {
            method: "POST",
            headers: { ...MCP_JSON_HEADERS, "x-forwarded-for": `${testIp}-wait` },
            body: INIT_BODY(999, "wait-redis"),
          });
          const res2 = await fetch(`${base2}/mcp`, {
            method: "POST",
            headers: { ...MCP_JSON_HEADERS, "x-forwarded-for": `${testIp}-wait2` },
            body: INIT_BODY(999, "wait-redis"),
          });
          return res1.status === 200 && res2.status === 200;
        } catch {
          return false;
        }
      }, { timeout: 5000, intervals: [100] }).toBeTruthy();

      // Send 2 requests to Server 1 (total 2/4)
      for (let i = 0; i < 2; i++) {
        const res = await fetch(`${base1}/mcp`, {
          method: "POST",
          headers: { ...MCP_JSON_HEADERS, "x-forwarded-for": testIp },
          body: INIT_BODY(i + 1, "shared-test"),
        });
        expect(res.status).not.toBe(429); // 400 because init body is not fully handled, but it passed rate limiting (which would be 429)
      }

      // Send 2 requests to Server 2 (total 4/4)
      for (let i = 0; i < 2; i++) {
        const res = await fetch(`${base2}/mcp`, {
          method: "POST",
          headers: { ...MCP_JSON_HEADERS, "x-forwarded-for": testIp },
          body: INIT_BODY(i + 3, "shared-test"),
        });
        expect(res.status).not.toBe(429); 
      }

      // Next request to EITHER server should be 429
      const res1 = await fetch(`${base1}/mcp`, {
        method: "POST",
        headers: { ...MCP_JSON_HEADERS, "x-forwarded-for": testIp },
        body: INIT_BODY(99, "shared-test"),
      });
      expect(res1.status).toBe(429);

      const res2 = await fetch(`${base2}/mcp`, {
        method: "POST",
        headers: { ...MCP_JSON_HEADERS, "x-forwarded-for": testIp },
        body: INIT_BODY(100, "shared-test"),
      });
      expect(res2.status).toBe(429);

    } finally {
      stopServer(port1);
      stopServer(port2);
    }
  });

  test("should exempt /health from Redis rate limiting", async ({}, testInfo) => {
    test.skip(!redisAvailable, "Redis not available");

    const port = 8204 + testInfo.workerIndex * 10;
    const testIp = `10.0.0.4-${crypto.randomUUID()}`;
    await startServer(
      port,
      ["--tool-filter", "starter"],
      "redis-rate-limit-health",
      { 
        MCP_RATE_LIMIT_MAX: "2",
        REDIS_URL: process.env.REDIS_URL || "redis://192.168.55.39:6379",
        TRUST_PROXY: "true"
      },
    );
    const base = `http://127.0.0.1:${port}`;

    try {
      await expect.poll(async () => {
        try {
          const res = await fetch(`${base}/mcp`, {
            method: "POST",
            headers: { ...MCP_JSON_HEADERS, "x-forwarded-for": `${testIp}-wait` },
            body: INIT_BODY(999, "wait-redis"),
          });
          return res.status === 200;
        } catch {
          return false;
        }
      }, { timeout: 5000, intervals: [100] }).toBeTruthy();

      // Exhaust rate limit
      for (let i = 0; i < 2; i++) {
        await fetch(`${base}/mcp`, {
          method: "POST",
          headers: { ...MCP_JSON_HEADERS, "x-forwarded-for": testIp },
          body: INIT_BODY(i + 1, "health-test"),
        });
      }

      // /health should still work
      const healthResponse = await fetch(`${base}/health`);
      expect(healthResponse.status).toBe(200);

      // But /mcp should be 429
      const mcpResponse = await fetch(`${base}/mcp`, {
        method: "POST",
        headers: { ...MCP_JSON_HEADERS, "x-forwarded-for": testIp },
        body: INIT_BODY(99, "health-test"),
      });
      expect(mcpResponse.status).toBe(429);
    } finally {
      stopServer(port);
    }
  });
});

