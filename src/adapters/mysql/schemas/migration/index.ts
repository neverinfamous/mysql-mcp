import { z } from "zod";
import { BaseOutputSchema } from "../output-schemas.js";

// Migration Tracking Input Schemas
// =============================================================================

/**
 * mysql_migration_init input
 */
export const MigrationInitSchemaBase = z.object({
  database: z
    .string()
    .optional()
    .describe("Database to create the tracking table in (default: active database)"),
});

export const MigrationInitSchema = MigrationInitSchemaBase.default({});

/**
 * mysql_migration_record input
 */
export const MigrationRecordSchemaBase = z.object({
  version: z
    .string()
    .optional()
    .describe("Version identifier (e.g., '1.0.0', '2024-01-15-add-users')"),
  migrationName: z.string().optional().describe("Alias for version"),
  migration: z.string().optional().describe("Alias for version"),
  description: z
    .string()
    .optional()
    .describe("Human-readable description of the migration"),
  name: z.string().optional().describe("Alias for description"),
  migrationSql: z
    .string()
    .optional()
    .describe("The DDL/SQL statements applied"),
  sql: z.string().optional().describe("Alias for migrationSql"),
  query: z.string().optional().describe("Alias for migrationSql"),
  rollbackSql: z.string().optional().describe("SQL to reverse this migration"),
  sourceSystem: z
    .string()
    .optional()
    .describe("Origin system (e.g., 'mysql', 'sqlite', 'manual', 'agent')"),
  appliedBy: z
    .string()
    .optional()
    .describe("Who/what applied this migration (e.g., agent name, user)"),
  database: z
    .string()
    .optional()
    .describe("Database to apply the migration in (default: active database)"),
});

// Internal parse schema — version and migrationSql are required
const MigrationRecordParseSchema = z.object({
  version: z
    .string()
    .describe("Version identifier (e.g., '1.0.0', '2024-01-15-add-users')"),
  description: z
    .string()
    .optional()
    .describe("Human-readable description of the migration"),
  migrationSql: z.string().describe("The DDL/SQL statements applied"),
  rollbackSql: z.string().optional().describe("SQL to reverse this migration"),
  sourceSystem: z
    .string()
    .optional()
    .describe("Origin system (e.g., 'mysql', 'sqlite', 'manual', 'agent')"),
  appliedBy: z
    .string()
    .optional()
    .describe("Who/what applied this migration (e.g., agent name, user)"),
  database: z
    .string()
    .optional()
    .describe("Database to apply the migration in (default: active database)"),
});

export const MigrationRecordSchema = z.preprocess((input: unknown) => {
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    const out = { ...obj };
    if (out["migrationSql"] === undefined) {
      if (out["sql"] !== undefined) out["migrationSql"] = out["sql"];
      else if (out["query"] !== undefined) out["migrationSql"] = out["query"];
    }
    if (out["version"] === undefined) {
      if (out["migrationName"] !== undefined) out["version"] = out["migrationName"];
      else if (out["migration"] !== undefined) out["version"] = out["migration"];
      else if (out["name"] !== undefined) out["version"] = out["name"];
    }
    if (out["description"] === undefined && out["name"] !== undefined) {
      out["description"] = out["name"];
    }
    return out;
  }
  return input;
}, MigrationRecordParseSchema);

/**
 * mysql_migration_apply input
 * Same fields as mysql_migration_record — version and migrationSql required.
 */
export const MigrationApplySchemaBase = MigrationRecordSchemaBase;

// Internal parse schema — version and migrationSql are required
export const MigrationApplySchema = MigrationRecordSchema;

/**
 * mysql_migration_rollback input
 */
export const MigrationRollbackSchemaBase = z.object({
  id: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Migration ID to roll back"),
  version: z
    .string()
    .optional()
    .describe("Migration version to roll back (alternative to id)"),
  dryRun: z
    .boolean()
    .optional()
    .describe(
      "If true, return the rollback SQL without executing (default: false)",
    ),
  database: z
    .string()
    .optional()
    .describe("Database to roll back the migration in (default: active database)"),
});

export const MigrationRollbackSchema = z.preprocess((input: unknown) => {
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    const out = { ...obj };

    // Resolve positional param collision with transactionRollback
    if (out["transactionId"] !== undefined && out["id"] === undefined) {
      out["id"] = out["transactionId"];
      delete out["transactionId"];
    }

    if (typeof out["id"] === "string" && isNaN(parseInt(out["id"], 10)) && out["version"] === undefined) {
      out["version"] = out["id"];
      delete out["id"];
    }
    return out;
  }
  return input;
}, z.object({
  id: z
    .preprocess((val) => {
      if (typeof val === "string") return parseInt(val, 10);
      return val;
    }, z.number().optional())
    .optional(),
  version: z.string().optional(),
  dryRun: z.boolean().optional(),
  database: z.string().optional(),
}));

/**
 * mysql_migration_history input
 */
export const MigrationHistorySchemaBase = z.object({
  status: z.string().optional().describe("Filter by status"),
  sourceSystem: z.string().optional().describe("Filter by source system"),
  limit: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Maximum records to return (default: 50)"),
  offset: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Offset for pagination (default: 0)"),
  database: z
    .string()
    .optional()
    .describe("Database to read the migration history from (default: active database)"),
});

export const MigrationHistorySchema = z
  .object({
    status: z.enum(["applied", "recorded", "rolled_back", "failed"]).optional(),
    sourceSystem: z.string().optional(),
    limit: z
      .preprocess((val) => {
        if (typeof val === "string") return parseInt(val, 10);
        return val;
      }, z.number().optional())
      .optional(),
    offset: z
      .preprocess((val) => {
        if (typeof val === "string") return parseInt(val, 10);
        return val;
      }, z.number().optional())
      .optional(),
    database: z.string().optional(),
  })
  .default({});

/**
 * mysql_migration_status input
 */
export const MigrationStatusSchemaBase = z.object({
  database: z
    .string()
    .optional()
    .describe("Database where the tracking table lives (default: active database)"),
});

export const MigrationStatusSchema = z.preprocess((input: unknown) => {
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    const out = { ...obj };
    // Gracefully ignore boolean arguments hallucinated by agents (e.g. status(true))
    if (typeof out["database"] === "boolean") {
      delete out["database"];
    }
    return out;
  }
  return input;
}, MigrationStatusSchemaBase.default({}));

// Output Schemas
// =============================================================================

export const MigrationInitOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    tableCreated: z.boolean(),
    tableName: z.string(),
    existingRecords: z.number()
  }).optional()
});

export const MigrationRecordOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    record: z.record(z.string(), z.unknown())
  }).optional()
});

export const MigrationApplyOutputSchema = MigrationRecordOutputSchema;

export const MigrationRollbackOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    dryRun: z.boolean(),
    rollbackSql: z.string().nullable(),
    record: z.record(z.string(), z.unknown())
  }).optional()
});

export const MigrationHistoryOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    records: z.array(z.record(z.string(), z.unknown())),
    total: z.number(),
    limit: z.number(),
    offset: z.number()
  }).optional()
});

export const MigrationStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    initialized: z.boolean(),
    latestVersion: z.string().nullable(),
    latestAppliedAt: z.string().nullable(),
    counts: z.object({
      total: z.number(),
      applied: z.number(),
      recorded: z.number(),
      rolledBack: z.number(),
      failed: z.number()
    }),
    sourceSystems: z.array(z.string())
  }).optional()
});

// =============================================================================
