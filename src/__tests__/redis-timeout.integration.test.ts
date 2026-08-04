import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { CodeModeSecurityManager } from "../codemode/security.js";
import type { RedisClientType } from "redis";
import { 
  REDIS_TEST_URL, 
  getRedisTestPrefix, 
  getRedisTestClient, 
  flushTestKeys,
} from "./helpers/redis-test-utils.js";
import { logger } from "../utils/logger.js";

// Disable logger output during tests
vi.spyOn(logger, "info").mockImplementation(() => {});
vi.spyOn(logger, "error").mockImplementation(() => {});
vi.spyOn(logger, "warning").mockImplementation(() => {});

// Conditionally skip tests if Redis is not available
const runTests = process.env.REDIS_AVAILABLE === "true";
const PREFIX = getRedisTestPrefix("timeout");

describe.skipIf(!runTests)("Redis Resilience & Timeout Testing", () => {
  let redisClient: RedisClientType;

  beforeAll(async () => {
    redisClient = await getRedisTestClient();
  });

  afterAll(async () => {
    if (redisClient?.isOpen) {
      await redisClient.quit();
    }
  });

  beforeEach(async () => {
    await flushTestKeys(redisClient, "codemode:rl:" + PREFIX);
  });

  it("should gracefully fallback to memory if connection times out", async () => {
    // Port 6378 is presumably unused and will just timeout or connection refuse.
    // By setting socket.connectTimeout, we ensure it fails quickly.
    const badUrl = "redis://localhost:6378";
    
    // Create a client that will fail to connect
    const manager = new CodeModeSecurityManager({ 
      redisUrl: badUrl, 
      windowMs: 5000, 
      maxExecutionsPerMinute: 2 
    });
    
    try {
      // Give it a moment to try connecting and fail
      await new Promise((resolve) => setTimeout(resolve, 50));
  
      // The manager should use in-memory rate limiting without crashing
      const clientId = `${PREFIX}timeout_client`;
      expect(await manager.checkRateLimit(clientId)).toBe(true);
      expect(await manager.checkRateLimit(clientId)).toBe(true);
      expect(await manager.checkRateLimit(clientId)).toBe(false); // Rate limited by memory
    } finally {
      await manager.destroy();
    }
  });

  it("should degrade gracefully under latency (mocked)", async () => {
    const manager = new CodeModeSecurityManager({ 
      redisUrl: REDIS_TEST_URL, 
      windowMs: 5000, 
      maxExecutionsPerMinute: 2 
    });
    
    await new Promise((resolve) => setTimeout(resolve, 50));
    const client = (manager as any).redisClient as RedisClientType;

    // Simulate high latency by delaying the eval command response, then throwing an error
    // to simulate a command timeout that causes a fallback.
    vi.spyOn(client, "eval").mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate delay
      throw new Error("Simulated Command Timeout");
    });

    try {
      const clientId = `${PREFIX}latency_client`;
      
      const start = Date.now();
      const result = await manager.checkRateLimit(clientId);
      const duration = Date.now() - start;
  
      expect(result).toBe(true); // Should fallback to memory
      expect(duration).toBeGreaterThanOrEqual(100); // Proves our delay ran
    } finally {
      await manager.destroy();
    }
  });

  it("should handle highly concurrent requests without race conditions", async () => {
    const manager = new CodeModeSecurityManager({ 
      redisUrl: REDIS_TEST_URL, 
      windowMs: 10000, 
      maxExecutionsPerMinute: 50 
    });
    
    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      const clientId = `${PREFIX}concurrent_client`;
      
      // Fire 100 requests concurrently
      const promises: Promise<boolean>[] = [];
      for (let i = 0; i < 100; i++) {
        promises.push(manager.checkRateLimit(clientId));
      }
      
      const results = await Promise.all(promises);
      
      // Exactly 50 should be true, 50 should be false
      const allowed = results.filter(r => r).length;
      const denied = results.filter(r => !r).length;
      
      expect(allowed).toBe(50);
      expect(denied).toBe(50);
    } finally {
      await manager.destroy();
    }
  });
});
