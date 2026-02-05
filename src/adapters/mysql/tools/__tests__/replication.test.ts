/**
 * mysql-mcp - Replication Tools Unit Tests
 *
 * Tests for replication and partitioning tool definitions and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getReplicationTools } from "../replication.js";
import { getPartitioningTools } from "../partitioning.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../__tests__/mocks/index.js";

describe("getReplicationTools", () => {
  let tools: ReturnType<typeof getReplicationTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getReplicationTools(
      createMockMySQLAdapter() as unknown as MySQLAdapter,
    );
  });

  it("should return 5 replication tools", () => {
    expect(tools).toHaveLength(5);
  });

  it("should have replication group for all tools", () => {
    for (const tool of tools) {
      expect(tool.group).toBe("replication");
    }
  });

  it("should have handler functions for all tools", () => {
    for (const tool of tools) {
      expect(typeof tool.handler).toBe("function");
    }
  });

  it("should have inputSchema for all tools", () => {
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it("should include expected tool names", () => {
    const names = tools.map((t) => t.name);
    expect(names).toContain("mysql_master_status");
    expect(names).toContain("mysql_slave_status");
    expect(names).toContain("mysql_binlog_events");
    expect(names).toContain("mysql_gtid_status");
    expect(names).toContain("mysql_replication_lag");
  });
});

describe("getPartitioningTools", () => {
  let tools: ReturnType<typeof getPartitioningTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getPartitioningTools(
      createMockMySQLAdapter() as unknown as MySQLAdapter,
    );
  });

  it("should return 4 partitioning tools", () => {
    expect(tools).toHaveLength(4);
  });

  it("should have partitioning group for all tools", () => {
    for (const tool of tools) {
      expect(tool.group).toBe("partitioning");
    }
  });

  it("should have handler functions for all tools", () => {
    for (const tool of tools) {
      expect(typeof tool.handler).toBe("function");
    }
  });

  it("should have inputSchema for all tools", () => {
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it("should include expected tool names", () => {
    const names = tools.map((t) => t.name);
    expect(names).toContain("mysql_partition_info");
    expect(names).toContain("mysql_add_partition");
    expect(names).toContain("mysql_drop_partition");
    expect(names).toContain("mysql_reorganize_partition");
  });
});

describe("Replication Handler Execution", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getReplicationTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getReplicationTools(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  describe("mysql_master_status", () => {
    it("should query master status", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ File: "mysql-bin.000001", Position: 12345 }]),
      );

      const tool = tools.find((t) => t.name === "mysql_master_status")!;
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("mysql_slave_status", () => {
    it("should query replica status", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { Replica_IO_Running: "Yes", Replica_SQL_Running: "Yes" },
        ]),
      );

      const tool = tools.find((t) => t.name === "mysql_slave_status")!;
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("mysql_binlog_events", () => {
    it("should query binlog events", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { Log_name: "mysql-bin.000001", Event_type: "Query" },
        ]),
      );

      const tool = tools.find((t) => t.name === "mysql_binlog_events")!;
      await tool.handler({ logName: "mysql-bin.000001" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("BINLOG EVENTS");
    });

    it("should limit events", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_binlog_events")!;
      await tool.handler(
        { logName: "mysql-bin.000001", limit: 10 },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("LIMIT 10");
    });
  });

  describe("mysql_gtid_status", () => {
    it("should query GTID status", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { Variable_name: "gtid_executed", Value: "uuid:1-100" },
        ]),
      );

      const tool = tools.find((t) => t.name === "mysql_gtid_status")!;
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("mysql_replication_lag", () => {
    it("should calculate replication lag", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ Seconds_Behind_Master: 5 }]),
      );

      const tool = tools.find((t) => t.name === "mysql_replication_lag")!;
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});

describe("Partitioning Handler Execution", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getPartitioningTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getPartitioningTools(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  describe("mysql_partition_info", () => {
    it("should query partition info", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { PARTITION_NAME: "p0", TABLE_ROWS: 1000, PARTITION_METHOD: "RANGE" },
        ]),
      );

      const tool = tools.find((t) => t.name === "mysql_partition_info")!;
      await tool.handler({ table: "logs" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("PARTITIONS");
    });

    it("should detect non-partitioned table", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ PARTITION_NAME: null, TABLE_ROWS: 1000 }]),
      );

      const tool = tools.find((t) => t.name === "mysql_partition_info")!;
      const result = (await tool.handler({ table: "users" }, mockContext)) as {
        partitioned: boolean;
      };

      expect(result.partitioned).toBe(false);
    });

    it("should detect partitioned table with method and expression", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            PARTITION_NAME: "p0",
            PARTITION_METHOD: "RANGE",
            PARTITION_EXPRESSION: "TO_DAYS(created_at)",
          },
        ]),
      );

      const tool = tools.find((t) => t.name === "mysql_partition_info")!;
      const result = (await tool.handler({ table: "logs" }, mockContext)) as {
        partitioned: boolean;
        method: string;
      };

      expect(result.partitioned).toBe(true);
      expect(result.method).toBe("RANGE");
    });
  });

  describe("mysql_add_partition", () => {
    it("should add a RANGE partition", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_add_partition")!;
      const result = await tool.handler(
        {
          table: "logs",
          partitionName: "p2024",
          partitionType: "RANGE",
          value: "2024",
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("ADD PARTITION");
      expect(call).toContain("VALUES LESS THAN");
      expect(result).toHaveProperty("success", true);
    });

    it("should add a LIST partition", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_add_partition")!;
      await tool.handler(
        {
          table: "regions",
          partitionName: "p_east",
          partitionType: "LIST",
          value: "'NY', 'NJ', 'PA'",
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("VALUES IN");
    });

    it("should add HASH partitions", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_add_partition")!;
      await tool.handler(
        {
          table: "data",
          partitionName: "hash_p",
          partitionType: "HASH",
          value: "4",
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("PARTITIONS 4");
    });

    it("should add KEY partitions", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_add_partition")!;
      await tool.handler(
        {
          table: "data",
          partitionName: "key_p",
          partitionType: "KEY",
          value: "8",
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("PARTITIONS 8");
    });
  });

  describe("mysql_drop_partition", () => {
    it("should drop a partition", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_drop_partition")!;
      const result = await tool.handler(
        {
          table: "logs",
          partitionName: "p2020",
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("DROP PARTITION");
      expect(result).toHaveProperty("success", true);
    });
  });

  describe("mysql_reorganize_partition", () => {
    it("should reorganize partitions", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_reorganize_partition")!;
      const result = await tool.handler(
        {
          table: "logs",
          fromPartitions: ["p2023"],
          partitionType: "RANGE",
          toPartitions: [
            { name: "p2023_h1", value: "202307" },
            { name: "p2023_h2", value: "202401" },
          ],
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("REORGANIZE PARTITION");
      expect(result).toHaveProperty("success", true);
    });
  });
});

describe("Replication Fallback Handling", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getReplicationTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getReplicationTools(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  describe("mysql_master_status fallback", () => {
    it("should fallback to SHOW MASTER STATUS on error", async () => {
      // First call fails (new syntax), second succeeds (old syntax)
      mockAdapter.executeQuery
        .mockRejectedValueOnce(new Error("Unknown command"))
        .mockResolvedValueOnce(
          createMockQueryResult([{ File: "mysql-bin.000001" }]),
        );

      const tool = tools.find((t) => t.name === "mysql_master_status")!;
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty("status");
    });

    it("should return error when binary logging is disabled", async () => {
      mockAdapter.executeQuery
        .mockRejectedValueOnce(new Error("Unknown command"))
        .mockRejectedValueOnce(new Error("Binary logging not enabled"));

      const tool = tools.find((t) => t.name === "mysql_master_status")!;
      const result = (await tool.handler({}, mockContext)) as { error: string };

      expect(result.error).toContain("Binary logging");
    });
  });

  describe("mysql_slave_status fallback", () => {
    it("should fallback to SHOW SLAVE STATUS on error", async () => {
      mockAdapter.executeQuery
        .mockRejectedValueOnce(new Error("Unknown command"))
        .mockResolvedValueOnce(
          createMockQueryResult([{ Slave_IO_Running: "Yes" }]),
        );

      const tool = tools.find((t) => t.name === "mysql_slave_status")!;
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      expect(result).toHaveProperty("status");
    });

    it("should return message when not configured as replica", async () => {
      mockAdapter.executeQuery
        .mockRejectedValueOnce(new Error("Unknown command"))
        .mockRejectedValueOnce(new Error("Not configured"));

      const tool = tools.find((t) => t.name === "mysql_slave_status")!;
      const result = (await tool.handler({}, mockContext)) as {
        message: string;
      };

      expect(result.message).toContain("not configured");
    });
  });

  describe("mysql_binlog_events options", () => {
    it("should include log file when specified", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_binlog_events")!;
      await tool.handler({ logFile: "mysql-bin.000005" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("IN 'mysql-bin.000005'");
    });

    it("should include position when specified", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_binlog_events")!;
      await tool.handler({ position: 12345 }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("FROM 12345");
    });
  });

  describe("mysql_replication_lag fallback", () => {
    it("should return lag from replica status", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            Seconds_Behind_Source: 5,
            Replica_IO_Running: "Yes",
            Replica_SQL_Running: "Yes",
            Last_Error: "",
          },
        ]),
      );

      const tool = tools.find((t) => t.name === "mysql_replication_lag")!;
      const result = (await tool.handler({}, mockContext)) as {
        lagSeconds: number;
      };

      expect(result.lagSeconds).toBe(5);
    });

    it("should fallback to SHOW SLAVE STATUS on error", async () => {
      mockAdapter.executeQuery
        .mockRejectedValueOnce(new Error("Unknown command"))
        .mockResolvedValueOnce(
          createMockQueryResult([
            {
              Seconds_Behind_Master: 10,
              Slave_IO_Running: "Yes",
              Slave_SQL_Running: "Yes",
              Last_Error: "",
            },
          ]),
        );

      const tool = tools.find((t) => t.name === "mysql_replication_lag")!;
      const result = (await tool.handler({}, mockContext)) as {
        lagSeconds: number;
      };

      expect(result.lagSeconds).toBe(10);
    });

    it("should return message when not a replica after both fail", async () => {
      mockAdapter.executeQuery
        .mockRejectedValueOnce(new Error("Unknown command"))
        .mockRejectedValueOnce(new Error("Not configured"));

      const tool = tools.find((t) => t.name === "mysql_replication_lag")!;
      const result = (await tool.handler({}, mockContext)) as {
        lagSeconds: null;
        message: string;
      };

      expect(result.lagSeconds).toBeNull();
      expect(result.message).toContain("not configured");
    });

    it("should return null lag when replica status returns empty", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_replication_lag")!;
      const result = (await tool.handler({}, mockContext)) as {
        lagSeconds: null;
      };

      expect(result.lagSeconds).toBeNull();
    });
  });
});
