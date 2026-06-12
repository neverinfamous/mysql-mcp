import {
  ReadQuerySchema,
  ReadQuerySchemaBase,
  ReadQueryOutputSchema,
  WriteQuerySchema,
  WriteQuerySchemaBase,
  WriteQueryOutputSchema,
} from "../../schemas/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "./error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { ValidationError } from "../../../../types/index.js";
import { READ_ONLY, WRITE } from "../../../../utils/annotations.js";
import { streamResultRows } from "../../../../utils/stream-utils.js";

export function createReadQueryTool(adapter: MySQLAdapter): ToolDefinition {
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
            const parsed: unknown = JSON.parse(
              Buffer.from(cursor, "base64").toString("utf8"),
            );
            if (
              parsed !== null &&
              typeof parsed === "object" &&
              "offset" in parsed &&
              typeof parsed.offset === "number"
            ) {
              offset = parsed.offset;
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

        if (stream === true && _context.isCodeMode !== true) {
          if (_context.progressToken !== undefined) {
            const chunksEmitted = streamResultRows(
              _context.progressToken,
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

export function createWriteQueryTool(adapter: MySQLAdapter): ToolDefinition {
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
