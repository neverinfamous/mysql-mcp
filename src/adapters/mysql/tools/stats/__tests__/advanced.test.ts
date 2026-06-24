import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createStatsTopNTool,
  createStatsDistinctTool,
  createStatsFrequencyTool,
  createStatsSummaryTool,
} from "../advanced.js";
import type {} from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

describe("Advanced Stats Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("Top N Tool", () => {
    let tool: ReturnType<typeof createStatsTopNTool>;

    beforeEach(() => {
      tool = createStatsTopNTool(mockAdapter);
    });

    it("should fetch top N with auto-excluded text columns", async () => {
      mockAdapter.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes("information_schema.COLUMNS")) {
          return createMockQueryResult([
            { COLUMN_NAME: "id", DATA_TYPE: "int" },
            { COLUMN_NAME: "body", DATA_TYPE: "longtext" },
          ]);
        }
        if (query.includes("LIMIT")) {
          return createMockQueryResult([{ id: 1 }]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler(
        { table: "posts", column: "id", n: 10 },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.count).toBe(1);
      expect(data.hint).toContain("body"); // Should warn about excluded column

      const selectSql = mockAdapter.executeQuery.mock.calls[1]?.[0];
      expect(selectSql).toContain("`id`");
      expect(selectSql).not.toContain("`body`");
    });

    it("should fetch user-specified columns", async () => {
      mockAdapter.executeQuery.mockImplementation(async () => {
        return createMockQueryResult([{ id: 1, body: "test" }]);
      });

      const result = await tool.handler(
        { table: "posts", column: "id", selectColumns: ["id", "body"] },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);

      const selectSql = mockAdapter.executeQuery.mock.calls[0]?.[0];
      expect(selectSql).toContain("`id`, `body`");
    });
  });

  describe("Distinct Tool", () => {
    let tool: ReturnType<typeof createStatsDistinctTool>;

    beforeEach(() => {
      tool = createStatsDistinctTool(mockAdapter);
    });

    it("should fetch distinct values", async () => {
      mockAdapter.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes("COUNT(DISTINCT")) {
          return createMockQueryResult([{ cnt: 3 }]);
        }
        if (query.includes("SELECT DISTINCT")) {
          return createMockQueryResult([
            { value: "A" },
            { value: "B" },
            { value: "C" },
          ]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler(
        { table: "users", column: "category" },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.count).toBe(3);
      expect(data.values).toEqual(["A", "B", "C"]);
    });
  });

  describe("Frequency Tool", () => {
    let tool: ReturnType<typeof createStatsFrequencyTool>;

    beforeEach(() => {
      tool = createStatsFrequencyTool(mockAdapter);
    });

    it("should calculate frequency distribution", async () => {
      mockAdapter.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes("COUNT(DISTINCT")) {
          return createMockQueryResult([{ cnt: 2 }]);
        }
        if (query.includes("percentage")) {
          return createMockQueryResult([
            { value: "A", frequency: 80, percentage: 80 },
            { value: "B", frequency: 20, percentage: 20 },
          ]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler(
        { table: "users", column: "category" },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.distinctValues).toBe(2);
      expect(data.distribution[0].value).toBe("A");
      expect(data.distribution[0].percentage).toBe(80);
    });
  });

  describe("Summary Tool", () => {
    let tool: ReturnType<typeof createStatsSummaryTool>;

    beforeEach(() => {
      tool = createStatsSummaryTool(mockAdapter);
    });

    it("should summarize auto-detected numeric columns", async () => {
      mockAdapter.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes("information_schema.TABLES")) {
          return createMockQueryResult([{ TABLE_NAME: "users" }]);
        }
        if (query.includes("information_schema.COLUMNS")) {
          return createMockQueryResult([
            { COLUMN_NAME: "age", DATA_TYPE: "int" },
            { COLUMN_NAME: "name", DATA_TYPE: "varchar" },
          ]);
        }
        if (query.includes("COUNT(")) {
          return createMockQueryResult([
            {
              age_count: 10,
              age_avg: 25.5,
              age_min: 18,
              age_max: 60,
              age_stddev: 10.5,
            },
          ]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler({ table: "users" }, mockContext);

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.summaries.length).toBe(1);
      expect(data.summaries[0].column).toBe("age");
      expect(data.summaries[0].avg).toBe(25.5);
    });

    it("should reject non-existent tables", async () => {
      mockAdapter.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes("missing_table")) {
          const error = new Error("Table 'testdb.missing_table' doesn't exist");
          Object.assign(error, { code: "ER_NO_SUCH_TABLE" });
          throw error;
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler(
        { table: "missing_table" },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(false);
      expect(Reflect.get(result || {}, "code")).toBe("TABLE_NOT_FOUND");
    });
  });
});
