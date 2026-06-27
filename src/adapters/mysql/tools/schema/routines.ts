import { z } from "zod";

import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import { BaseOutputSchema } from "../../schemas/output-schemas.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { READ_ONLY } from "../../../../utils/annotations.js";

const ListObjectsSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema name (defaults to current database)"),
  database: z.string().optional().describe("Alias for schema"),
  limit: z.number().default(50).describe("Maximum number of results to return"),
  offset: z.number().default(0).describe("Number of results to skip"),
});

const ListObjectsSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      return {
        ...obj,
        schema: obj['schema'] ?? obj['database'],
      };
    }
    return val;
  },
  z.object({
    schema: z.string().optional(),
    limit: z.number().default(50),
    offset: z.number().default(0),
  })
);

const ListStoredProceduresOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    procedures: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).optional()
});

const ListFunctionsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    functions: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).optional()
});

/**
 * List stored procedures
 */
export function createListStoredProceduresTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_list_stored_procedures",
    title: "MySQL List Stored Procedures",
    description: "List all stored procedures with parameters and metadata.",
    group: "schema",
    inputSchema: ListObjectsSchemaBase,
    outputSchema: ListStoredProceduresOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsedParams = ListObjectsSchema.parse(params);
        const targetSchema = parsedParams.schema;

        // P154: Schema existence check when explicitly provided
        if (targetSchema !== undefined && targetSchema !== "") {
          const schemaCheck = await adapter.executeQuery(
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
            [targetSchema],
          );
          if (schemaCheck.rows === undefined || schemaCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new Error(`Schema '${targetSchema}' does not exist`),
            );
          }
        }

        const query = `
                SELECT
                    r.ROUTINE_NAME as name,
                    r.ROUTINE_TYPE as type,
                    r.DEFINER as definer,
                    r.CREATED as created,
                    r.LAST_ALTERED as lastAltered,
                    r.SQL_DATA_ACCESS as dataAccess,
                    r.SECURITY_TYPE as securityType,
                    r.ROUTINE_COMMENT as comment,
                    GROUP_CONCAT(
                        CONCAT(p.PARAMETER_MODE, ' ', p.PARAMETER_NAME, ' ', p.DATA_TYPE)
                        ORDER BY p.ORDINAL_POSITION
                        SEPARATOR ', '
                    ) as parameters
                FROM information_schema.ROUTINES r
                LEFT JOIN information_schema.PARAMETERS p
                    ON r.ROUTINE_SCHEMA = p.SPECIFIC_SCHEMA
                    AND r.ROUTINE_NAME = p.SPECIFIC_NAME
                    AND p.PARAMETER_MODE IS NOT NULL
                WHERE r.ROUTINE_SCHEMA = COALESCE(?, DATABASE())
                  AND r.ROUTINE_TYPE = 'PROCEDURE'
                GROUP BY r.ROUTINE_NAME, r.ROUTINE_TYPE, r.DEFINER, r.CREATED,
                         r.LAST_ALTERED, r.SQL_DATA_ACCESS, r.SECURITY_TYPE, r.ROUTINE_COMMENT
                ORDER BY r.ROUTINE_NAME
                LIMIT ? OFFSET ?
            `;

        const result = await adapter.executeQuery(query, [
          targetSchema ?? null,
          parsedParams.limit,
          parsedParams.offset,
        ]);
        return withTokenEstimate({
          success: true,
          data: {
            procedures: result.rows,
            count: result.rows?.length ?? 0,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

/**
 * List user-defined functions
 */
export function createListFunctionsTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_list_functions",
    title: "MySQL List Functions",
    description:
      "List all user-defined functions with return types and metadata.",
    group: "schema",
    inputSchema: ListObjectsSchemaBase,
    outputSchema: ListFunctionsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsedParams = ListObjectsSchema.parse(params);
        const targetSchema = parsedParams.schema;

        // P154: Schema existence check when explicitly provided
        if (targetSchema !== undefined && targetSchema !== "") {
          const schemaCheck = await adapter.executeQuery(
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
            [targetSchema],
          );
          if (schemaCheck.rows === undefined || schemaCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new Error(`Schema '${targetSchema}' does not exist`),
            );
          }
        }

        const query = `
                SELECT
                    r.ROUTINE_NAME as name,
                    r.DATA_TYPE as returnType,
                    r.DEFINER as definer,
                    r.CREATED as created,
                    r.LAST_ALTERED as lastAltered,
                    r.SQL_DATA_ACCESS as dataAccess,
                    r.SECURITY_TYPE as securityType,
                    r.ROUTINE_COMMENT as comment,
                    r.IS_DETERMINISTIC as isDeterministic
                FROM information_schema.ROUTINES r
                WHERE r.ROUTINE_SCHEMA = COALESCE(?, DATABASE())
                  AND r.ROUTINE_TYPE = 'FUNCTION'
                ORDER BY r.ROUTINE_NAME
                LIMIT ? OFFSET ?
            `;

        const result = await adapter.executeQuery(query, [
          targetSchema ?? null,
          parsedParams.limit,
          parsedParams.offset,
        ]);
        return withTokenEstimate({
          success: true,
          data: {
            functions: result.rows,
            count: result.rows?.length ?? 0,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
