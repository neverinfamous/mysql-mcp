/**
 * MySQL Statistics Tools - Advanced Analysis
 *
 * Top-N, distinct values, frequency distribution, and multi-column summary.
 * 4 tools total.
 */

import { z } from "zod";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  TopNOutputSchema,
  DistinctOutputSchema,
  FrequencyOutputSchema,
  SummaryOutputSchema,
} from "../../schemas/stats.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

// =============================================================================
// Constants
// =============================================================================

/** Column types that typically contain long content (auto-excluded from top_n) */
const LONG_CONTENT_TYPES = new Set([
  "text",
  "mediumtext",
  "longtext",
  "blob",
  "mediumblob",
  "longblob",
  "json",
  "geometry",
]);

/** Numeric types for summary detection */
const NUMERIC_TYPES = new Set([
  "tinyint",
  "smallint",
  "mediumint",
  "int",
  "bigint",
  "decimal",
  "numeric",
  "float",
  "double",
]);

// =============================================================================
// Schemas
// =============================================================================

export const StatsTopNSchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column to sort by"),
  col: z.string().optional().describe("Alias for column"),
  n: z
    .unknown()
    .optional()
    .describe("Number of rows to return (default: 10, max: 100)"),
  direction: z.unknown().optional().describe("Sort direction (default: desc)"),
  selectColumns: z
    .unknown()
    .optional()
    .describe("Columns to include (defaults to all except long text/blobs)"),
  where: z.string().optional().describe("Filter condition"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
});

export const StatsTopNSchema = z.preprocess(
  (val: unknown) => {
    if (val === null || typeof val !== "object") return val;
    const obj = val as Record<string, unknown>;
    return {
      ...obj,
      table: obj["table"] ?? obj["tableName"] ?? obj["name"],
      column: obj["column"] ?? obj["col"] ?? obj["columnName"] ?? obj["fieldName"],
      where: obj["where"] ?? obj["sql"] ?? obj["query"],
    };
  },
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "table is required"),
    column: z.string().min(1, "column is required"),
    n: z.number().min(1).max(100).default(10),
    direction: z.enum(["asc", "desc"]).default("desc"),
    selectColumns: z.array(z.string()).optional(),
    where: z.string().optional(),
  })
);

export const StatsDistinctSchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column to get distinct values for"),
  col: z.string().optional().describe("Alias for column"),
  limit: z
    .unknown()
    .optional()
    .describe("Maximum values to return (default: 100)"),
  where: z.string().optional().describe("Filter condition"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
});

export const StatsDistinctSchema = z.preprocess(
  (val: unknown) => {
    if (val === null || typeof val !== "object") return val;
    const obj = val as Record<string, unknown>;
    return {
      ...obj,
      table: obj["table"] ?? obj["tableName"] ?? obj["name"],
      column: obj["column"] ?? obj["col"] ?? obj["columnName"] ?? obj["fieldName"],
      where: obj["where"] ?? obj["sql"] ?? obj["query"],
    };
  },
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "table is required"),
    column: z.string().min(1, "column is required"),
    limit: z.number().min(1).max(1000).default(100),
    where: z.string().optional(),
  })
);

export const StatsFrequencySchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  column: z
    .string()
    .optional()
    .describe("Column to get frequency distribution for"),
  col: z.string().optional().describe("Alias for column"),
  limit: z
    .unknown()
    .optional()
    .describe("Maximum rows to return (default: 20)"),
  where: z.string().optional().describe("Filter condition"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
});

export const StatsFrequencySchema = z.preprocess(
  (val: unknown) => {
    if (val === null || typeof val !== "object") return val;
    const obj = val as Record<string, unknown>;
    return {
      ...obj,
      table: obj["table"] ?? obj["tableName"] ?? obj["name"],
      column: obj["column"] ?? obj["col"] ?? obj["columnName"] ?? obj["fieldName"],
      where: obj["where"] ?? obj["sql"] ?? obj["query"],
    };
  },
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "table is required"),
    column: z.string().min(1, "column is required"),
    limit: z.number().min(1).max(1000).default(20),
    where: z.string().optional(),
  })
);

export const StatsSummarySchemaBase = z.object({
  database: z.string().optional().describe("Database name"),
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  name: z.string().optional().describe("Alias for table"),
  columns: z
    .unknown()
    .optional()
    .describe(
      "Specific numeric columns to summarize (defaults to all numeric columns)",
    ),
  where: z.string().optional().describe("Filter condition"),
  sql: z.string().optional().describe("Alias for where"),
  query: z.string().optional().describe("Alias for where"),
});

export const StatsSummarySchema = z.preprocess(
  (val: unknown) => {
    if (val === null || typeof val !== "object") return val;
    const obj = val as Record<string, unknown>;
    return {
      ...obj,
      table: obj["table"] ?? obj["tableName"] ?? obj["name"],
      columns: typeof obj["columns"] === "string" ? [obj["columns"]] : obj["columns"],
      where: obj["where"] ?? obj["sql"] ?? obj["query"],
    };
  },
  z.object({
    database: z.string().optional(),
    table: z.string().min(1, "table is required"),
    columns: z.array(z.string()).optional(),
    where: z.string().optional(),
  })
);

// =============================================================================
// TOP N
// =============================================================================

export function createStatsTopNTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_top_n",
    title: "Stats Top N",
    description:
      "Get the top N rows ranked by a column. Auto-excludes long-content columns (text, json, blob) from output unless selectColumns is specified.",
    group: "stats",
    inputSchema: StatsTopNSchemaBase,
    outputSchema: TopNOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsTopNSchema.parse(params);

        const { database, table, column, n, direction, selectColumns, where } = parsed;
        const whereClause = where ? `WHERE ${where}` : "";

        if (!/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)?$/.test(table)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: "Invalid table name",
          });
        }
        
        const fullTableName = database ? `\`${database}\`.\`${table}\`` : (table.includes('.') ? table.split('.').map(p => `\`${p}\``).join('.') : `\`${table}\``);

        let columnList: string;
        let hint: string | undefined;

        if (selectColumns && selectColumns.length > 0) {
          // User-specified columns
          columnList = selectColumns.map((c) => `\`${c}\``).join(", ");
        } else {
          // Auto-exclude long content columns
          const colQuery = `
            SELECT COLUMN_NAME, DATA_TYPE
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ${database ? '?' : (table.includes('.') ? '?' : 'DATABASE()')} AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
          `;
          const dbParam = database ? database : (table.includes('.') ? table.split('.')[0] : null);
          const tblParam = table.includes('.') ? table.split('.')[1] : table;
          const colResult = await adapter.executeQuery(colQuery, dbParam ? [dbParam, tblParam] : [tblParam]);
          const allCols = (colResult.rows ?? []).map((row) => ({
            COLUMN_NAME: String(row["COLUMN_NAME"]),
            DATA_TYPE: String(row["DATA_TYPE"]),
          }));

          const excluded: string[] = [];
          const included: string[] = [];

          for (const col of allCols) {
            if (LONG_CONTENT_TYPES.has(col.DATA_TYPE.toLowerCase())) {
              excluded.push(col.COLUMN_NAME);
            } else {
              included.push(col.COLUMN_NAME);
            }
          }

          if (excluded.length > 0) {
            hint = `Auto-excluded long-content columns: ${excluded.join(", ")}. Use selectColumns to override.`;
          }

          columnList =
            included.length > 0
              ? included.map((c) => `\`${c}\``).join(", ")
              : "*";
        }

        const sql = `
          SELECT ${columnList}
          FROM ${fullTableName}
          ${whereClause}
          ORDER BY \`${column}\` ${direction.toUpperCase()}
          LIMIT ${String(n)}
        `;

        const result = await adapter.executeQuery(sql);
        const rows = result.rows ?? [];

        const data: Record<string, unknown> = {
          column,
          direction,
          count: rows.length,
        };

        if (rows.length > 0) {
          data["rows"] = rows;
        }

        if (hint) {
          data["hint"] = hint;
        }

        return withTokenEstimate({ success: true, data });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

// =============================================================================
// DISTINCT VALUES
// =============================================================================

export function createStatsDistinctTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_distinct",
    title: "Stats Distinct",
    description:
      "Get distinct values from a column with count. Useful for understanding cardinality and unique value distribution.",
    group: "stats",
    inputSchema: StatsDistinctSchemaBase,
    outputSchema: DistinctOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsDistinctSchema.parse(params);

        const { database, table, column, limit, where } = parsed;
        const whereClause = where ? `WHERE ${where}` : "";

        if (!/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)?$/.test(table)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: "Invalid table name",
          });
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: "Invalid column name",
          });
        }

        const fullTableName = database ? `\`${database}\`.\`${table}\`` : (table.includes('.') ? table.split('.').map(p => `\`${p}\``).join('.') : `\`${table}\``);

        const sql = `
          SELECT DISTINCT \`${column}\` AS value
          FROM ${fullTableName}
          ${whereClause}
          ORDER BY \`${column}\`
          LIMIT ${String(limit)}
        `;

        const result = await adapter.executeQuery(sql);
        const values = (result.rows ?? []).map((row) => row["value"]);

        // Get total distinct count
        const countSql = `
          SELECT COUNT(DISTINCT \`${column}\`) AS cnt
          FROM ${fullTableName}
          ${whereClause}
        `;
        const countResult = await adapter.executeQuery(countSql);
        const distinctCount = Number(countResult.rows?.[0]?.["cnt"] ?? 0);

        return withTokenEstimate({
          success: true,
          data: {
            column,
            count: distinctCount,
            values,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

// =============================================================================
// FREQUENCY DISTRIBUTION

export function createStatsFrequencyTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_stats_frequency",
    title: "Stats Frequency",
    description:
      "Get value frequency distribution (count per unique value) ordered by frequency descending. Shows the most common values first.",
    group: "stats",
    inputSchema: StatsFrequencySchemaBase,
    outputSchema: FrequencyOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsFrequencySchema.parse(params);

        const { database, table, column, limit, where } = parsed;
        const whereClause = where ? `WHERE ${where}` : "";

        if (!/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)?$/.test(table)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: "Invalid table name",
          });
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: "Invalid column name",
          });
        }

        const fullTableName = database ? `\`${database}\`.\`${table}\`` : (table.includes('.') ? table.split('.').map(p => `\`${p}\``).join('.') : `\`${table}\``);

        const sql = `
          SELECT
            \`${column}\` AS value,
            COUNT(*) AS frequency,
            ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS percentage
          FROM ${fullTableName}
          ${whereClause}
          GROUP BY \`${column}\`
          ORDER BY COUNT(*) DESC
          LIMIT ${String(limit)}
        `;

        const result = await adapter.executeQuery(sql);
        const distribution = (result.rows ?? []).map((row) => ({
          value: row["value"],
          frequency: Number(row["frequency"]),
          percentage: Number(row["percentage"]),
        }));

        // Get total distinct count
        const countSql = `
          SELECT COUNT(DISTINCT \`${column}\`) AS cnt
          FROM ${fullTableName}
          ${whereClause}
        `;
        const countResult = await adapter.executeQuery(countSql);
        const distinctValues = Number(countResult.rows?.[0]?.["cnt"] ?? 0);

        return withTokenEstimate({
          success: true,
          data: {
            column,
            distinctValues,
            distribution,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

// =============================================================================
// SUMMARY STATISTICS
// =============================================================================

export function createStatsSummaryTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_summary",
    title: "Stats Summary",
    description:
      "Get summary statistics (count, avg, min, max, stddev) for multiple numeric columns. Defaults to all numeric columns if none specified.",
    group: "stats",
    inputSchema: StatsSummarySchemaBase,
    outputSchema: SummaryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsSummarySchema.parse(params);

        const { database, table, where } = parsed;
        const whereClause = where ? `WHERE ${where}` : "";

        if (!/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)?$/.test(table)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: "Invalid table name",
          });
        }
        
        const fullTableName = database ? `\`${database}\`.\`${table}\`` : (table.includes('.') ? table.split('.').map(p => `\`${p}\``).join('.') : `\`${table}\``);

        // Check if table exists (P154) and allow native error formatting
        await adapter.executeQuery(`SELECT 1 FROM ${fullTableName} LIMIT 1`);

        const dbParam = database ? database : (table.includes('.') ? table.split('.')[0] : null);
        const tblParam = table.includes('.') ? table.split('.')[1] : table;

        // Determine columns to summarize
        let targetColumns: string[];

        if (parsed.columns && parsed.columns.length > 0) {
          // Verify they are valid columns
          targetColumns = parsed.columns;
        } else {
          // Auto-detect numeric columns
          const colQuery = `
            SELECT COLUMN_NAME, DATA_TYPE
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ${dbParam != null ? '?' : 'DATABASE()'}
              AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
          `;
          const colResult = await adapter.executeQuery(colQuery, dbParam != null ? [dbParam, tblParam] : [tblParam]);
          const colRows = (colResult.rows ?? []).map((row) => ({
            COLUMN_NAME: String(row["COLUMN_NAME"]),
            DATA_TYPE: String(row["DATA_TYPE"]),
          }));

          targetColumns = colRows
            .filter((row) => NUMERIC_TYPES.has(row.DATA_TYPE.toLowerCase()))
            .map((row) => row.COLUMN_NAME);
        }

        if (targetColumns.length === 0) {
          return withTokenEstimate({
            success: true,
            data: {
              table,
              summaries: [],
            },
          });
        }

        // Build a single query for all columns
        const selectParts = targetColumns.flatMap((col) => [
          `COUNT(\`${col}\`) AS \`${col}_count\``,
          `AVG(\`${col}\`) AS \`${col}_avg\``,
          `MIN(\`${col}\`) AS \`${col}_min\``,
          `MAX(\`${col}\`) AS \`${col}_max\``,
          `STDDEV_SAMP(\`${col}\`) AS \`${col}_stddev\``,
        ]);

        const sql = `
          SELECT ${selectParts.join(",\n            ")}
          FROM ${fullTableName}
          ${whereClause}
        `;

        const result = await adapter.executeQuery(sql);
        const row = result.rows?.[0];

        const summaries = targetColumns.map((col) => {
          if (!row) {
            return { column: col, error: "No data returned" };
          }
          return {
            column: col,
            count: Number(row[`${col}_count`] ?? 0),
            avg: row[`${col}_avg`] !== null ? Number(row[`${col}_avg`]) : null,
            min: row[`${col}_min`] !== null ? Number(row[`${col}_min`]) : null,
            max: row[`${col}_max`] !== null ? Number(row[`${col}_max`]) : null,
            stddev:
              row[`${col}_stddev`] !== null
                ? Number(row[`${col}_stddev`])
                : null,
          };
        });

        return withTokenEstimate({
          success: true,
          data: {
            table,
            summaries,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
