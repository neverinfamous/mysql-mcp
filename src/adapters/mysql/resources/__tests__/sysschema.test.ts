import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSysSchemaResource } from "../sysschema.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../__tests__/mocks/index.js";

describe("SysSchema Resource", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  it("should return sys schema diagnostics when available", async () => {
    // Mock top users query
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        {
          user: "root",
          total_connections: 100,
          current_connections: 5,
          memory_bytes: 1000000,
        },
      ]),
    );
    // Mock slow statements query
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        {
          query_preview: "SELECT * FROM large_table",
          exec_count: 50,
          total_latency: "5s",
        },
      ]),
    );
    // Mock lock waits query
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([{ lock_wait_count: 0 }]),
    );

    const resource = createSysSchemaResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://sysschema",
      mockContext,
    )) as { available: boolean; topUsers: unknown[] };

    expect(result).toHaveProperty("available", true);
    expect(result).toHaveProperty("topUsers");
    expect(result).toHaveProperty("slowStatements");
    expect(result).toHaveProperty("currentLockWaits", 0);
  });

  it("should handle sys schema not available", async () => {
    mockAdapter.executeQuery.mockRejectedValueOnce(
      new Error("sys schema not found"),
    );

    const resource = createSysSchemaResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://sysschema",
      mockContext,
    )) as { available: boolean; message: string };

    expect(result.available).toBe(false);
    expect(result).toHaveProperty("message");
  });

  it("should handle null query results", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult(null as any),
    ); // Users
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult(null as any),
    ); // Statements
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult(null as any),
    ); // Locks

    const resource = createSysSchemaResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://sysschema",
      mockContext,
    )) as any;

    expect(result.topUsers).toEqual([]);
    expect(result.slowStatements).toEqual([]);
    expect(result.currentLockWaits).toBe(0);
  });
});
