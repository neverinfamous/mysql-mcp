import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInnodbResource } from "../innodb.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../__tests__/mocks/index.js";

describe("InnoDB Resource", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  it("should return buffer pool statistics", async () => {
    // Mock buffer pool status
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        { Variable_name: "Innodb_buffer_pool_read_requests", Value: "10000" },
        { Variable_name: "Innodb_buffer_pool_reads", Value: "100" },
        { Variable_name: "Innodb_buffer_pool_pages_total", Value: "8192" },
        { Variable_name: "Innodb_buffer_pool_pages_free", Value: "1000" },
        { Variable_name: "Innodb_buffer_pool_pages_data", Value: "7000" },
        { Variable_name: "Innodb_buffer_pool_pages_dirty", Value: "50" },
        { Variable_name: "Innodb_buffer_pool_write_requests", Value: "5000" },
      ]),
    );
    // Mock config
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        { Variable_name: "innodb_buffer_pool_size", Value: "134217728" },
        { Variable_name: "innodb_buffer_pool_instances", Value: "1" },
      ]),
    );
    // Mock row operations
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        { Variable_name: "Innodb_rows_read", Value: "50000" },
        { Variable_name: "Innodb_rows_inserted", Value: "1000" },
      ]),
    );

    const resource = createInnodbResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler("mysql://innodb", mockContext)) as {
      buffer_pool: { hit_ratio_percent: number };
    };

    expect(result).toHaveProperty("io");
  });

  it("should handle missing buffer pool stats (division by zero protection)", async () => {
    // Mock empty stats
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const resource = createInnodbResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://innodb",
      mockContext,
    )) as any;

    expect(result.buffer_pool.hit_ratio_percent).toBe(100); // Default when requests=0
    expect(result.buffer_pool.pages.dirty_percent).toBe(0); // Default when total=0
    expect(result.buffer_pool.size_bytes).toBe(0);
  });

  it("should parse configuration integers correctly", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce(createMockQueryResult([])) // buffer pool stats
      .mockResolvedValueOnce(
        createMockQueryResult([
          // config
          { Variable_name: "innodb_buffer_pool_size", Value: "1024" },
          { Variable_name: "innodb_buffer_pool_instances", Value: "2" },
        ]),
      )
      .mockResolvedValueOnce(createMockQueryResult([])); // row ops

    const resource = createInnodbResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://innodb",
      mockContext,
    )) as any;

    expect(result.buffer_pool.size_bytes).toBe(1024);
    expect(result.buffer_pool.instances).toBe(2);
  });
});
