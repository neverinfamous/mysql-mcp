import { describe, it, expect, vi, beforeEach } from "vitest";
import { createIndexesResource } from "../indexes.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../__tests__/mocks/index.js";

describe("createIndexesResource", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;
  let resource: ReturnType<typeof createIndexesResource>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
    resource = createIndexesResource(mockAdapter as unknown as MySQLAdapter);
  });

  it("should return error if no database selected", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([])); // DB select returns empty/null

    const result = await resource.handler(resource.uri, mockContext);

    expect(result).toEqual({ error: "No database selected" });
  });

  it("should return index stats, unused, and duplicates when all queries succeed", async () => {
    // Mock Database select
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([{ db: "test_db" }]),
    );

    // Mock Index Stats
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        { table_name: "users", index_name: "PRIMARY", non_unique: 0 },
      ]),
    );

    // Mock Unused Indexes
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        { schema_name: "test_db", table_name: "users", index_name: "idx_old" },
      ]),
    );

    // Mock Duplicate Indexes
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        {
          table_name: "users",
          redundant_index: "idx_dup",
          dominant_index: "PRIMARY",
        },
      ]),
    );

    const result = await resource.handler(resource.uri, mockContext);

    expect(result).toEqual({
      database: "test_db",
      total_indexes: 1,
      indexes: expect.any(Array),
      unused_indexes: expect.any(Array),
      potential_duplicates: expect.any(Array),
    });
    expect((result as any).indexes).toHaveLength(1);
    expect((result as any).unused_indexes).toHaveLength(1);
    expect((result as any).potential_duplicates).toHaveLength(1);
  });

  it("should handle failures in optional queries (unused/duplicates) gracefully", async () => {
    // Mock Database select
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([{ db: "test_db" }]),
    );

    // Mock Index Stats
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    // Mock Unused Indexes FAILURE
    mockAdapter.executeQuery.mockRejectedValueOnce(
      new Error("Performance Schema error"),
    );

    // Mock Duplicate Indexes FAILURE
    mockAdapter.executeQuery.mockRejectedValueOnce(
      new Error("Info Schema error"),
    );

    const result = await resource.handler(resource.uri, mockContext);

    expect(result).toEqual({
      database: "test_db",
      total_indexes: 0,
      indexes: [],
      unused_indexes: [], // Should default to empty array on error
      potential_duplicates: [], // Should default to empty array on error
    });
  });
  it("should handle undefined rows gracefully", async () => {
    // Mock Database select with undefined rows
    mockAdapter.executeQuery.mockResolvedValueOnce({ rows: undefined } as any);

    // First attempt with undefined rows for database selection
    const result1 = await resource.handler(resource.uri, mockContext);
    expect(result1).toEqual({ error: "No database selected" });

    // Now test undefined rows for other queries
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([{ db: "test_db" }]),
    );
    mockAdapter.executeQuery.mockResolvedValueOnce({ rows: undefined } as any); // Indexes
    mockAdapter.executeQuery.mockResolvedValueOnce({ rows: undefined } as any); // Unused
    mockAdapter.executeQuery.mockResolvedValueOnce({ rows: undefined } as any); // Duplicates

    const result2 = await resource.handler(resource.uri, mockContext);
    expect(result2).toEqual({
      database: "test_db",
      total_indexes: 0,
      indexes: [],
      unused_indexes: [],
      potential_duplicates: [],
    });
  });
});
