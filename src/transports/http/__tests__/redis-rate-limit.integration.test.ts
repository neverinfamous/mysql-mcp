import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { checkRateLimit } from "../security.js";
import { 
  getRedisTestPrefix, 
  getRedisTestClient, 
  flushTestKeys,
} from "../../../__tests__/helpers/redis-test-utils.js";
import type { RedisClientType } from "redis";
import type { IncomingMessage } from "node:http";
import type { HttpTransportConfig, RateLimitEntry } from "../types.js";
import { logger } from "../../../utils/logger.js";

// Disable logger output during tests
vi.spyOn(logger, "info").mockImplementation(() => {});
vi.spyOn(logger, "error").mockImplementation(() => {});
vi.spyOn(logger, "warning").mockImplementation(() => {});

// Conditionally skip tests if Redis is not available
const runTests = process.env.REDIS_AVAILABLE === "true";
const PREFIX = getRedisTestPrefix("http-rl");

describe.skipIf(!runTests)("HTTP Transport Rate Limiting - Redis Integration", () => {
  let redisClient: RedisClientType;
  let rateLimitMap: Map<string, RateLimitEntry>;

  beforeAll(async () => {
    redisClient = await getRedisTestClient();
  });

  afterAll(async () => {
    if (redisClient?.isOpen) {
      await redisClient.quit();
    }
  });

  beforeEach(async () => {
    await flushTestKeys(redisClient, "http:rl:" + PREFIX);
    rateLimitMap = new Map();
  });

  function createMockRequest(ip: string): IncomingMessage {
    return {
      socket: { remoteAddress: ip },
      headers: {},
    } as unknown as IncomingMessage;
  }

  const getConfig = (windowMs: number, maxRequests: number): HttpTransportConfig => ({
    port: 3000,
    enableRateLimit: true,
    rateLimitWindowMs: windowMs,
    rateLimitMaxRequests: maxRequests,
  });

  it("should enforce rate limit using real Redis", async () => {
    const ip = `${PREFIX}ip1`;
    const req = createMockRequest(ip);
    const config = getConfig(5000, 2);

    const res1 = await checkRateLimit(req, config, rateLimitMap, redisClient);
    expect(res1.allowed).toBe(true);

    const res2 = await checkRateLimit(req, config, rateLimitMap, redisClient);
    expect(res2.allowed).toBe(true);

    const res3 = await checkRateLimit(req, config, rateLimitMap, redisClient);
    expect(res3.allowed).toBe(false);
    expect(res3.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("should isolate rate limits by IP address", async () => {
    const req1 = createMockRequest(`${PREFIX}ip_a`);
    const req2 = createMockRequest(`${PREFIX}ip_b`);
    const config = getConfig(5000, 1);

    // IP A hits limit
    expect((await checkRateLimit(req1, config, rateLimitMap, redisClient)).allowed).toBe(true);
    expect((await checkRateLimit(req1, config, rateLimitMap, redisClient)).allowed).toBe(false);

    // IP B is still allowed
    expect((await checkRateLimit(req2, config, rateLimitMap, redisClient)).allowed).toBe(true);
  });

  it("should calculate retryAfterSeconds from real Redis pTTL", async () => {
    const ip = `${PREFIX}ip_retry`;
    const req = createMockRequest(ip);
    const config = getConfig(4000, 1);

    await checkRateLimit(req, config, rateLimitMap, redisClient); // consume limit

    // Mock Date to ensure it doesn't impact Redis TTL logic
    const res = await checkRateLimit(req, config, rateLimitMap, redisClient);
    expect(res.allowed).toBe(false);
    
    // retryAfterSeconds should be 4000ms / 1000 = 4s (or 3s depending on execution speed)
    expect(res.retryAfterSeconds).toBeGreaterThanOrEqual(3);
    expect(res.retryAfterSeconds).toBeLessThanOrEqual(4);
  });

  it("should fallback to in-memory map if Redis eval fails", async () => {
    const ip = `${PREFIX}ip_fallback`;
    const req = createMockRequest(ip);
    const config = getConfig(5000, 1);

    // Simulate Redis failure
    vi.spyOn(redisClient, "eval").mockRejectedValue(new Error("Simulated Redis Error"));

    // First request - falls back to memory
    const res1 = await checkRateLimit(req, config, rateLimitMap, redisClient);
    expect(res1.allowed).toBe(true);

    // Verify key NOT in Redis
    const key = `http:rl:${ip}`;
    expect(await redisClient.exists(key)).toBe(0);

    // Verify key IS in memory map
    expect(rateLimitMap.has(ip)).toBe(true);

    // Second request - rate limited by memory
    const res2 = await checkRateLimit(req, config, rateLimitMap, redisClient);
    expect(res2.allowed).toBe(false);
  });
});
