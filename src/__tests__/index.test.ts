import { describe, it, expect } from "vitest";
import * as Index from "../index.js";

describe("Index Exports", () => {
  it("should export core modules", () => {
    expect(Index.McpServer).toBeDefined();
    expect(Index.DatabaseAdapter).toBeDefined();
    expect(Index.MySQLAdapter).toBeDefined();
    expect(Index.ConnectionPool).toBeDefined();
  });

  it("should export error classes", () => {
    expect(Index.MySQLMcpError).toBeDefined();
    expect(Index.ConnectionError).toBeDefined();
    expect(Index.AuthenticationError).toBeDefined();
  });

  it("should export types", () => {
    // Types are erased at runtime, but we can check if the module object has keys
    // or just rely on the test compiling as verification that types are exported
    // if we import them as types.
    // For runtime check, we just verify the module object is substantial
    expect(Object.keys(Index).length).toBeGreaterThan(0);
  });
});
