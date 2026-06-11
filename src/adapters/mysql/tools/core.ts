/**
 * MySQL Core Database Tools
 *
 * Fundamental database operations: read, write, table management, indexes.
 * 8 tools total.
 */

import type { MySQLAdapter } from "../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { ValidationError } from "../../../types/index.js";
import {
  ReadQuerySchema,
  ReadQuerySchemaBase,
  ReadQueryOutputSchema,
  WriteQuerySchema,
  WriteQuerySchemaBase,
  WriteQueryOutputSchema,
  CreateTableSchema,
  CreateTableSchemaBase,
  CreateTableOutputSchema,
  DescribeTableSchema,
  DescribeTableSchemaBase,
  DescribeTableOutputSchema,
  DropTableSchema,
  DropTableSchemaBase,
  DropTableOutputSchema,
  CreateIndexSchema,
  CreateIndexSchemaBase,
  CreateIndexOutputSchema,
  GetIndexesSchema,
  GetIndexesSchemaBase,
  GetIndexesOutputSchema,
  ListTablesSchema,
  ListTablesSchemaBase,
  ListTablesOutputSchema,
} from "../schemas/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "./core/error-helpers.js";
import { READ_ONLY, WRITE, DESTRUCTIVE } from "../../../utils/annotations.js";
import { buildProgressContext } from "../../../utils/progress-utils.js";
import { streamResultRows } from "../../../utils/stream-utils.js";
import {
  createEnableVersioningTool,
  createDisableVersioningTool,
  createCheckVersionTool,
  createConditionalUpdateTool,
} from "./core/versioning.js";

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
    createEnableVersioningTool(adapter),
    createDisableVersioningTool(adapter),
    createCheckVersionTool(adapter),
    createConditionalUpdateTool(adapter),
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
    outputSchema: ReadQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const {
          query,
          params: queryParams,
          cursor,
          transactionId,
          stream,
          chunkSize,
        } = ReadQuerySchema.parse(params);

        let finalQuery = query.replace(/[\s;]+$/g, "");
        let offset = 0;

        if (cursor) {
          try {
            const cursorData = JSON.parse(
              Buffer.from(cursor, "base64").toString("utf8"),
            ) as Record<string, unknown>;
            if (typeof cursorData["offset"] === "number") {
              offset = cursorData["offset"];
            }
          } catch {
            throw new ValidationError("Invalid cursor format", {
              suggestion: "Use the nextCursor value returned from a previous query.",
            });
          }
        }

        const upperForLimit = finalQuery.toUpperCase();
        const isLimitable =
          upperForLimit.startsWith("SELECT") ||
          upperForLimit.startsWith("WITH");

        const limit = 50;
        const hasLimit = /\bLIMIT\b/i.test(finalQuery);
        
        if (isLimitable && !hasLimit) {
          finalQuery = `${finalQuery} LIMIT ${limit}`;
          if (offset > 0) {
            finalQuery = `${finalQuery} OFFSET ${offset}`;
          }
        } else if (isLimitable && hasLimit && offset > 0) {
          if (!/\bOFFSET\b/i.test(finalQuery)) {
            finalQuery = `${finalQuery} OFFSET ${offset}`;
          }
        }

        const result = await adapter.executeReadQuery(
          finalQuery,
          queryParams,
          transactionId,
        );

        let nextCursor: string | undefined;
        if (isLimitable && !hasLimit && result.rows?.length === limit) {
          const nextOffset = offset + limit;
          nextCursor = Buffer.from(
            JSON.stringify({ offset: nextOffset }),
          ).toString("base64");
        }

        if (stream && !_context.isCodeMode) {
          const progressCtx = buildProgressContext(_context);
          if (progressCtx) {
            const chunksEmitted = await streamResultRows(
              progressCtx,
              result.rows ?? [],
              chunkSize,
            );
            return withTokenEstimate({
              success: true,
              data: {
                streamed: true,
                chunksEmitted,
                rowCount: result.rows?.length ?? 0,
                nextCursor,
                executionTimeMs: result.executionTimeMs,
              },
            });
          }
        }

        return withTokenEstimate({
          success: true,
          data: {
            rows: result.rows,
            rowCount: result.rows?.length ?? 0,
            nextCursor,
            executionTimeMs: result.executionTimeMs,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
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
    outputSchema: WriteQueryOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
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

        // Auto-detect DDL statements to clear schema cache and notify subscribers
        const upperQuery = query.trim().toUpperCase();
        if (
          upperQuery.startsWith("CREATE ") ||
          upperQuery.startsWith("DROP ") ||
          upperQuery.startsWith("ALTER ") ||
          upperQuery.startsWith("RENAME ") ||
          upperQuery.startsWith("TRUNCATE ")
        ) {
          adapter.clearSchemaCache();
        }

        return withTokenEstimate({
          success: true,
          data: {
            rowsAffected: result.rowsAffected,
            lastInsertId: result.lastInsertId?.toString(),
            executionTimeMs: result.executionTimeMs,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
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
    inputSchema: ListTablesSchemaBase,
    outputSchema: ListTablesOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { database, limit } = ListTablesSchema.parse(params);

        // P154: Pre-check database existence when explicitly provided
        if (database) {
          const dbCheck = await adapter.executeReadQuery(
            `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
            [database],
          );
          if (!dbCheck.rows || dbCheck.rows.length === 0) {
            return withTokenEstimate({
              success: false,
              error: `Database '${database}' does not exist`,
            });
          }
        }

        let tables = await adapter.listTables(database);
        let truncated = false;
        if (limit !== undefined && tables.length > limit) {
          tables = tables.slice(0, limit);
          truncated = true;
        }

        return withTokenEstimate({
          success: true,
          data: {
            tables: tables.map((t) => ({
              name: t.name,
              type: t.type,
              ...(t.engine != null ? { engine: t.engine } : {}),
              ...(t.rowCount != null ? { rowCount: t.rowCount } : {}),
              ...(t.comment != null && t.comment !== ""
                ? { comment: t.comment }
                : {}),
            })),
            count: tables.length,
            ...(truncated ? { truncated: true } : {}),
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
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
    outputSchema: DescribeTableOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table } = DescribeTableSchema.parse(params);
        const tableInfo = await adapter.describeTable(table);
        // Graceful handling for non-existent tables
        if (!tableInfo.columns || tableInfo.columns.length === 0) {
          return withTokenEstimate({
            success: false,
            error: `Table '${table}' does not exist or has no columns`,
          });
        }
        // Sanitize to reduce token bloat
        const sanitizedColumns = tableInfo.columns?.map((c) => {
          const {
            comment,
            characterSet,
            collation,
            defaultValue,
            autoIncrement,
            ...rest
          } = c;
          return {
            ...rest,
            ...(comment != null && comment !== "" ? { comment } : {}),
            ...(characterSet != null ? { characterSet } : {}),
            ...(collation != null ? { collation } : {}),
            ...(defaultValue !== null ? { defaultValue } : {}),
            ...(autoIncrement === true ? { autoIncrement } : {}),
          };
        });

        const {
          comment: tableComment,
          collation: tableCollation,
          ...restInfo
        } = tableInfo;
        const sanitizedInfo = {
          ...restInfo,
          columns: sanitizedColumns,
          ...(tableComment != null && tableComment !== ""
            ? { comment: tableComment }
            : {}),
          ...(tableCollation != null && tableCollation !== ""
            ? { collation: tableCollation }
            : {}),
        };

        return withTokenEstimate({
          success: true,
          data: { ...sanitizedInfo, exists: true },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
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
    outputSchema: CreateTableOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const {
          name,
          columns,
          engine,
          charset,
          collate,
          comment,
          ifNotExists,
        } = CreateTableSchema.parse(params);

        // Pre-check existence for skipped indicator when ifNotExists is true
        if (ifNotExists) {
          const checkName = name.includes(".")
            ? (name.split(".")[1] ?? name)
            : name;
          const tableInfo = await adapter.describeTable(checkName);
          if (tableInfo.columns && tableInfo.columns.length > 0) {
            return withTokenEstimate({
              success: true,
              data: {
                skipped: true,
                tableName: name,
                reason: "Table already exists",
              },
            });
          }
        }

        // Build column definitions
        const columnDefs = (columns ?? []).map((col) => {
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
        const pkCols = (columns ?? [])
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
            return withTokenEstimate({
              success: false,
              error: `Table '${name}' already exists`,
            });
          }
          return formatHandlerErrorResponse(err);
        }

        adapter.clearSchemaCache();
        return withTokenEstimate({ success: true, data: { tableName: name } });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
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
    outputSchema: DropTableOutputSchema,
    requiredScopes: ["admin"],
    annotations: DESTRUCTIVE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, ifExists } = DropTableSchema.parse(params);

        // Validate table name
        if (!isValidId(table)) {
          return withTokenEstimate({
            success: false,
            error: "Invalid table name",
          });
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
          await adapter.executeQuery(
            `DROP TABLE ${ifExistsClause}${tableName}`,
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("Unknown table")) {
            return withTokenEstimate({
              success: false,
              error: `Table '${table}' does not exist`,
            });
          }
          return formatHandlerErrorResponse(err);
        }

        adapter.clearSchemaCache();

        if (tableAbsent) {
          return withTokenEstimate({
            success: true,
            data: {
              skipped: true,
              tableName: table,
              reason: "Table did not exist",
            },
          });
        }

        return withTokenEstimate({ success: true, data: { tableName: table } });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
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
    outputSchema: GetIndexesOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table } = GetIndexesSchema.parse(params);
        // First check if table exists by describing it
        const tableInfo = await adapter.describeTable(table);
        if (!tableInfo.columns || tableInfo.columns.length === 0) {
          return withTokenEstimate({
            success: false,
            error: `Table '${table}' does not exist`,
          });
        }
        const indexes = await adapter.getTableIndexes(table);
        return withTokenEstimate({
          success: true,
          data: { exists: true, indexes },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
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
    outputSchema: CreateIndexOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { name, table, columns, unique, type, ifNotExists } =
          CreateIndexSchema.parse(params);

        // Validate names
        if (!name || !VALID_INDEX_NAME_PATTERN.test(name)) {
          return withTokenEstimate({
            success: false,
            error: "Invalid index name",
          });
        }
        if (!isValidId(table)) {
          return withTokenEstimate({
            success: false,
            error: "Invalid table name",
          });
        }

        const columnList = (columns ?? []).map((c) => `\`${c}\``).join(", ");
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
            return withTokenEstimate({
              success: true,
              data: {
                skipped: true,
                indexName: name,
                reason: "Index already exists",
              },
            });
          }
        }

        try {
          await adapter.executeQuery(
            `CREATE ${uniqueClause}${prefixClause}INDEX \`${name}\` ON ${tableName} (${columnList})${usingClause}`,
          );
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("Duplicate key name")) {
            return withTokenEstimate({
              success: false,
              error: `Index '${name}' already exists on table '${table}'`,
            });
          }
          // Distinguish column errors from table errors
          if (message.includes("Key column")) {
            const colMatch = /Key column '([^']+)'/.exec(message);
            return withTokenEstimate({
              success: false,
              error: colMatch
                ? `Column '${colMatch[1]}' does not exist in table '${table}'`
                : `Column does not exist in table '${table}'`,
            });
          }
          if (message.includes("doesn't exist")) {
            return withTokenEstimate({
              success: false,
              error: `Table '${table}' does not exist`,
            });
          }
          return formatHandlerErrorResponse(err);
        }

        adapter.clearSchemaCache();

        // Warn if HASH was requested on a non-MEMORY engine (InnoDB silently converts to BTREE)
        if (type === "HASH") {
          return withTokenEstimate({
            success: true,
            data: {
              indexName: name,
              warning:
                "HASH indexes are only supported by the MEMORY engine. InnoDB silently converts HASH to BTREE.",
            },
          });
        }

        return withTokenEstimate({ success: true, data: { indexName: name } });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
