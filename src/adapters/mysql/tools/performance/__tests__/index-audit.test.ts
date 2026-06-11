/**
 * mysql-mcp - Index Audit Tools Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createIndexRecommendationTool } from "../index-audit/index.js";
import type {} from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
  createMockTableInfo,
} from "../../../../../__tests__/mocks/index.js";

describe("Index Audit Tool", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createIndexRecommendationTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createIndexRecommendationTool(
        mockAdapter,
      );

      expect(tool.name).toBe("mysql_index_recommendation");
      expect(tool.group).toBe("optimization");
      expect(tool.requiredScopes).toContain("read");
    });

    it("should return structured error for nonexistent table (P154)", async () => {
      const mockTableInfo = createMockTableInfo("ghost");
      mockTableInfo.columns = [];
      mockAdapter.describeTable.mockResolvedValue(mockTableInfo);

      const tool = createIndexRecommendationTool(
        mockAdapter,
      );
      const result = (await tool.handler({ table: "ghost" }, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Table 'ghost' does not exist");
      expect(mockAdapter.getTableIndexes).not.toHaveBeenCalled();
    });

    it("should handle alias for table name", async () => {
      const mockTableInfo = createMockTableInfo("orders");
      mockTableInfo.columns = [
        { name: "id", type: "int", nullable: false, primaryKey: true },
      ];
      mockAdapter.describeTable.mockResolvedValue(mockTableInfo);
      mockAdapter.getTableIndexes.mockResolvedValue([]);
      
      const tool = createIndexRecommendationTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { tableName: "orders" },
        mockContext,
      )) as { data: { table: string } };

      expect(result.data.table).toBe("orders");
      expect(mockAdapter.describeTable).toHaveBeenCalledWith("orders");
    });

    it("should reject non-SELECT queries for EXPLAIN analysis", async () => {
      const tool = createIndexRecommendationTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { queries: ["DELETE FROM users"] },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Only SELECT queries are supported");
    });

    it("should limit the number of queries to 20", async () => {
      const queries = Array(21).fill("SELECT 1");
      const tool = createIndexRecommendationTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { queries },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Maximum of 20 queries");
    });

    describe("Redundant Index Detection", () => {
      it("should flag strict prefix indexes as redundant", async () => {
        mockAdapter.getTableIndexes.mockResolvedValue([
          { name: "PRIMARY", tableName: "users", columns: ["id"], unique: true, type: "BTREE" },
          { name: "idx_a", tableName: "users", columns: ["status"], unique: false, type: "BTREE" },
          { name: "idx_a_b", tableName: "users", columns: ["status", "created_at"], unique: false, type: "BTREE" },
        ]);

        const mockTableInfo = createMockTableInfo("users");
        mockTableInfo.columns = [{ name: "id", type: "int", nullable: false, primaryKey: true }];
        mockAdapter.describeTable.mockResolvedValue(mockTableInfo);

        const tool = createIndexRecommendationTool(
          mockAdapter,
        );
        const result = await tool.handler({ table: "users" }, mockContext);

        const redundantFindings = result.data.findings.filter((f: any) => f.type === "redundant");
        expect(redundantFindings).toHaveLength(1);
        expect(redundantFindings[0].index).toBe("idx_a");
        expect(redundantFindings[0].redundantOf).toBe("idx_a_b");
      });

      it("should not flag non-prefix overlapping indexes", async () => {
        mockAdapter.getTableIndexes.mockResolvedValue([
          { name: "idx_a_b", tableName: "users", columns: ["a", "b"], unique: false, type: "BTREE" },
          { name: "idx_b_c", tableName: "users", columns: ["b", "c"], unique: false, type: "BTREE" },
        ]);

        const mockTableInfo = createMockTableInfo("users");
        mockTableInfo.columns = [{ name: "id", type: "int", nullable: false, primaryKey: true }];
        mockAdapter.describeTable.mockResolvedValue(mockTableInfo);

        const tool = createIndexRecommendationTool(
          mockAdapter,
        );
        const result = await tool.handler({ table: "users" }, mockContext);

        const redundantFindings = result.data.findings.filter((f: any) => f.type === "redundant");
        expect(redundantFindings).toHaveLength(0);
      });
    });

    describe("Missing FK Index Detection", () => {
      it("should flag foreign keys without leading indexes", async () => {
        mockAdapter.getTableIndexes.mockResolvedValue([]);
        mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([
          { TABLE_NAME: "orders", COLUMN_NAME: "user_id", REFERENCED_TABLE_NAME: "users", REFERENCED_COLUMN_NAME: "id" }
        ]));

        const mockTableInfo = createMockTableInfo("orders");
        mockTableInfo.columns = [{ name: "id", type: "int", nullable: false, primaryKey: true }];
        mockAdapter.describeTable.mockResolvedValue(mockTableInfo);

        const tool = createIndexRecommendationTool(
          mockAdapter,
        );
        const result = await tool.handler({ table: "orders" }, mockContext);

        const fkFindings = result.data.findings.filter((f: any) => f.type === "missing_fk_index");
        expect(fkFindings).toHaveLength(1);
        expect(fkFindings[0].column).toBe("user_id");
      });
    });

    describe("Unindexed Large Table Detection", () => {
      it("should flag tables with >= 1000 rows and no secondary indexes", async () => {
        mockAdapter.getTableIndexes.mockResolvedValue([
          { name: "PRIMARY", tableName: "logs", columns: ["id"], unique: true, type: "BTREE" }
        ]);
        mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([
          { TABLE_NAME: "logs", TABLE_ROWS: 1500 }
        ]));

        const mockTableInfo = createMockTableInfo("logs");
        mockTableInfo.columns = [{ name: "id", type: "int", nullable: false, primaryKey: true }];
        mockAdapter.describeTable.mockResolvedValue(mockTableInfo);

        const tool = createIndexRecommendationTool(
          mockAdapter,
        );
        const result = await tool.handler({ table: "logs" }, mockContext);

        const unindexedFindings = result.data.findings.filter((f: any) => f.type === "unindexed_large_table");
        expect(unindexedFindings).toHaveLength(1);
        expect(unindexedFindings[0].table).toBe("logs");
      });
    });

    describe("EXPLAIN-based Query Analysis", () => {
      it("should detect full table scans and recommend composite indexes", async () => {
        // Setup table and indexes
        const mockTableInfo = createMockTableInfo("users");
        mockTableInfo.columns = [{ name: "id", type: "int", nullable: false, primaryKey: true }];
        mockAdapter.describeTable.mockResolvedValue(mockTableInfo);
        mockAdapter.getTableIndexes.mockResolvedValue([]);

        // Mock EXPLAIN response
        mockAdapter.executeReadQuery.mockImplementation(async (query: string) => {
          if (query.startsWith("EXPLAIN")) {
            return createMockQueryResult([{
              EXPLAIN: JSON.stringify({
                query_block: {
                  table: {
                    table_name: "users",
                    access_type: "ALL",
                    attached_condition: "(`users`.`status` = 'active' and `users`.`role` = 'admin')"
                  }
                }
              })
            }]);
          }
          return createMockQueryResult([]);
        });

        const tool = createIndexRecommendationTool(
          mockAdapter,
        );
        const result = await tool.handler(
          { table: "users", queries: ["SELECT * FROM users WHERE status = 'active' AND role = 'admin'"] },
          mockContext,
        );

        const compositeFindings = result.data.findings.filter((f: any) => f.type === "composite");
        expect(compositeFindings).toHaveLength(1);
        expect(compositeFindings[0].table).toBe("users");
        expect(compositeFindings[0].columns).toContain("status");
        expect(compositeFindings[0].columns).toContain("role");
      });
    });

    describe("Legacy Heuristic Recommendations", () => {
      it("should fallback to heuristic matching if no queries provided", async () => {
        const mockTableInfo = createMockTableInfo("orders");
        mockTableInfo.columns = [
          { name: "id", type: "int", nullable: false, primaryKey: true },
          { name: "user_id", type: "int", nullable: false, primaryKey: false },
          { name: "status", type: "varchar", nullable: false, primaryKey: false },
        ];
        mockAdapter.describeTable.mockResolvedValue(mockTableInfo);
        mockAdapter.getTableIndexes.mockResolvedValue([]);

        const tool = createIndexRecommendationTool(
          mockAdapter,
        );
        const result = await tool.handler({ table: "orders" }, mockContext);

        const heuristicFindings = result.data.findings.filter((f: any) => f.type === "heuristic");
        expect(heuristicFindings).toHaveLength(3); // id, user_id, status

        // Verify backwards compatibility shape
        expect(result.data.recommendations).toHaveLength(3);
        expect(result.data.recommendations[0]).toHaveProperty("column");
        expect(result.data.recommendations[0]).toHaveProperty("reason");
      });
    });
  });
});
