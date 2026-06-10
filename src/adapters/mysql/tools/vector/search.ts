import type { ToolDefinition } from "../../../../types/index.js";
import type { RequestContext } from "../../../../types/index.js";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import { formatHandlerErrorResponse, withTokenEstimate } from "../core/error-helpers.js";
import { READ_ONLY } from "../../../../utils/annotations.js";
import {
  VectorSearchSchemaBase,
  VectorSearchSchema,
  VectorRangeSearchSchemaBase,
  VectorRangeSearchSchema,
  VectorHybridSearchSchemaBase,
  VectorHybridSearchSchema,
} from "../../schemas/vector.js";
import { ensureVectorSupport, formatVector, parseVector, sanitizeIdentifier } from "./helpers.js";

export function createVectorSearchTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_vector_search",
    title: "Vector KNN Search",
    description: "Find the K nearest neighbors to a query vector.",
    group: "vector",
    inputSchema: VectorSearchSchemaBase,
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
          LIMIT ?
        `;

        const result = await adapter.executeQuery(query, [vectorStr, validated.k]);

        // Transform results to parse the vector strings
        const transformedRows = (result.rows ?? []).map(row => {
          const { vector_str, ...rest } = row;
          return {
            ...rest,
            vector: typeof vector_str === 'string' && vector_str ? parseVector(vector_str) : null
          };
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
      } catch (e) {
        return formatHandlerErrorResponse(e);
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
          LIMIT ?
        `;

        const result = await adapter.executeQuery(query, [vectorStr, validated.maxDistance, validated.limit]);

        const transformedRows = (result.rows ?? []).map(row => {
          const { vector_str, ...rest } = row;
          return {
            ...rest,
            vector: typeof vector_str === 'string' && vector_str ? parseVector(vector_str) : null
          };
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
      } catch (e) {
        return formatHandlerErrorResponse(e);
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
        const hasText = (validated.queryText?.trim().length ?? 0) > 0;

        // Base case 1: Neither provided (caught by Zod refine, but double-checking)
        if (!hasVector && !hasText) {
          throw new Error("Must provide either queryVector or queryText");
        }

        const queryParams: unknown[] = [];
        
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
          
        let query = "";

        if (hasVector && hasText) {
          // Full Hybrid Search with RRF
          const vectorStr = formatVector(validated.queryVector ?? []);
          queryParams.push(vectorStr, validated.k, validated.queryText, validated.k);
          
          query = `
            WITH vector_results AS (
              SELECT \`${pkCol}\`,
                     DISTANCE(\`${vCol}\`, STRING_TO_VECTOR(?), 'COSINE') as distance,
                     ROW_NUMBER() OVER (ORDER BY DISTANCE(\`${vCol}\`, STRING_TO_VECTOR(?), 'COSINE') ASC) as v_rank
              FROM \`${table}\`
              LIMIT ?
            ),
            text_results AS (
              SELECT \`${pkCol}\`,
                     MATCH(\`${tCol}\`) AGAINST(? IN NATURAL LANGUAGE MODE) as text_score,
                     ROW_NUMBER() OVER (ORDER BY MATCH(\`${tCol}\`) AGAINST(? IN NATURAL LANGUAGE MODE) DESC) as t_rank
              FROM \`${table}\`
              WHERE MATCH(\`${tCol}\`) AGAINST(? IN NATURAL LANGUAGE MODE)
              LIMIT ?
            )
            SELECT t.*, 
                   COALESCE(v.distance, NULL) as vector_distance,
                   COALESCE(tx.text_score, 0) as text_score,
                   COALESCE(v.v_rank, 1000) as vector_rank,
                   COALESCE(tx.t_rank, 1000) as text_rank,
                   -- RRF Score formula: (1 / (60 + rank_a)) * weight_a + (1 / (60 + rank_b)) * weight_b
                   (
                     (1.0 / (60 + COALESCE(v.v_rank, 1000))) * ${validated.vectorWeight} + 
                     (1.0 / (60 + COALESCE(tx.t_rank, 1000))) * ${validated.textWeight}
                   ) as combined_score
            FROM \`${table}\` t
            LEFT JOIN vector_results v ON t.\`${pkCol}\` = v.\`${pkCol}\`
            LEFT JOIN text_results tx ON t.\`${pkCol}\` = tx.\`${pkCol}\`
            WHERE v.\`${pkCol}\` IS NOT NULL OR tx.\`${pkCol}\` IS NOT NULL
            ORDER BY combined_score DESC
            LIMIT ${validated.k}
          `;
          
          // Add the extra params needed for the window functions
          queryParams.splice(1, 0, vectorStr); // for ROW_NUMBER
          queryParams.splice(5, 0, validated.queryText, validated.queryText); // for ROW_NUMBER and WHERE
        } 
        else if (hasVector) {
          // Vector-only fallback
          const vectorStr = formatVector(validated.queryVector ?? []);
          queryParams.push(vectorStr, validated.k);
          
          query = `
            SELECT *, 
                   DISTANCE(\`${vCol}\`, STRING_TO_VECTOR(?), 'COSINE') as vector_distance,
                   0 as text_score,
                   (1.0 / (60 + ROW_NUMBER() OVER (ORDER BY DISTANCE(\`${vCol}\`, STRING_TO_VECTOR(?), 'COSINE') ASC))) * ${validated.vectorWeight} as combined_score
            FROM \`${table}\`
            ORDER BY vector_distance ASC
            LIMIT ?
          `;
          
          queryParams.splice(1, 0, vectorStr); // for ROW_NUMBER
        } 
        else {
          // Text-only fallback
          queryParams.push(validated.queryText, validated.queryText, validated.k);
          
          query = `
            SELECT *, 
                   NULL as vector_distance,
                   MATCH(\`${tCol}\`) AGAINST(? IN NATURAL LANGUAGE MODE) as text_score,
                   (1.0 / (60 + ROW_NUMBER() OVER (ORDER BY MATCH(\`${tCol}\`) AGAINST(? IN NATURAL LANGUAGE MODE) DESC))) * ${validated.textWeight} as combined_score
            FROM \`${table}\`
            WHERE MATCH(\`${tCol}\`) AGAINST(? IN NATURAL LANGUAGE MODE)
            ORDER BY text_score DESC
            LIMIT ?
          `;
          
          queryParams.splice(1, 0, validated.queryText); // for ROW_NUMBER
        }

        const result = await adapter.executeQuery(query, queryParams);

        // Strip the raw vector column from the output to save tokens, 
        // user only needs the scores and the document data
        const transformedRows = (result.rows ?? []).map(row => {
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
      } catch (e) {
        return formatHandlerErrorResponse(e);
      }
    },
  };
}
