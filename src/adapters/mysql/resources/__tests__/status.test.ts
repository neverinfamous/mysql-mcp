import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStatusResource } from "../status.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../__tests__/mocks/index.js";

describe("Status Resource", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  it("should map query results to status object", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult([
        { Variable_name: "Uptime", Value: "1000" },
        { Variable_name: "Threads_connected", Value: "5" },
      ]),
    );

    const resource = createStatusResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = await resource.handler("mysql://status", mockContext);

    expect(result).toEqual({
      status: {
        Uptime: "1000",
        Threads_connected: "5",
      },
    });
    expect(mockAdapter.executeQuery).toHaveBeenCalledWith("SHOW GLOBAL STATUS");
  });

  it("should handle empty results", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

    const resource = createStatusResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = await resource.handler("mysql://status", mockContext);

    expect(result).toEqual({ status: {} });
  });

  it("should handle null query results", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce(
      createMockQueryResult(null as any),
    );

    const resource = createStatusResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    const result = await resource.handler("mysql://status", mockContext);

    expect(result).toEqual({ status: {} });
  });

  it("should propagate errors", async () => {
    mockAdapter.executeQuery.mockRejectedValue(new Error("Connection failed"));
    const resource = createStatusResource(
      mockAdapter as unknown as MySQLAdapter,
    );
    await expect(
      resource.handler("mysql://status", mockContext),
    ).rejects.toThrow("Connection failed");
  });
});
