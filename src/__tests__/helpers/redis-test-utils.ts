import { createClient, type RedisClientType } from "redis";
import { randomUUID } from "node:crypto";

export const REDIS_TEST_URL = process.env["REDIS_URL"] || "redis://192.168.55.39:6379";

/**
 * Returns a unique prefix for a test file/suite to avoid collisions during parallel test execution.
 */
export function getRedisTestPrefix(suiteName: string): string {
  return `test:${suiteName}:${randomUUID()}:`;
}

/**
 * Creates and connects a Redis client for testing.
 * IMPORTANT: Callers must call `await client.disconnect()` in an `afterAll` hook to prevent Vitest from hanging.
 */
export async function getRedisTestClient(): Promise<RedisClientType> {
  const client = createClient({ url: REDIS_TEST_URL });
  await client.connect();
  return client as RedisClientType;
}

/**
 * Safely deletes only keys matching the given prefix.
 * NEVER use FLUSHDB/FLUSHALL in tests to avoid wiping out concurrent test data or real data.
 */
export async function flushTestKeys(client: RedisClientType, prefix: string): Promise<void> {
  if (!prefix || prefix.length < 5) {
    throw new Error("Prefix too short or undefined, refusing to scan/delete for safety.");
  }
  
  const keys = await client.keys(`${prefix}*`);
  
  if (keys.length > 0) {
    const multi = client.multi();
    for (const key of keys) {
      multi.del(key);
    }
    await multi.exec();
  }
}

/**
 * Polls Redis to wait for a key to expire. Useful for testing TTLs.
 */
export async function waitForKeyExpiry(client: RedisClientType, key: string, maxWaitMs = 5000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const exists = await client.exists(key);
    if (!exists) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}
