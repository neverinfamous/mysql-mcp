/**
 * mysql-mcp - Events Tools Unit Tests
 *
 * Tests for events tool definitions, annotations, and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getEventTools } from "../events.js";
import type {} from "../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../__tests__/mocks/index.js";

describe("getEventTools", () => {
  let tools: ReturnType<typeof getEventTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getEventTools(createMockMySQLAdapter());
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
    tools = getEventTools(mockAdapter);
    mockContext = createMockRequestContext();
  });

  describe("mysql_event_create", () => {
    it("should create a one-time event", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_create")!;
      const result = await tool.handler(
        {
          name: "cleanup_once",
          schedule: "AT '2024-12-31 23:59:59'",
          body: "DELETE FROM temp_data",
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0];
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
          schedule: "EVERY 1 DAY",
          body: "DELETE FROM logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)",
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0];
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
          status: "DISABLE",
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0];
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

      const call = mockAdapter.executeQuery.mock.calls[0][0];
      expect(call).toContain("RENAME TO");
    });

    it("should place RENAME TO before COMMENT and DO body in combined alter", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_alter")!;
      await tool.handler(
        {
          name: "old_event",
          newName: "new_event",
          body: "SELECT 1",
          comment: "updated",
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0];
      const renameIndex = call.indexOf("RENAME TO");
      const commentIndex = call.indexOf("COMMENT");
      const doIndex = call.indexOf("DO ");
      expect(renameIndex).toBeGreaterThan(-1);
      expect(commentIndex).toBeGreaterThan(-1);
      expect(doIndex).toBeGreaterThan(-1);
      expect(renameIndex).toBeLessThan(commentIndex);
      expect(commentIndex).toBeLessThan(doIndex);
    });
  });

  describe("mysql_event_drop", () => {
    it("should drop an event", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_drop")!;
      const result = await tool.handler(
        {
          name: "old_event",
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
      const dropCall = mockAdapter.executeQuery.mock.calls[0][0];
      expect(dropCall).toContain("DROP EVENT");
      expect(result).toHaveProperty("success", true);
    });

    it("should use IF EXISTS clause", async () => {
      // First call: pre-check returns event exists
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ EVENT_NAME: "maybe_exists" }]),
      );
      // Second call: actual DROP
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_drop")!;
      await tool.handler(
        {
          name: "maybe_exists",
          ifExists: true,
        },
        mockContext,
      );

      const dropCall = mockAdapter.executeQuery.mock.calls[1][0];
      expect(dropCall).toContain("IF EXISTS");
    });

    it("should return structured error when ifExists is true and event does not exist", async () => {
      // Pre-check returns empty (event doesn't exist)
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_drop")!;
      const result = await tool.handler(
        {
          name: "ghost_event",
          ifExists: true,
        },
        mockContext,
      );

      expect(result).toMatchObject({
        success: true,
        data: { skipped: true, reason: "Event did not exist" },
      });
      // Should only have the pre-check query, no DROP
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
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
      expect(result).toHaveProperty("data.events");
    });

    it("should accept schema filter via params", async () => {
      // First call: schema existence check
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ SCHEMA_NAME: "mydb" }]),
      );
      // Second call: actual event list query
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_list")!;
      // Uses parameterized query
      await tool.handler({ schema: "mydb" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      // Second call should contain the schema param
      expect(mockAdapter.executeQuery).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.arrayContaining(["mydb"]),
      );
    });

    it("should return exists false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_list")!;
      const result = await tool.handler(
        { schema: "nonexistent_db" },
        mockContext,
      );

      expect(result).toMatchObject({
        success: false,
        error: "Schema does not exist",
        metrics: expect.any(Object),
      });
      // Should only have the schema check query, no event list query
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
    });

    it("should exclude disabled events when includeDisabled is false", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_list")!;
      await tool.handler({ includeDisabled: false }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0];
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
      expect(result).toHaveProperty("data.event");
    });

    it("should return exists false when event is not found", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_status")!;
      const result = await tool.handler(
        { name: "nonexistent_event" },
        mockContext,
      );

      expect(result).toMatchObject({
        success: true,
        data: { exists: false, name: "nonexistent_event" },
      });
    });

    it("should return exists false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_event_status")!;
      const result = await tool.handler(
        { name: "any_event", schema: "nonexistent_db" },
        mockContext,
      );

      expect(result).toMatchObject({
        success: false,
        error: "Schema does not exist",
        metrics: expect.any(Object),
      });
      // Should only have the schema check query, no event status query
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
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
      expect(result).toHaveProperty("data.schedulerEnabled");
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
    tools = getEventTools(mockAdapter);
    mockContext = createMockRequestContext();
  });

  it("should add IF NOT EXISTS clause when specified", async () => {
    // Pre-check returns empty (event doesn't exist), then CREATE succeeds
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_create")!;
    await tool.handler(
      {
        name: "my_event",
        schedule: "AT '" + "2024-12-31 23:59:59".replace(/"/g, "") + "'",
        body: "DELETE FROM temp",
        ifNotExists: true,
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[1][0];
    expect(call).toContain("IF NOT EXISTS");
  });

  it("should return structured error when ifNotExists is true and event already exists", async () => {
    // Pre-check returns existing event
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([{ EVENT_NAME: "my_event" }]),
    );

    const tool = tools.find((t) => t.name === "mysql_event_create")!;
    const result = await tool.handler(
      {
        name: "my_event",
        schedule: "AT '" + "2024-12-31 23:59:59".replace(/"/g, "") + "'",
        body: "DELETE FROM temp",
        ifNotExists: true,
      },
      mockContext,
    );

    expect(result).toMatchObject({
        success: true,
        data: { skipped: true, reason: "Event already exists" },
      });
    // Should only have the pre-check query, no CREATE
    expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
  });

  it("should include STARTS and ENDS for recurring events", async () => {
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_create")!;
    await tool.handler(
      {
        name: "recurring_event",
        schedule:
          "EVERY 1 HOUR STARTS '2024-01-01 00:00:00' ENDS '2024-12-31 23:59:59'",
        body: "CALL cleanup_proc()",
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[0][0];
    expect(call).toContain("STARTS");
    expect(call).toContain("ENDS");
  });

  it("should include comment when provided", async () => {
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_create")!;
    await tool.handler(
      {
        name: "commented_event",
        schedule: "AT '" + "2024-12-31 23:59:59".replace(/"/g, "") + "'",
        body: "SELECT 1",
        comment: "This is a test event",
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[0][0];
    expect(call).toContain("COMMENT");
    expect(call).toContain("This is a test event");
  });

  it("should add DISABLE clause when enabled is false", async () => {
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_create")!;
    await tool.handler(
      {
        name: "disabled_event",
        schedule: "AT '" + "2024-12-31 23:59:59".replace(/"/g, "") + "'",
        body: "SELECT 1",
        status: "DISABLE",
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[0][0];
    expect(call).toContain("DISABLE");
  });

  it("should return structured error for invalid event name", async () => {
    const tool = tools.find((t) => t.name === "mysql_event_create")!;

    const result = await tool.handler(
      {
        name: "123-invalid",
        schedule: "AT '" + "2024-12-31 23:59:59".replace(/"/g, "") + "'",
        body: "SELECT 1",
      },
      mockContext,
    );

    expect(result).toMatchObject({
      success: false,
      error: "Invalid event name",
    });
  });
});

describe("Event Alter Advanced", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getEventTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getEventTools(mockAdapter);
    mockContext = createMockRequestContext();
  });

  it("should alter schedule to ONE TIME", async () => {
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_alter")!;
    await tool.handler(
      {
        name: "my_event",
        schedule: "AT '" + "2024-12-31 23:59:59".replace(/"/g, "") + "'",
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[0][0];
    expect(call).toContain("ON SCHEDULE AT");
  });

  it("should alter schedule to RECURRING with starts/ends", async () => {
    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = tools.find((t) => t.name === "mysql_event_alter")!;
    await tool.handler(
      {
        name: "my_event",
        schedule:
          "EVERY 2 HOUR STARTS '2024-01-01 00:00:00' ENDS '2024-12-31 23:59:59'",
      },
      mockContext,
    );

    const call = mockAdapter.executeQuery.mock.calls[0][0];
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

    const call = mockAdapter.executeQuery.mock.calls[0][0];
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

    const call = mockAdapter.executeQuery.mock.calls[0][0];
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

    const call = mockAdapter.executeQuery.mock.calls[0][0];
    expect(call).toContain("COMMENT 'Updated comment'");
  });

  it("should return structured error for invalid event name", async () => {
    const tool = tools.find((t) => t.name === "mysql_event_alter")!;

    const result = await tool.handler(
      {
        name: "invalid-name",
        status: "ENABLE",
      },
      mockContext,
    );

    expect(result).toMatchObject({
      success: false,
      error: "Invalid event name",
    });
  });

  it("should return structured error for invalid new event name", async () => {
    const tool = tools.find((t) => t.name === "mysql_event_alter")!;

    const result = await tool.handler(
      {
        name: "valid_name",
        newName: "123-invalid",
      },
      mockContext,
    );

    expect(result).toMatchObject({
      success: false,
      error: "Invalid new event name",
    });
  });

  it("should return structured error when no modifications specified", async () => {
    const tool = tools.find((t) => t.name === "mysql_event_alter")!;

    const result = await tool.handler(
      {
        name: "my_event",
      },
      mockContext,
    );

    expect(result).toMatchObject({
      success: false,
      error: "No modifications specified",
    });
  });
});

describe("Event Drop Advanced", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getEventTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getEventTools(mockAdapter);
    mockContext = createMockRequestContext();
  });

  it("should return structured error for invalid event name", async () => {
    const tool = tools.find((t) => t.name === "mysql_event_drop")!;

    const result = await tool.handler(
      {
        name: "invalid-event-name",
      },
      mockContext,
    );

    expect(result).toMatchObject({
      success: false,
      error: "Invalid event name",
    });
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

    const call = mockAdapter.executeQuery.mock.calls[0][0];
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
    tools = getEventTools(mockAdapter);
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
        schedule: "AT '" + "2024-12-31 23:59:59".replace(/"/g, "") + "'",
        body: "SELECT 1",
      },
      mockContext,
    );

    expect(result).toMatchObject({
      success: false,
      error: "Event already exists",
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
        status: "ENABLE",
      },
      mockContext,
    );

    expect(result).toMatchObject({
      success: false,
      error: "Event does not exist",
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

    expect(result).toMatchObject({
      success: false,
      error: "Event does not exist",
    });
  });

  it("should return structured error for unexpected errors from create", async () => {
    mockAdapter.executeQuery.mockRejectedValue(new Error("Connection lost"));

    const tool = tools.find((t) => t.name === "mysql_event_create")!;
    const result = await tool.handler(
      {
        name: "my_event",
        schedule: "AT '" + "2024-12-31 23:59:59".replace(/"/g, "") + "'",
        body: "SELECT 1",
      },
      mockContext,
    );

    expect(result).toMatchObject({ success: false, error: "Connection lost" });
  });

  it("should strip error prefix from create error messages", async () => {
    mockAdapter.executeQuery.mockRejectedValue(
      new Error(
        "Query failed: Execute failed: You have an error in your SQL syntax",
      ),
    );

    const tool = tools.find((t) => t.name === "mysql_event_create")!;
    const result = await tool.handler(
      {
        name: "my_event",
        schedule: "AT '" + "2024-12-31 23:59:59".replace(/"/g, "") + "'",
        body: "SELECTT * FROMM",
      },
      mockContext,
    );

    expect(result).toMatchObject({
      success: false,
      error: "You have an error in your SQL syntax",
    });
  });

  it("should return structured error when event_list query fails", async () => {
    mockAdapter.executeQuery.mockRejectedValue(
      new Error("Connection lost during query"),
    );

    const tool = tools.find((t) => t.name === "mysql_event_list")!;
    const result = await tool.handler({}, mockContext);

    expect(result).toMatchObject({
      success: false,
      error: "Connection lost during query",
    });
  });

  it("should return structured error when event_status query fails", async () => {
    mockAdapter.executeQuery.mockRejectedValue(
      new Error("Connection lost during query"),
    );

    const tool = tools.find((t) => t.name === "mysql_event_status")!;
    const result = await tool.handler({ name: "test_event" }, mockContext);

    expect(result).toMatchObject({
      success: false,
      error: "Connection lost during query",
    });
  });

  it("should return structured error when scheduler_status query fails", async () => {
    mockAdapter.executeQuery.mockRejectedValue(
      new Error("Connection lost during query"),
    );

    const tool = tools.find((t) => t.name === "mysql_scheduler_status")!;
    const result = await tool.handler({}, mockContext);

    expect(result).toMatchObject({
      success: false,
      error: "Connection lost during query",
    });
  });
});
