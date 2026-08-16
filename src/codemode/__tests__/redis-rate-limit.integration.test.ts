import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { CodeModeSecurityManager } from "../security.js";
import { 
  REDIS_TEST_URL, 
  getRedisTestPrefix, 
  getRedisTestClient, 
  flushTestKeys,
  waitForKeyExpiry
} from "../../__tests__/helpers/redis-test-utils.js";
import type { RedisClientType } from "redis";
import { logger } from "../../utils/logger.js";

// Disable logger output during tests
vi.spyOn(logger, "info").mockImplementation(() => {});
vi.spyOn(logger, "error").mockImplementation(() => {});
vi.spyOn(logger, "warning").mockImplementation(() => {});

// Conditionally skip tests if Redis is not available
const runTests = process.env.REDIS_AVAILABLE === "true";
const PREFIX = getRedisTestPrefix("codemode");

describe.skipIf(!runTests)("CodeModeSecurityManager - Redis Integration", () => {
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
    await flushTestKeys(redisClient, PREFIX);
  });

  it("should initialize a connected Redis client", async () => {
    const manager = new CodeModeSecurityManager({ redisUrl: REDIS_TEST_URL });
    // Wait for async connect
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    // Internal property access for testing
    const client = (manager as any).redisClient as RedisClientType;
    expect(client).toBeDefined();
    expect(client.isOpen).toBe(true);
    
    await manager.destroy();
  });

  it("should perform rate limit with real INCR/pExpire", async () => {
    const windowMs = 2000;
    const clientId = `${PREFIX}client1`;
    const manager = new CodeModeSecurityManager({ redisUrl: REDIS_TEST_URL, windowMs, maxExecutionsPerMinute: 5 });
    
    await new Promise((resolve) => setTimeout(resolve, 100));

    // First request
    const allowed1 = await manager.checkRateLimit(clientId);
    expect(allowed1).toBe(true);

    // Verify key in Redis
    const key = `codemode:rl:${clientId}`;
    const val = await redisClient.get(key);
    expect(val).toBe("1");

    // Second request
    const allowed2 = await manager.checkRateLimit(clientId);
    expect(allowed2).toBe(true);
    const val2 = await redisClient.get(key);
    expect(val2).toBe("2");

    await manager.destroy();
  });

  it("should expire the rate limit window in real time", async () => {
    const windowMs = 500; // very short window
    const clientId = `${PREFIX}client_expiry`;
    const manager = new CodeModeSecurityManager({ redisUrl: REDIS_TEST_URL, windowMs, maxExecutionsPerMinute: 1 });
    
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Consume the 1 allowed request
    expect(await manager.checkRateLimit(clientId)).toBe(true);
    expect(await manager.checkRateLimit(clientId)).toBe(false);

    // Wait for the key to expire in Redis
    const key = `codemode:rl:${clientId}`;
    const expired = await waitForKeyExpiry(redisClient, key, 2000);
    expect(expired).toBe(true);

    // Should be allowed again
    expect(await manager.checkRateLimit(clientId)).toBe(true);

    await manager.destroy();
  });

  it("should reject requests when rate limit is exceeded", async () => {
    const windowMs = 5000;
    const clientId = `${PREFIX}client_exceed`;
    const manager = new CodeModeSecurityManager({ redisUrl: REDIS_TEST_URL, windowMs, maxExecutionsPerMinute: 2 });
    
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(await manager.checkRateLimit(clientId)).toBe(true); // 1
    expect(await manager.checkRateLimit(clientId)).toBe(true); // 2
    expect(await manager.checkRateLimit(clientId)).toBe(false); // 3 (exceeded)

    await manager.destroy();
  });

  it("should return correct rate limit remaining from Redis", async () => {
    const windowMs = 5000;
    const clientId = `${PREFIX}client_remaining`;
    const manager = new CodeModeSecurityManager({ redisUrl: REDIS_TEST_URL, windowMs, maxExecutionsPerMinute: 5 });
    
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(await manager.getRateLimitRemaining(clientId)).toBe(5);

    await manager.checkRateLimit(clientId);
    expect(await manager.getRateLimitRemaining(clientId)).toBe(4);

    await manager.checkRateLimit(clientId);
    expect(await manager.getRateLimitRemaining(clientId)).toBe(3);

    await manager.destroy();
  });

  it("should fallback to memory on Redis error", async () => {
    const windowMs = 5000;
    const clientId = `${PREFIX}client_fallback`;
    const manager = new CodeModeSecurityManager({ redisUrl: REDIS_TEST_URL, windowMs, maxExecutionsPerMinute: 2 });
    
    await new Promise((resolve) => setTimeout(resolve, 100));

    const client = (manager as any).redisClient as RedisClientType;
    
    // Inject a mocked eval that throws to simulate a Redis failure
    vi.spyOn(client, "eval").mockRejectedValueOnce(new Error("Simulated Redis Error"));

    // First request hits the error and falls back to memory
    expect(await manager.checkRateLimit(clientId)).toBe(true); // 1 (in memory)
    
    // The key should NOT be in Redis since it failed
    const key = `codemode:rl:${clientId}`;
    expect(await redisClient.exists(key)).toBe(0);

    // Remaining requests use memory (or standard Redis if eval is no longer mocked)
    // Wait, the fallback logic inside checkRateLimit falls back ONLY if redis throws.
    // Let's mock eval to always throw for this test instance.
    vi.spyOn(client, "eval").mockRejectedValue(new Error("Simulated Redis Error"));

    expect(await manager.checkRateLimit(clientId)).toBe(true); // 2 (in memory)
    expect(await manager.checkRateLimit(clientId)).toBe(false); // 3 (exceeded in memory)
    
    // Check remaining also falls back
    vi.spyOn(client, "get").mockRejectedValue(new Error("Simulated Redis Error"));
    expect(await manager.getRateLimitRemaining(clientId)).toBe(0);

    await manager.destroy();
  });
});
