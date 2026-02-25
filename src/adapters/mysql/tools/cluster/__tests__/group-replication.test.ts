import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  createGRStatusTool,
  createGRMembersTool,
  createGRPrimaryTool,
  createGRTransactionsTool,
  createGRFlowControlTool,
} from "../group-replication.js";
import { MySQLAdapter } from "../../../MySQLAdapter.js";

describe("Group Replication Tools", () => {
  let mockAdapter: MySQLAdapter;
  let mockExecuteQuery: Mock;

  beforeEach(() => {
    mockExecuteQuery = vi.fn();
    mockAdapter = {
      executeQuery: mockExecuteQuery,
    } as unknown as MySQLAdapter;
  });

  describe("mysql_gr_status", () => {
    it("should report status correctly", async () => {
      const tool = createGRStatusTool(mockAdapter);

      mockExecuteQuery
        // Plugin Status
        .mockResolvedValueOnce({
          rows: [{ PLUGIN_STATUS: "ACTIVE" }],
        })
        // Config status
        .mockResolvedValueOnce({
          rows: [
            {
              groupName: "d747d0cc-189f-11ee-8653-0242ac110002",
              singlePrimaryMode: 1,
              localAddress: "127.0.0.1:33061",
              groupSeeds: "127.0.0.1:33061",
              bootstrapGroup: 0,
            },
          ],
        })
        // Members status
        .mockResolvedValueOnce({
          rows: [
            {
              CHANNEL_NAME: "group_replication_applier",
              MEMBER_ID: "member-1",
              MEMBER_HOST: "host1",
              MEMBER_PORT: 3306,
              MEMBER_STATE: "ONLINE",
              MEMBER_ROLE: "PRIMARY",
              MEMBER_VERSION: "8.0.32",
            },
          ],
        })
        // Local UUID
        .mockResolvedValueOnce({
          rows: [{ serverUuid: "member-1" }],
        });

      const result = (await tool.handler({}, {} as any)) as any;

      expect(result).toEqual({
        enabled: true,
        groupName: "d747d0cc-189f-11ee-8653-0242ac110002",
        singlePrimaryMode: true,
        localAddress: "127.0.0.1:33061",
        localMember: {
          CHANNEL_NAME: "group_replication_applier",
          MEMBER_ID: "member-1",
          MEMBER_HOST: "host1",
          MEMBER_PORT: 3306,
          MEMBER_STATE: "ONLINE",
          MEMBER_ROLE: "PRIMARY",
          MEMBER_VERSION: "8.0.32",
        },
        memberCount: 1,
        members: [
          expect.objectContaining({
            id: "member-1",
            role: "PRIMARY",
          }),
        ],
      });
    });

    it("should handle disabled group replication", async () => {
      const tool = createGRStatusTool(mockAdapter);

      mockExecuteQuery.mockResolvedValueOnce({ rows: [] }); // Plugin not found or not active

      const result = (await tool.handler({}, {} as any)) as any;

      expect(result.enabled).toBe(false);
      expect(result.message).toContain("not active");
    });

    it("should handle partial status where config is missing but members exist", async () => {
      const tool = createGRStatusTool(mockAdapter);

      mockExecuteQuery
        // Plugin Status
        .mockResolvedValueOnce({
          rows: [{ PLUGIN_STATUS: "ACTIVE" }],
        })
        .mockResolvedValueOnce({ rows: [] }) // Config missing
        .mockResolvedValueOnce({
          rows: [{ MEMBER_ID: "member-1", MEMBER_STATE: "ONLINE" }],
        }) // Members exist
        .mockResolvedValueOnce({
          rows: [{ serverUuid: "member-1" }],
        });

      const result = (await tool.handler({}, {} as any)) as any;

      expect(result.enabled).toBe(true);
      expect(result.groupName).toBeNull();
      expect(result.singlePrimaryMode).toBe(false); // Default logic fallback
      expect(result.localMember).toBeDefined();
    });
  });

  describe("mysql_gr_flow_control", () => {
    it("should report flow control statistics", async () => {
      const tool = createGRFlowControlTool(mockAdapter);

      mockExecuteQuery
        // Plugin Status
        .mockResolvedValueOnce({
          rows: [{ PLUGIN_STATUS: "ACTIVE" }],
        })
        // Config
        .mockResolvedValueOnce({
          rows: [
            {
              flowControlMode: "QUOTA",
              certifierThreshold: 25000,
              applierThreshold: 25000,
              minQuota: 0,
              minRecoveryQuota: 0,
              maxQuota: 0,
            },
          ],
        })
        // Queue stats
        .mockResolvedValueOnce({
          rows: [
            {
              memberId: "member-1",
              certifyQueue: 100,
              applierQueue: 50,
            },
          ],
        });

      const result = (await tool.handler({}, {} as any)) as any;

      expect(result.isThrottling).toBe(false);
      expect(result.memberQueues).toHaveLength(1);
    });

    it("should detect throttling", async () => {
      const tool = createGRFlowControlTool(mockAdapter);

      mockExecuteQuery
        // Plugin Status
        .mockResolvedValueOnce({
          rows: [{ PLUGIN_STATUS: "ACTIVE" }],
        })
        // Config
        .mockResolvedValueOnce({
          rows: [
            {
              certifierThreshold: 100, // Low threshold
              applierThreshold: 100,
            },
          ],
        })
        // Queue stats
        .mockResolvedValueOnce({
          rows: [
            {
              memberId: "member-1",
              certifyQueue: 200, // Above threshold
              applierQueue: 50,
            },
          ],
        });

      const result = (await tool.handler({}, {} as any)) as any;

      expect(result.isThrottling).toBe(true);
    });

    it("should use default thresholds when config missing", async () => {
      const tool = createGRFlowControlTool(mockAdapter);

      mockExecuteQuery
        // Plugin Status
        .mockResolvedValueOnce({
          rows: [{ PLUGIN_STATUS: "ACTIVE" }],
        })
        .mockResolvedValueOnce({ rows: [] }) // Missing config
        .mockResolvedValueOnce({
          rows: [
            {
              memberId: "member-1",
              certifyQueue: 26000, // > 25000 default
              applierQueue: 100,
            },
          ],
        });

      const result = (await tool.handler({}, {} as any)) as any;

      expect(result.isThrottling).toBe(true);
      expect(result.recommendation).toContain("Flow control is active");
    });
  });
});

describe("Group Replication Tools - Error Handling", () => {
  let mockAdapter: MySQLAdapter;
  let mockExecuteQuery: Mock;

  beforeEach(() => {
    mockExecuteQuery = vi.fn();
    mockAdapter = {
      executeQuery: mockExecuteQuery,
    } as unknown as MySQLAdapter;
  });

  it("mysql_gr_status should return structured error when query fails", async () => {
    const tool = createGRStatusTool(mockAdapter);
    mockExecuteQuery.mockRejectedValue(new Error("Connection refused"));

    const result = (await tool.handler({}, {} as any)) as any;

    expect(result.enabled).toBe(false);
    expect(result.error).toBe("Connection refused");
  });

  it("mysql_gr_members should return structured error when query fails", async () => {
    const tool = createGRMembersTool(mockAdapter);
    mockExecuteQuery.mockRejectedValue(new Error("Access denied"));

    const result = (await tool.handler({}, {} as any)) as any;

    expect(result.members).toEqual([]);
    expect(result.count).toBe(0);
    expect(result.error).toBe("Access denied");
  });

  it("mysql_gr_primary should return structured error when query fails", async () => {
    const tool = createGRPrimaryTool(mockAdapter);
    mockExecuteQuery.mockRejectedValue(new Error("Connection lost"));

    const result = (await tool.handler({}, {} as any)) as any;

    expect(result.hasPrimary).toBe(false);
    expect(result.error).toBe("Connection lost");
  });

  it("mysql_gr_transactions should return structured error when query fails", async () => {
    const tool = createGRTransactionsTool(mockAdapter);
    mockExecuteQuery.mockRejectedValue(new Error("Permission denied"));

    const result = (await tool.handler({}, {} as any)) as any;

    expect(result.memberStats).toEqual([]);
    expect(result.gtid).toEqual({ executed: "", purged: "" });
    expect(result.error).toBe("Permission denied");
  });

  it("mysql_gr_flow_control should return structured error when query fails", async () => {
    const tool = createGRFlowControlTool(mockAdapter);
    mockExecuteQuery.mockRejectedValue(new Error("Timeout"));

    const result = (await tool.handler({}, {} as any)) as any;

    expect(result.configuration).toEqual({});
    expect(result.memberQueues).toEqual([]);
    expect(result.isThrottling).toBe(false);
    expect(result.error).toBe("Timeout");
  });
});
