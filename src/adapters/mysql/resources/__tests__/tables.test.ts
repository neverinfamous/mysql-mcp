import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTablesResource } from "../tables.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
} from "../../../../__tests__/mocks/index.js";

interface TablesResult {
  tables: unknown[];
  count: number;
}

describe("Tables Resource", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  it("should call listTables adapter method", async () => {
    const resource = createTablesResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    await resource.handler("mysql://tables", mockContext);

    expect(mockAdapter.listTables).toHaveBeenCalled();
  });

  it("should return table list with count", async () => {
    const resource = createTablesResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://tables",
      mockContext,
    )) as TablesResult;

    expect(result).toHaveProperty("tables");
    expect(result).toHaveProperty("count");
    expect(Array.isArray(result.tables)).toBe(true);
  });
});
