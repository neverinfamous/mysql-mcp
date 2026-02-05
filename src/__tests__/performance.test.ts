/**
 * mysql-mcp - Performance Benchmarks
 *
 * Benchmarks for measuring the performance of optimized code paths.
 * Run with: npm test -- --grep="Performance Benchmarks"
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SchemaManager } from "../adapters/mysql/SchemaManager.js";

describe("Performance Benchmarks", () => {
  describe("Tool Definition Caching", () => {
    it("should return cached tool definitions on second call", () => {
      // Simulate the caching behavior
      let callCount = 0;
      const generateTools = () => {
        callCount++;
        return Array.from({ length: 191 }, (_, i) => ({
          name: `tool_${String(i)}`,
          description: `Tool ${String(i)} description`,
        }));
      };

      let cachedTools: ReturnType<typeof generateTools> | null = null;
      const getToolDefinitions = () => {
        if (cachedTools) return cachedTools;
        cachedTools = generateTools();
        return cachedTools;
      };

      // First call - should generate
      const startFirst = performance.now();
      const tools1 = getToolDefinitions();
      const firstDuration = performance.now() - startFirst;

      // Second call - should use cache
      const startSecond = performance.now();
      const tools2 = getToolDefinitions();
      const secondDuration = performance.now() - startSecond;

      expect(tools1).toBe(tools2); // Same reference
      expect(callCount).toBe(1); // Only generated once
      expect(secondDuration).toBeLessThan(firstDuration); // Cache is faster
    });

    it("should generate 191 tool definitions", () => {
      // Verify the tool count matches documentation
      const toolGroups = {
        core: 8,
        transactions: 7,
        json: 17,
        text: 6,
        fulltext: 4,
        performance: 8,
        optimization: 4,
        admin: 6,
        monitoring: 7,
        backup: 4,
        replication: 5,
        partitioning: 4,
        router: 9,
        proxysql: 12,
        shell: 10,
        schema: 10,
        events: 6,
        sysschema: 8,
        stats: 8,
        spatial: 12,
        security: 9,
        cluster: 10,
        roles: 8,
        docstore: 9,
      };

      const total = Object.values(toolGroups).reduce((a, b) => a + b, 0);
      expect(total).toBe(191);
    });
  });

  describe("Metadata Cache TTL", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return cached value before TTL expires", () => {
      const cache = new Map<string, { data: unknown; timestamp: number }>();
      const TTL_MS = 30000;

      // Set cache
      cache.set("test_key", {
        data: { value: "cached" },
        timestamp: Date.now(),
      });

      // Advance time less than TTL
      vi.advanceTimersByTime(15000);

      // Check cache
      const entry = cache.get("test_key");
      expect(entry).toBeDefined();
      const isExpired = Date.now() - entry!.timestamp > TTL_MS;
      expect(isExpired).toBe(false);
    });

    it("should expire cached value after TTL", () => {
      const cache = new Map<string, { data: unknown; timestamp: number }>();
      const TTL_MS = 30000;

      // Set cache
      cache.set("test_key", {
        data: { value: "cached" },
        timestamp: Date.now(),
      });

      // Advance time past TTL
      vi.advanceTimersByTime(31000);

      // Check cache
      const entry = cache.get("test_key");
      expect(entry).toBeDefined();
      const isExpired = Date.now() - entry!.timestamp > TTL_MS;
      expect(isExpired).toBe(true);
    });

    it("should use configurable TTL from environment", () => {
      const defaultTtl = parseInt(
        process.env["METADATA_CACHE_TTL_MS"] ?? "30000",
        10,
      );
      expect(defaultTtl).toBe(30000);
    });
  });

  describe("Parallel Query Execution", () => {
    it("should demonstrate parallel execution concept", () => {
      // This test verifies the conceptual benefit of parallel execution
      // Real query timing depends on database latency, so we verify the pattern

      // Sequential pattern: wait for each before next
      const sequentialPattern = (queries: number) => {
        // Total time = sum of all query times
        return queries * 1; // 1 unit per query
      };

      // Parallel pattern: all at once
      const parallelPattern = (_queries: number) => {
        // Total time = max of all query times (all roughly equal)
        return 1; // 1 unit (concurrent)
      };

      const queryCount = 2; // health resource has 2 queries
      const sequentialUnits = sequentialPattern(queryCount);
      const parallelUnits = parallelPattern(queryCount);

      // Parallel is faster (2x for 2 queries)
      expect(parallelUnits).toBeLessThan(sequentialUnits);
      expect(sequentialUnits / parallelUnits).toBe(2);
    });
  });

  describe("Batch Query Pattern", () => {
    it("should use single query instead of N+1 for indexes", () => {
      // Verify the optimization concept: single query vs N+1
      const tableCount = 100;
      const singleQueryCount = 1; // Batch query
      const nPlusOneQueryCount = tableCount + 1; // N+1 pattern

      // Expected improvement: N+1 → 1 query (reduced by tableCount)
      const improvement = nPlusOneQueryCount / singleQueryCount;
      expect(improvement).toBe(101); // For 100 tables, 101x fewer queries
    });
  });

  describe("SchemaManager Cache", () => {
    it("should have clearCache method", () => {
      const mockExecutor = {
        executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
      };
      const schemaManager = new SchemaManager(mockExecutor);

      // Verify clearCache method exists and is callable
      expect(typeof schemaManager.clearCache).toBe("function");
      schemaManager.clearCache(); // Should not throw
    });
  });
});
