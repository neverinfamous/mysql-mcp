import type { ToolDefinition } from "../../../../types/modules/tools.js";
import type { RequestContext } from "../../../../types/index.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import { formatHandlerErrorResponse, withTokenEstimate } from "../core/error-helpers.js";
import { READ_ONLY, WRITE, ADMIN } from "../../../../utils/annotations.js";
import { ErrorCategory } from "../../../../types/modules/error-types.js";
import { MySQLMcpError } from "../../../../types/modules/errors.js";
import {
  VectorInfoSchemaBase,
  VectorInfoSchema,
  VectorCreateIndexSchemaBase,
  VectorCreateIndexSchema,
  VectorOptimizeSchemaBase,
  VectorOptimizeSchema,
  VectorStatsSchemaBase,
  VectorStatsSchema,
  VectorInfoOutputSchema,
  VectorCreateIndexOutputSchema,
  VectorOptimizeOutputSchema,
  VectorStatsOutputSchema,
} from "../../schemas/vector.js";
import { ensureVectorSupport, ensureVectorIndexSupport, sanitizeIdentifier, resolveVectorColumn } from "./helpers.js";

export function createVectorInfoTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_vector_info",
    title: "Get Vector Columns Info",
    description: "List all vector columns for a table and their dimensions.",
    group: "vector",
    inputSchema: VectorInfoSchemaBase,
    outputSchema: VectorInfoOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const validated = VectorInfoSchema.parse(params);

        // Pre-check table existence to satisfy P154
        await adapter.executeQuery(`SELECT 1 FROM \`${sanitizeIdentifier(validated.table)}\` LIMIT 0`);

        await ensureVectorSupport(adapter);

        const tableParam = validated.table; // Parameterized
        const columnFilters: unknown[] = [tableParam];
        
        let colCondition = "";
        if (validated.column) {
          colCondition = "AND COLUMN_NAME = ?";
          columnFilters.push(validated.column);
        }

        const query = `
          SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = ? AND DATA_TYPE = 'vector' ${colCondition}
        `;

        const result = await adapter.executeQuery(query, columnFilters);

        // Parse dimensions from COLUMN_TYPE (e.g., "vector(1536)")
        const columns = (result.rows ?? []).map((r) => {
          const row = r;
          let dimensions: number | null = null;
          
          const typeStr = typeof row['COLUMN_TYPE'] === "string" ? row['COLUMN_TYPE'] : "";
          const match = /vector\((\d+)\)/i.exec(typeStr);
          if (match?.[1]) {
            dimensions = parseInt(match[1], 10);
          }

          return {
            name: String(row['COLUMN_NAME']),
            dimensions,
            isNullable: row['IS_NULLABLE'] === "YES",
            default: row['COLUMN_DEFAULT'],
          };
        });

        return withTokenEstimate({
          success: true,
          data: {
            table: validated.table,
            columns
          }
        });
      } catch (e) {
        return formatHandlerErrorResponse(e);
      }
    },
  };
}

export function createVectorCreateIndexTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_vector_create_index",
    title: "Create Vector Index",
    description: "Create an HNSW vector index for faster KNN searches (requires MySQL 9.1+).",
    group: "vector",
    inputSchema: VectorCreateIndexSchemaBase,
    outputSchema: VectorCreateIndexOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const validated = VectorCreateIndexSchema.parse(params);

        const table = sanitizeIdentifier(validated.table);
        const targetColumn = await resolveVectorColumn(adapter, validated.table, validated.column);
        const column = sanitizeIdentifier(targetColumn);
        
        // Pre-check table existence to satisfy P154
        await adapter.executeQuery(`SELECT 1 FROM \`${table}\` LIMIT 0`);

        // HNSW indexes were added in MySQL 9.1
        await ensureVectorIndexSupport(adapter);
        
        const indexName = `idx_${table}_${column}_vec`;

        // Syntax: ALTER TABLE t1 ADD VECTOR INDEX idx_t1_c1_vec (c1)
        const query = `
          ALTER TABLE \`${table}\` 
          ADD VECTOR INDEX \`${indexName}\` (\`${column}\`)
        `;

        await adapter.executeQuery(query);

        return withTokenEstimate({
          success: true,
          data: {
            created: true,
            table: validated.table,
            column: validated.column,
            indexName,
            metric: validated.metric
          }
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("syntax") || msg.includes("parse")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              "Vector indexes require MySQL HeatWave or a specific vector plugin.",
              "EXTENSION_MISSING",
              ErrorCategory.CONFIGURATION,
              { suggestion: "Vector index creation is only available in MySQL HeatWave or with compatible plugins." }
            )
          );
        }
        return formatHandlerErrorResponse(e);
      }
    },
  };
}

export function createVectorOptimizeTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_vector_optimize",
    title: "Optimize Vector Indexes",
    description: "Run ANALYZE TABLE to update vector index statistics.",
    group: "vector",
    inputSchema: VectorOptimizeSchemaBase,
    outputSchema: VectorOptimizeOutputSchema,
    requiredScopes: ["write"],
    annotations: ADMIN,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const validated = VectorOptimizeSchema.parse(params);

        const table = sanitizeIdentifier(validated.table);
        
        // Pre-check table existence to satisfy P154
        await adapter.executeQuery(`SELECT 1 FROM \`${table}\` LIMIT 0`);

        await ensureVectorSupport(adapter);
        
        const query = `ANALYZE TABLE \`${table}\``;
        const result = await adapter.rawQuery(query);

        const rows = result.rows ?? [];
        const errorRow = rows.find(
          (r: Record<string, unknown>) =>
            String(r["Msg_type"]).toLowerCase() === "error",
        );
        if (errorRow) {
          return withTokenEstimate({
            success: false,
            error: String(errorRow["Msg_text"]),
            code: "MAINTENANCE_ERROR",
            category: ErrorCategory.RESOURCE,
            suggestion: undefined,
            recoverable: false,
            details: { results: rows },
          });
        }

        return withTokenEstimate({
          success: true,
          data: {
            optimized: true,
            table: validated.table,
            result: rows
          }
        });
      } catch (e) {
        return formatHandlerErrorResponse(e);
      }
    },
  };
}

export function createVectorStatsTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_vector_stats",
    title: "Vector Column Statistics",
    description: "Get statistics about a vector column, including dimension validation and sampling.",
    group: "vector",
    inputSchema: VectorStatsSchemaBase,
    outputSchema: VectorStatsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const validated = VectorStatsSchema.parse(params);

        const table = sanitizeIdentifier(validated.table);
        const targetColumn = await resolveVectorColumn(adapter, validated.table, validated.column);
        const column = sanitizeIdentifier(targetColumn);

        // Pre-check table existence to satisfy P154
        await adapter.executeQuery(`SELECT 1 FROM \`${table}\` LIMIT 0`);

        await ensureVectorSupport(adapter);

        // Pre-check column type to avoid raw MySQL "Incorrect arguments to vector_dim" errors
        const colCheck = await adapter.executeQuery(`
          SELECT DATA_TYPE 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_NAME = ? AND COLUMN_NAME = ?
        `, [validated.table, targetColumn]);

        if (!colCheck.rows || colCheck.rows.length === 0) {
          return withTokenEstimate({
            success: false,
            error: `Column '${targetColumn}' not found in table '${validated.table}'`,
            code: "COLUMN_NOT_FOUND",
            category: ErrorCategory.RESOURCE,
            recoverable: false,
            suggestion: "Verify the column name using mysql_describe_table."
          });
        }

        const colCheckFirstRow = colCheck.rows[0];
        const dataType = String(colCheckFirstRow ? colCheckFirstRow["DATA_TYPE"] : "").toLowerCase();
        if (dataType !== "vector") {
          return withTokenEstimate({
            success: false,
            error: `Column '${targetColumn}' is of type '${dataType}', not 'vector'`,
            code: "VALIDATION_ERROR",
            category: ErrorCategory.VALIDATION,
            recoverable: false,
            suggestion: "Vector stats can only be calculated on vector columns. Use mysql_vector_info to list vector columns."
          });
        }

        const query = `
          SELECT 
            COUNT(*) as total_rows,
            COUNT(\`${column}\`) as non_null_count,
            COUNT(*) - COUNT(\`${column}\`) as null_count,
            MIN(VECTOR_DIM(\`${column}\`)) as min_dimensions,
            MAX(VECTOR_DIM(\`${column}\`)) as max_dimensions
          FROM \`${table}\`
        `;

        const result = await adapter.executeQuery(query);
        
        if (!result.rows || result.rows.length === 0) {
          return withTokenEstimate({
            success: true,
            data: {
              table,
              column,
              totalRows: 0,
              stats: null
            }
          });
        }

        const firstRow = result.rows[0];
        if (firstRow === undefined || firstRow === null) {
          return withTokenEstimate({
            success: true,
            data: {
              table,
              column,
              totalRows: 0,
              stats: null
            }
          });
        }
        const r = firstRow;
        const totalRows = Number(typeof r['total_rows'] === "number" || typeof r['total_rows'] === "string" ? r['total_rows'] : 0);
        
        if (totalRows === 0) {
          return withTokenEstimate({
            success: true,
            data: {
              table,
              column: targetColumn,
              totalRows: 0,
              stats: null
            }
          });
        }

        const minDim = Number(typeof r['min_dimensions'] === "number" || typeof r['min_dimensions'] === "string" ? r['min_dimensions'] : 0);
        const maxDim = Number(typeof r['max_dimensions'] === "number" || typeof r['max_dimensions'] === "string" ? r['max_dimensions'] : 0);

        return withTokenEstimate({
          success: true,
          data: {
            table,
            column: targetColumn,
            totalRows,
            stats: {
              nonNullCount: Number(typeof r['non_null_count'] === "number" || typeof r['non_null_count'] === "string" ? r['non_null_count'] : 0),
              nullCount: Number(typeof r['null_count'] === "number" || typeof r['null_count'] === "string" ? r['null_count'] : 0),
              dimensions: {
                consistent: minDim === maxDim,
                min: minDim,
                max: maxDim
              }
            }
          }
        });
      } catch (e) {
        return formatHandlerErrorResponse(e);
      }
    },
  };
}
