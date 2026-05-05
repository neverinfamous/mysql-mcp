/**
 * MySQL Introspection Tools - Schema Snapshot
 *
 * Complete schema snapshot in a single agent-optimized JSON structure.
 * 1 tool total.
 */

import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";
import { checkSchemaExists } from "./helpers.js";
import {
  SchemaSnapshotSchemaBase,
  SchemaSnapshotSchema,
} from "../../schemas/index.js";
import { READ_ONLY } from "../../../../utils/annotations.js";


// =============================================================================
// mysql_schema_snapshot
// =============================================================================

export function createSchemaSnapshotTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_schema_snapshot",
    description:
      "Get a complete schema snapshot in a single agent-optimized JSON structure. Includes tables, columns, constraints, indexes, views, routines, and triggers.",
    group: "introspection",
    inputSchema: SchemaSnapshotSchemaBase,
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = SchemaSnapshotSchema.parse(params);

        // Validate schema existence when filtering by schema
        await checkSchemaExists(adapter, parsed.schema);

        const includeAll = !parsed.sections || parsed.sections.length === 0;
        const sections = new Set(parsed.sections ?? []);

        const snapshot: Record<string, unknown> = {};
        const stats = {
          tables: 0,
          views: 0,
          indexes: 0,
          constraints: 0,
          functions: 0,
          triggers: 0,
        };

        const schemaExclude = parsed.includeSystem
          ? ""
          : "AND TABLE_SCHEMA NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')";

        const schemaParams: unknown[] = [];
        let schemaWhere = "";
        if (parsed.schema) {
          schemaParams.push(parsed.schema);
          schemaWhere = `AND TABLE_SCHEMA = ?`;
        }

        const limit = Math.min(Math.max(parsed.limit ?? 100, 1), 500);
        const limitClause = `LIMIT ${String(limit)}`;

        const qp = schemaParams.length > 0 ? schemaParams : undefined;

        // Execute all independent section queries in parallel (PERF-P2)
        const [
          tablesResult,
          viewsResult,
          indexesResult,
          constraintsResult,
          functionsResult,
          triggersResult,
        ] = await Promise.all([
          // Tables
          includeAll || sections.has("tables")
            ? adapter.executeReadQuery(
                `SELECT
                TABLE_SCHEMA AS schema_name, TABLE_NAME AS name,
                TABLE_TYPE AS type,
                TABLE_COMMENT AS comment,
                TABLE_ROWS AS row_count,
                (DATA_LENGTH + INDEX_LENGTH) AS size_bytes
              FROM information_schema.TABLES
              WHERE TABLE_TYPE = 'BASE TABLE'
                ${schemaExclude} ${schemaWhere}
              ORDER BY TABLE_SCHEMA, TABLE_NAME
              ${limitClause}`,
                qp,
              )
            : null,

          // Views
          includeAll || sections.has("views")
            ? adapter.executeReadQuery(
                `SELECT
                TABLE_SCHEMA AS schema_name, TABLE_NAME AS name,
                'view' AS type,
                ${parsed.compact ? "NULL" : "VIEW_DEFINITION"} AS definition
              FROM information_schema.VIEWS
              WHERE 1=1
                ${schemaExclude} ${schemaWhere}
              ORDER BY TABLE_SCHEMA, TABLE_NAME
              ${limitClause}`,
                qp,
              )
            : null,

          // Indexes
          includeAll || sections.has("indexes")
            ? adapter.executeReadQuery(
                `SELECT
                INDEX_NAME AS name, TABLE_NAME AS table_name, TABLE_SCHEMA AS schema_name,
                INDEX_TYPE AS type, IF(NON_UNIQUE=0, 1, 0) AS is_unique
              FROM information_schema.STATISTICS
              WHERE 1=1
                ${schemaExclude} ${schemaWhere}
              GROUP BY TABLE_SCHEMA, TABLE_NAME, INDEX_NAME, INDEX_TYPE, NON_UNIQUE
              ORDER BY TABLE_SCHEMA, TABLE_NAME, INDEX_NAME
              ${limitClause}`,
                qp,
              )
            : null,

          // Constraints
          includeAll || sections.has("constraints")
            ? adapter.executeReadQuery(
                `SELECT
                CONSTRAINT_NAME AS name, TABLE_NAME AS table_name, TABLE_SCHEMA AS schema_name,
                CONSTRAINT_TYPE AS type
              FROM information_schema.TABLE_CONSTRAINTS
              WHERE 1=1
                ${schemaExclude} ${schemaWhere}
              ORDER BY TABLE_SCHEMA, TABLE_NAME, CONSTRAINT_NAME
              ${limitClause}`,
                qp,
              )
            : null,

          // Functions / Routines
          includeAll || sections.has("functions")
            ? adapter.executeReadQuery(
                `SELECT
                ROUTINE_SCHEMA AS schema_name, ROUTINE_NAME AS name,
                ROUTINE_TYPE AS type,
                DATA_TYPE AS return_type,
                SQL_DATA_ACCESS AS volatility,
                ${parsed.compact ? "NULL" : "ROUTINE_DEFINITION"} AS definition
              FROM information_schema.ROUTINES
              WHERE 1=1
                ${schemaExclude.replace(/TABLE_SCHEMA/g, "ROUTINE_SCHEMA")} ${schemaWhere.replace(/TABLE_SCHEMA/g, "ROUTINE_SCHEMA")}
              ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME
              ${limitClause}`,
                qp,
              )
            : null,

          // Triggers
          includeAll || sections.has("triggers")
            ? adapter.executeReadQuery(
                `SELECT
                TRIGGER_NAME AS name, EVENT_OBJECT_TABLE AS table_name, TRIGGER_SCHEMA AS schema_name,
                ACTION_TIMING AS timing,
                EVENT_MANIPULATION AS events,
                ${parsed.compact ? "NULL" : "ACTION_STATEMENT"} AS definition
              FROM information_schema.TRIGGERS
              WHERE 1=1
                ${schemaExclude.replace(/TABLE_SCHEMA/g, "TRIGGER_SCHEMA")} ${schemaWhere.replace(/TABLE_SCHEMA/g, "TRIGGER_SCHEMA")}
              ORDER BY TRIGGER_SCHEMA, EVENT_OBJECT_TABLE, TRIGGER_NAME
              ${limitClause}`,
                qp,
              )
            : null,
        ]);

        // Helper to defensively strip null/undefined/empty arrays from records recursively
        const stripNulls = (
          rows: Record<string, unknown>[],
        ): Record<string, unknown>[] => {
          const clean = (obj: unknown): unknown => {
            if (Array.isArray(obj)) {
              const mapped = obj
                .map(clean)
                .filter((v) => v != null && v !== "");
              return mapped.length > 0 ? mapped : undefined;
            }
            if (obj !== null && typeof obj === "object") {
              const res: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(obj)) {
                if (v == null || v === "") continue;
                const cleaned = clean(v);
                if (Array.isArray(cleaned) && cleaned.length === 0) continue;
                if (
                  typeof cleaned === "object" &&
                  cleaned !== null &&
                  Object.keys(cleaned).length === 0
                )
                  continue;
                res[k] = cleaned;
              }
              return res;
            }
            return obj;
          };
          return rows.map((r) => clean(r) as Record<string, unknown>);
        };

        // If not compact mode, query columns and append them to tables
        const columnsMap = new Map<string, Record<string, unknown>[]>();
        if (!parsed.compact && tablesResult?.rows) {
          const colsResult = await adapter.executeReadQuery(
            `SELECT
              TABLE_SCHEMA, TABLE_NAME,
              COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
            FROM information_schema.COLUMNS
            WHERE 1=1
              ${schemaExclude} ${schemaWhere}
            ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION`,
            qp,
          );

          for (const row of colsResult.rows ?? []) {
            const key = `${row["TABLE_SCHEMA"] as string}.${row["TABLE_NAME"] as string}`;
            if (!columnsMap.has(key)) columnsMap.set(key, []);
            columnsMap.get(key)?.push({
              name: row["COLUMN_NAME"],
              type: row["COLUMN_TYPE"],
              nullable: row["IS_NULLABLE"] === "YES" ? true : undefined,
              default: row["COLUMN_DEFAULT"],
              primaryKey: row["COLUMN_KEY"] === "PRI" ? true : undefined,
            });
          }

          for (const row of tablesResult.rows) {
            const key = `${row["schema_name"] as string}.${row["name"] as string}`;
            if (columnsMap.has(key)) {
              row["columns"] = columnsMap.get(key);
            }
          }
        }

        // Assign results to snapshot and stats
        if (tablesResult !== null) {
          if (tablesResult.rows && tablesResult.rows.length > 0)
            snapshot["tables"] = stripNulls(tablesResult.rows);
          stats.tables = tablesResult.rows?.length ?? 0;
        }
        if (viewsResult !== null) {
          if (viewsResult.rows && viewsResult.rows.length > 0)
            snapshot["views"] = stripNulls(viewsResult.rows);
          stats.views = viewsResult.rows?.length ?? 0;
        }
        if (indexesResult !== null) {
          if (indexesResult.rows && indexesResult.rows.length > 0)
            snapshot["indexes"] = stripNulls(indexesResult.rows);
          stats.indexes = indexesResult.rows?.length ?? 0;
        }
        if (constraintsResult !== null) {
          if (constraintsResult.rows && constraintsResult.rows.length > 0)
            snapshot["constraints"] = stripNulls(constraintsResult.rows);
          stats.constraints = constraintsResult.rows?.length ?? 0;
        }
        if (functionsResult !== null) {
          if (functionsResult.rows && functionsResult.rows.length > 0)
            snapshot["functions"] = stripNulls(functionsResult.rows);
          stats.functions = functionsResult.rows?.length ?? 0;
        }
        if (triggersResult !== null) {
          if (triggersResult.rows && triggersResult.rows.length > 0)
            snapshot["triggers"] = stripNulls(triggersResult.rows);
          stats.triggers = triggersResult.rows?.length ?? 0;
        }

        const finalStats: Record<string, number> = {};
        for (const [k, v] of Object.entries(stats)) {
          if (v > 0) finalStats[k] = v;
        }

        const finalHint =
          stats.tables >= limit ||
          stats.views >= limit ||
          stats.indexes >= limit ||
          stats.constraints >= limit
            ? `Result truncated to ${String(limit)} objects per section. Use more specific schema filters or request fewer sections.`
            : undefined;

        const data = {
          ...(Object.keys(snapshot).length > 0 ? { snapshot } : {}),
          ...(Object.keys(finalStats).length > 0 ? { stats: finalStats } : {}),
          ...(finalHint ? { hint: finalHint } : {}),
          generatedAt: new Date().toISOString(),
        };
        const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(data), "utf8") / 4);
        return { success: true, data, metrics: { tokenEstimate } };
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
