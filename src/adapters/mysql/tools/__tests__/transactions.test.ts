/**
 * mysql-mcp - Transaction Tools Unit Tests
 *
 * Tests for transaction tool definitions, annotations, and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTransactionTools } from "../transactions.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapterWithTransaction,
  createMockRequestContext,
} from "../../../../__tests__/mocks/index.js";

describe("getTransactionTools", () => {
  let tools: ReturnType<typeof getTransactionTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    const adapter = createMockMySQLAdapterWithTransaction();
    tools = getTransactionTools(adapter as unknown as MySQLAdapter);
  });

  it("should return 7 transaction tools", () => {
    expect(tools).toHaveLength(7);
  });

  it("should include all expected tool names", () => {
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("mysql_transaction_begin");
    expect(toolNames).toContain("mysql_transaction_commit");
    expect(toolNames).toContain("mysql_transaction_rollback");
    expect(toolNames).toContain("mysql_transaction_savepoint");
    expect(toolNames).toContain("mysql_transaction_release");
    expect(toolNames).toContain("mysql_transaction_rollback_to");
    expect(toolNames).toContain("mysql_transaction_execute");
  });

  it("should have transactions group for all tools", () => {
    for (const tool of tools) {
      expect(tool.group).toBe("transactions");
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
});

describe("Transaction Tool Annotations", () => {
  let tools: ReturnType<typeof getTransactionTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    const adapter = createMockMySQLAdapterWithTransaction();
    tools = getTransactionTools(adapter as unknown as MySQLAdapter);
  });

  it("mysql_transaction_begin should not be read-only", () => {
    const tool = tools.find((t) => t.name === "mysql_transaction_begin")!;
    expect(tool.annotations?.readOnlyHint).toBe(false);
  });

  it("mysql_transaction_commit should not be read-only", () => {
    const tool = tools.find((t) => t.name === "mysql_transaction_commit")!;
    expect(tool.annotations?.readOnlyHint).toBe(false);
  });

  it("mysql_transaction_rollback should not be read-only", () => {
    const tool = tools.find((t) => t.name === "mysql_transaction_rollback")!;
    expect(tool.annotations?.readOnlyHint).toBe(false);
  });

  it("all transaction tools should not be read-only", () => {
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(false);
    }
  });
});

describe("Required Scopes", () => {
  let tools: ReturnType<typeof getTransactionTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    const adapter = createMockMySQLAdapterWithTransaction();
    tools = getTransactionTools(adapter as unknown as MySQLAdapter);
  });

  it("all transaction tools should require write scope", () => {
    for (const tool of tools) {
      expect(tool.requiredScopes).toContain("write");
    }
  });
});

describe("Handler Execution", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapterWithTransaction>;
  let tools: ReturnType<typeof getTransactionTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapterWithTransaction();
    tools = getTransactionTools(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  describe("mysql_transaction_begin", () => {
    it("should call beginTransaction on adapter", async () => {
      const tool = tools.find((t) => t.name === "mysql_transaction_begin")!;
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.beginTransaction).toHaveBeenCalled();
      expect(result).toHaveProperty("transactionId");
      expect(result).toHaveProperty("message");
    });

    it("should pass isolation level if provided", async () => {
      const tool = tools.find((t) => t.name === "mysql_transaction_begin")!;
      const result = await tool.handler(
        { isolationLevel: "SERIALIZABLE" },
        mockContext,
      );

      expect(mockAdapter.beginTransaction).toHaveBeenCalledWith("SERIALIZABLE");
      expect(result).toHaveProperty("isolationLevel", "SERIALIZABLE");
    });

    it("should use default isolation level if not provided", async () => {
      const tool = tools.find((t) => t.name === "mysql_transaction_begin")!;
      const result = await tool.handler({}, mockContext);

      expect(result).toHaveProperty(
        "isolationLevel",
        "REPEATABLE READ (default)",
      );
    });
  });

  describe("mysql_transaction_commit", () => {
    it("should call commitTransaction with transaction id", async () => {
      const tool = tools.find((t) => t.name === "mysql_transaction_commit")!;
      const result = await tool.handler(
        { transactionId: "txn-123" },
        mockContext,
      );

      expect(mockAdapter.commitTransaction).toHaveBeenCalledWith("txn-123");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("transactionId", "txn-123");
    });
  });

  describe("mysql_transaction_rollback", () => {
    it("should call rollbackTransaction with transaction id", async () => {
      const tool = tools.find((t) => t.name === "mysql_transaction_rollback")!;
      const result = await tool.handler(
        { transactionId: "txn-123" },
        mockContext,
      );

      expect(mockAdapter.rollbackTransaction).toHaveBeenCalledWith("txn-123");
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("message");
    });
  });

  describe("mysql_transaction_savepoint", () => {
    it("should create savepoint on connection", async () => {
      const tool = tools.find((t) => t.name === "mysql_transaction_savepoint")!;
      const result = await tool.handler(
        {
          transactionId: "txn-123",
          savepoint: "sp1",
        },
        mockContext,
      );

      expect(mockAdapter.getTransactionConnection).toHaveBeenCalledWith(
        "txn-123",
      );
      expect(mockAdapter.mockConnection.query).toHaveBeenCalledWith(
        "SAVEPOINT sp1",
      );
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("savepoint", "sp1");
    });

    it("should throw for invalid savepoint name", async () => {
      const tool = tools.find((t) => t.name === "mysql_transaction_savepoint")!;

      await expect(
        tool.handler(
          {
            transactionId: "txn-123",
            savepoint: "invalid-name",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid savepoint name");
    });

    it("should throw for non-existent transaction", async () => {
      (
        mockAdapter.getTransactionConnection as ReturnType<typeof vi.fn>
      ).mockReturnValue(undefined);

      const tool = tools.find((t) => t.name === "mysql_transaction_savepoint")!;

      await expect(
        tool.handler(
          {
            transactionId: "nonexistent",
            savepoint: "sp1",
          },
          mockContext,
        ),
      ).rejects.toThrow("Transaction not found");
    });
  });

  describe("mysql_transaction_release", () => {
    it("should release savepoint on connection", async () => {
      const tool = tools.find((t) => t.name === "mysql_transaction_release")!;
      const result = await tool.handler(
        {
          transactionId: "txn-123",
          savepoint: "sp1",
        },
        mockContext,
      );

      expect(mockAdapter.mockConnection.query).toHaveBeenCalledWith(
        "RELEASE SAVEPOINT sp1",
      );
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("message", "Savepoint released.");
    });

    it("should throw for invalid savepoint name", async () => {
      const tool = tools.find((t) => t.name === "mysql_transaction_release")!;

      await expect(
        tool.handler(
          {
            transactionId: "txn-123",
            savepoint: "123invalid",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid savepoint name");
    });

    it("should throw for non-existent transaction", async () => {
      (
        mockAdapter.getTransactionConnection as ReturnType<typeof vi.fn>
      ).mockReturnValue(undefined);

      const tool = tools.find((t) => t.name === "mysql_transaction_release")!;

      await expect(
        tool.handler(
          {
            transactionId: "gone",
            savepoint: "sp1",
          },
          mockContext,
        ),
      ).rejects.toThrow("Transaction not found");
    });
  });

  describe("mysql_transaction_rollback_to", () => {
    it("should rollback to savepoint on connection", async () => {
      const tool = tools.find(
        (t) => t.name === "mysql_transaction_rollback_to",
      )!;
      const result = await tool.handler(
        {
          transactionId: "txn-123",
          savepoint: "checkpoint",
        },
        mockContext,
      );

      expect(mockAdapter.mockConnection.query).toHaveBeenCalledWith(
        "ROLLBACK TO SAVEPOINT checkpoint",
      );
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("message", "Rolled back to savepoint.");
    });

    it("should throw for invalid savepoint name with special chars", async () => {
      const tool = tools.find(
        (t) => t.name === "mysql_transaction_rollback_to",
      )!;

      await expect(
        tool.handler(
          {
            transactionId: "txn-123",
            savepoint: "DROP TABLE users; --",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid savepoint name");
    });

    it("should throw for non-existent transaction", async () => {
      (
        mockAdapter.getTransactionConnection as ReturnType<typeof vi.fn>
      ).mockReturnValue(undefined);

      const tool = tools.find(
        (t) => t.name === "mysql_transaction_rollback_to",
      )!;

      await expect(
        tool.handler(
          {
            transactionId: "missing",
            savepoint: "sp1",
          },
          mockContext,
        ),
      ).rejects.toThrow("Transaction not found");
    });
  });

  describe("mysql_transaction_execute", () => {
    it("should execute multiple statements atomically", async () => {
      // Add executeOnConnection mock
      (
        mockAdapter as { executeOnConnection?: ReturnType<typeof vi.fn> }
      ).executeOnConnection = vi.fn().mockResolvedValue({ rowsAffected: 1 });

      const tool = tools.find((t) => t.name === "mysql_transaction_execute")!;
      const result = await tool.handler(
        {
          statements: [
            "INSERT INTO users VALUES (1)",
            "INSERT INTO logs VALUES (1)",
          ],
        },
        mockContext,
      );

      expect(mockAdapter.beginTransaction).toHaveBeenCalled();
      expect(mockAdapter.commitTransaction).toHaveBeenCalled();
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("statementsExecuted", 2);
      expect(result).toHaveProperty("results");
    });

    it("should rollback on failure", async () => {
      (
        mockAdapter as { executeOnConnection?: ReturnType<typeof vi.fn> }
      ).executeOnConnection = vi
        .fn()
        .mockResolvedValueOnce({ rowsAffected: 1 })
        .mockRejectedValueOnce(new Error("Constraint violation"));

      const tool = tools.find((t) => t.name === "mysql_transaction_execute")!;

      await expect(
        tool.handler(
          {
            statements: ["INSERT INTO users VALUES (1)", "INSERT INTO invalid"],
          },
          mockContext,
        ),
      ).rejects.toThrow("Transaction failed and was rolled back");

      expect(mockAdapter.rollbackTransaction).toHaveBeenCalled();
    });

    it("should pass isolation level to beginTransaction", async () => {
      (
        mockAdapter as { executeOnConnection?: ReturnType<typeof vi.fn> }
      ).executeOnConnection = vi.fn().mockResolvedValue({ rowsAffected: 1 });

      const tool = tools.find((t) => t.name === "mysql_transaction_execute")!;
      await tool.handler(
        {
          statements: ["SELECT 1"],
          isolationLevel: "READ COMMITTED",
        },
        mockContext,
      );

      expect(mockAdapter.beginTransaction).toHaveBeenCalledWith(
        "READ COMMITTED",
      );
    });
  });
});
