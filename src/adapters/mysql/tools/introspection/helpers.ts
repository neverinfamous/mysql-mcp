/**
 * MySQL Introspection Tools - Shared Helpers
 *
 * Common types, utility functions, and shared database queries
 * used by graph analysis and schema analysis tools.
 */

import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import { ValidationError } from "../../../../types/index.js";

// =============================================================================
// Internal types
// =============================================================================

export interface FkEdge {
  constraintName: string;
  fromSchema: string;
  fromTable: string;
  fromColumns: string[];
  toSchema: string;
  toTable: string;
  toColumns: string[];
  onDelete: string;
  onUpdate: string;
}

export interface TableNode {
  schema: string;
  table: string;
  rowCount?: number;
  sizeBytes?: number;
}

// =============================================================================
// Shared queries
// =============================================================================

/**
 * Fetch all foreign key relationships across user schemas
 */
export async function fetchForeignKeys(
  adapter: MySQLAdapter,
  schemaFilter?: string,
): Promise<FkEdge[]> {
  const params: unknown[] = [];
  let schemaClause = "";
  if (schemaFilter) {
    params.push(schemaFilter);
    schemaClause = `AND tc.TABLE_SCHEMA = ?`;
  }

  // We fetch raw columns and aggregate in TypeScript to avoid JSON_ARRAYAGG compatibility issues
  const result = await adapter.executeReadQuery(
    `SELECT
      tc.CONSTRAINT_NAME as constraint_name,
      tc.TABLE_SCHEMA as from_schema,
      tc.TABLE_NAME as from_table,
      kcu.COLUMN_NAME as from_column,
      rc.UNIQUE_CONSTRAINT_SCHEMA as to_schema,
      rc.REFERENCED_TABLE_NAME as to_table,
      kcu.REFERENCED_COLUMN_NAME as to_column,
      rc.DELETE_RULE as on_delete,
      rc.UPDATE_RULE as on_update
    FROM information_schema.TABLE_CONSTRAINTS tc
    JOIN information_schema.KEY_COLUMN_USAGE kcu
      ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      AND tc.TABLE_NAME = kcu.TABLE_NAME
    JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
      ON tc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
      AND tc.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
    WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
      AND tc.TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
      ${schemaClause}
    ORDER BY tc.TABLE_SCHEMA, tc.TABLE_NAME, tc.CONSTRAINT_NAME, kcu.ORDINAL_POSITION`,
    params.length > 0 ? params : undefined,
  );

  const edgeMap = new Map<string, FkEdge>();

  for (const row of result.rows ?? []) {
    const constraintName = typeof row["constraint_name"] === "string" ? row["constraint_name"] : "";
    const fromSchema = typeof row["from_schema"] === "string" ? row["from_schema"] : "";
    const fromTable = typeof row["from_table"] === "string" ? row["from_table"] : "";
    const toSchema = typeof row["to_schema"] === "string" ? row["to_schema"] : "";
    const toTable = typeof row["to_table"] === "string" ? row["to_table"] : "";

    // Fallback schema if UNIQUE_CONSTRAINT_SCHEMA is null (sometimes happens in older MySQL versions)
    const finalToSchema = toSchema || fromSchema;

    const key = `${fromSchema}.${fromTable}.${constraintName}`;

    if (!edgeMap.has(key)) {
      edgeMap.set(key, {
        constraintName,
        fromSchema,
        fromTable,
        fromColumns: [],
        toSchema: finalToSchema,
        toTable,
        toColumns: [],
        onDelete: (typeof row["on_delete"] === "string" ? row["on_delete"] : "") || "NO ACTION",
        onUpdate: (typeof row["on_update"] === "string" ? row["on_update"] : "") || "NO ACTION",
      });
    }

    const edge = edgeMap.get(key);
    if (!edge) continue;
    if (row["from_column"] != null && typeof row["from_column"] === "string") {
      edge.fromColumns.push(row["from_column"]);
    }
    if (row["to_column"] != null && typeof row["to_column"] === "string") {
      edge.toColumns.push(row["to_column"]);
    }
  }

  return Array.from(edgeMap.values());
}

/**
 * Fetch all user tables with row counts and sizes
 */
export async function fetchTableNodes(
  adapter: MySQLAdapter,
  schemaFilter?: string,
): Promise<TableNode[]> {
  const params: unknown[] = [];
  let schemaClause = "";
  if (schemaFilter) {
    params.push(schemaFilter);
    schemaClause = `AND TABLE_SCHEMA = ?`;
  }

  const result = await adapter.executeReadQuery(
    `SELECT
      TABLE_SCHEMA as schema_name,
      TABLE_NAME as table_name,
      TABLE_ROWS as row_count,
      (DATA_LENGTH + INDEX_LENGTH) as size_bytes
    FROM information_schema.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
      AND TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
      ${schemaClause}
    ORDER BY TABLE_SCHEMA, TABLE_NAME`,
    params.length > 0 ? params : undefined,
  );

  return (result.rows ?? []).map((row) => ({
    schema: typeof row["schema_name"] === "string" ? row["schema_name"] : "",
    table: typeof row["table_name"] === "string" ? row["table_name"] : "",
    rowCount:
      typeof row["row_count"] === "number"
        ? row["row_count"]
        : parseInt(typeof row["row_count"] === "string" ? row["row_count"] : "0", 10) || 0,
    sizeBytes:
      typeof row["size_bytes"] === "number"
        ? row["size_bytes"]
        : parseInt(typeof row["size_bytes"] === "string" ? row["size_bytes"] : "0", 10) || 0,
  }));
}

// =============================================================================
// Utility functions
// =============================================================================

/**
 * Create qualified table name
 */
export function qualifiedName(schema: string, table: string): string {
  return `${schema}.${table}`;
}

/**
 * Check if a schema exists in the database.
 * Returns null if schema exists or no filter specified, or error response if nonexistent.
 */
export async function checkSchemaExists(
  adapter: MySQLAdapter,
  schemaFilter?: string,
): Promise<void> {
  if (!schemaFilter) return;
  const result = await adapter.executeReadQuery(
    `SELECT 1 FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
    [schemaFilter],
  );
  if (!result.rows || result.rows.length === 0) {
    throw new ValidationError(
      `Schema '${schemaFilter}' does not exist. Use mysql_list_schemas to see available schemas.`,
    );
  }
}

/**
 * Check if a table exists in the database.
 * Returns null if table exists or no filter specified, or error response if nonexistent.
 */
export async function checkTableExists(
  adapter: MySQLAdapter,
  tableFilter?: string,
  schemaFilter?: string,
): Promise<void> {
  if (!tableFilter) return;

  let currentSchema = schemaFilter;
  if (!currentSchema) {
    const dbRow = (await adapter.executeReadQuery("SELECT DATABASE() as db"))
      .rows?.[0];
    currentSchema = typeof dbRow?.["db"] === "string" ? dbRow["db"] : "mysql";
  }

  const result = await adapter.executeReadQuery(
    `SELECT 1 FROM information_schema.TABLES WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?`,
    [tableFilter, currentSchema],
  );
  if (!result.rows || result.rows.length === 0) {
    throw new ValidationError(
      `Table '${currentSchema}.${tableFilter}' does not exist. Use mysql_list_tables to verify.`,
    );
  }
}
