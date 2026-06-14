import {
  ListTablesSchema,
  ListTablesSchemaBase,
  ListTablesOutputSchema,
  DescribeTableSchema,
  DescribeTableSchemaBase,
  DescribeTableOutputSchema,
  CreateTableSchema,
  CreateTableSchemaBase,
  CreateTableOutputSchema,
  DropTableSchema,
  DropTableSchemaBase,
  DropTableOutputSchema,
} from "../../schemas/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "./error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { MySQLMcpError } from "../../../../types/modules/errors.js";
import { ErrorCategory } from "../../../../types/modules/error-types.js";
import { READ_ONLY, WRITE, DESTRUCTIVE } from "../../../../utils/annotations.js";

const VALID_ID_PATTERN = /^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)?$/;

export function escapeId(id: string): string {
  return id
    .split(".")
    .map((part) => `\`${part}\``)
    .join(".");
}

export function isValidId(id: string): boolean {
  return VALID_ID_PATTERN.test(id);
}

export function createListTablesTool(adapter: MySQLAdapter): ToolDefinition {
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

        if (database) {
          const dbCheck = await adapter.executeReadQuery(
            `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
            [database],
          );
          if (!dbCheck.rows || dbCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(`Database '${database}' does not exist`, "DATABASE_NOT_FOUND", ErrorCategory.RESOURCE)
            );
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

export function createDescribeTableTool(adapter: MySQLAdapter): ToolDefinition {
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
        if (!tableInfo.columns || tableInfo.columns.length === 0) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(`Table '${table}' does not exist or has no columns`, "TABLE_NOT_FOUND", ErrorCategory.RESOURCE)
          );
        }
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

export function createCreateTableTool(adapter: MySQLAdapter): ToolDefinition {
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
            if (typeof defaultVal === "boolean") {
              defaultVal = defaultVal ? 1 : 0;
            }
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
              /^[A-Z_]+\(.*\)$/.test(defaultValue);

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

        const pkCols = (columns ?? [])
          .filter((c) => c.primaryKey)
          .map((c) => `\`${c.name}\``);
        if (pkCols.length > 0) {
          columnDefs.push(`PRIMARY KEY (${pkCols.join(", ")})`);
        }

        const ifNotExistsClause = ifNotExists ? "IF NOT EXISTS " : "";
        const tableName = escapeId(name);
        let sql = `CREATE TABLE ${ifNotExistsClause}${tableName} (\n  ${columnDefs.join(",\n  ")}\n)`;
        sql += ` ENGINE=${engine}`;
        sql += ` DEFAULT CHARSET=${charset}`;
        sql += ` COLLATE=${collate}`;

        if (comment) {
          sql += ` COMMENT='${comment.replace(/'/g, "''")}'`;
        }

        if (name.includes(".")) {
          const [schemaName] = name.split(".");
          await adapter.executeQuery(`USE \`${schemaName}\``);
        }

        try {
          await adapter.executeQuery(sql);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("already exists")) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(`Table '${name}' already exists`, "TABLE_EXISTS", ErrorCategory.RESOURCE)
            );
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

export function createDropTableTool(adapter: MySQLAdapter): ToolDefinition {
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

        if (!isValidId(table)) {
          return formatHandlerErrorResponse(
            new MySQLMcpError("Invalid table name", "VALIDATION_ERROR", ErrorCategory.VALIDATION)
          );
        }

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
            return formatHandlerErrorResponse(
              new MySQLMcpError(`Table '${table}' does not exist`, "TABLE_NOT_FOUND", ErrorCategory.RESOURCE)
            );
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
