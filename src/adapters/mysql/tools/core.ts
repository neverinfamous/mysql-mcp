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
  WriteQuerySchema,
  CreateTableSchema,
  DescribeTableSchema,
  DropTableSchema,
  CreateIndexSchema,
  GetIndexesSchema,
  ListTablesSchema,
} from "../types.js";

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
    inputSchema: ReadQuerySchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const {
        query,
        params: queryParams,
        transactionId,
      } = ReadQuerySchema.parse(params);
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
    inputSchema: WriteQuerySchema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const {
        query,
        params: queryParams,
        transactionId,
      } = WriteQuerySchema.parse(params);
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
      const { database } = ListTablesSchema.parse(params);
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
    inputSchema: DescribeTableSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table } = DescribeTableSchema.parse(params);
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
    inputSchema: CreateTableSchema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { name, columns, engine, charset, collate, comment, ifNotExists } =
        CreateTableSchema.parse(params);

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

      await adapter.executeQuery(sql);

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
    inputSchema: DropTableSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, ifExists } = DropTableSchema.parse(params);

      // Validate table name
      if (!isValidId(table)) {
        throw new Error("Invalid table name");
      }

      const ifExistsClause = ifExists ? "IF EXISTS " : "";
      const tableName = escapeId(table);
      await adapter.executeQuery(`DROP TABLE ${ifExistsClause}${tableName}`);

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
    inputSchema: GetIndexesSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table } = GetIndexesSchema.parse(params);
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
    inputSchema: CreateIndexSchema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { name, table, columns, unique, type, ifNotExists } =
        CreateIndexSchema.parse(params);

      // Validate names
      if (!VALID_INDEX_NAME_PATTERN.test(name)) {
        // Index names usually don't have schema prefix
        throw new Error("Invalid index name");
      }
      if (!isValidId(table)) {
        throw new Error("Invalid table name");
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

      await adapter.executeQuery(
        `CREATE ${uniqueClause}${prefixClause}INDEX \`${name}\` ON ${tableName} (${columnList})${usingClause}`,
      );

      return { success: true, indexName: name };
    },
  };
}
