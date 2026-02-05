/**
 * mysql-mcp - InnoDB Cluster Tools Unit Tests
 *
 * Tests for innodb-cluster.ts tools including fallback scenarios.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createClusterStatusTool,
  createClusterInstancesTool,
  createClusterRouterStatusTool,
} from "../innodb-cluster.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("InnoDB Cluster Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createClusterStatusTool", () => {
    it("should return cluster status when InnoDB Cluster metadata exists", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([
            { SCHEMA_NAME: "mysql_innodb_cluster_metadata" },
          ]),
        ) // Schema check
        .mockResolvedValueOnce(
          createMockQueryResult([{ cluster_name: "myCluster" }]),
        ) // Cluster info
        .mockResolvedValueOnce(createMockQueryResult([{ count: 3 }])) // Instance count
        .mockResolvedValueOnce(createMockQueryResult([{ count: 2 }])); // Router count

      const tool = createClusterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.isInnoDBCluster).toBe(true);
      expect(result.cluster).toEqual({ cluster_name: "myCluster" });
      expect(result.instanceCount).toBe(3);
      expect(result.routerCount).toBe(2);
    });

    it("should fall back to GR status when InnoDB Cluster metadata not found", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([])) // Schema check - empty
        .mockResolvedValueOnce(createMockQueryResult([{ memberCount: 3 }])); // GR member count

      const tool = createClusterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.isInnoDBCluster).toBe(false);
      expect(result.message).toContain("Group Replication status");
      expect(result.onlineMembers).toBe(3);
    });

    it("should fall back to GR status when schema check returns undefined rows", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce({ rows: undefined }) // Schema check - undefined rows
        .mockResolvedValueOnce(createMockQueryResult([{ memberCount: 2 }])); // GR member count

      const tool = createClusterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.isInnoDBCluster).toBe(false);
      expect(result.onlineMembers).toBe(2);
    });

    it("should return error response when query fails", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Connection refused"),
      );

      const tool = createClusterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.isInnoDBCluster).toBe(false);
      expect(result.message).toContain("Unable to query cluster metadata");
      expect(result.error).toBe("Connection refused");
    });

    it("should handle non-Error thrown values", async () => {
      mockAdapter.executeQuery.mockRejectedValue("String error");

      const tool = createClusterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.isInnoDBCluster).toBe(false);
      expect(result.error).toBe("String error");
    });
  });

  describe("createClusterInstancesTool", () => {
    it("should fallback to GR members when InnoDB Cluster metadata query fails", async () => {
      mockAdapter.executeQuery
        .mockRejectedValueOnce(new Error("Table not found")) // First query fails
        .mockResolvedValueOnce(
          createMockQueryResult([
            {
              serverUuid: "uuid1",
              address: "host1:3306",
              memberState: "ONLINE",
              memberRole: "PRIMARY",
            },
          ]),
        ); // GR fallback

      const tool = createClusterInstancesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ limit: 10 }, mockContext)) as any;

      expect(result.source).toBe("group_replication");
      expect(result.instances).toHaveLength(1);
    });
  });

  describe("createClusterRouterStatusTool", () => {
    it("should return unavailable message when router metadata query fails", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Table does not exist"),
      );

      const tool = createClusterRouterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.available).toBe(false);
      expect(result.message).toContain("Router metadata not available");
      expect(result.suggestion).toContain("mysql_router_status");
    });

    it("should return routers when metadata exists", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { routerId: 1, routerName: "router1", address: "192.168.1.1" },
        ]),
      );

      const tool = createClusterRouterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.routers).toHaveLength(1);
      expect(result.count).toBe(1);
    });
  });
});
