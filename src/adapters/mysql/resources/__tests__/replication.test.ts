import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../__tests__/mocks/index.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import { createReplicationResource } from "../replication.js";

describe("Replication Resource", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  it("should handle empty result sets gracefully", async () => {
    // SHOW REPLICA STATUS (returns empty array)
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    // Fallback: SHOW SLAVE STATUS (returns empty array)
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    // SHOW BINARY LOG STATUS (returns empty array)
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    // Fallback: SHOW MASTER STATUS (returns empty array)
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    // GTID (fails or empty)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("No GTID"));

    // SHOW REPLICAS (empty)
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    const resource = createReplicationResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://replication",
      mockContext,
    )) as any;

    expect(result.role).toBe("standalone");
    expect(result.source).toBeNull();
    expect(result.replica).toBeNull();
  });

  it("should return source role info correctly", async () => {
    // SHOW REPLICA STATUS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("Not found"));
    // SHOW SLAVE STATUS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("Not found"));

    // SHOW BINARY LOG STATUS
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        {
          File: "bin.001",
          Position: 100,
          Binlog_Do_DB: "",
          Binlog_Ignore_DB: "",
        },
      ]),
    );

    // GTID
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    // SHOW REPLICAS
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([{ Host: "slave1" }]),
    );

    const resource = createReplicationResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://replication",
      mockContext,
    )) as any;

    expect(result.role).toBe("source");
    expect(result.source).toBeDefined();
    expect(result.connected_replicas).toHaveLength(1);
  });

  it("should return replica role info correctly", async () => {
    // SHOW REPLICA STATUS
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        {
          Source_Host: "master1",
          Slave_IO_Running: "Yes",
          Slave_SQL_Running: "Yes",
          Seconds_Behind_Master: 0,
        },
      ]),
    );

    // SHOW BINARY LOG STATUS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("Not source"));
    // SHOW MASTER STATUS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("Not source"));

    // GTID
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    // SHOW REPLICAS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("Not source"));

    // SHOW SLAVE HOSTS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("Not source"));

    const resource = createReplicationResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://replication",
      mockContext,
    )) as any;

    expect(result.role).toBe("replica");
    expect(result.replica).toBeDefined();
    expect(result.replica.source_host).toBe("master1");
  });

  it("should handle replica-source role", async () => {
    // SHOW REPLICA STATUS
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([{ Source_Host: "master1" }]),
    );

    // SHOW BINARY LOG STATUS
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([{ File: "bin.001" }]),
    );

    // GTID
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    // SHOW REPLICAS
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    const resource = createReplicationResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://replication",
      mockContext,
    )) as any;

    expect(result.role).toBe("replica-source");
    expect(result.gtid).toEqual({});
  });

  it("should parse GTID information", async () => {
    // SHOW REPLICA STATUS (fail - not a replica)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("Not a replica"));
    // SHOW SLAVE STATUS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("Not a replica"));

    // SHOW BINARY LOG STATUS (source)
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([{ File: "bin.001" }]),
    );

    // GTID
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        { Variable_name: "gtid_mode", Value: "ON" },
        { Variable_name: "gtid_executed", Value: "uuid:1-100" },
      ]),
    );

    // SHOW REPLICAS
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    const resource = createReplicationResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://replication",
      mockContext,
    )) as any;

    expect(result.role).toBe("source");
    expect(result.gtid).toEqual({
      gtid_mode: "ON",
      gtid_executed: "uuid:1-100",
    });
  });

  it("should fallback to older syntax for replicas", async () => {
    // SHOW REPLICA STATUS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("Syntax error"));

    // SHOW SLAVE STATUS
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([{ Master_Host: "master1" }]),
    );

    // SHOW BINARY LOG STATUS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("fail"));
    // SHOW MASTER STATUS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("fail"));

    // GTID
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    // SHOW REPLICAS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("fail"));
    // SHOW SLAVE HOSTS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("fail"));

    const resource = createReplicationResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://replication",
      mockContext,
    )) as any;

    expect(result.replica).toBeDefined();
    expect(result.replica.source_host).toBe("master1");
  });

  it("should fallback to older syntax for source", async () => {
    // SHOW REPLICA STATUS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("fail"));
    // SHOW SLAVE STATUS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("fail"));

    // SHOW BINARY LOG STATUS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("fail"));

    // SHOW MASTER STATUS
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([{ File: "bin.001" }]),
    );

    // GTID
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    // SHOW REPLICAS (fail)
    mockAdapter.executeQuery.mockRejectedValueOnce(new Error("fail"));

    // SHOW SLAVE HOSTS
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([{ Host: "slave1" }]),
    );

    const resource = createReplicationResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = (await resource.handler(
      "mysql://replication",
      mockContext,
    )) as any;

    expect(result.role).toBe("source");
    expect(result.connected_replicas).toHaveLength(1);
  });
});
