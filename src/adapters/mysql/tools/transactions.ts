/**
 * MySQL Transaction Tools
 *
 * Transaction control operations with savepoint support.
 * 7 tools total.
 */

import type { MySQLAdapter } from "../MySQLAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import {
  TransactionBeginSchema,
  TransactionIdSchema,
  TransactionIdSchemaBase,
  TransactionSavepointSchema,
  TransactionSavepointSchemaBase,
  TransactionExecuteSchema,
  TransactionExecuteSchemaBase,
} from "../types.js";

/**
 * Get all transaction tools
 */
export function getTransactionTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createTransactionBeginTool(adapter),
    createTransactionCommitTool(adapter),
    createTransactionRollbackTool(adapter),
    createTransactionSavepointTool(adapter),
    createTransactionReleaseTool(adapter),
    createTransactionRollbackToTool(adapter),
    createTransactionExecuteTool(adapter),
  ];
}

/**
 * Begin a transaction
 */
function createTransactionBeginTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_transaction_begin",
    title: "MySQL Begin Transaction",
    description:
      "Begin a new transaction with optional isolation level. Returns a transaction ID for subsequent operations.",
    group: "transactions",
    inputSchema: TransactionBeginSchema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { isolationLevel } = TransactionBeginSchema.parse(params);
      const transactionId = await adapter.beginTransaction(isolationLevel);
      return {
        transactionId,
        isolationLevel: isolationLevel ?? "REPEATABLE READ (default)",
        message:
          "Transaction started. Use transactionId for commit/rollback operations.",
      };
    },
  };
}

/**
 * Commit a transaction
 */
function createTransactionCommitTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_transaction_commit",
    title: "MySQL Commit Transaction",
    description: "Commit a transaction, making all changes permanent.",
    group: "transactions",
    inputSchema: TransactionIdSchemaBase,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { transactionId } = TransactionIdSchema.parse(params);
      try {
        await adapter.commitTransaction(transactionId);
        return {
          success: true,
          transactionId,
          message: "Transaction committed successfully.",
        };
      } catch (error) {
        const msg = String(error instanceof Error ? error.message : error);
        return { success: false, error: msg };
      }
    },
  };
}

/**
 * Rollback a transaction
 */
function createTransactionRollbackTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_transaction_rollback",
    title: "MySQL Rollback Transaction",
    description: "Rollback a transaction, undoing all changes.",
    group: "transactions",
    inputSchema: TransactionIdSchemaBase,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { transactionId } = TransactionIdSchema.parse(params);
      try {
        await adapter.rollbackTransaction(transactionId);
        return {
          success: true,
          transactionId,
          message: "Transaction rolled back.",
        };
      } catch (error) {
        const msg = String(error instanceof Error ? error.message : error);
        return { success: false, error: msg };
      }
    },
  };
}

/**
 * Create a savepoint
 */
function createTransactionSavepointTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_transaction_savepoint",
    title: "MySQL Create Savepoint",
    description:
      "Create a savepoint within a transaction for partial rollback.",
    group: "transactions",
    inputSchema: TransactionSavepointSchemaBase,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { transactionId, savepoint } =
        TransactionSavepointSchema.parse(params);

      const connection = adapter.getTransactionConnection(transactionId);
      if (!connection) {
        return {
          success: false,
          error: `Transaction not found: ${transactionId}`,
        };
      }

      // Validate savepoint name
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(savepoint)) {
        return { success: false, error: "Invalid savepoint name" };
      }

      try {
        // Use query() instead of execute() - SAVEPOINT not supported in prepared statement protocol
        await connection.query(`SAVEPOINT ${savepoint}`);
        return { success: true, transactionId, savepoint };
      } catch (error) {
        const msg = String(error instanceof Error ? error.message : error);
        return { success: false, error: msg };
      }
    },
  };
}

/**
 * Release a savepoint
 */
function createTransactionReleaseTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_transaction_release",
    title: "MySQL Release Savepoint",
    description: "Release a savepoint, removing it without rolling back.",
    group: "transactions",
    inputSchema: TransactionSavepointSchemaBase,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { transactionId, savepoint } =
        TransactionSavepointSchema.parse(params);

      const connection = adapter.getTransactionConnection(transactionId);
      if (!connection) {
        return {
          success: false,
          error: `Transaction not found: ${transactionId}`,
        };
      }

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(savepoint)) {
        return { success: false, error: "Invalid savepoint name" };
      }

      try {
        // Use query() instead of execute() - RELEASE SAVEPOINT not supported in prepared statement protocol
        await connection.query(`RELEASE SAVEPOINT ${savepoint}`);
        return {
          success: true,
          transactionId,
          savepoint,
          message: "Savepoint released.",
        };
      } catch (error) {
        const msg = String(error instanceof Error ? error.message : error);
        return { success: false, error: msg };
      }
    },
  };
}

/**
 * Rollback to a savepoint
 */
function createTransactionRollbackToTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_transaction_rollback_to",
    title: "MySQL Rollback to Savepoint",
    description: "Rollback to a savepoint, undoing changes after that point.",
    group: "transactions",
    inputSchema: TransactionSavepointSchemaBase,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { transactionId, savepoint } =
        TransactionSavepointSchema.parse(params);

      const connection = adapter.getTransactionConnection(transactionId);
      if (!connection) {
        return {
          success: false,
          error: `Transaction not found: ${transactionId}`,
        };
      }

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(savepoint)) {
        return { success: false, error: "Invalid savepoint name" };
      }

      try {
        // Use query() instead of execute() - ROLLBACK TO SAVEPOINT not supported in prepared statement protocol
        await connection.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        return {
          success: true,
          transactionId,
          savepoint,
          message: "Rolled back to savepoint.",
        };
      } catch (error) {
        const msg = String(error instanceof Error ? error.message : error);
        return { success: false, error: msg };
      }
    },
  };
}

/**
 * Execute multiple statements atomically
 */
function createTransactionExecuteTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_transaction_execute",
    title: "MySQL Atomic Execute",
    description:
      "Execute multiple SQL statements atomically. All statements succeed or all are rolled back.",
    group: "transactions",
    inputSchema: TransactionExecuteSchemaBase,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { statements, isolationLevel } =
        TransactionExecuteSchema.parse(params);

      if (statements.length === 0) {
        return {
          success: false,
          error:
            "No statements provided. Pass at least one SQL statement in statements (or queries alias).",
        };
      }

      const transactionId = await adapter.beginTransaction(isolationLevel);
      const connection = adapter.getTransactionConnection(transactionId);

      if (!connection) {
        throw new Error("Failed to get transaction connection");
      }

      const results: {
        statement: number;
        rowsAffected?: number;
        rows?: Record<string, unknown>[];
        rowCount?: number;
      }[] = [];

      try {
        for (let i = 0; i < statements.length; i++) {
          const stmt = statements[i];
          if (!stmt) continue;
          const result = await adapter.executeOnConnection(connection, stmt);
          if (result.rows) {
            results.push({
              statement: i + 1,
              rows: result.rows,
              rowCount: result.rows.length,
            });
          } else {
            results.push({
              statement: i + 1,
              rowsAffected: result.rowsAffected,
            });
          }
        }

        await adapter.commitTransaction(transactionId);

        return {
          success: true,
          statementsExecuted: statements.length,
          results,
        };
      } catch (error) {
        await adapter.rollbackTransaction(transactionId);
        const msg = String(error instanceof Error ? error.message : error);
        return {
          success: false,
          error: `Transaction failed and was rolled back: ${msg}`,
          rolledBack: true,
        };
      }
    },
  };
}
