import {
  CreateIndexSchema,
  CreateIndexSchemaBase,
  CreateIndexOutputSchema,
  GetIndexesSchema,
  GetIndexesSchemaBase,
  GetIndexesOutputSchema,
} from "../../schemas/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "./error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { READ_ONLY, WRITE } from "../../../../utils/annotations.js";
import { isValidId, escapeId } from "./tables.js";

const VALID_INDEX_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function createGetIndexesTool(adapter: MySQLAdapter): ToolDefinition {
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

export function createCreateIndexTool(adapter: MySQLAdapter): ToolDefinition {
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

        const isPrefixType = type === "FULLTEXT" || type === "SPATIAL";
        const prefixClause = isPrefixType ? `${type} ` : "";
        const uniqueClause = !isPrefixType && unique ? "UNIQUE " : "";
        const usingClause = type && !isPrefixType ? ` USING ${type}` : "";

        if (ifNotExists) {
          const existing = await adapter.getTableIndexes(table);
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
