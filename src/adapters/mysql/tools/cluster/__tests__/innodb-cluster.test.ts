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
  createClusterSwitchoverTool,
  createClusterTopologyTool,
} from "../innodb-cluster.js";
import type { MySQLAdapter } from "../../../mysql-adapter.js";
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
        ) // Cluster info (basic)
        .mockResolvedValueOnce(createMockQueryResult([{ count: 3 }])) // Instance count
        .mockResolvedValueOnce(createMockQueryResult([{ count: 2 }])) // Router count
        .mockResolvedValueOnce(
          createMockQueryResult([
            { host: "node1", port: 3306, state: "ONLINE", role: "PRIMARY" },
          ]),
        ) // GR result for status and topology
        .mockResolvedValueOnce(
          createMockQueryResult([
            {
              cluster_name: "myCluster",
              cluster_id: 1,
              primary_mode: "SINGLE",
            },
          ]),
        ); // Full cluster info (non-summary mode)

      const tool = createClusterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.data.isInnoDBCluster).toBe(true);
      expect(result.data.cluster).toEqual({
        cluster_name: "myCluster",
        cluster_id: 1,
        primary_mode: "SINGLE",
      });
      expect(result.data.instanceCount).toBe(3);
      expect(result.data.routerCount).toBe(2);
    });

    it("should fall back to GR status when InnoDB Cluster metadata not found", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([])) // Schema check - empty
        .mockResolvedValueOnce(createMockQueryResult([{ memberCount: 3 }])); // GR member count

      const tool = createClusterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.data.isInnoDBCluster).toBe(false);
      expect(result.data.message).toContain("Group Replication status");
      expect(result.data.onlineMembers).toBe(3);
    });

    it("should fall back to GR status when schema check returns undefined rows", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce({ rows: undefined }) // Schema check - undefined rows
        .mockResolvedValueOnce(createMockQueryResult([{ memberCount: 2 }])); // GR member count

      const tool = createClusterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.data.isInnoDBCluster).toBe(false);
      expect(result.data.onlineMembers).toBe(2);
    });

    it("should return error response when query fails", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Connection refused"),
      );

      const tool = createClusterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.error).toBe("Connection refused");
    });

    it("should handle non-Error thrown values", async () => {
      mockAdapter.executeQuery.mockRejectedValue("String error");

      const tool = createClusterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.error).toBe("String error");
    });
  });

  describe("createClusterInstancesTool", () => {
    it("should include primaryError when both queries fail", async () => {
      mockAdapter.executeQuery
        .mockRejectedValueOnce(new Error("Metadata query failed")) // Primary fails
        .mockRejectedValueOnce(new Error("GR query also failed")); // Fallback fails

      const tool = createClusterInstancesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ limit: 10 }, mockContext)) as any;

      expect(result.error).toBe(
        "Primary Error: Metadata query failed. Fallback Error: GR query also failed",
      );
    });

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

      expect(result.data.source).toBe("group_replication");
      expect(result.data.instances).toHaveLength(1);
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

      expect(result.error).toContain("Router metadata not available");
      expect(result.error).toContain("mysql_router_status");
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

      expect(result.data.routers).toHaveLength(1);
      expect(result.data.count).toBe(1);
    });

    it("should strip Configuration from attributes in full mode", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            routerId: 1,
            routerName: "router1",
            address: "192.168.1.1",
            attributes: JSON.stringify({
              ROEndpoint: "6447",
              RWEndpoint: "6446",
              Configuration: { endpoint1: { ssl: true, port: 6446 } },
            }),
          },
        ]),
      );

      const tool = createClusterRouterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { summary: false },
        mockContext,
      )) as any;

      expect(result.data.routers).toHaveLength(1);
      expect(result.data.routers[0].attributes).toBeDefined();
      expect(result.data.routers[0].attributes.ROEndpoint).toBe("6447");
      expect(result.data.routers[0].attributes.Configuration).toBeUndefined();
    });

    it("should flag stale routers when lastCheckIn is null or old", async () => {
      const recentTime = new Date().toISOString();
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            routerId: 1,
            routerName: "active-router",
            address: "192.168.1.1",
            lastCheckIn: recentTime,
            attributes: JSON.stringify({ ROEndpoint: "6447" }),
          },
          {
            routerId: 2,
            routerName: "stale-router",
            address: "192.168.1.2",
            lastCheckIn: null,
            attributes: JSON.stringify({ ROEndpoint: "6447" }),
          },
        ]),
      );

      const tool = createClusterRouterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { summary: false },
        mockContext,
      )) as any;

      expect(result.data.routers).toHaveLength(2);
      expect(result.data.routers[0].isStale).toBe(false);
      expect(result.data.routers[1].isStale).toBe(true);
      expect(result.data.staleCount).toBe(1);
    });
  });

  describe("createClusterStatusTool - payload optimization", () => {
    it("should strip entire Configuration from router_options in full mode", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([
            { SCHEMA_NAME: "mysql_innodb_cluster_metadata" },
          ]),
        )
        .mockResolvedValueOnce(
          createMockQueryResult([{ cluster_name: "myCluster" }]),
        )
        .mockResolvedValueOnce(createMockQueryResult([{ count: 3 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ count: 1 }]))
        .mockResolvedValueOnce(
          createMockQueryResult([
            { host: "node1", port: 3306, state: "ONLINE", role: "PRIMARY" },
          ]),
        )
        .mockResolvedValueOnce(
          createMockQueryResult([
            {
              cluster_name: "myCluster",
              router_options: JSON.stringify({
                Configuration: {
                  "9.2.0": {
                    GuidelinesSchema: { type: "object", properties: {} },
                    ConfigurationChangesSchema: {
                      type: "object",
                      properties: {},
                    },
                    SomeUsefulOption: "keep-this",
                  },
                },
                SomeTopLevelOption: "preserved",
              }),
            },
          ]),
        );

      const tool = createClusterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { summary: false },
        mockContext,
      )) as any;

      expect(result.data.isInnoDBCluster).toBe(true);
      const routerOpts = result.data.cluster.router_options;
      expect(routerOpts.Configuration).toBeUndefined();
      expect(routerOpts.SomeTopLevelOption).toBe("preserved");
    });
  });

  describe("createClusterInstancesTool - null state normalization", () => {
    it("should return OFFLINE/NONE for instances not in GR group", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            instanceId: 1,
            address: "node1:3306",
            memberState: "ONLINE",
            memberRole: "PRIMARY",
          },
          {
            instanceId: 2,
            address: "node2:3306",
            memberState: "OFFLINE",
            memberRole: "NONE",
          },
        ]),
      );

      const tool = createClusterInstancesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.data.instances[0].memberState).toBe("ONLINE");
      expect(result.data.instances[0].memberRole).toBe("PRIMARY");
      expect(result.data.instances[1].memberState).toBe("OFFLINE");
      expect(result.data.instances[1].memberRole).toBe("NONE");
    });
  });

  describe("createClusterTopologyTool - metadata cross-reference", () => {
    it("should include metadata-only instances in offline list", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([
            {
              id: "uuid1",
              host: "node1",
              port: 3306,
              state: "ONLINE",
              role: "PRIMARY",
              version: "9.2.0",
            },
          ]),
        )
        .mockResolvedValueOnce(
          createMockQueryResult([
            { id: "uuid1", host: "node1", port: 3306 },
            { id: "uuid2", host: "node2", port: 3306 },
            { id: "uuid3", host: "node3", port: 3306 },
          ]),
        );

      const tool = createClusterTopologyTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.data.totalMembers).toBe(3);
      expect(result.data.onlineMembers).toBe(1);
      expect(result.data.topology.offline).toHaveLength(2);
      expect(result.data.topology.offline[0].state).toBe("OFFLINE");
      expect(result.data.topology.offline[0].source).toBe("metadata");
      expect(result.data.visualization).toContain("node2");
    });
  });

  describe("createClusterSwitchoverTool", () => {
    it("should warn when no online secondaries exist", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            memberId: "uuid1",
            host: "node1",
            port: 3306,
            state: "ONLINE",
            role: "PRIMARY",
            version: "9.2.0",
            txQueue: 0,
            applierQueue: 0,
          },
        ]),
      );

      const tool = createClusterSwitchoverTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.data.canSwitchover).toBe(false);
      expect(result.data.candidates).toHaveLength(0);
      expect(result.data.currentPrimary).toBeDefined();
      expect(result.data.warning).toBe(
        "No online secondaries available for switchover.",
      );
    });

    it("should return currentPrimary as null when no primary exists", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            memberId: "uuid1",
            host: "node1",
            port: 3306,
            state: "OFFLINE",
            role: "SECONDARY",
            version: "9.2.0",
            txQueue: 0,
            applierQueue: 0,
          },
        ]),
      );

      const tool = createClusterSwitchoverTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.data.currentPrimary).toBeNull();
    });

    it("should recommend good switchover candidate", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          {
            memberId: "uuid1",
            host: "node1",
            port: 3306,
            state: "ONLINE",
            role: "PRIMARY",
            version: "9.2.0",
            txQueue: 0,
            applierQueue: 0,
          },
          {
            memberId: "uuid2",
            host: "node2",
            port: 3306,
            state: "ONLINE",
            role: "SECONDARY",
            version: "9.2.0",
            txQueue: 0,
            applierQueue: 0,
          },
        ]),
      );

      const tool = createClusterSwitchoverTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.data.canSwitchover).toBe(true);
      expect(result.data.candidates).toHaveLength(1);
      expect(result.data.candidates[0].suitability).toBe("GOOD");
      expect(result.data.recommendedTarget).not.toBeNull();
      expect(result.data.warning).toBeUndefined();
    });
  });

  describe("createClusterTopologyTool - error handling", () => {
    it("should return structured error when first query fails", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Connection refused"),
      );

      const tool = createClusterTopologyTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.error).toBe("Connection refused");
    });
  });

  describe("createClusterSwitchoverTool - error handling", () => {
    it("should return structured error when query fails", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Access denied"));

      const tool = createClusterSwitchoverTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.error).toBe("Access denied");
    });
  });

  describe("Zod validation leak prevention", () => {
    it("cluster_status should return structured error for invalid summary type", async () => {
      const tool = createClusterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { summary: "yes" },
        mockContext,
      )) as any;

      expect(result.error).toBeDefined();
      expect(result.error).toContain("expected boolean");
    });

    it("cluster_instances should return structured error for invalid limit type", async () => {
      const tool = createClusterInstancesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ limit: "abc" }, mockContext)) as any;

      expect(result.error).toBeDefined();
      expect(result.error).toContain("expected number");
    });

    it("cluster_instances should return structured error for negative limit", async () => {
      const tool = createClusterInstancesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ limit: -5 }, mockContext)) as any;

      expect(result.error).toBeDefined();
    });

    it("cluster_instances should return structured error for float limit", async () => {
      const tool = createClusterInstancesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ limit: 0.5 }, mockContext)) as any;

      expect(result.error).toBeDefined();
    });

    it("cluster_router_status should return structured error for invalid summary type", async () => {
      const tool = createClusterRouterStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ summary: 123 }, mockContext)) as any;

      expect(result.error).toBeDefined();
      expect(result.error).toContain("expected boolean");
    });
  });
});
