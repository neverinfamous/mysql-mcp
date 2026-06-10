import { z } from "zod";

import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import { BaseOutputSchema } from "../../schemas/output-schemas.js";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  validateQualifiedIdentifier,
  escapeQualifiedTable,
} from "../../../../utils/validators.js";
import { READ_ONLY, WRITE } from "../../../../utils/annotations.js";

const ListViewsSchema = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema name (defaults to current database)"),
  database: z.string().optional().describe("Alias for schema"),
});

const ListViewsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    views: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).optional()
});

const CreateViewSchemaBase = z.object({
  name: z.string().optional().describe("View name"),
  definition: z
    .string()
    .optional()
    .describe("SELECT statement defining the view"),
  query: z.string().optional().describe("Alias for definition"),
  orReplace: z.boolean().default(false).describe("Use CREATE OR REPLACE"),
  algorithm: z.string().default("UNDEFINED").describe("View algorithm"),
  checkOption: z.string().default("NONE").describe("WITH CHECK OPTION"),
});

const CreateViewSchema = z.object({
  name: z.string().describe("View name"),
  definition: z
    .string()
    .optional()
    .describe("SELECT statement defining the view"),
  query: z.string().optional().describe("Alias for definition"),
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

const CreateViewOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    viewName: z.string(),
  }).optional()
});

const DropViewSchemaBase = z.object({
  name: z.string().optional().describe("View name"),
  ifExists: z.boolean().optional().describe("Use IF EXISTS"),
});

const DropViewSchema = z.object({
  name: z.string().describe("View name"),
  ifExists: z.boolean().default(false).describe("Use IF EXISTS"),
});

const DropViewOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    viewName: z.string(),
  }).optional()
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
    outputSchema: ListViewsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsedParams = ListViewsSchema.parse(params);
        const targetSchema = parsedParams.schema ?? parsedParams.database;

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

        const result = await adapter.executeQuery(query, [
          targetSchema ?? null,
        ]);
        return withTokenEstimate({
          success: true,
          data: {
            views: result.rows,
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
 * Create a view
 */
export function createCreateViewTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_create_view",
    title: "MySQL Create View",
    description:
      "Create or replace a view with specified algorithm and check option.",
    group: "schema",
    inputSchema: CreateViewSchemaBase,
    outputSchema: CreateViewOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsedParams = CreateViewSchema.parse(params);
        const name = parsedParams.name;
        const definition = parsedParams.definition;
        const query = parsedParams.query;
        const orReplace = parsedParams.orReplace;
        const algorithm = parsedParams.algorithm;
        const checkOption = parsedParams.checkOption;

        const finalDefinition = definition ?? query;
        if (finalDefinition === undefined || finalDefinition === "") {
          return formatHandlerErrorResponse(
            new Error("Validation error: definition or query must be provided"),
          );
        }

        try {
          validateQualifiedIdentifier(name, "view");
        } catch (err: unknown) {
          return formatHandlerErrorResponse(err);
        }

        const fullViewName = escapeQualifiedTable(name);

        const createClause = orReplace ? "CREATE OR REPLACE" : "CREATE";
        let sql = `${createClause} ALGORITHM=${algorithm} VIEW ${fullViewName} AS ${finalDefinition}`;

        if (checkOption !== "NONE") {
          sql += ` WITH ${checkOption} CHECK OPTION`;
        }

        try {
          await adapter.executeQuery(sql);
          adapter.clearSchemaCache();
          return withTokenEstimate({
            success: true,
            data: { viewName: name }
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.toLowerCase().includes("already exists")) {
            return formatHandlerErrorResponse(
              new Error(`View '${name}' already exists`),
            );
          }
          return formatHandlerErrorResponse(err);
        }
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

/**
 * Drop a view
 */
export function createDropViewTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_drop_view",
    title: "MySQL Drop View",
    description: "Drop a view.",
    group: "schema",
    inputSchema: DropViewSchemaBase,
    outputSchema: DropViewOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsedParams = DropViewSchema.parse(params);
        try {
          validateQualifiedIdentifier(parsedParams.name, "view");
        } catch (err: unknown) {
          return formatHandlerErrorResponse(err);
        }

        const fullViewName = escapeQualifiedTable(parsedParams.name);
        const ifExistsClause = parsedParams.ifExists ? "IF EXISTS " : "";
        const sql = `DROP VIEW ${ifExistsClause}${fullViewName}`;

        try {
          await adapter.executeQuery(sql);
          adapter.clearSchemaCache();
          return withTokenEstimate({
            success: true,
            data: { viewName: parsedParams.name },
          });
        } catch (err: unknown) {
          return formatHandlerErrorResponse(err);
        }
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
