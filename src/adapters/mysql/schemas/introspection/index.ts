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
  tables: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for table. Anti-Hallucination: This tool only supports filtering by a single table at a time."),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
});

export const DependencyGraphSchema = z.object({
  schema: z.string().default(""),
  database: z.string().optional(),
  db: z.string().optional(),
  table: z.string().optional(),
  tables: z.union([z.string(), z.array(z.string())]).optional(),
  tableName: z.string().optional(),
  name: z.string().optional(),
  includeRowCounts: z.preprocess((val) => {
    if (typeof val === "string") return val.toLowerCase() === "true";
    return val;
  }, z.boolean().optional()),
  compact: z.preprocess((val) => {
    if (typeof val === "string") return val.toLowerCase() === "true";
    return val;
  }, z.boolean().optional()),
  limit: z.preprocess((val) => {
    if (typeof val === "string") return parseInt(val, 10);
    return val;
  }, z.number().min(1).max(500).optional().default(100)),
  maxDepth: z
    .preprocess((val) => {
      if (typeof val === "string") return parseInt(val, 10);
      return val;
    }, z.number().min(0).optional())
    .optional(),
}).transform(val => {
  if (val.database && !val.schema) val.schema = val.database;
  if (val.db && !val.schema) val.schema = val.db;
  
  let targetTable = val.table ?? val.tableName ?? val.name;
  if (targetTable === undefined && val.tables !== undefined) {
    targetTable = Array.isArray(val.tables) ? val.tables[0] : val.tables;
  }
  if (targetTable !== undefined) val.table = targetTable;
  
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
}).refine(val => val.schema !== undefined && val.schema.trim().length > 0, {
  message: "schema parameter is required (e.g., { schema: 'my_database' })",
  path: ["schema"],
}).refine(val => !(Array.isArray(val.tables) && val.tables.length > 1), {
  message: "This tool only supports filtering by a single table at a time. Do not pass an array of multiple tables.",
  path: ["tables"],
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
  table: z.string().optional().describe("Anti-Hallucination: Topological sort operates on the entire schema. Do not provide a table."),
  tables: z.union([z.string(), z.array(z.string())]).optional().describe("Anti-Hallucination: Topological sort operates on the entire schema. Do not provide a list of tables."),
});

export const TopologicalSortSchema = z
  .object({
    schema: z.string().optional(),
    database: z.string().optional(),
    db: z.string().optional(),
    direction: z.preprocess((val) => {
      if (typeof val === "string") return val.toLowerCase();
      return val;
    }, z.enum(["create", "drop"]).optional()),
    table: z.any().optional(),
    tables: z.any().optional(),
  })
  .transform(val => {
    if (val.database && !val.schema) val.schema = val.database;
    if (val.db && !val.schema) val.schema = val.db;
    return val;
  })
  .refine(val => val.schema !== undefined && val.schema.trim().length > 0, {
    message: "schema parameter is required (e.g., { schema: 'my_database' })",
    path: ["schema"],
  })
  .refine(val => val.table === undefined && val.tables === undefined, {
    message: "Topological sort operates on the entire schema. Do not provide a table parameter.",
    path: ["table"],
  });

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
  action: z.string().optional().describe("Alias for operation"),
  where: z.string().optional().describe("Anti-Hallucination: Cascade simulator operates on the schema level. Do not provide a WHERE clause."),
  condition: z.string().optional().describe("Anti-Hallucination: Cascade simulator operates on the schema level. Do not provide a condition."),
});

const CascadeSimulatorInnerSchema = z.object({
  table: z.string().default(""),
  tableName: z.string().optional(),
  name: z.string().optional(),
  schema: z.string().optional(),
  database: z.string().optional(),
  db: z.string().optional(),
  operation: z.preprocess((val) => {
    if (typeof val === "string") return val.toUpperCase();
    return val;
  }, z.enum(["DELETE", "DROP", "TRUNCATE"]).optional()),
  action: z.preprocess((val) => {
    if (typeof val === "string") return val.toUpperCase();
    return val;
  }, z.enum(["DELETE", "DROP", "TRUNCATE"]).optional()),
  where: z.any().optional(),
  condition: z.any().optional(),
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
  if (val.action && !val.operation) val.operation = val.action;
  return val;
}).refine(val => val.table !== undefined && val.table.trim().length > 0, {
  message: "table parameter is required",
  path: ["table"],
}).refine(val => val.where === undefined && val.condition === undefined, {
  message: "Cascade simulator operates on the schema level to trace foreign key paths. Do not provide a WHERE clause or condition.",
  path: ["where"],
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
  table: z.string().optional().describe("Note: schemaSnapshot does not filter by table. Use mysql_describe_table instead."),
  tableName: z.string().optional().describe("Note: schemaSnapshot does not filter by table. Use mysql_describe_table instead."),
  includeSystem: z
    .boolean()
    .optional()
    .describe(
      "Include system schemas like mysql, information_schema (default: false)",
    ),
  sections: z
    .union([z.string(), z.array(z.string())])
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
    includeSystem: z.preprocess((val) => {
      if (typeof val === "string") return val.toLowerCase() === "true";
      return val;
    }, z.boolean().optional()),
    sections: z.preprocess(
      (val) => {
        if (typeof val === "string") return val.split(",").map((s) => s.trim());
        return val;
      },
      z.array(
        z.enum([
          "tables",
          "views",
          "indexes",
          "constraints",
          "functions",
          "triggers",
        ]),
      )
      .optional()
    ),
    compact: z.preprocess((val) => {
      if (typeof val === "string") return val.toLowerCase() === "true";
      return val;
    }, z.boolean().optional().default(true)),
    limit: z.preprocess((val) => {
      if (typeof val === "string") return parseInt(val, 10);
      return val;
    }, z.number().min(1).max(500).optional().default(100)),
  })
  .transform(val => {
    if (val.database && !val.schema) val.schema = val.database;
    if (val.db && !val.schema) val.schema = val.db;
    return val;
  })
  .refine(val => val.schema !== undefined && val.schema.trim().length > 0, {
    message: "schema parameter is required",
    path: ["schema"],
  })
  .refine(val => val.table === undefined && val.tableName === undefined, {
    message: "mysql_schema_snapshot does not support filtering by table. Please use mysql_describe_table instead to inspect a specific table.",
    path: ["table"],
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
  tables: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for table. Anti-Hallucination: This tool only supports filtering by a single table at a time."),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  checks: z
    .array(
      z.enum([
        "missing_not_null",
        "missing_pk",
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
  tables: z.union([z.string(), z.array(z.string())]).optional(),
  tableName: z.string().optional(),
  name: z.string().optional(),
  checks: z
    .array(
      z.enum([
        "missing_not_null",
        "missing_pk",
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

  let targetTable = val.table ?? val.tableName ?? val.name;
  if (targetTable === undefined && val.tables !== undefined) {
    targetTable = Array.isArray(val.tables) ? val.tables[0] : val.tables;
  }
  if (targetTable !== undefined) val.table = targetTable;

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
}).refine(val => val.schema !== undefined && val.schema.trim().length > 0, {
  message: "schema parameter is required (e.g., { schema: 'my_database' })",
  path: ["schema"],
}).refine(val => !(Array.isArray(val.tables) && val.tables.length > 1), {
  message: "This tool only supports filtering by a single table at a time. Do not pass an array of multiple tables.",
  path: ["tables"],
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
  queries: z.union([z.string(), z.array(z.string())]).optional().describe("Alias for statements/statement"),
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
  queries: z.union([z.string(), z.array(z.string())]).optional(),
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
  addStrings(val.queries);
  addStrings(val.ddlQuery);

  val.statements = stmts.map(s => s.trim()).filter(s => s.length > 0);
  
  return val;
}).refine(val => val.statements !== undefined && val.statements.length > 0, {
  message: "statements are required and cannot be empty",
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
