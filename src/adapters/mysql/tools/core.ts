/**
 * MySQL Core Database Tools
 *
 * Fundamental database operations: read, write, table management, indexes.
 * 8 tools total.
 */

import type { MySQLAdapter } from "../MySQLAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import {
  ReadQuerySchema,
  ReadQuerySchemaBase,
  WriteQuerySchema,
  WriteQuerySchemaBase,
  CreateTableSchema,
  CreateTableSchemaBase,
  DescribeTableSchema,
  DescribeTableSchemaBase,
  DropTableSchema,
  DropTableSchemaBase,
  CreateIndexSchema,
  CreateIndexSchemaBase,
  GetIndexesSchema,
  GetIndexesSchemaBase,
  ListTablesSchema,
} from "../types.js";
import { ZodError } from "zod";

/**
 * Extract human-readable messages from a ZodError instead of raw JSON array
 */
function formatZodError(error: ZodError): string {
  return error.issues.map((i) => i.message).join("; ");
}

/**
 * Pre-compiled identifier validation patterns (hoisted for performance)
 */
const VALID_ID_PATTERN = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)?$/;
const VALID_INDEX_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Helper to escape table/schema identifiers
 * Handles "table" -> "`table`" and "db.table" -> "`db`.`table`"
 */
function escapeId(id: string): string {
  return id
    .split(".")
    .map((part) => `\`${part}\``)
    .join(".");
}

/**
 * Helper to validate table/schema identifiers
 * Allows "table" and "db.table" formats
 */
function isValidId(id: string): boolean {
  return VALID_ID_PATTERN.test(id);
}

/**
 * Get all core database tools
 */
export function getCoreTools(adapter: MySQLAdapter): ToolDefinition[] {
  return [
    createReadQueryTool(adapter),
    createWriteQueryTool(adapter),
    createListTablesTool(adapter),
    createDescribeTableTool(adapter),
    createCreateTableTool(adapter),
    createDropTableTool(adapter),
    createGetIndexesTool(adapter),
    createCreateIndexTool(adapter),
  ];
}

/**
 * Execute a read-only SQL query
 */
function createReadQueryTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_read_query",
    title: "MySQL Read Query",
    description:
      "Execute a read-only SQL query (SELECT). Uses prepared statements for safety.",
    group: "core",
    inputSchema: ReadQuerySchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      let parsed;
      try {
        parsed = ReadQuerySchema.parse(params);
      } catch (err: unknown) {
        if (err instanceof ZodError)
          return { success: false, error: formatZodError(err) };
        throw err;
      }
      const { query, params: queryParams, transactionId } = parsed;
      try {
        const result = await adapter.executeReadQuery(
          query,
          queryParams,
          transactionId,
        );
        return {
          rows: result.rows,
          rowCount: result.rows?.length ?? 0,
          executionTimeMs: result.executionTimeMs,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message.replace(/^.*?:\s*/, "") };
      }
    },
  };
}

/**
 * Execute a write SQL query
 */
function createWriteQueryTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_write_query",
    title: "MySQL Write Query",
    description:
      "Execute a write SQL query (INSERT, UPDATE, DELETE). Uses prepared statements for safety.",
    group: "core",
    inputSchema: WriteQuerySchemaBase,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      let parsed;
      try {
        parsed = WriteQuerySchema.parse(params);
      } catch (err: unknown) {
        if (err instanceof ZodError)
          return { success: false, error: formatZodError(err) };
        throw err;
      }
      const { query, params: queryParams, transactionId } = parsed;
      try {
        const result = await adapter.executeWriteQuery(
          query,
          queryParams,
          transactionId,
        );
        return {
          rowsAffected: result.rowsAffected,
          lastInsertId: result.lastInsertId?.toString(),
          executionTimeMs: result.executionTimeMs,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message.replace(/^.*?:\s*/, "") };
      }
    },
  };
}

/**
 * List all tables in the database
 */
function createListTablesTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_list_tables",
    title: "MySQL List Tables",
    description: "List all tables and views in the database with metadata.",
    group: "core",
    inputSchema: ListTablesSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      let parsed;
      try {
        parsed = ListTablesSchema.parse(params);
      } catch (err: unknown) {
        if (err instanceof ZodError)
          return { success: false, error: formatZodError(err) };
        throw err;
      }
      const { database } = parsed;

      // P154: Pre-check database existence when explicitly provided
      if (database) {
        const dbCheck = await adapter.executeReadQuery(
          `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
          [database],
        );
        if (!dbCheck.rows || dbCheck.rows.length === 0) {
          return {
            exists: false,
            database,
            message: `Database '${database}' does not exist`,
          };
        }
      }

      try {
        const tables = await adapter.listTables(database);
        return {
          tables: tables.map((t) => ({
            name: t.name,
            type: t.type,
            engine: t.engine,
            rowCount: t.rowCount,
            comment: t.comment,
          })),
          count: tables.length,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
      }
    },
  };
}

/**
 * Describe a table's structure
 */
function createDescribeTableTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_describe_table",
    title: "MySQL Describe Table",
    description:
      "Get detailed information about a table's structure including columns, types, and constraints.",
    group: "core",
    inputSchema: DescribeTableSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      let parsed;
      try {
        parsed = DescribeTableSchema.parse(params);
      } catch (err: unknown) {
        if (err instanceof ZodError)
          return { success: false, error: formatZodError(err) };
        throw err;
      }
      const { table } = parsed;
      const tableInfo = await adapter.describeTable(table);
      // Graceful handling for non-existent tables
      if (!tableInfo.columns || tableInfo.columns.length === 0) {
        return {
          exists: false,
          table,
          message: `Table '${table}' does not exist or has no columns`,
        };
      }
      return { ...tableInfo, exists: true };
    },
  };
}

/**
 * Create a new table
 */
function createCreateTableTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_create_table",
    title: "MySQL Create Table",
    description:
      "Create a new table with specified columns, engine, and charset.",
    group: "core",
    inputSchema: CreateTableSchemaBase,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      let parsed;
      try {
        parsed = CreateTableSchema.parse(params);
      } catch (err: unknown) {
        if (err instanceof ZodError)
          return { success: false, error: formatZodError(err) };
        throw err;
      }
      const { name, columns, engine, charset, collate, comment, ifNotExists } =
        parsed;

      // Pre-check existence for skipped indicator when ifNotExists is true
      if (ifNotExists) {
        const checkName = name.includes(".")
          ? (name.split(".")[1] ?? name)
          : name;
        const tableInfo = await adapter.describeTable(checkName);
        if (tableInfo.columns && tableInfo.columns.length > 0) {
          return {
            success: true,
            skipped: true,
            tableName: name,
            reason: "Table already exists",
          };
        }
      }

      // Build column definitions
      const columnDefs = columns.map((col) => {
        let def = `\`${col.name}\` ${col.type}`;

        if (!col.nullable) {
          def += " NOT NULL";
        }
        if (col.autoIncrement) {
          def += " AUTO_INCREMENT";
        }
        if (col.default !== undefined) {
          let defaultVal = col.default as string | number | boolean | null;
          // Convert boolean true/false to 1/0 for MySQL compatibility
          if (typeof defaultVal === "boolean") {
            defaultVal = defaultVal ? 1 : 0;
          }
          // Check if default is a SQL function/expression that should not be quoted
          const defaultValue = String(defaultVal).toUpperCase().trim();
          const sqlFunctions = [
            "CURRENT_TIMESTAMP",
            "CURRENT_DATE",
            "CURRENT_TIME",
            "NOW()",
            "UUID()",
            "NULL",
          ];
          const isSqlFunction =
            sqlFunctions.some((fn) => defaultValue.startsWith(fn)) ||
            /^[A-Z_]+\(.*\)$/.test(defaultValue); // Matches FUNCTION(...) pattern

          if (isSqlFunction || typeof defaultVal === "number") {
            def += ` DEFAULT ${String(defaultVal)}`;
          } else {
            def += ` DEFAULT '${String(defaultVal).replace(/'/g, "''")}'`;
          }
        }
        if (col.unique) {
          def += " UNIQUE";
        }
        if (col.comment) {
          def += ` COMMENT '${col.comment.replace(/'/g, "''")}'`;
        }

        return def;
      });

      // Add primary key
      const pkCols = columns
        .filter((c) => c.primaryKey)
        .map((c) => `\`${c.name}\``);
      if (pkCols.length > 0) {
        columnDefs.push(`PRIMARY KEY (${pkCols.join(", ")})`);
      }

      // Build SQL
      const ifNotExistsClause = ifNotExists ? "IF NOT EXISTS " : "";
      // Handle qualified names (e.g. schema.table)
      const tableName = escapeId(name);
      let sql = `CREATE TABLE ${ifNotExistsClause}${tableName} (\n  ${columnDefs.join(",\n  ")}\n)`;
      sql += ` ENGINE=${engine}`;
      sql += ` DEFAULT CHARSET=${charset}`;
      sql += ` COLLATE=${collate}`;

      if (comment) {
        sql += ` COMMENT='${comment.replace(/'/g, "''")}'`;
      }

      // If schema-qualified name, switch to that database first
      if (name.includes(".")) {
        const [schemaName] = name.split(".");
        await adapter.executeQuery(`USE \`${schemaName}\``);
      }

      try {
        await adapter.executeQuery(sql);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("already exists")) {
          return {
            success: false,
            error: `Table '${name}' already exists`,
          };
        }
        return { success: false, error: message };
      }

      adapter.clearSchemaCache();
      return { success: true, tableName: name };
    },
  };
}

/**
 * Drop a table
 */
function createDropTableTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_drop_table",
    title: "MySQL Drop Table",
    description: "Drop (delete) a table from the database.",
    group: "core",
    inputSchema: DropTableSchemaBase,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      let parsed;
      try {
        parsed = DropTableSchema.parse(params);
      } catch (err: unknown) {
        if (err instanceof ZodError)
          return { success: false, error: formatZodError(err) };
        throw err;
      }
      const { table, ifExists } = parsed;

      // Validate table name
      if (!isValidId(table)) {
        return { success: false, error: "Invalid table name" };
      }

      // Pre-check existence for skipped indicator when ifExists is true
      let tableAbsent = false;
      if (ifExists) {
        const tableInfo = await adapter.describeTable(table);
        if (!tableInfo.columns || tableInfo.columns.length === 0) {
          tableAbsent = true;
        }
      }

      const ifExistsClause = ifExists ? "IF EXISTS " : "";
      const tableName = escapeId(table);

      try {
        await adapter.executeQuery(`DROP TABLE ${ifExistsClause}${tableName}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Unknown table")) {
          return {
            success: false,
            error: `Table '${table}' does not exist`,
          };
        }
        return { success: false, error: message };
      }

      adapter.clearSchemaCache();

      if (tableAbsent) {
        return {
          success: true,
          skipped: true,
          tableName: table,
          reason: "Table did not exist",
        };
      }

      return { success: true, tableName: table };
    },
  };
}

/**
 * Get indexes for a table
 */
function createGetIndexesTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_get_indexes",
    title: "MySQL Get Indexes",
    description:
      "Get all indexes for a table including type, columns, and cardinality.",
    group: "core",
    inputSchema: GetIndexesSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      let parsed;
      try {
        parsed = GetIndexesSchema.parse(params);
      } catch (err: unknown) {
        if (err instanceof ZodError)
          return { success: false, error: formatZodError(err) };
        throw err;
      }
      const { table } = parsed;
      // First check if table exists by describing it
      const tableInfo = await adapter.describeTable(table);
      if (!tableInfo.columns || tableInfo.columns.length === 0) {
        return {
          exists: false,
          table,
          indexes: [],
          message: `Table '${table}' does not exist`,
        };
      }
      const indexes = await adapter.getTableIndexes(table);
      return { exists: true, indexes };
    },
  };
}

/**
 * Create an index
 */
function createCreateIndexTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_create_index",
    title: "MySQL Create Index",
    description:
      "Create an index on a table. Supports BTREE, HASH, FULLTEXT, and SPATIAL index types.",
    group: "core",
    inputSchema: CreateIndexSchemaBase,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      let parsed;
      try {
        parsed = CreateIndexSchema.parse(params);
      } catch (err: unknown) {
        if (err instanceof ZodError)
          return { success: false, error: formatZodError(err) };
        throw err;
      }
      const { name, table, columns, unique, type, ifNotExists } = parsed;

      // Validate names
      if (!VALID_INDEX_NAME_PATTERN.test(name)) {
        return { success: false, error: "Invalid index name" };
      }
      if (!isValidId(table)) {
        return { success: false, error: "Invalid table name" };
      }

      const columnList = columns.map((c) => `\`${c}\``).join(", ");
      const tableName = escapeId(table);

      // FULLTEXT and SPATIAL are index type prefixes (CREATE FULLTEXT INDEX ...)
      // BTREE and HASH use the USING clause (... USING BTREE)
      const isPrefixType = type === "FULLTEXT" || type === "SPATIAL";
      const prefixClause = isPrefixType ? `${type} ` : "";
      const uniqueClause = !isPrefixType && unique ? "UNIQUE " : "";
      const usingClause = type && !isPrefixType ? ` USING ${type}` : "";

      // Note: IF NOT EXISTS not supported for indexes in MySQL
      // We'll check if it exists first
      if (ifNotExists) {
        const existing = await adapter.getTableIndexes(table); // Pass original unescaped name to getTableIndexes (it expects string)
        if (existing.some((idx) => idx.name === name)) {
          return {
            success: true,
            skipped: true,
            indexName: name,
            reason: "Index already exists",
          };
        }
      }

      try {
        await adapter.executeQuery(
          `CREATE ${uniqueClause}${prefixClause}INDEX \`${name}\` ON ${tableName} (${columnList})${usingClause}`,
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("Duplicate key name")) {
          return {
            success: false,
            error: `Index '${name}' already exists on table '${table}'`,
          };
        }
        // Distinguish column errors from table errors
        if (message.includes("Key column")) {
          const colMatch = /Key column '([^']+)'/.exec(message);
          return {
            success: false,
            error: colMatch
              ? `Column '${colMatch[1]}' does not exist in table '${table}'`
              : `Column does not exist in table '${table}'`,
          };
        }
        if (message.includes("doesn't exist")) {
          return { exists: false, table };
        }
        return { success: false, error: message };
      }

      adapter.clearSchemaCache();

      // Warn if HASH was requested on a non-MEMORY engine (InnoDB silently converts to BTREE)
      if (type === "HASH") {
        return {
          success: true,
          indexName: name,
          warning:
            "HASH indexes are only supported by the MEMORY engine. InnoDB silently converts HASH to BTREE.",
        };
      }

      return { success: true, indexName: name };
    },
  };
}
