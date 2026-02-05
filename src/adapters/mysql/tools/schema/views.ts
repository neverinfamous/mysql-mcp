import { z } from "zod";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  validateQualifiedIdentifier,
  escapeQualifiedTable,
} from "../../../../utils/validators.js";

const ListViewsSchema = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema name (defaults to current database)"),
});

const CreateViewSchema = z.object({
  name: z.string().describe("View name"),
  definition: z.string().describe("SELECT statement defining the view"),
  orReplace: z.boolean().default(false).describe("Use CREATE OR REPLACE"),
  algorithm: z
    .enum(["UNDEFINED", "MERGE", "TEMPTABLE"])
    .default("UNDEFINED")
    .describe("View algorithm"),
  checkOption: z
    .enum(["NONE", "CASCADED", "LOCAL"])
    .default("NONE")
    .describe("WITH CHECK OPTION"),
});

/**
 * List all views
 */
export function createListViewsTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_list_views",
    title: "MySQL List Views",
    description:
      "List all views with their definitions, security type, and check option.",
    group: "schema",
    inputSchema: ListViewsSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { schema } = ListViewsSchema.parse(params);

      const query = `
                SELECT 
                    TABLE_NAME as name,
                    VIEW_DEFINITION as definition,
                    DEFINER as definer,
                    SECURITY_TYPE as securityType,
                    CHECK_OPTION as checkOption,
                    IS_UPDATABLE as isUpdatable
                FROM information_schema.VIEWS
                WHERE TABLE_SCHEMA = COALESCE(?, DATABASE())
                ORDER BY TABLE_NAME
            `;

      const result = await adapter.executeQuery(query, [schema ?? null]);
      return {
        views: result.rows,
        count: result.rows?.length ?? 0,
      };
    },
  };
}

/**
 * Create a view
 */
export function createCreateViewTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_create_view",
    title: "MySQL Create View",
    description:
      "Create or replace a view with specified algorithm and check option.",
    group: "schema",
    inputSchema: CreateViewSchema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { name, definition, orReplace, algorithm, checkOption } =
        CreateViewSchema.parse(params);

      validateQualifiedIdentifier(name, "view");

      const fullViewName = escapeQualifiedTable(name);

      const createClause = orReplace ? "CREATE OR REPLACE" : "CREATE";
      let sql = `${createClause} ALGORITHM=${algorithm} VIEW ${fullViewName} AS ${definition}`;

      if (checkOption !== "NONE") {
        sql += ` WITH ${checkOption} CHECK OPTION`;
      }

      await adapter.executeQuery(sql);
      return { success: true, viewName: name };
    },
  };
}
