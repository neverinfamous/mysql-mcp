import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEventsResource } from "../events.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../__tests__/mocks/index.js";

describe("createEventsResource", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;
  let resource: ReturnType<typeof createEventsResource>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
    resource = createEventsResource(mockAdapter as unknown as MySQLAdapter);
  });

  it("should return scheduler enabled when variable is ON", async () => {
    // Mock scheduler variable
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        { Variable_name: "event_scheduler", Value: "ON" },
      ]),
    );

    // Mock events list
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        { schema_name: "test", name: "event1", status: "ENABLED" },
      ]),
    );

    const result = await resource.handler(resource.uri, mockContext);

    expect(result).toEqual({
      schedulerEnabled: true,
      schedulerStatus: "ON",
      eventCount: 1,
      events: [{ schema_name: "test", name: "event1", status: "ENABLED" }],
    });
  });

  it("should return scheduler disabled when variable is OFF", async () => {
    // Mock scheduler variable
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        { Variable_name: "event_scheduler", Value: "OFF" },
      ]),
    );

    // Mock events list
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    const result = await resource.handler(resource.uri, mockContext);

    expect(result).toEqual({
      schedulerEnabled: false,
      schedulerStatus: "OFF",
      eventCount: 0,
      events: [],
    });
  });

  it("should handle missing variable execution gracefully (default OFF)", async () => {
    // Mock scheduler variable empty result
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    // Mock events list
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    const result = await resource.handler(resource.uri, mockContext);

    expect(result).toEqual({
      schedulerEnabled: false,
      schedulerStatus: "OFF",
      eventCount: 0,
      events: [],
    });
  });

  it("should propagate errors since no try/catch in handler", async () => {
    mockAdapter.executeQuery.mockRejectedValue(new Error("DB Error"));

    await expect(resource.handler(resource.uri, mockContext)).rejects.toThrow(
      "DB Error",
    );
  });
  it("should handle undefined rows gracefully", async () => {
    // Mock scheduler variable with undefined rows
    mockAdapter.executeQuery.mockResolvedValueOnce({ rows: undefined } as any);

    // Mock events list with undefined rows
    mockAdapter.executeQuery.mockResolvedValueOnce({ rows: undefined } as any);

    const result = await resource.handler(resource.uri, mockContext);

    expect(result).toEqual({
      schedulerEnabled: false,
      schedulerStatus: "OFF",
      eventCount: 0,
      events: [],
    });
  });
});
