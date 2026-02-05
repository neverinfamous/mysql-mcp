import { describe, it, expect } from "vitest";
import { createSysIOSummaryTool } from "../performance.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Sys Schema I/O Summary Compatibility Fix", () => {
  it("should use event_name instead of wait_class for global IO summary", async () => {
    const mockAdapter = createMockMySQLAdapter();
    const mockContext = createMockRequestContext();

    mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

    const tool = createSysIOSummaryTool(mockAdapter as unknown as MySQLAdapter);
    await tool.handler({ type: "global", limit: 1 }, mockContext);

    const executedQuery = mockAdapter.executeQuery.mock.calls[0][0] as string;

    // STRICTLY verify the column presence
    expect(executedQuery).toContain("event_name");
    expect(executedQuery).not.toContain("wait_class");
    expect(executedQuery).toContain("FROM sys.io_global_by_wait_by_latency");
  });
});
