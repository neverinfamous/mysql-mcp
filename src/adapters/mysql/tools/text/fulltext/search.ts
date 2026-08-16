import { ZodError } from "zod";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { ValidationError } from "../../../../../types/index.js";
import { sanitizeFulltextQuery } from "../fulltext-helpers.js";
import {
  FulltextSearchSchema,
  FulltextSearchSchemaBase,
  FulltextSearchOutputSchema,
} from "../../../schemas/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import {
  validateIdentifier,
  validateQualifiedIdentifier,
  escapeQualifiedTable,
} from "../../../../../utils/validators.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { truncateRowValues } from "./helpers.js";

export function createFulltextSearchTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_fulltext_search",
    title: "MySQL FULLTEXT Search",
    description: "Perform FULLTEXT search with relevance ranking.",
    group: "fulltext",
    inputSchema: FulltextSearchSchemaBase,
    outputSchema: FulltextSearchOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = FulltextSearchSchema.parse(params);
        const { table, columns, query, mode, maxLength, limit, includeFacets, cursor } = parsed;

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        for (const col of columns) {
          validateIdentifier(col, "column");
        }

        const sanitizedQuery = sanitizeFulltextQuery(query);
        if (!sanitizedQuery) {
          return withTokenEstimate({
            success: true,
            data: { rows: [], count: 0 },
          });
        }

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
            throw new ValidationError("Invalid cursor format", undefined, {
              suggestion: "Use the nextCursor value returned from a previous query.",
            });
          }
        }

        const columnList = columns.map((c) => `\`${c}\``).join(", ");
        let matchClause: string;
        let matchModeModifier: string;

        switch (mode) {
          case "BOOLEAN":
            matchModeModifier = "IN BOOLEAN MODE";
            matchClause = `MATCH(${columnList}) AGAINST(? IN BOOLEAN MODE)`;
            break;
          case "EXPANSION":
            matchModeModifier = "WITH QUERY EXPANSION";
            matchClause = `MATCH(${columnList}) AGAINST(? WITH QUERY EXPANSION)`;
            break;
          default:
            matchModeModifier = "IN NATURAL LANGUAGE MODE";
            matchClause = `MATCH(${columnList}) AGAINST(? IN NATURAL LANGUAGE MODE)`;
        }

        // Return searched columns and relevance for minimal payload
        // Bypass ProxySQL read-routing bug for MATCH queries on locked connections
        // We use WITH cte AS (...) SELECT ... because ProxySQL's default rule routes ^SELECT .* to HG2
        let sql = `WITH cte AS (SELECT *, ${matchClause} as relevance FROM ${escapeQualifiedTable(table)} WHERE ${matchClause}) SELECT * FROM cte ORDER BY relevance DESC`;
        const queryArgs: (string | number)[] = [sanitizedQuery, sanitizedQuery];

        const finalLimit = limit !== undefined && limit > 0 ? limit : 5;
        sql += ` LIMIT ${Math.floor(finalLimit)}`;
        if (offset > 0) {
          sql += ` OFFSET ${offset}`;
        }

        try {
          const result = await adapter.executeReadQuery(sql, queryArgs);
          const rawData = result.rows ?? [];
          const data = truncateRowValues(
            rawData,
            columns,
            maxLength ?? 250,
          );

          let nextCursor: string | undefined;
          if (data.length === finalLimit) {
            nextCursor = Buffer.from(
              JSON.stringify({ offset: offset + finalLimit }),
            ).toString("base64");
          }

          let facets: Record<string, number> | undefined;
          let warnings: string[] | undefined;
          let totalCount = data.length;
          if (includeFacets && data.length > 0) {
            facets = {};
            const countSql = `WITH cte AS (SELECT COUNT(*) AS cnt FROM ${escapeQualifiedTable(table)} WHERE ${matchClause}) SELECT * FROM cte`;
            try {
              const countResult = await adapter.executeReadQuery(countSql, [sanitizedQuery]);
              totalCount = Number(countResult.rows?.[0]?.["cnt"] ?? data.length);
            } catch {
              // Ignore and fallback to data.length
            }

            for (const col of columns) {
              const facetSql = `WITH cte AS (SELECT COUNT(*) AS cnt FROM ${escapeQualifiedTable(table)} WHERE MATCH(\`${col}\`) AGAINST(? ${matchModeModifier})) SELECT * FROM cte`;
              try {
                const facetResult = await adapter.executeReadQuery(facetSql, [sanitizedQuery]);
                const firstRow = facetResult.rows?.[0];
                facets[col] = Number(firstRow?.["cnt"] ?? 0);
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes("FULLTEXT index") || msg.includes("ER_FT_MATCHING_KEY_NOT_FOUND")) {
                  warnings ??= [];
                  warnings.push(`Facet skipped for '${col}': Requires individual FULLTEXT index`);
                } else {
                  throw err;
                }
              }
            }
            facets["total"] = totalCount;
          }

          return withTokenEstimate({
            success: true,
            data: {
              rows: data,
              count: includeFacets ? totalCount : data.length,
              ...(nextCursor ? { nextCursor } : {}),
              ...(facets ? { facets } : {}),
              ...(warnings ? { warnings } : {}),
            },
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes("Unknown column")) {
            return formatHandlerErrorResponse(
              new ValidationError(`One or more columns specified do not exist in table '${table}'`, undefined, {
                suggestion: "Check the table schema using mysql_describe_table to see available columns."
              }),
            );
          }
          if (msg.includes("does not exist") || msg.includes("doesn't exist")) {
            return formatHandlerErrorResponse(
              new ValidationError(`Table '${table}' does not exist`, undefined, {
                suggestion: "Table or collection does not exist. Run mysql_list_tables or mysql_doc_list_collections to see available objects."
              }),
            );
          }
          if (
            msg.includes("Can't find FULLTEXT index matching the column list")
          ) {
            return formatHandlerErrorResponse(
              new ValidationError("No FULLTEXT index found for the specified columns", undefined, {
                suggestion: "Ensure that a FULLTEXT index exists on the exact combination of columns specified."
              }),
            );
          }
          if (msg.includes("syntax error, unexpected")) {
            return formatHandlerErrorResponse(
              new ValidationError(`Invalid search syntax: ${query}`),
            );
          }
          return formatHandlerErrorResponse(error);
        }
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
