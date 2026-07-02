import { z } from "zod";
import { BaseOutputSchema } from "./output-schemas.js";
import {
  preprocessTransactionIdParams,
  preprocessSavepointParams,
  preprocessTransactionExecuteParams,
  preprocessTransactionBeginParams,
} from "./preprocess-utils.js";

// =============================================================================
// Transaction Schemas
// =============================================================================

// --- TransactionBegin ---

// Base schema for MCP visibility
export const TransactionBeginSchemaBase = z.object({
  isolationLevel: z.string().optional().describe("Transaction isolation level"),
  isolation_level: z.string().optional().describe("Alias for isolationLevel"),
});

// Transformed schema for handler parsing
export const TransactionBeginSchema = z.preprocess(
  preprocessTransactionBeginParams,
  z.object({
    isolationLevel: z
      .enum([
        "READ UNCOMMITTED",
        "READ COMMITTED",
        "REPEATABLE READ",
        "SERIALIZABLE",
      ])
      .optional()
      .describe("Transaction isolation level"),
  }),
);

export const TransactionBeginOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    transactionId: z.string(),
    isolationLevel: z.string().optional(),
    message: z.string().optional(),
  }).optional(),
});

// --- TransactionId ---

// Base schema for MCP visibility
export const TransactionIdSchemaBase = z.object({
  transactionId: z
    .string()
    .optional()
    .describe("Transaction ID from begin operation"),
  txId: z.string().optional().describe("Alias for transactionId"),
  tx: z.string().optional().describe("Alias for transactionId"),
});

// Transformed schema for handler parsing
export const TransactionIdSchema = z
  .preprocess(preprocessTransactionIdParams, TransactionIdSchemaBase)
  .transform((data) => ({
    transactionId: data.transactionId ?? data.txId ?? data.tx ?? "",
  }))
  .refine((data) => data.transactionId !== "", {
    message:
      "transactionId (or txId/tx alias) is required. Get one from mysql_transaction_begin first.",
  });

export const TransactionIdOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    transactionId: z.string(),
    message: z.string().optional(),
  }).optional(),
});

// --- TransactionSavepoint ---

// Base schema for MCP visibility
export const TransactionSavepointSchemaBase = z.object({
  transactionId: z.string().optional().describe("Transaction ID"),
  txId: z.string().optional().describe("Alias for transactionId"),
  tx: z.string().optional().describe("Alias for transactionId"),
  savepoint: z.string().optional().describe("Savepoint name"),
  name: z.string().optional().describe("Alias for savepoint"),
  savepointName: z.string().optional().describe("Alias for savepoint"),
  id: z.string().optional().describe("Alias for savepoint"),
});

// Transformed schema for handler parsing
export const TransactionSavepointSchema = z
  .preprocess(preprocessSavepointParams, TransactionSavepointSchemaBase)
  .transform((data) => ({
    transactionId: data.transactionId ?? data.txId ?? data.tx ?? "",
    savepoint: data.savepoint ?? data.name ?? "",
  }))
  .refine((data) => data.transactionId !== "" && data.savepoint !== "", {
    message:
      'Both transactionId and savepoint are required. Example: {transactionId: "...", savepoint: "sp1"}',
  });

export const TransactionSavepointOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    transactionId: z.string(),
    savepoint: z.string(),
    message: z.string().optional(),
  }).optional(),
});

// --- TransactionExecute ---

// Base schema for MCP visibility
export const TransactionExecuteSchemaBase = z.object({
  statements: z
    .array(z.string())
    .optional()
    .describe("SQL statements to execute atomically. Anti-Hallucination Hint: Pass an array of strings. You can also pass a single string or use the 'queries' or 'sql' alias."),
  queries: z.array(z.string()).optional().describe("Alias for statements"),
  query: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for statements"),
  sql: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for statements"),
  isolationLevel: z.string().optional().describe("Transaction isolation level. Expected one of: READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE"),
  isolation_level: z.string().optional().describe("Alias for isolationLevel"),
});

export const TransactionExecuteSchema = z
  .preprocess(preprocessTransactionExecuteParams, TransactionExecuteSchemaBase)
  .transform((data) => ({
    statements: data.statements ?? data.queries ?? [],
    isolationLevel: data.isolationLevel,
  }))
  .refine((data) => data.statements.length > 0, {
    message:
      "No statements provided. Pass at least one SQL statement in statements (or queries alias).",
  })
  .refine(
    (data) => {
      if (!data.isolationLevel) return true;
      const validLevels = [
        "READ UNCOMMITTED",
        "READ COMMITTED",
        "REPEATABLE READ",
        "SERIALIZABLE",
      ];
      return validLevels.includes(data.isolationLevel);
    },
    {
      message:
        "Invalid isolationLevel. Expected one of: READ UNCOMMITTED, READ COMMITTED, REPEATABLE READ, SERIALIZABLE",
    },
  );

export const TransactionExecuteOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    statementsExecuted: z.number(),
    results: z.array(z.object({
      statement: z.number(),
      rowsAffected: z.number().optional(),
      rows: z.array(z.record(z.string(), z.unknown())).optional(),
      rowCount: z.number().optional(),
    })),
  }).optional(),
  rolledBack: z.boolean().optional(),
});
