import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { ValidationError } from "../../../../../types/index.js";
import { validateQualifiedIdentifier, validateIdentifier, escapeQualifiedTable, parseQualifiedTable, validateWhereClause } from "../../../../../utils/validators.js";
import { TimeSeriesOutputSchema } from "../../../schemas/stats.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { TimeSeriesSchemaBase, TimeSeriesSchema } from "./schemas.js";

/**
 * Time series analysis with moving averages
 */
export function createTimeSeriesToolStats(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_stats_time_series",
    title: "MySQL Time Series Analysis",
    description:
      "Aggregate and analyze time series data with specified intervals.",
    group: "stats",
    inputSchema: TimeSeriesSchemaBase,
    outputSchema: TimeSeriesOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const {
          table,
          valueColumn,
          timeColumn,
          interval,
          aggregation,
          where,
          limit,
        } = TimeSeriesSchema.parse(params);

        // Validate identifiers
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(valueColumn, "column");
        validateIdentifier(timeColumn, "column");
        validateWhereClause(where);

        // Ensure table exists to trigger ER_NO_SUCH_TABLE for P154 object existence compliance
        await adapter.executeQuery(`SELECT 1 FROM ${escapeQualifiedTable(table)} LIMIT 1`);

        // Verify columns
        const { schema, table: parsedTableName } = parseQualifiedTable(table);

        const colCheck = await adapter.executeQuery(
          `SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS 
           WHERE TABLE_SCHEMA = ${schema ? '?' : 'DATABASE()'} AND TABLE_NAME = ? 
           AND LOWER(COLUMN_NAME) IN (LOWER(?), LOWER(?))`,
          schema ? [schema, parsedTableName, valueColumn, timeColumn] : [parsedTableName, valueColumn, timeColumn],
        );

        const NUMERIC_TYPES = new Set([
          "tinyint", "smallint", "mediumint", "int", "bigint",
          "decimal", "numeric", "float", "double",
        ]);
        const TEMPORAL_TYPES = new Set([
          "date", "datetime", "timestamp", "time", "year",
        ]);

        const validCols = new Set<string>();
        const temporalCols = new Set<string>();
        const numericCols = new Set<string>();

        for (const row of colCheck.rows ?? []) {
          const type = typeof row["DATA_TYPE"] === "string" ? row["DATA_TYPE"].toLowerCase() : undefined;
          const colName = typeof row["COLUMN_NAME"] === "string" ? row["COLUMN_NAME"].toLowerCase() : undefined;
          
          if (type && colName) {
            validCols.add(colName);
            if (NUMERIC_TYPES.has(type)) numericCols.add(colName);
            if (TEMPORAL_TYPES.has(type)) temporalCols.add(colName);
          }
        }

        const missingCols = [valueColumn, timeColumn].filter((c) => !validCols.has(c.toLowerCase()));
        if (missingCols.length > 0) {
          throw new ValidationError(`Column(s) not found: ${missingCols.join(", ")}`);
        }

        if (!numericCols.has(valueColumn.toLowerCase())) {
          throw new ValidationError(`Value column must be numeric type. Non-numeric: ${valueColumn}`);
        }
        
        if (!temporalCols.has(timeColumn.toLowerCase())) {
          throw new ValidationError(`Time column must be temporal type. Non-temporal: ${timeColumn}`);
        }

        const normalizedInterval = interval.toLowerCase();
        const validIntervals = ["minute", "hour", "day", "week", "month"];
        if (!validIntervals.includes(normalizedInterval)) {
          throw new ValidationError(`Invalid interval: '${interval}' — expected one of: ${validIntervals.join(", ")}`);
        }
        
        const normalizedAggregation = aggregation.toLowerCase();
        const validAggregations = ["avg", "sum", "count", "min", "max"];
        if (!validAggregations.includes(normalizedAggregation)) {
          throw new ValidationError(`Invalid aggregation: '${aggregation}' — expected one of: ${validAggregations.join(", ")}`);
        }

        let dateFormat: string;
        switch (normalizedInterval) {
          case "minute":
            dateFormat = "%Y-%m-%d %H:%i:00";
            break;
          case "hour":
            dateFormat = "%Y-%m-%d %H:00:00";
            break;
          case "day":
            dateFormat = "%Y-%m-%d";
            break;
          case "week":
            dateFormat = "%x-W%v";
            break;
          case "month":
            dateFormat = "%Y-%m";
            break;
          default:
            dateFormat = "%Y-%m-%d";
        }

        const whereClause = where ? `WHERE (${where})` : "";
        const aggFunc = normalizedAggregation.toUpperCase();

        const query = `
                SELECT
                    DATE_FORMAT(\`${timeColumn}\`, '${dateFormat}') as period,
                    ${aggFunc}(\`${valueColumn}\`) as value,
                    COUNT(*) as data_points,
                    MIN(\`${valueColumn}\`) as period_min,
                    MAX(\`${valueColumn}\`) as period_max
                FROM ${escapeQualifiedTable(table)}
                ${whereClause}
                GROUP BY period
                ORDER BY period DESC
                LIMIT ${String(limit)}
            `;
        const result = await adapter.executeQuery(query);

        return withTokenEstimate({
          success: true,
          data: {
            interval,
            aggregation,
            valueColumn,
            timeColumn,
            dataPoints: result.rows ?? [],
            count: result.rows?.length ?? 0,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
