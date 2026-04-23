import { z } from "zod";
import { defaultToEmpty, preprocessTransactionIdParams, preprocessSavepointParams, preprocessTransactionExecuteParams } from "./preprocess-utils.js";

// =============================================================================
// Transaction Schemas
// =============================================================================

// --- TransactionBegin ---

// Base schema for MCP visibility
export const TransactionBeginSchemaBase = z.object({
  isolationLevel: z.string().optional().describe("Transaction isolation level"),
});

// Transformed schema for handler parsing
export const TransactionBeginSchema = z.preprocess(
  defaultToEmpty,
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

// --- TransactionSavepoint ---

// Base schema for MCP visibility
export const TransactionSavepointSchemaBase = z.object({
  transactionId: z.string().optional().describe("Transaction ID"),
  txId: z.string().optional().describe("Alias for transactionId"),
  tx: z.string().optional().describe("Alias for transactionId"),
  savepoint: z.string().optional().describe("Savepoint name"),
  name: z.string().optional().describe("Alias for savepoint"),
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

// --- TransactionExecute ---

// Base schema for MCP visibility
export const TransactionExecuteSchemaBase = z.object({
  statements: z
    .array(z.string())
    .optional()
    .describe("SQL statements to execute atomically"),
  queries: z.array(z.string()).optional().describe("Alias for statements"),
  isolationLevel: z.string().optional().describe("Transaction isolation level"),
});

export const TransactionExecuteSchema = z
  .preprocess(preprocessTransactionExecuteParams, TransactionExecuteSchemaBase)
  .transform((data) => ({
    statements: data.statements ?? data.queries ?? [],
    isolationLevel: data.isolationLevel,
  }))
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

