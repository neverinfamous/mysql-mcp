import { z } from "zod";
import { BaseOutputSchema } from "../output-schemas.js";

// Introspection Schemas
// =============================================================================

/**
 * mysql_dependency_graph input
 */
export const DependencyGraphSchemaBase = z.object({
  schema: z.string().optional().describe("Schema to analyze (REQUIRED)"),
  database: z.string().optional().describe("Alias for schema"),
  db: z.string().optional().describe("Alias for schema"),
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
  maxDepth: z
    .union([z.number(), z.string()])
    .optional()
    .describe("Maximum depth for traversal (default: no limit)"),
  table: z.string().optional().describe("Table to filter dependencies for"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
});

export const DependencyGraphSchema = z.object({
  schema: z.string().default(""),
  database: z.string().optional(),
  db: z.string().optional(),
  table: z.string().optional(),
  tableName: z.string().optional(),
  name: z.string().optional(),
  includeRowCounts: z.boolean().optional(),
  compact: z.boolean().optional(),
  limit: z.preprocess((val) => {
    if (typeof val === "string") return parseInt(val, 10);
    return val;
  }, z.number().optional().default(100)),
  maxDepth: z
    .preprocess((val) => {
      if (typeof val === "string") return parseInt(val, 10);
      return val;
    }, z.number().optional())
    .optional(),
}).transform(val => {
  if (val.database && !val.schema) val.schema = val.database;
  if (val.db && !val.schema) val.schema = val.db;
  if (val.tableName && !val.table) val.table = val.tableName;
  if (val.name && !val.table) val.table = val.name;
  
  if (
    typeof val.table === "string" &&
    val.table.includes(".") &&
    typeof val.schema === "undefined"
  ) {
    const parts = val.table.split(".");
    if (parts.length === 2 && parts[0] && parts[1]) {
      val.schema = parts[0];
      val.table = parts[1];
    }
  }
  return val;
});

/**
 * mysql_topological_sort input
 */
export const TopologicalSortSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema to analyze (REQUIRED)"),
  database: z.string().optional().describe("Alias for schema"),
  db: z.string().optional().describe("Alias for schema"),
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
    database: z.string().optional(),
    db: z.string().optional(),
    direction: z.enum(["create", "drop"]).optional(),
  })
  .transform(val => {
    if (val.database && !val.schema) val.schema = val.database;
    if (val.db && !val.schema) val.schema = val.db;
    return val;
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
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  schema: z.string().optional().describe("Schema name (default: public)"),
  database: z.string().optional().describe("Alias for schema"),
  db: z.string().optional().describe("Alias for schema"),
  operation: z
    .string()
    .optional()
    .describe("Operation to simulate (default: DELETE)"),
});

const CascadeSimulatorInnerSchema = z.object({
  table: z.string().default(""),
  tableName: z.string().optional(),
  name: z.string().optional(),
  schema: z.string().optional(),
  database: z.string().optional(),
  db: z.string().optional(),
  operation: z.enum(["DELETE", "DROP", "TRUNCATE"]).optional(),
});

export const CascadeSimulatorSchema = z.preprocess((input: unknown) => {
  if (typeof input === "string") return { table: input };
  return input;
}, CascadeSimulatorInnerSchema).transform(val => {
  if (val.database && !val.schema) val.schema = val.database;
  if (val.db && !val.schema) val.schema = val.db;
  if (val.tableName && !val.table) val.table = val.tableName;
  if (val.name && !val.table) val.table = val.name;

  if (
    typeof val.table === "string" &&
    val.table.includes(".") &&
    typeof val.schema === "undefined"
  ) {
    const parts = val.table.split(".");
    if (parts.length === 2 && parts[0] && parts[1]) {
      val.schema = parts[0];
      val.table = parts[1];
    }
  }
  return val;
});

/**
 * mysql_schema_snapshot input
 */
export const SchemaSnapshotSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema to snapshot (REQUIRED. Note: Pass schema, not tableName)"),
  database: z.string().optional().describe("Alias for schema"),
  db: z.string().optional().describe("Alias for schema"),
  table: z.string().optional().describe("Note: schemaSnapshot does not filter by table. Use describeTable instead."),
  tableName: z.string().optional().describe("Note: schemaSnapshot does not filter by table. Use describeTable instead."),
  includeSystem: z
    .boolean()
    .optional()
    .describe(
      "Include system schemas like mysql, information_schema (default: false)",
    ),
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
    database: z.string().optional(),
    db: z.string().optional(),
    table: z.string().optional(),
    tableName: z.string().optional(),
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
  .transform(val => {
    if (val.database && !val.schema) val.schema = val.database;
    if (val.db && !val.schema) val.schema = val.db;
    return val;
  })
  .default({ compact: true, limit: 100 });

/**
 * mysql_constraint_analysis input
 */
export const ConstraintAnalysisSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema to analyze (REQUIRED)"),
  database: z.string().optional().describe("Alias for schema"),
  db: z.string().optional().describe("Alias for schema"),
  table: z
    .string()
    .optional()
    .describe("Analyze constraints for a specific table only"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  checks: z
    .array(
      z.enum([
        "redundant",
        "missing_fk",
        "missing_not_null",
        "missing_pk",
        "unindexed_fk",
        "circular_dependency",
      ]),
    )
    .optional()
    .describe("Specific checks to run (default: all)"),
});

const ConstraintAnalysisInnerSchema = z.object({
  schema: z.string().optional(),
  database: z.string().optional(),
  db: z.string().optional(),
  table: z.string().optional(),
  tableName: z.string().optional(),
  name: z.string().optional(),
  checks: z
    .array(
      z.enum([
        "redundant",
        "missing_fk",
        "missing_not_null",
        "missing_pk",
        "unindexed_fk",
        "circular_dependency",
      ]),
    )
    .optional(),
});

export const ConstraintAnalysisSchema = z.preprocess((input: unknown) => {
  if (typeof input === "string") return { table: input };
  return input;
}, ConstraintAnalysisInnerSchema.default({})).transform(val => {
  if (val.database && !val.schema) val.schema = val.database;
  if (val.db && !val.schema) val.schema = val.db;
  if (val.tableName && !val.table) val.table = val.tableName;
  if (val.name && !val.table) val.table = val.name;

  if (
    typeof val.table === "string" &&
    val.table.includes(".") &&
    typeof val.schema === "undefined"
  ) {
    const parts = val.table.split(".");
    if (parts.length === 2 && parts[0] && parts[1]) {
      val.schema = parts[0];
      val.table = parts[1];
    }
  }
  return val;
});

/**
 * mysql_migration_risks input
 */
export const MigrationRisksSchemaBase = z.object({
  statements: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Array of DDL statements to analyze for risks"),
  statement: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe("Single DDL statement (alias for statements)"),
  sql: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for statements/statement"),
  query: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for statements/statement"),
  ddlQuery: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for statements/statement"),
  schema: z
    .string()
    .optional()
    .describe("Target schema context (default: public)"),
  database: z.string().optional().describe("Alias for schema"),
  db: z.string().optional().describe("Alias for schema"),
});

export const MigrationRisksSchema = z.object({
  statements: z.union([z.string(), z.array(z.string())]).optional(),
  statement: z.union([z.string(), z.array(z.string())]).optional(),
  sql: z.union([z.string(), z.array(z.string())]).optional(),
  query: z.union([z.string(), z.array(z.string())]).optional(),
  ddlQuery: z.union([z.string(), z.array(z.string())]).optional(),
  schema: z.string().optional(),
  database: z.string().optional(),
  db: z.string().optional(),
}).transform(val => {
  if (val.database && !val.schema) val.schema = val.database;
  if (val.db && !val.schema) val.schema = val.db;
  
  let stmts: string[] = [];
  if (Array.isArray(val.statements)) {
    stmts = val.statements;
  } else if (typeof val.statements === "string") {
    stmts = [val.statements];
  }

  const addStrings = (field: string | string[] | undefined): void => {
    if (field === undefined) return;
    if (Array.isArray(field)) {
      if (stmts.length === 0) stmts.push(...field);
    } else if (typeof field === "string") {
      if (stmts.length === 0) stmts.push(field);
    }
  };

  addStrings(val.statement);
  addStrings(val.sql);
  addStrings(val.query);
  addStrings(val.ddlQuery);

  val.statements = stmts;
  
  return val;
}).refine(val => val.statements !== undefined && val.statements.length > 0, {
  message: "statements are required",
  path: ["statements"],
});

// Output Schemas
// =============================================================================

export const DependencyGraphOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    nodes: z.array(z.record(z.string(), z.unknown())).optional(),
    edges: z.array(z.record(z.string(), z.unknown())).optional(),
    circularDependencies: z.array(z.array(z.string())).optional(),
    stats: z.record(z.string(), z.unknown()),
    hint: z.string().optional()
  }).optional()
});

export const TopologicalSortOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    order: z.array(z.record(z.string(), z.unknown())).optional(),
    direction: z.string(),
    hasCycles: z.boolean(),
  }).optional()
});

export const CascadeSimulatorOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    sourceTable: z.string(),
    operation: z.string(),
    affectedTables: z.array(z.record(z.string(), z.unknown())).optional(),
    severity: z.string(),
    stats: z.record(z.string(), z.unknown())
  }).optional()
});

export const SchemaSnapshotOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    tables: z.array(z.record(z.string(), z.unknown())).optional(),
    views: z.array(z.record(z.string(), z.unknown())).optional(),
    indexes: z.array(z.record(z.string(), z.unknown())).optional(),
    constraints: z.array(z.record(z.string(), z.unknown())).optional(),
    functions: z.array(z.record(z.string(), z.unknown())).optional(),
    triggers: z.array(z.record(z.string(), z.unknown())).optional(),
    sequences: z.array(z.record(z.string(), z.unknown())).optional(),
    types: z.array(z.record(z.string(), z.unknown())).optional(),
    extensions: z.array(z.record(z.string(), z.unknown())).optional(),
    stats: z.record(z.string(), z.unknown()).optional(),
    hint: z.string().optional()
  }).optional()
});

export const ConstraintAnalysisOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    findings: z.array(z.record(z.string(), z.unknown())).optional(),
    summary: z.object({
      totalFindings: z.number(),
      byType: z.record(z.string(), z.number()).optional(),
      bySeverity: z.record(z.string(), z.number()).optional(),
    }).optional()
  }).optional()
});

export const MigrationRisksOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    risks: z.array(z.record(z.string(), z.unknown())).optional(),
    summary: z.object({
      totalStatements: z.number(),
      totalRisks: z.number(),
      highestSeverity: z.string(),
      requiresDowntime: z.boolean(),
      estimatedLockImpact: z.string()
    }).optional()
  }).optional()
});

// =============================================================================
