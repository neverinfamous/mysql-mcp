/**
 * mysql-mcp - Events Tools Unit Tests
 *
 * Tests for events tool definitions, annotations, and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEventTools } from "../events.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../__tests__/mocks/index.js";

describe("getEventTools", () => {
  let tools: ReturnType<typeof getEventTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getEventTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
  });

  it("should return 6 event tools", () => {
    expect(tools).toHaveLength(6);
  });

  it("should have events group for all tools", () => {
    for (const tool of tools) {
      expect(tool.group).toBe("events");
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
    expect(names).toContain("mysql_event_create");
    expect(names).toContain("mysql_event_alter");
    expect(names).toContain("mysql_event_drop");
    expect(names).toContain("mysql_event_list");
    expect(names).toContain("mysql_event_status");
    expect(names).toContain("mysql_scheduler_status");
  });
});

describe("Handler Execution", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getEventTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getEventTools(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  describe("mysql_event_create", () => {
    it("should create a one-time event", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_create")!;
      const result = await tool.handler(
        {
          name: "cleanup_once",
          schedule: {
            type: "ONE TIME",
            executeAt: "2024-12-31 23:59:59",
          },
          body: "DELETE FROM temp_data",
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("CREATE EVENT");
      expect(call).toContain("ON SCHEDULE AT");
      expect(result).toHaveProperty("success", true);
    });

    it("should create a recurring event", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_create")!;
      await tool.handler(
        {
          name: "daily_cleanup",
          schedule: {
            type: "RECURRING",
            interval: 1,
            intervalUnit: "DAY",
          },
          body: "DELETE FROM logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)",
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("EVERY 1 DAY");
    });
  });

  describe("mysql_event_alter", () => {
    it("should alter an existing event", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_alter")!;
      const result = await tool.handler(
        {
          name: "cleanup_job",
          enabled: false,
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("ALTER EVENT");
      expect(result).toHaveProperty("success", true);
    });

    it("should rename an event", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_alter")!;
      await tool.handler(
        {
          name: "old_event",
          newName: "new_event",
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("RENAME TO");
    });
  });

  describe("mysql_event_drop", () => {
    it("should drop an event", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_drop")!;
      const result = await tool.handler(
        {
          name: "old_event",
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("DROP EVENT");
      expect(result).toHaveProperty("success", true);
    });

    it("should use IF EXISTS clause", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_drop")!;
      await tool.handler(
        {
          name: "maybe_exists",
          ifExists: true,
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("IF EXISTS");
    });
  });

  describe("mysql_event_list", () => {
    it("should list scheduled events", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { name: "cleanup_job", eventType: "RECURRING", status: "ENABLED" },
        ]),
      );

      const tool = tools.find((t) => t.name === "mysql_event_list")!;
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toHaveProperty("events");
    });

    it("should accept schema filter via params", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_list")!;
      // Uses parameterized query
      await tool.handler({ schema: "mydb" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["mydb"]),
      );
    });

    it("should exclude disabled events when includeDisabled is false", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_list")!;
      await tool.handler({ includeDisabled: false }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("ENABLED");
    });
  });

  describe("mysql_event_status", () => {
    it("should get detailed event status", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { name: "test_event", lastExecuted: "2024-01-01" },
        ]),
      );

      const tool = tools.find((t) => t.name === "mysql_event_status")!;
      const result = await tool.handler({ name: "test_event" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      // Returns the query result row directly
      expect(result).toBeDefined();
    });

    it("should return exists false when event is not found", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_status")!;
      const result = await tool.handler(
        { name: "nonexistent_event" },
        mockContext,
      );

      expect(result).toEqual({ exists: false, name: "nonexistent_event" });
    });
  });

  describe("mysql_scheduler_status", () => {
    it("should get scheduler status", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { Variable_name: "event_scheduler", Value: "ON" },
        ]),
      );

      const tool = tools.find((t) => t.name === "mysql_scheduler_status")!;
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      // Returns schedulerEnabled, processlist, etc
      expect(result).toHaveProperty("schedulerEnabled");
    });
  });
});

describe("Event Create Advanced", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getEventTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getEventTools(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  it("should add IF NOT EXISTS clause when specified", async () => {
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_create")!;
    await tool.handler(
      {
        name: "my_event",
        schedule: { type: "ONE TIME", executeAt: "2024-12-31 23:59:59" },
        body: "DELETE FROM temp",
        ifNotExists: true,
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
    expect(call).toContain("IF NOT EXISTS");
  });

  it("should include STARTS and ENDS for recurring events", async () => {
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_create")!;
    await tool.handler(
      {
        name: "recurring_event",
        schedule: {
          type: "RECURRING",
          interval: 1,
          intervalUnit: "HOUR",
          starts: "2024-01-01 00:00:00",
          ends: "2024-12-31 23:59:59",
        },
        body: "CALL cleanup_proc()",
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
    expect(call).toContain("STARTS");
    expect(call).toContain("ENDS");
  });

  it("should include comment when provided", async () => {
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_create")!;
    await tool.handler(
      {
        name: "commented_event",
        schedule: { type: "ONE TIME", executeAt: "2024-12-31 23:59:59" },
        body: "SELECT 1",
        comment: "This is a test event",
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
    expect(call).toContain("COMMENT");
    expect(call).toContain("This is a test event");
  });

  it("should add DISABLE clause when enabled is false", async () => {
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_create")!;
    await tool.handler(
      {
        name: "disabled_event",
        schedule: { type: "ONE TIME", executeAt: "2024-12-31 23:59:59" },
        body: "SELECT 1",
        enabled: false,
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
    expect(call).toContain("DISABLE");
  });

  it("should throw error for invalid event name", async () => {
    const tool = tools.find((t) => t.name === "mysql_event_create")!;

    await expect(
      tool.handler(
        {
          name: "123-invalid",
          schedule: { type: "ONE TIME", executeAt: "2024-12-31 23:59:59" },
          body: "SELECT 1",
        },
        mockContext,
      ),
    ).rejects.toThrow("Invalid event name");
  });

  it("should throw error when executeAt is missing for ONE TIME events", async () => {
    const tool = tools.find((t) => t.name === "mysql_event_create")!;

    await expect(
      tool.handler(
        {
          name: "bad_event",
          schedule: { type: "ONE TIME" },
          body: "SELECT 1",
        },
        mockContext,
      ),
    ).rejects.toThrow("executeAt is required");
  });

  it("should throw error when interval is missing for RECURRING events", async () => {
    const tool = tools.find((t) => t.name === "mysql_event_create")!;

    await expect(
      tool.handler(
        {
          name: "bad_recurring",
          schedule: { type: "RECURRING" },
          body: "SELECT 1",
        },
        mockContext,
      ),
    ).rejects.toThrow("interval and intervalUnit are required");
  });
});

describe("Event Alter Advanced", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getEventTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getEventTools(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  it("should alter schedule to ONE TIME", async () => {
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_alter")!;
    await tool.handler(
      {
        name: "my_event",
        schedule: { type: "ONE TIME", executeAt: "2024-12-31 23:59:59" },
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
    expect(call).toContain("ON SCHEDULE AT");
  });

  it("should alter schedule to RECURRING with starts/ends", async () => {
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_alter")!;
    await tool.handler(
      {
        name: "my_event",
        schedule: {
          type: "RECURRING",
          interval: 2,
          intervalUnit: "HOUR",
          starts: "2024-01-01 00:00:00",
          ends: "2024-12-31 23:59:59",
        },
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
    expect(call).toContain("EVERY 2 HOUR");
    expect(call).toContain("STARTS");
    expect(call).toContain("ENDS");
  });

  it("should alter event body", async () => {
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_alter")!;
    await tool.handler(
      {
        name: "my_event",
        body: "CALL new_procedure()",
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
    expect(call).toContain("DO CALL new_procedure()");
  });

  it("should alter on completion behavior", async () => {
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_alter")!;
    await tool.handler(
      {
        name: "my_event",
        onCompletion: "PRESERVE",
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
    expect(call).toContain("ON COMPLETION PRESERVE");
  });

  it("should alter event comment", async () => {
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_alter")!;
    await tool.handler(
      {
        name: "my_event",
        comment: "Updated comment",
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
    expect(call).toContain("COMMENT 'Updated comment'");
  });

  it("should throw error for invalid event name", async () => {
    const tool = tools.find((t) => t.name === "mysql_event_alter")!;

    await expect(
      tool.handler(
        {
          name: "invalid-name",
          enabled: true,
        },
        mockContext,
      ),
    ).rejects.toThrow("Invalid event name");
  });

  it("should throw error for invalid new event name", async () => {
    const tool = tools.find((t) => t.name === "mysql_event_alter")!;

    await expect(
      tool.handler(
        {
          name: "valid_name",
          newName: "123-invalid",
        },
        mockContext,
      ),
    ).rejects.toThrow("Invalid new event name");
  });

  it("should throw error when no modifications specified", async () => {
    const tool = tools.find((t) => t.name === "mysql_event_alter")!;

    await expect(
      tool.handler(
        {
          name: "my_event",
        },
        mockContext,
      ),
    ).rejects.toThrow("No modifications specified");
  });

  it("should throw error when executeAt missing for ONE TIME alter", async () => {
    const tool = tools.find((t) => t.name === "mysql_event_alter")!;

    await expect(
      tool.handler(
        {
          name: "my_event",
          schedule: { type: "ONE TIME" },
        },
        mockContext,
      ),
    ).rejects.toThrow("executeAt is required");
  });

  it("should throw error when interval missing for RECURRING alter", async () => {
    const tool = tools.find((t) => t.name === "mysql_event_alter")!;

    await expect(
      tool.handler(
        {
          name: "my_event",
          schedule: { type: "RECURRING" },
        },
        mockContext,
      ),
    ).rejects.toThrow("interval and intervalUnit are required");
  });
});

describe("Event Drop Advanced", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getEventTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getEventTools(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  it("should throw error for invalid event name", async () => {
    const tool = tools.find((t) => t.name === "mysql_event_drop")!;

    await expect(
      tool.handler(
        {
          name: "invalid-event-name",
        },
        mockContext,
      ),
    ).rejects.toThrow("Invalid event name");
  });

  it("should drop without IF EXISTS when ifExists is false", async () => {
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_drop")!;
    await tool.handler(
      {
        name: "my_event",
        ifExists: false,
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
    expect(call).not.toContain("IF EXISTS");
  });
});

describe("Event Graceful Error Handling", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getEventTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getEventTools(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  it("should return success false when creating duplicate event", async () => {
    const mysqlError = new Error(
      "Query failed: Execute failed: Event 'my_event' already exists",
    );
    mockAdapter.executeQuery.mockRejectedValue(mysqlError);

    const tool = tools.find((t) => t.name === "mysql_event_create")!;
    const result = await tool.handler(
      {
        name: "my_event",
        schedule: { type: "ONE TIME", executeAt: "2024-12-31 23:59:59" },
        body: "SELECT 1",
      },
      mockContext,
    );

    expect(result).toEqual({
      success: false,
      reason: "Event 'my_event' already exists",
    });
  });

  it("should return success false when altering nonexistent event", async () => {
    const mysqlError = new Error(
      "Query failed: Execute failed: Unknown event 'ghost_event'",
    );
    mockAdapter.executeQuery.mockRejectedValue(mysqlError);

    const tool = tools.find((t) => t.name === "mysql_event_alter")!;
    const result = await tool.handler(
      {
        name: "ghost_event",
        enabled: true,
      },
      mockContext,
    );

    expect(result).toEqual({
      success: false,
      reason: "Event 'ghost_event' does not exist",
    });
  });

  it("should return success false when dropping nonexistent event without ifExists", async () => {
    const mysqlError = new Error(
      "Query failed: Execute failed: Unknown event 'ghost_event'",
    );
    mockAdapter.executeQuery.mockRejectedValue(mysqlError);

    const tool = tools.find((t) => t.name === "mysql_event_drop")!;
    const result = await tool.handler(
      {
        name: "ghost_event",
        ifExists: false,
      },
      mockContext,
    );

    expect(result).toEqual({
      success: false,
      reason: "Event 'ghost_event' does not exist",
    });
  });

  it("should rethrow unexpected errors from create", async () => {
    mockAdapter.executeQuery.mockRejectedValue(new Error("Connection lost"));

    const tool = tools.find((t) => t.name === "mysql_event_create")!;
    await expect(
      tool.handler(
        {
          name: "my_event",
          schedule: { type: "ONE TIME", executeAt: "2024-12-31 23:59:59" },
          body: "SELECT 1",
        },
        mockContext,
      ),
    ).rejects.toThrow("Connection lost");
  });
});
