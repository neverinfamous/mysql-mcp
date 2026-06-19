import type { ToolDefinition } from "../../../../types/index.js";
import type { RequestContext } from "../../../../types/index.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import { formatHandlerErrorResponse, withTokenEstimate } from "../core/error-helpers.js";
import { READ_ONLY } from "../../../../utils/annotations.js";
import {
  VectorSearchSchemaBase,
  VectorSearchSchema,
  VectorRangeSearchSchemaBase,
  VectorRangeSearchSchema,
  VectorHybridSearchSchemaBase,
  VectorHybridSearchSchema,
  VectorSearchOutputSchema,
  VectorRangeSearchOutputSchema,
  VectorHybridSearchOutputSchema,
} from "../../schemas/vector.js";
import { ensureVectorSupport, formatVector, sanitizeIdentifier } from "./helpers.js";
import { sanitizeFulltextQuery } from "../text/fulltext-helpers.js";
import { MySQLMcpError } from "../../../../types/modules/errors.js";
import { ErrorCategory } from "../../../../types/modules/error-types.js";

export function createVectorSearchTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_vector_search",
    title: "Vector KNN Search",
    description: "Find the K nearest neighbors to a query vector.",
    group: "vector",
    inputSchema: VectorSearchSchemaBase,
    outputSchema: VectorSearchOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const validated = VectorSearchSchema.parse(params);
        await ensureVectorSupport(adapter);

        const table = sanitizeIdentifier(validated.table);
        const column = sanitizeIdentifier(validated.column);
        
        let selectCols = `*, VECTOR_TO_STRING(\`${column}\`) as vector_str`;
        if (validated.select && validated.select.length > 0) {
          const safeSelectCols = validated.select.map(c => `\`${sanitizeIdentifier(c)}\``).join(", ");
          selectCols = `${safeSelectCols}, VECTOR_TO_STRING(\`${column}\`) as vector_str`;
        }

        const vectorStr = formatVector(validated.queryVector);
        
        let whereClause = "";
        if (validated.filter) {
          whereClause = `WHERE ${validated.filter}`;
        }

        // distance function requires literal string for metric: 'COSINE', 'EUCLIDEAN', or 'DOT'
        const metricLiteral = validated.metric === "DOT" ? "DOT" : validated.metric === "EUCLIDEAN" ? "EUCLIDEAN" : "COSINE";
        
        // DISTANCE() handles the metric parameter internally
        const query = `
          SELECT ${selectCols}, 
                 DISTANCE(\`${column}\`, STRING_TO_VECTOR(?), '${metricLiteral}') as distance
          FROM \`${table}\`
          ${whereClause}
          ORDER BY distance ASC
          LIMIT ${validated.k}
        `;

        const result = await adapter.executeQuery(query, [vectorStr]);

        // Strip the raw vector from the output to save tokens, 
        // user only needs the distance scores and the document data
        const transformedRows = (result.rows ?? []).map(row => {
          const rest = { ...row };
          delete rest["vector_str"];
          if (validated.select && validated.select.length > 0) {
             return rest;
          }
          return Object.fromEntries(
            Object.entries(rest).filter(([key]) => key !== validated.column)
          );
        });

        return withTokenEstimate({
          success: true,
          data: {
            table: validated.table,
            metric: validated.metric,
            results: transformedRows,
            count: transformedRows.length
          }
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("DEBUG CATCH BLOCK:", msg);
        if (msg.includes("FUNCTION") && msg.includes("DISTANCE") && msg.includes("does not exist")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              "Vector distance functions require MySQL HeatWave or a specific vector plugin.",
              "EXTENSION_MISSING",
              ErrorCategory.CONFIGURATION,
              { suggestion: "Vector similarity search is only available in MySQL HeatWave or with compatible plugins." }
            )
          );
        }
        if (msg.includes("from_vector") || msg.includes("VECTOR_TO_STRING")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              "Column is not a valid VECTOR type.",
              "INVALID_COLUMN_TYPE",
              ErrorCategory.VALIDATION,
              { suggestion: "Ensure the specified column is a VECTOR data type." }
            )
          );
        }
        if (msg.includes("doesn't exist")) {
          const tableName = typeof params === 'object' && params !== null ? (params as Record<string, unknown>)['table'] : 'unknown';
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              `Table '${String(tableName)}' does not exist`,
              "TABLE_NOT_FOUND",
              ErrorCategory.QUERY,
              { suggestion: "Use mysql_list_tables to find available tables" }
            )
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createVectorRangeSearchTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_vector_range_search",
    title: "Vector Range Search",
    description: "Find all vectors within a maximum distance threshold.",
    group: "vector",
    inputSchema: VectorRangeSearchSchemaBase,
    outputSchema: VectorRangeSearchOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const validated = VectorRangeSearchSchema.parse(params);
        await ensureVectorSupport(adapter);

        const table = sanitizeIdentifier(validated.table);
        const column = sanitizeIdentifier(validated.column);
        
        const vectorStr = formatVector(validated.queryVector);
        
        let whereClause = "";
        if (validated.filter) {
          whereClause = `WHERE ${validated.filter}`;
        }

        const metricLiteral = validated.metric === "DOT" ? "DOT" : validated.metric === "EUCLIDEAN" ? "EUCLIDEAN" : "COSINE";
        
        const query = `
          SELECT *, 
                 VECTOR_TO_STRING(\`${column}\`) as vector_str,
                 DISTANCE(\`${column}\`, STRING_TO_VECTOR(?), '${metricLiteral}') as distance
          FROM \`${table}\`
          ${whereClause}
          HAVING distance <= ?
          ORDER BY distance ASC
          LIMIT ${validated.limit}
        `;

        const result = await adapter.executeQuery(query, [vectorStr, validated.maxDistance]);

        // Strip the raw vector from the output to save tokens,
        // user only needs the distance scores and the document data
        const transformedRows = (result.rows ?? []).map(row => {
          const rest = { ...row };
          delete rest["vector_str"];
          return Object.fromEntries(
            Object.entries(rest).filter(([key]) => key !== validated.column)
          );
        });

        return withTokenEstimate({
          success: true,
          data: {
            table: validated.table,
            metric: validated.metric,
            maxDistance: validated.maxDistance,
            results: transformedRows,
            count: transformedRows.length
          }
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("FUNCTION") && msg.includes("DISTANCE") && msg.includes("does not exist")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              "Vector distance functions require MySQL HeatWave or a specific vector plugin.",
              "EXTENSION_MISSING",
              ErrorCategory.CONFIGURATION,
              { suggestion: "Vector similarity search is only available in MySQL HeatWave or with compatible plugins." }
            )
          );
        }
        if (msg.includes("from_vector") || msg.includes("VECTOR_TO_STRING")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              "Column is not a valid VECTOR type.",
              "INVALID_COLUMN_TYPE",
              ErrorCategory.VALIDATION,
              { suggestion: "Ensure the specified column is a VECTOR data type." }
            )
          );
        }
        if (msg.includes("doesn't exist")) {
          const tableName = typeof params === 'object' && params !== null ? (params as Record<string, unknown>)['table'] : 'unknown';
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              `Table '${String(tableName)}' does not exist`,
              "TABLE_NOT_FOUND",
              ErrorCategory.QUERY,
              { suggestion: "Use mysql_list_tables to find available tables" }
            )
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createVectorHybridSearchTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_vector_hybrid_search",
    title: "Hybrid Search (Vector + Fulltext)",
    description: "Combine vector similarity and fulltext search using Reciprocal Rank Fusion (RRF).",
    group: "vector",
    inputSchema: VectorHybridSearchSchemaBase,
    outputSchema: VectorHybridSearchOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const validated = VectorHybridSearchSchema.parse(params);
        await ensureVectorSupport(adapter);

        const table = sanitizeIdentifier(validated.table);
        const vCol = sanitizeIdentifier(validated.vectorColumn);
        const tCol = sanitizeIdentifier(validated.textColumn);
        
        const hasVector = (validated.queryVector?.length ?? 0) > 0;
        let queryText = validated.queryText;
        if (queryText) {
          queryText = sanitizeFulltextQuery(queryText);
        }
        const hasText = (queryText?.length ?? 0) > 0;

        // Base case 1: Neither provided (caught by Zod refine, but double-checking)
        if (!hasVector && !hasText) {
          throw new MySQLMcpError("Must provide either a valid queryVector or queryText", "VALIDATION_ERROR", ErrorCategory.VALIDATION);
        }

        let selectCols = "*";
        if (validated.select && validated.select.length > 0) {
          selectCols = validated.select.map(c => `\`${sanitizeIdentifier(c)}\``).join(", ");
        }

        let whereClause = "";
        let filterAnd = "";
        if (validated.filter) {
          whereClause = `WHERE ${validated.filter}`;
          filterAnd = `AND ${validated.filter}`;
        }

        const metricLiteral = validated.metric === "DOT" ? "DOT" : validated.metric === "EUCLIDEAN" ? "EUCLIDEAN" : "COSINE";
        const rrfK = validated.rrfK;
        const limit = validated.k;

        const queryParams: unknown[] = [];
        let query = "";

        // Determine primary key column for joining
        const infoQuery = `
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
          WHERE TABLE_NAME = ? AND CONSTRAINT_NAME = 'PRIMARY' 
          LIMIT 1
        `;
        const pkResult = await adapter.executeQuery(infoQuery, [validated.table]);
        const firstPkRow = pkResult.rows?.[0];
        const pkCol = firstPkRow && typeof firstPkRow === 'object' ? sanitizeIdentifier(String((firstPkRow)['COLUMN_NAME'])) : "id";

        if (hasVector && hasText) {
          // Full Hybrid Search with RRF
          const vectorStr = formatVector(validated.queryVector ?? []);
          
          query = `
            WITH vector_results AS (
              SELECT \`${pkCol}\`, distance,
                     ROW_NUMBER() OVER (ORDER BY distance ASC) as v_rank
              FROM (
                SELECT \`${pkCol}\`, DISTANCE(\`${vCol}\`, STRING_TO_VECTOR(?), '${metricLiteral}') as distance
                FROM \`${table}\`
                ${whereClause}
                ORDER BY distance ASC LIMIT ${limit}
              ) ranked_v
            ),
            text_results AS (
              SELECT \`${pkCol}\`, text_score,
                     ROW_NUMBER() OVER (ORDER BY text_score DESC) as t_rank
              FROM (
                SELECT \`${pkCol}\`, MATCH(\`${tCol}\`) AGAINST(? IN NATURAL LANGUAGE MODE) as text_score
                FROM \`${table}\`
                WHERE MATCH(\`${tCol}\`) AGAINST(? IN NATURAL LANGUAGE MODE) ${filterAnd}
                ORDER BY text_score DESC LIMIT ${limit}
              ) ranked_t
            )
            SELECT t.${selectCols === '*' ? '*' : selectCols}, 
                   COALESCE(v.distance, NULL) as vector_distance,
                   COALESCE(tx.text_score, 0) as text_score,
                   COALESCE(v.v_rank, 1000) as vector_rank,
                   COALESCE(tx.t_rank, 1000) as text_rank,
                   (
                     (1.0 / (${rrfK} + COALESCE(v.v_rank, 1000))) * ${validated.vectorWeight} + 
                     (1.0 / (${rrfK} + COALESCE(tx.t_rank, 1000))) * ${validated.textWeight}
                   ) as combined_score
            FROM \`${table}\` t
            LEFT JOIN vector_results v ON t.\`${pkCol}\` = v.\`${pkCol}\`
            LEFT JOIN text_results tx ON t.\`${pkCol}\` = tx.\`${pkCol}\`
            WHERE v.\`${pkCol}\` IS NOT NULL OR tx.\`${pkCol}\` IS NOT NULL
            ORDER BY combined_score DESC
            LIMIT ${limit}
          `;
          queryParams.push(vectorStr, queryText, queryText);
        } 
        else if (hasVector) {
          // Vector-only fallback
          const vectorStr = formatVector(validated.queryVector ?? []);
          
          query = `
            SELECT ${selectCols}, distance as vector_distance, 0 as text_score,
                   (1.0 / (${rrfK} + ROW_NUMBER() OVER (ORDER BY distance ASC))) * ${validated.vectorWeight} as combined_score
            FROM (
              SELECT *, DISTANCE(\`${vCol}\`, STRING_TO_VECTOR(?), '${metricLiteral}') as distance
              FROM \`${table}\`
              ${whereClause}
              ORDER BY distance ASC LIMIT ${limit}
            ) ranked
          `;
          queryParams.push(vectorStr);
        } 
        else {
          // Text-only fallback
          query = `
            SELECT ${selectCols}, NULL as vector_distance, text_score,
                   (1.0 / (${rrfK} + ROW_NUMBER() OVER (ORDER BY text_score DESC))) * ${validated.textWeight} as combined_score
            FROM (
              SELECT *, MATCH(\`${tCol}\`) AGAINST(? IN NATURAL LANGUAGE MODE) as text_score
              FROM \`${table}\`
              WHERE MATCH(\`${tCol}\`) AGAINST(? IN NATURAL LANGUAGE MODE) ${filterAnd}
              ORDER BY text_score DESC LIMIT ${limit}
            ) ranked
          `;
          queryParams.push(queryText, queryText);
        }

        const result = await adapter.executeQuery(query, queryParams);

        // Strip the raw vector column from the output to save tokens, 
        // user only needs the scores and the document data
        const transformedRows = (result.rows ?? []).map(row => {
          if (validated.select && validated.select.length > 0) {
             return row;
          }
          return Object.fromEntries(
            Object.entries(row).filter(([key]) => key !== validated.vectorColumn)
          );
        });

        return withTokenEstimate({
          success: true,
          data: {
            table: validated.table,
            results: transformedRows,
            count: transformedRows.length,
            weights: {
              vector: validated.vectorWeight,
              text: validated.textWeight
            }
          }
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("FUNCTION") && msg.includes("DISTANCE") && msg.includes("does not exist")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              "Vector distance functions require MySQL HeatWave or a specific vector plugin.",
              "EXTENSION_MISSING",
              ErrorCategory.CONFIGURATION,
              { suggestion: "Vector similarity search is only available in MySQL HeatWave or with compatible plugins." }
            )
          );
        }
        if (msg.includes("from_vector") || msg.includes("VECTOR_TO_STRING")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              "Column is not a valid VECTOR type.",
              "INVALID_COLUMN_TYPE",
              ErrorCategory.VALIDATION,
              { suggestion: "Ensure the specified column is a VECTOR data type." }
            )
          );
        }
        if (msg.includes("doesn't exist")) {
          const tableName = typeof params === 'object' && params !== null ? (params as Record<string, unknown>)['table'] : 'unknown';
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              `Table '${String(tableName)}' does not exist`,
              "TABLE_NOT_FOUND",
              ErrorCategory.QUERY,
              { suggestion: "Use mysql_list_tables to find available tables" }
            )
          );
        }
        if (msg.includes("Can't find FULLTEXT index")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              "No FULLTEXT index found for the specified text column",
              "FULLTEXT_INDEX_MISSING",
              ErrorCategory.QUERY,
              { suggestion: "Create a FULLTEXT index: ALTER TABLE ... ADD FULLTEXT(textColumn)" }
            )
          );
        }
        if (msg.includes("Unknown column")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              "Column not found in table",
              "COLUMN_NOT_FOUND",
              ErrorCategory.QUERY
            )
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
