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
  dbName: z.string().optional().describe("Alias for schema"),
  limit: z.union([z.number(), z.string()]).optional().describe("Maximum number of results to return (default: 50)"),
  offset: z.union([z.number(), z.string()]).optional().describe("Number of results to skip (default: 0)"),
  pattern: z.string().optional().describe("Filter pattern for routine name (LIKE syntax, e.g. 'get_%')"),
  filter: z.string().optional().describe("Alias for pattern"),
  search: z.string().optional().describe("Alias for pattern"),
  routine: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
  name: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
  routineName: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
  routines: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
  procedure: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
  procedureName: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
  procedures: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
  function: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
  functionName: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
  functions: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
  table: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
  tableName: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
  tables: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
});

const ListObjectsSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      return {
        ...obj,
        schema: (obj['schema'] === "" ? undefined : obj['schema']) ?? (obj['database'] === "" ? undefined : obj['database']) ?? (obj['dbName'] === "" ? undefined : obj['dbName']),
        pattern: obj['pattern'] ?? obj['filter'] ?? obj['search'],
        routine: obj['routine'] ?? obj['name'] ?? obj['routineName'] ?? obj['routines'] ?? obj['procedure'] ?? obj['procedureName'] ?? obj['procedures'] ?? obj['function'] ?? obj['functionName'] ?? obj['functions'],
        table: obj['table'] ?? obj['tableName'] ?? obj['tables'],
      };
    }
    return val;
  },
  z.object({
    schema: z.string().optional(),
    pattern: z.string().optional(),
    routine: z.unknown().optional(),
    table: z.unknown().optional(),
    limit: z.preprocess((val) => {
      if (typeof val === "string") {
        const parsed = Number(val);
        return isNaN(parsed) ? val : parsed;
      }
      return val;
    }, z.number().int().positive().default(50)),
    offset: z.preprocess((val) => {
      if (typeof val === "string") {
        const parsed = Number(val);
        return isNaN(parsed) ? val : parsed;
      }
      return val;
    }, z.number().int().nonnegative().default(0)),
  })
).refine((data) => data.routine === undefined, {
  message: "🛠️ AUTONOMOUS HEALING: Do not pass 'name', 'procedure', or 'function' to list tools. To read data from a routine, use mysql_read_query. To list routines, you don't need to specify a routine name.",
}).refine((data) => data.table === undefined, {
  message: "🛠️ AUTONOMOUS HEALING: Routines belong to a schema, not a table. Do not pass 'table' or 'tableName'. Use 'schema' to filter by database.",
});

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

        let query = `
                SELECT
                    r.ROUTINE_NAME as name,
                    r.ROUTINE_TYPE as type,
                    r.DEFINER as definer,
                    r.CREATED as created,
                    r.LAST_ALTERED as lastAltered,
                    r.SQL_DATA_ACCESS as dataAccess,
                    r.SECURITY_TYPE as securityType,
                    CASE 
                        WHEN CHAR_LENGTH(r.ROUTINE_COMMENT) > 100 
                        THEN CONCAT(LEFT(r.ROUTINE_COMMENT, 97), '...') 
                        ELSE r.ROUTINE_COMMENT 
                    END as comment,
                    GROUP_CONCAT(
                        CONCAT(p.PARAMETER_MODE, ' ', p.PARAMETER_NAME, ' ', p.DATA_TYPE)
                        ORDER BY p.ORDINAL_POSITION
                        SEPARATOR ', '
                    ) as parameters
                FROM information_schema.ROUTINES r
                LEFT JOIN information_schema.PARAMETERS p
                    ON r.ROUTINE_SCHEMA = p.SPECIFIC_SCHEMA
                    AND r.ROUTINE_NAME = p.SPECIFIC_NAME
                    AND p.ROUTINE_TYPE = r.ROUTINE_TYPE
                    AND p.PARAMETER_MODE IS NOT NULL
                WHERE r.ROUTINE_SCHEMA = COALESCE(?, DATABASE())
                  AND r.ROUTINE_TYPE = 'PROCEDURE'
            `;

        const queryParams: unknown[] = [targetSchema ?? null];

        if (parsedParams.pattern) {
          query += " AND r.ROUTINE_NAME LIKE ?";
          queryParams.push(parsedParams.pattern);
        }

        query += `
                GROUP BY r.ROUTINE_NAME, r.ROUTINE_TYPE, r.DEFINER, r.CREATED,
                         r.LAST_ALTERED, r.SQL_DATA_ACCESS, r.SECURITY_TYPE, r.ROUTINE_COMMENT
                ORDER BY r.ROUTINE_NAME
                LIMIT ${parsedParams.limit} OFFSET ${parsedParams.offset}
            `;

        const result = await adapter.executeQuery(query, queryParams);
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

        let query = `
                SELECT
                    r.ROUTINE_NAME as name,
                    r.DATA_TYPE as returnType,
                    r.DEFINER as definer,
                    r.CREATED as created,
                    r.LAST_ALTERED as lastAltered,
                    r.SQL_DATA_ACCESS as dataAccess,
                    r.SECURITY_TYPE as securityType,
                    CASE 
                        WHEN CHAR_LENGTH(r.ROUTINE_COMMENT) > 100 
                        THEN CONCAT(LEFT(r.ROUTINE_COMMENT, 97), '...') 
                        ELSE r.ROUTINE_COMMENT 
                    END as comment,
                    r.IS_DETERMINISTIC as isDeterministic,
                    GROUP_CONCAT(
                        CONCAT(COALESCE(p.PARAMETER_NAME, ''), ' ', p.DATA_TYPE)
                        ORDER BY p.ORDINAL_POSITION
                        SEPARATOR ', '
                    ) as parameters
                FROM information_schema.ROUTINES r
                LEFT JOIN information_schema.PARAMETERS p
                    ON r.ROUTINE_SCHEMA = p.SPECIFIC_SCHEMA
                    AND r.ROUTINE_NAME = p.SPECIFIC_NAME
                    AND p.ROUTINE_TYPE = r.ROUTINE_TYPE
                    AND p.ORDINAL_POSITION > 0
                WHERE r.ROUTINE_SCHEMA = COALESCE(?, DATABASE())
                  AND r.ROUTINE_TYPE = 'FUNCTION'
            `;

        const queryParams: unknown[] = [targetSchema ?? null];

        if (parsedParams.pattern) {
          query += " AND r.ROUTINE_NAME LIKE ?";
          queryParams.push(parsedParams.pattern);
        }

        query += `
                GROUP BY r.ROUTINE_NAME, r.DATA_TYPE, r.DEFINER, r.CREATED,
                         r.LAST_ALTERED, r.SQL_DATA_ACCESS, r.SECURITY_TYPE, r.ROUTINE_COMMENT,
                         r.IS_DETERMINISTIC
                ORDER BY r.ROUTINE_NAME
                LIMIT ${parsedParams.limit} OFFSET ${parsedParams.offset}
            `;

        const result = await adapter.executeQuery(query, queryParams);
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
