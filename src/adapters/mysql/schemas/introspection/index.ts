import { z } from "zod";

// Introspection Schemas
// =============================================================================

/**
 * mysql_dependency_graph input
 */
export const DependencyGraphSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema to analyze (default: all user schemas)"),
  includeRowCounts: z
    .boolean()
    .optional()
    .describe("Include estimated row counts (default: true)"),
  compact: z
    .boolean()
    .optional()
    .describe("Omit detailed metadata to reduce payload size (default: false)"),
  limit: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Maximum tables to include in graph (default: 100, max: 500)"),
});

export const DependencyGraphSchema = z
  .object({
    schema: z.string().optional(),
    includeRowCounts: z.boolean().optional(),
    compact: z.boolean().optional(),
    limit: z.preprocess((val) => {
      if (typeof val === "string") return parseInt(val, 10);
      return val;
    }, z.number().optional().default(100)),
  })
  .default({ limit: 100 });

/**
 * mysql_topological_sort input
 */
export const TopologicalSortSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema to analyze (default: all user schemas)"),
  direction: z
    .string()
    .optional()
    .describe(
      "Sort direction: 'create' = dependencies first, 'drop' = dependents first (default: create)",
    ),
});

export const TopologicalSortSchema = z
  .object({
    schema: z.string().optional(),
    direction: z.enum(["create", "drop"]).optional(),
  })
  .default({});

/**
 * mysql_cascade_simulator input
 */
export const CascadeSimulatorSchemaBase = z.object({
  table: z
    .string()
    .optional()
    .describe("Table name to simulate deletion from (supports schema.table)"),
  schema: z.string().optional().describe("Schema name (default: public)"),
  operation: z
    .string()
    .optional()
    .describe("Operation to simulate (default: DELETE)"),
});

const CascadeSimulatorInnerSchema = z.object({
  table: z.string(),
  schema: z.string().optional(),
  operation: z.enum(["DELETE", "DROP", "TRUNCATE"]).optional(),
});

export const CascadeSimulatorSchema = z.preprocess((input: unknown) => {
  if (typeof input === "string") return { table: input };
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    // Parse schema.table format
    if (
      typeof obj["table"] === "string" &&
      obj["table"].includes(".") &&
      typeof obj["schema"] === "undefined"
    ) {
      const parts = obj["table"].split(".");
      if (parts.length === 2 && parts[0] && parts[1]) {
        return { ...obj, schema: parts[0], table: parts[1] };
      }
    }
  }
  return input;
}, CascadeSimulatorInnerSchema);

/**
 * mysql_schema_snapshot input
 */
export const SchemaSnapshotSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema to snapshot (default: all user schemas)"),
  includeSystem: z
    .boolean()
    .optional()
    .describe("Include system schemas like mysql, information_schema (default: false)"),
  sections: z
    .array(z.string())
    .optional()
    .describe("Specific sections to include (default: all)"),
  compact: z
    .boolean()
    .optional()
    .describe(
      "Omit column details from tables section for reduced payload size (default: true). Set to false to include full column schemas.",
    ),
  limit: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Maximum objects per section (default: 100, max: 500)"),
});

export const SchemaSnapshotSchema = z
  .object({
    schema: z.string().optional(),
    includeSystem: z.boolean().optional(),
    sections: z
      .array(
        z.enum([
          "tables",
          "views",
          "indexes",
          "constraints",
          "functions",
          "triggers",
          "sequences",
          "types",
          "extensions",
        ]),
      )
      .optional(),
    compact: z.boolean().optional().default(true),
    limit: z.preprocess((val) => {
      if (typeof val === "string") return parseInt(val, 10);
      return val;
    }, z.number().optional().default(100)),
  })
  .default({ compact: true, limit: 100 });

/**
 * mysql_constraint_analysis input
 */
export const ConstraintAnalysisSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema to analyze (default: all user schemas)"),
  table: z
    .string()
    .optional()
    .describe("Analyze constraints for a specific table only"),
  checks: z
    .array(z.string())
    .optional()
    .describe("Specific checks to run (default: all)"),
});

const ConstraintAnalysisInnerSchema = z.object({
  schema: z.string().optional(),
  table: z.string().optional(),
  checks: z
    .array(
      z.enum([
        "redundant",
        "missing_fk",
        "missing_not_null",
        "missing_pk",
        "unindexed_fk",
      ]),
    )
    .optional(),
});

export const ConstraintAnalysisSchema = z.preprocess((input: unknown) => {
  if (typeof input === "string") return { table: input };
  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;
    if (
      typeof obj["table"] === "string" &&
      obj["table"].includes(".") &&
      typeof obj["schema"] === "undefined"
    ) {
      const parts = obj["table"].split(".");
      if (parts.length === 2 && parts[0] && parts[1]) {
        return { ...obj, schema: parts[0], table: parts[1] };
      }
    }
  }
  return input;
}, ConstraintAnalysisInnerSchema.default({}));

/**
 * mysql_migration_risks input
 */
export const MigrationRisksSchemaBase = z.object({
  statements: z
    .array(z.string())
    .optional()
    .describe("Array of DDL statements to analyze for risks"),
  statement: z
    .string()
    .optional()
    .describe("Single DDL statement (alias for statements)"),
  sql: z.string().optional().describe("Alias for statements/statement"),
  schema: z
    .string()
    .optional()
    .describe("Target schema context (default: public)"),
});

export const MigrationRisksSchema = z.preprocess(
  (input: unknown) => {
    if (typeof input === "object" && input !== null) {
      const obj = input as Record<string, unknown>;
      // Accept statement/sql aliases
      if (obj["statement"] !== undefined && obj["statements"] === undefined) {
        return { ...obj, statements: [obj["statement"]] };
      }
      if (obj["sql"] !== undefined && obj["statements"] === undefined) {
        return { ...obj, statements: [obj["sql"]] };
      }
    }
    return input;
  },
  MigrationRisksSchemaBase.required({ statements: true }),
);

// =============================================================================