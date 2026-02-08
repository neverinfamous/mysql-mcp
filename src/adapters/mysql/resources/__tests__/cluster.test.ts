import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../__tests__/mocks/index.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import { createClusterResource } from "../cluster.js";

describe("Cluster Resource", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  it("should return cluster status when group replication is enabled", async () => {
    // Mock group_replication_group_name
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        {
          Variable_name: "group_replication_group_name",
          Value: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        },
      ]),
    );

    // Mock replication_group_members
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        {
          id: "1",
          host: "host1",
          port: 3306,
          state: "ONLINE",
          role: "PRIMARY",
          version: "8.0.35",
        },
        {
          id: "2",
          host: "host2",
          port: 3306,
          state: "ONLINE",
          role: "SECONDARY",
          version: "8.0.35",
        },
      ]),
    );

    // Mock primary member query
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([{ host: "host1", port: 3306 }]),
    );

    const resource = createClusterResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://cluster",
      mockContext,
    )) as any;

    expect(result.groupReplicationEnabled).toBe(true);
    expect(result.groupName).toBe("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(result.memberCount).toBe(2);
    expect(result.primary).toBe("host1:3306");
  });

  it("should return disabled status if group name is empty", async () => {
    // Mock group_replication_group_name with empty value
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        { Variable_name: "group_replication_group_name", Value: "" },
      ]),
    );

    const resource = createClusterResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://cluster",
      mockContext,
    )) as any;

    expect(result.groupReplicationEnabled).toBe(false);
    expect(result.message).toContain("not configured");
  });

  it("should return disabled status if variable query returns empty", async () => {
    // Mock group_replication_group_name with no rows
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    const resource = createClusterResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://cluster",
      mockContext,
    )) as any;

    expect(result.groupReplicationEnabled).toBe(false);
  });

  it("should handle undefined rows gracefully", async () => {
    // Mock empty result with undefined rows
    mockAdapter.executeQuery.mockResolvedValueOnce({} as any);

    const resource = createClusterResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://cluster",
      mockContext,
    )) as any;

    expect(result.groupReplicationEnabled).toBe(false);
  });

  it("should handle missing primary member", async () => {
    // Mock group_replication_group_name
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        { Variable_name: "group_replication_group_name", Value: "uuid" },
      ]),
    );

    // Mock members (no primary)
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([{ id: "1", role: "SECONDARY" }]),
    );

    // Mock primary query (empty)
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    const resource = createClusterResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://cluster",
      mockContext,
    )) as any;

    expect(result.groupReplicationEnabled).toBe(true);
    expect(result.primary).toBeNull();
  });

  it("should handle errors gracefully", async () => {
    mockAdapter.executeQuery.mockRejectedValue(new Error("DB Error"));

    const resource = createClusterResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://cluster",
      mockContext,
    )) as any;

    expect(result.groupReplicationEnabled).toBe(false);
    expect(result.message).toContain("Unable to retrieve");
  });
});
