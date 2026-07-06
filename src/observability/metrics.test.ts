import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MetricsRegistry } from "./metrics.js";
import { SystemDb } from "./system-db.js";
import fs from "fs";
import path from "path";

describe("MetricsRegistry", () => {
  let registry: MetricsRegistry;

  beforeEach(() => {
    registry = new MetricsRegistry();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    registry.close();
  });

  it("should record tool execution metrics", () => {
    registry.recordToolCall("mysql_read_query", 150, true, 50);
    registry.recordToolCall("mysql_read_query", 250, true, 100);
    
    const summary = registry.getSummary();
    const tools = summary.tools as Record<string, { calls: number; errors: number; tokens: number }>;
    const toolMetrics = tools["mysql_read_query"];
    
    expect(toolMetrics).toBeDefined();
    expect(toolMetrics.calls).toBe(2);
    expect(toolMetrics.errors).toBe(0);
    expect(toolMetrics.tokens).toBe(150);
  });

  it("should handle error recordings", () => {
    registry.recordToolCall("mysql_write_query", 50, false, 0);
    
    const summary = registry.getSummary();
    const tools = summary.tools as Record<string, { calls: number; errors: number; tokens: number }>;
    expect(tools["mysql_write_query"].errors).toBe(1);
  });

  describe("SystemDb Integration", () => {
    const dbPath = path.join(process.cwd(), "test-metrics-registry.sqlite");
    let systemDb: SystemDb;

    beforeEach(async () => {
      systemDb = new SystemDb({ dbPath });
      await systemDb.init();
      registry.setSystemDb(systemDb);
    });

    afterEach(() => {
      systemDb.close();
      try {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (fs.existsSync(`${dbPath}-shm`)) fs.unlinkSync(`${dbPath}-shm`);
        if (fs.existsSync(`${dbPath}-wal`)) fs.unlinkSync(`${dbPath}-wal`);
      } catch {
        // Ignore EBUSY errors on Windows
      }
    });

    it("should flush metrics to SystemDb periodically", () => {
      registry.recordToolCall("test_tool", 100, true, 50);
      
      // Fast-forward 5 minutes + 1 second (startup deferral) to trigger interval
      vi.advanceTimersByTime(5 * 60 * 1000 + 1000);
      
      const db = systemDb.getDb();
      const rows = db.prepare("SELECT * FROM metrics_snapshots").all() as { tool: string; calls: number }[];
      expect(rows.length).toBeGreaterThan(0);
      
      const testToolSnapshot = rows.find(h => h.tool === "test_tool");
      expect(testToolSnapshot).toBeDefined();
      expect(testToolSnapshot?.calls).toBe(1);
    });

    it("should flush metrics on close", () => {
      registry.recordToolCall("flush_tool", 100, true, 50);
      
      registry.close();
      
      const db = systemDb.getDb();
      const rows = db.prepare("SELECT * FROM metrics_snapshots").all() as { tool: string; calls: number }[];
      const testToolSnapshot = rows.find(h => h.tool === "flush_tool");
      
      expect(testToolSnapshot).toBeDefined();
      expect(testToolSnapshot?.calls).toBe(1);
    });
  });
});
