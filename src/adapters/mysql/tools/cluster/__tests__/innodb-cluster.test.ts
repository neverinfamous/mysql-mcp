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
        ) // Cluster info (basic)
        .mockResolvedValueOnce(createMockQueryResult([{ count: 3 }])) // Instance count
        .mockResolvedValueOnce(createMockQueryResult([{ count: 2 }])) // Router count
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

      expect(result.isInnoDBCluster).toBe(true);
      expect(result.cluster).toEqual({
        cluster_name: "myCluster",
        cluster_id: 1,
        primary_mode: "SINGLE",
      });
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

      expect(result.routers).toHaveLength(1);
      expect(result.routers[0].attributes).toBeDefined();
      expect(result.routers[0].attributes.ROEndpoint).toBe("6447");
      expect(result.routers[0].attributes.Configuration).toBeUndefined();
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

      expect(result.routers).toHaveLength(2);
      expect(result.routers[0].isStale).toBe(false);
      expect(result.routers[1].isStale).toBe(true);
      expect(result.staleCount).toBe(1);
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

      expect(result.isInnoDBCluster).toBe(true);
      const routerOpts = result.cluster.router_options;
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

      expect(result.instances[0].memberState).toBe("ONLINE");
      expect(result.instances[0].memberRole).toBe("PRIMARY");
      expect(result.instances[1].memberState).toBe("OFFLINE");
      expect(result.instances[1].memberRole).toBe("NONE");
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

      expect(result.totalMembers).toBe(3);
      expect(result.onlineMembers).toBe(1);
      expect(result.topology.offline).toHaveLength(2);
      expect(result.topology.offline[0].state).toBe("OFFLINE");
      expect(result.topology.offline[0].source).toBe("metadata");
      expect(result.visualization).toContain("node2");
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

      expect(result.canSwitchover).toBe(false);
      expect(result.candidates).toHaveLength(0);
      expect(result.warning).toBe(
        "No online secondaries available for switchover.",
      );
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

      expect(result.canSwitchover).toBe(true);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].suitability).toBe("GOOD");
      expect(result.recommendedTarget).not.toBeNull();
      expect(result.warning).toBeUndefined();
    });
  });
});
