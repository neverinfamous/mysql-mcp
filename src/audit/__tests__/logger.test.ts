import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AuditLogger } from "../logger.js";
import { appendFile, open, rename, stat } from "node:fs/promises";
import type { AuditEntry } from "../types.js";

vi.mock("node:fs/promises", () => ({
  appendFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  open: vi.fn().mockResolvedValue({}),
  rename: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 0 }),
}));

describe("AuditLogger", () => {
  const mockConfig = {
    enabled: true,
    logPath: "/test/audit.jsonl",
    maxSizeBytes: 1024 * 1024,
  };

  const sampleEntry: AuditEntry = {
    timestamp: "2023-01-01T00:00:00Z",
    requestId: "req-1",
    tool: "test_tool",
    category: "test",
    scope: "test",
    durationMs: 10,
    success: true,
    scopes: ["admin"],
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize correctly", () => {
    const logger = new AuditLogger(mockConfig);
    expect(logger.config).toEqual(mockConfig);
  });

  it("should not set up timer if disabled", () => {
    const logger = new AuditLogger({ ...mockConfig, enabled: false });
    expect((logger as any).flushTimer).toBeNull();
  });

  it("should eagerly flush when high water mark is reached", async () => {
    const logger = new AuditLogger(mockConfig);
    
    // BUFFER_HIGH_WATER is 50
    for (let i = 0; i < 50; i++) {
      logger.log(sampleEntry);
    }
    
    // Wait for the asynchronous flush to start and finish
    await (logger as any).activeFlush;
    
    expect(appendFile).toHaveBeenCalledTimes(1);
    const args = vi.mocked(appendFile).mock.calls[0];
    expect(args[0]).toBe("/test/audit.jsonl");
    expect(typeof args[1]).toBe("string");
    // Should contain 50 lines plus trailing newline, split by \n gives 51 items
    expect((args[1] as string).split("\n").length).toBe(51); 
  });

  it("should auto-flush on interval", async () => {
    const logger = new AuditLogger(mockConfig);
    logger.log(sampleEntry);
    
    expect(appendFile).not.toHaveBeenCalled();
    
    // Fast-forward time to trigger interval
    vi.advanceTimersByTime(150);
    await (logger as any).activeFlush;
    
    expect(appendFile).toHaveBeenCalledTimes(1);
  });

  it("should handle stderr mode", async () => {
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    
    const logger = new AuditLogger({ ...mockConfig, logPath: "stderr" });
    logger.log(sampleEntry);
    
    await logger.flush();
    
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    expect(appendFile).not.toHaveBeenCalled();
    
    stderrSpy.mockRestore();
  });

  it("should write to system db if configured", async () => {
    const mockDb = {
      prepare: vi.fn().mockReturnValue({ run: vi.fn() }),
      transaction: vi.fn().mockImplementation((cb) => cb),
    };
    
    const mockSystemDb = {
      getDb: vi.fn().mockReturnValue(mockDb),
    };

    const logger = new AuditLogger(mockConfig);
    logger.setSystemDb(mockSystemDb as any);
    
    logger.log(sampleEntry);
    await logger.flush();
    
    expect(mockSystemDb.getDb).toHaveBeenCalled();
    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO audit_logs"));
  });

  it("should rotate file if size exceeded", async () => {
    vi.mocked(stat).mockResolvedValue({ size: 2 * 1024 * 1024 } as any); // 2MB
    
    const logger = new AuditLogger(mockConfig);
    logger.log(sampleEntry);
    
    await logger.flush();
    
    expect(stat).toHaveBeenCalled();
    // Rename should be called to rotate .4 -> .5, etc. and current -> .1
    expect(rename).toHaveBeenCalledWith("/test/audit.jsonl", "/test/audit.jsonl.1");
  });

  it("should return empty array for recent() in stderr mode", async () => {
    const logger = new AuditLogger({ ...mockConfig, logPath: "stderr" });
    const recent = await logger.recent(10);
    expect(recent).toEqual([]);
  });

  it("should read from file for recent() if systemDb not set", async () => {
    const mockContent = Array(10).fill(JSON.stringify(sampleEntry)).join("\n");
    const mockFh = {
      read: vi.fn().mockImplementation(async (buf, _0, _1, _2) => {
        Buffer.from(mockContent).copy(buf);
        return { bytesRead: mockContent.length };
      }),
      close: vi.fn(),
    };
    
    vi.mocked(open).mockResolvedValue(mockFh as any);
    vi.mocked(stat).mockResolvedValue({ size: mockContent.length } as any);

    const logger = new AuditLogger(mockConfig);
    const recent = await logger.recent(5);
    
    expect(recent).toHaveLength(5); // Requested 5
    expect(open).toHaveBeenCalledWith("/test/audit.jsonl", "r");
    expect(mockFh.read).toHaveBeenCalled();
    expect(mockFh.close).toHaveBeenCalled();
  });

  it("should gracefully close", async () => {
    const logger = new AuditLogger(mockConfig);
    logger.log(sampleEntry);
    
    await logger.close();
    
    expect((logger as any).closed).toBe(true);
    expect((logger as any).flushTimer).toBeNull();
    expect(appendFile).toHaveBeenCalledTimes(1); // Should flush pending log
  });

  describe("search", () => {
    it("should return empty results if stderr mode", async () => {
      const logger = new AuditLogger({ ...mockConfig, logPath: "stderr" });
      const result = await logger.search({});
      expect(result).toEqual({ entries: [], totalCount: 0 });
    });

    it("should return empty results if systemDb not set", async () => {
      const logger = new AuditLogger(mockConfig);
      const result = await logger.search({});
      expect(result).toEqual({ entries: [], totalCount: 0 });
    });

    it("should query systemDb if configured", async () => {
      const mockRows = [
        {
          timestamp: "2023-01-01T00:00:00Z",
          requestId: "req-1",
          tool: "test_tool",
          category: "test",
          success: 1,
        }
      ];

      const mockDb = {
        prepare: vi.fn().mockImplementation((query) => {
          if (query.includes("COUNT")) {
            return { get: vi.fn().mockReturnValue({ c: 1 }) };
          }
          return { all: vi.fn().mockReturnValue(mockRows) };
        }),
      };
      
      const mockSystemDb = {
        getDb: vi.fn().mockReturnValue(mockDb),
      };

      const logger = new AuditLogger(mockConfig);
      logger.setSystemDb(mockSystemDb as any);

      const result = await logger.search({ tool: "test_tool", success: true });
      
      expect(result.totalCount).toBe(1);
      expect(result.entries).toHaveLength(1);
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("COUNT"));
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("SELECT *"));
    });
  });
});
