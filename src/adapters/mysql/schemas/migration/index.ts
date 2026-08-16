import { z } from "zod";
import { BaseOutputSchema } from "../output-schemas.js";

// Migration Tracking Input Schemas
// =============================================================================

/**
 * mysql_migration_init input
 */
export const MigrationInitSchemaBase = z.object({
  database: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .describe("Database to create the tracking table in (default: active database)"),
  db: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for database"),
  schema: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for database"),
});

export const MigrationInitSchema = z.preprocess((input: unknown) => {
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    const out = { ...obj };
    
    const stringFields = ["database", "db", "schema"];
    for (const field of stringFields) {
      if (typeof out[field] === "boolean") out[field] = undefined;
      if (typeof out[field] === "number") out[field] = String(out[field]);
    }
    
    if (out["db"] !== undefined && out["database"] === undefined) out["database"] = out["db"];
    if (out["schema"] !== undefined && out["database"] === undefined) out["database"] = out["schema"];
    return out;
  }
  return input;
}, z.object({
  database: z.string().regex(/^[a-zA-Z0-9_]+$/, "Invalid database name").max(64, "Database name cannot exceed 64 characters").optional()
}).default({}));

/**
 * mysql_migration_record input
 */
export const MigrationRecordSchemaBase = z.object({
  version: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .describe("Version identifier (e.g., '1.0.0', '2024-01-15-add-users')"),
  migrationName: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for version"),
  migration: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for version"),
  description: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .describe("Human-readable description of the migration"),
  name: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for description"),
  migrationSql: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .describe("The DDL/SQL statements applied"),
  sql: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for migrationSql"),
  query: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for migrationSql"),
  rollbackSql: z.union([z.string(), z.boolean(), z.number()]).optional().describe("SQL to reverse this migration (Note: MySQL DDL statements cannot be rolled back, they commit implicitly)"),
  sourceSystem: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .describe("Origin system (e.g., 'mysql', 'sqlite', 'manual', 'agent')"),
  appliedBy: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .describe("Who/what applied this migration (e.g., agent name, user)"),
  database: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .describe("Database to apply the migration in (default: active database)"),
  db: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for database"),
  schema: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for database"),
});

// Internal parse schema — version and migrationSql are required
const MigrationRecordParseSchema = z.object({
  version: z
    .string()
    .trim()
    .min(1, "Version cannot be empty")
    .max(50, "Version cannot exceed 50 characters")
    .describe("Version identifier (e.g., '1.0.0', '2024-01-15-add-users')"),
  description: z
    .string()
    .optional()
    .describe("Human-readable description of the migration"),
  migrationSql: z.string().trim().min(1, "Migration SQL cannot be empty").describe("The DDL/SQL statements applied"),
  rollbackSql: z.string().optional().describe("SQL to reverse this migration"),
  sourceSystem: z
    .string()
    .max(50, "Origin system cannot exceed 50 characters")
    .optional()
    .describe("Origin system (e.g., 'mysql', 'sqlite', 'manual', 'agent')"),
  appliedBy: z
    .string()
    .max(255, "Applied by cannot exceed 255 characters")
    .optional()
    .describe("Who/what applied this migration (e.g., agent name, user)"),
  database: z
    .string()
    .regex(/^[a-zA-Z0-9_]+$/, "Invalid database name")
    .max(64, "Database name cannot exceed 64 characters")
    .optional()
    .describe("Database to apply the migration in (default: active database)"),
});

export const MigrationRecordSchema = z.preprocess((input: unknown) => {
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    const out = { ...obj };

    const stringFields = ["version", "migrationName", "migration", "description", "name", "migrationSql", "sql", "query", "rollbackSql", "sourceSystem", "appliedBy", "database", "db", "schema"];
    for (const field of stringFields) {
      if (typeof out[field] === "boolean") out[field] = undefined;
      if (typeof out[field] === "number") out[field] = String(out[field]);
    }

    if (out["migrationSql"] === undefined) {
      if (out["sql"] !== undefined) out["migrationSql"] = out["sql"];
      else if (out["query"] !== undefined) out["migrationSql"] = out["query"];
    }
    if (out["version"] === undefined) {
      if (out["migrationName"] !== undefined) out["version"] = out["migrationName"];
      else if (out["migration"] !== undefined) out["version"] = out["migration"];
      else if (out["name"] !== undefined) out["version"] = out["name"];
      else out["version"] = Date.now().toString();
    }
    if (out["description"] === undefined && out["name"] !== undefined) {
      out["description"] = out["name"];
    }
    if (out["db"] !== undefined && out["database"] === undefined) out["database"] = out["db"];
    if (out["schema"] !== undefined && out["database"] === undefined) out["database"] = out["schema"];
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
    .describe("Migration ID to roll back (Required if version is not provided)"),
  version: z
    .string()
    .optional()
    .describe("Migration version to roll back (alternative to id, required if id not provided)"),
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
  migrationId: z.union([z.number(), z.string()]).optional().describe("Alias for id"),
  transactionId: z.union([z.number(), z.string()]).optional().describe("Alias for id"),
  migrationVersion: z.string().optional().describe("Alias for version"),
  migration: z.string().optional().describe("Alias for version"),
  name: z.string().optional().describe("Alias for version"),
  db: z.string().optional().describe("Alias for database"),
  schema: z.string().optional().describe("Alias for database"),
});

export const MigrationRollbackSchema = z.preprocess((input: unknown) => {
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    const out = { ...obj };

    if (out["migrationId"] !== undefined && out["id"] === undefined) out["id"] = out["migrationId"];
    if (out["migrationVersion"] !== undefined && out["version"] === undefined) out["version"] = out["migrationVersion"];
    if (out["migration"] !== undefined && out["version"] === undefined && out["id"] === undefined) out["version"] = out["migration"];
    if (out["name"] !== undefined && out["version"] === undefined && out["id"] === undefined) out["version"] = out["name"];
    if (out["db"] !== undefined && out["database"] === undefined) out["database"] = out["db"];
    if (out["schema"] !== undefined && out["database"] === undefined) out["database"] = out["schema"];

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
  database: z.string().regex(/^[a-zA-Z0-9_]+$/, "Invalid database name").optional(),
}));

/**
 * mysql_migration_history input
 */
export const MigrationHistorySchemaBase = z.object({
  status: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Filter by status"),
  state: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for status"),
  filter: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for status"),
  sourceSystem: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Filter by source system"),
  source: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for sourceSystem"),
  limit: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Maximum records to return (default: 50)"),
  offset: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Offset for pagination (default: 0)"),
  skip: z.union([z.number(), z.string()]).optional().describe("Alias for offset"),
  database: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .describe("Database to read the migration history from (default: active database)"),
  system: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for sourceSystem"),
  count: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
  max: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
  take: z.union([z.number(), z.string()]).optional().describe("Alias for limit"),
  db: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for database"),
  schema: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for database"),
});

export const MigrationHistorySchema = z.preprocess((input: unknown) => {
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    const out = { ...obj };

    const stringFields = ["database", "db", "schema", "status", "state", "filter", "sourceSystem", "source", "system"];
    for (const field of stringFields) {
      if (typeof out[field] === "boolean") out[field] = undefined;
      if (typeof out[field] === "number") out[field] = String(out[field]);
    }

    const numberFields = ["limit", "offset", "skip", "count", "max", "take"];
    for (const field of numberFields) {
      if (typeof out[field] === "boolean") out[field] = undefined;
    }

    if (out["state"] !== undefined && out["status"] === undefined) out["status"] = out["state"];
    if (out["filter"] !== undefined && out["status"] === undefined) out["status"] = out["filter"];
    if (out["source"] !== undefined && out["sourceSystem"] === undefined) out["sourceSystem"] = out["source"];
    if (out["system"] !== undefined && out["sourceSystem"] === undefined) out["sourceSystem"] = out["system"];
    if (out["count"] !== undefined && out["limit"] === undefined) out["limit"] = out["count"];
    if (out["max"] !== undefined && out["limit"] === undefined) out["limit"] = out["max"];
    if (out["take"] !== undefined && out["limit"] === undefined) out["limit"] = out["take"];
    if (out["skip"] !== undefined && out["offset"] === undefined) out["offset"] = out["skip"];
    if (out["db"] !== undefined && out["database"] === undefined) out["database"] = out["db"];
    if (out["schema"] !== undefined && out["database"] === undefined) out["database"] = out["schema"];

    if (typeof out["limit"] === "string" && isNaN(parseInt(out["limit"], 10))) {
      if (["applied", "recorded", "rolled_back", "failed"].includes(out["limit"])) {
        if (out["status"] === undefined) out["status"] = out["limit"];
        delete out["limit"];
      }
    }

    return out;
  }
  return input;
}, z.object({
    status: z.enum(["applied", "recorded", "rolled_back", "failed"]).optional(),
    sourceSystem: z.string().optional(),
    limit: z
      .preprocess((val) => {
        if (typeof val === "string") return parseInt(val, 10);
        return val;
      }, z.number().int().min(1).optional())
      .optional(),
    offset: z
      .preprocess((val) => {
        if (typeof val === "string") return parseInt(val, 10);
        return val;
      }, z.number().int().min(0).optional())
      .optional(),
    database: z.string().regex(/^[a-zA-Z0-9_]+$/, "Invalid database name").optional(),
  })
  .default({}));

/**
 * mysql_migration_status input
 */
export const MigrationStatusSchemaBase = z.object({
  database: z
    .union([z.string(), z.boolean(), z.number()])
    .optional()
    .describe("Database where the tracking table lives (default: active database)"),
  db: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for database"),
  schema: z.union([z.string(), z.boolean(), z.number()]).optional().describe("Alias for database"),
});

export const MigrationStatusSchema = z.preprocess((input: unknown) => {
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    const out = { ...obj };
    const stringFields = ["database", "db", "schema"];
    for (const field of stringFields) {
      if (typeof out[field] === "boolean") out[field] = undefined;
      if (typeof out[field] === "number") out[field] = String(out[field]);
    }
    if (out["db"] !== undefined && out["database"] === undefined) out["database"] = out["db"];
    if (out["schema"] !== undefined && out["database"] === undefined) out["database"] = out["schema"];
    return out;
  }
  return input;
}, z.object({
  database: z.string().regex(/^[a-zA-Z0-9_]+$/, "Invalid database name").optional()
}).default({}));

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
