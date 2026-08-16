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
import {
  validateQualifiedIdentifier,
  escapeQualifiedTable,
  validateIdentifier,
} from "../../../../utils/validators.js";
import { READ_ONLY, WRITE } from "../../../../utils/annotations.js";

const ListViewsSchemaBase = z.object({
  schema: z
    .string()
    .optional()
    .describe("Schema name (defaults to current database)"),
  database: z.string().optional().describe("Alias for schema"),
  schemaName: z.string().optional().describe("Alias for schema"),
  databaseName: z.string().optional().describe("Alias for schema"),
  schema_name: z.string().optional().describe("Alias for schema"),
  database_name: z.string().optional().describe("Alias for schema"),
  limit: z.number().default(50).describe("Maximum number of results to return"),
  offset: z.number().default(0).describe("Number of results to skip"),
  pattern: z.string().optional().describe("Filter pattern for view name (LIKE syntax, e.g. 'user_%')"),
  filter: z.string().optional().describe("Alias for pattern"),
  search: z.string().optional().describe("Alias for pattern"),
  view: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
  name: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
  viewName: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
  tableName: z.unknown().optional().describe("Anti-hallucination property. Do not use."),
});

const ListViewsSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      return {
        ...obj,
        schema: (obj['schema'] === "" ? undefined : obj['schema']) ?? (obj['database'] === "" ? undefined : obj['database']) ?? (obj['schemaName'] === "" ? undefined : obj['schemaName']) ?? (obj['databaseName'] === "" ? undefined : obj['databaseName']) ?? (obj['schema_name'] === "" ? undefined : obj['schema_name']) ?? (obj['database_name'] === "" ? undefined : obj['database_name']),
        limit: obj['limit'] !== undefined ? Number(obj['limit']) : undefined,
        offset: obj['offset'] !== undefined ? Number(obj['offset']) : undefined,
        pattern: obj['pattern'] ?? obj['filter'] ?? obj['search'],
        view: obj['view'] ?? obj['name'] ?? obj['viewName'] ?? obj['tableName'],
      };
    }
    return val;
  },
  z.object({
    schema: z.string().optional(),
    limit: z.number().int().min(0).default(50),
    offset: z.number().int().min(0).default(0),
    pattern: z.string().optional(),
    view: z.unknown().optional(),
  })
).refine((data) => data.view === undefined, {
  message: "🛠️ AUTONOMOUS HEALING: Do not pass 'view', 'name', or 'tableName' to mysql_list_views. To read data from a view, use mysql_read_query. To list views, you don't need to specify a view name.",
});

const ListViewsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    views: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).optional()
});

const CreateViewSchemaBase = z.object({
  name: z.string().default("").describe("View name"),
  view: z.string().default("").describe("Alias for name"),
  viewName: z.string().default("").describe("Alias for name"),
  tableName: z.string().default("").describe("Alias for name (anti-hallucination)"),
  schema: z.string().optional().describe("Schema name (defaults to current database)"),
  database: z.string().optional().describe("Alias for schema"),
  schemaName: z.string().optional().describe("Alias for schema"),
  databaseName: z.string().optional().describe("Alias for schema"),
  schema_name: z.string().optional().describe("Alias for schema"),
  database_name: z.string().optional().describe("Alias for schema"),
  definition: z
    .string()
    .default("")
    .describe("SELECT statement defining the view (required)"),
  query: z.string().default("").describe("Alias for definition"),
  sql: z.string().default("").describe("Alias for definition"),
  orReplace: z.boolean().default(false).describe("Use CREATE OR REPLACE"),
  replace: z.boolean().default(false).describe("Alias for orReplace"),
  algorithm: z.string().default("UNDEFINED").describe("View algorithm"),
  security: z.string().optional().describe("SQL SECURITY (DEFINER or INVOKER)"),
  checkOption: z.string().default("NONE").describe("WITH CHECK OPTION"),
});

const CreateViewSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      return {
        ...obj,
        name: (typeof obj['name'] === 'string' && obj['name'] !== "") ? obj['name'] :
              (typeof obj['view'] === 'string' && obj['view'] !== "") ? obj['view'] :
              (typeof obj['viewName'] === 'string' && obj['viewName'] !== "") ? obj['viewName'] :
              (typeof obj['tableName'] === 'string' && obj['tableName'] !== "") ? obj['tableName'] : "",
        schema: (typeof obj['schema'] === 'string' && obj['schema'] !== "") ? obj['schema'] :
                (typeof obj['database'] === 'string' && obj['database'] !== "") ? obj['database'] :
                (typeof obj['schemaName'] === 'string' && obj['schemaName'] !== "") ? obj['schemaName'] :
                (typeof obj['databaseName'] === 'string' && obj['databaseName'] !== "") ? obj['databaseName'] :
                (typeof obj['schema_name'] === 'string' && obj['schema_name'] !== "") ? obj['schema_name'] :
                (typeof obj['database_name'] === 'string' && obj['database_name'] !== "") ? obj['database_name'] : undefined,
        definition: (typeof obj['definition'] === 'string' && obj['definition'] !== "") ? obj['definition'] :
                    (typeof obj['query'] === 'string' && obj['query'] !== "") ? obj['query'] :
                    (typeof obj['sql'] === 'string' && obj['sql'] !== "") ? obj['sql'] : "",
        orReplace: (typeof obj['orReplace'] === 'boolean' ? obj['orReplace'] : typeof obj['orReplace'] === 'string' ? obj['orReplace'].toLowerCase() === 'true' : false) ||
                   (typeof obj['replace'] === 'boolean' ? obj['replace'] : typeof obj['replace'] === 'string' ? obj['replace'].toLowerCase() === 'true' : false),
        algorithm: typeof obj['algorithm'] === 'string' ? obj['algorithm'].toUpperCase() : obj['algorithm'],
        security: typeof obj['security'] === 'string' ? obj['security'].toUpperCase() : obj['security'],
        checkOption: typeof obj['checkOption'] === 'string' ? obj['checkOption'].toUpperCase() : obj['checkOption'],
      };
    }
    return val;
  },
  z.object({
    name: z.string().min(1, "View name is required").describe("View name"),
    schema: z.string().optional(),
    definition: z
      .string()
      .min(1, "View definition (SELECT statement) is required")
      .describe("SELECT statement defining the view"),
    orReplace: z.boolean().default(false).describe("Use CREATE OR REPLACE"),
    algorithm: z
      .enum(["UNDEFINED", "MERGE", "TEMPTABLE"])
      .default("UNDEFINED")
      .describe("View algorithm"),
    security: z
      .enum(["DEFINER", "INVOKER"])
      .optional()
      .describe("SQL SECURITY"),
    checkOption: z
      .enum(["NONE", "CASCADED", "LOCAL"])
      .default("NONE")
      .describe("WITH CHECK OPTION"),
  })
);

const CreateViewOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    viewName: z.string(),
  }).optional()
});

const DropViewSchemaBase = z.object({
  name: z.string().default("").describe("View name"),
  view: z.string().default("").describe("Alias for name"),
  viewName: z.string().default("").describe("Alias for name"),
  tableName: z.string().default("").describe("Alias for name (anti-hallucination)"),
  schema: z.string().optional().describe("Schema name (defaults to current database)"),
  database: z.string().optional().describe("Alias for schema"),
  schemaName: z.string().optional().describe("Alias for schema"),
  databaseName: z.string().optional().describe("Alias for schema"),
  schema_name: z.string().optional().describe("Alias for schema"),
  database_name: z.string().optional().describe("Alias for schema"),
  ifExists: z.boolean().default(false).describe("Use IF EXISTS"),
});

const DropViewSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      return {
        ...obj,
        name: (typeof obj['name'] === 'string' && obj['name'] !== "") ? obj['name'] :
              (typeof obj['view'] === 'string' && obj['view'] !== "") ? obj['view'] :
              (typeof obj['viewName'] === 'string' && obj['viewName'] !== "") ? obj['viewName'] :
              (typeof obj['tableName'] === 'string' && obj['tableName'] !== "") ? obj['tableName'] : "",
        schema: (typeof obj['schema'] === 'string' && obj['schema'] !== "") ? obj['schema'] :
                (typeof obj['database'] === 'string' && obj['database'] !== "") ? obj['database'] :
                (typeof obj['schemaName'] === 'string' && obj['schemaName'] !== "") ? obj['schemaName'] :
                (typeof obj['databaseName'] === 'string' && obj['databaseName'] !== "") ? obj['databaseName'] :
                (typeof obj['schema_name'] === 'string' && obj['schema_name'] !== "") ? obj['schema_name'] :
                (typeof obj['database_name'] === 'string' && obj['database_name'] !== "") ? obj['database_name'] : undefined,
        ifExists: typeof obj['ifExists'] === 'string' ? obj['ifExists'].toLowerCase() === 'true' : obj['ifExists'],
      };
    }
    return val;
  },
  z.object({
    name: z.string().min(1, "View name is required").describe("View name"),
    schema: z.string().optional(),
    ifExists: z.boolean().default(false).describe("Use IF EXISTS"),
  })
);

const DropViewOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    viewName: z.string().optional(),
    skipped: z.boolean().optional(),
    reason: z.string().optional(),
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
    inputSchema: ListViewsSchemaBase,
    outputSchema: ListViewsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsedParams = ListViewsSchema.parse(params);
        const targetSchema = parsedParams.schema;

        // P154: Schema existence check when explicitly provided
        if (targetSchema !== undefined && targetSchema !== "") {
          try {
            validateIdentifier(targetSchema, "schema");
          } catch (err: unknown) {
            return formatHandlerErrorResponse(err);
          }
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
                    TABLE_NAME as name,
                    VIEW_DEFINITION as definition,
                    DEFINER as definer,
                    SECURITY_TYPE as securityType,
                    CHECK_OPTION as checkOption,
                    IS_UPDATABLE as isUpdatable
                FROM information_schema.VIEWS
                WHERE TABLE_SCHEMA = COALESCE(?, DATABASE())
            `;

        const queryParams: unknown[] = [targetSchema ?? null];

        if (parsedParams.pattern) {
          query += " AND TABLE_NAME LIKE ?";
          queryParams.push(parsedParams.pattern);
        }

        query += ` ORDER BY TABLE_NAME LIMIT ${parsedParams.limit} OFFSET ${parsedParams.offset}`;

        const result = await adapter.executeQuery(query, queryParams);
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
        let name = parsedParams.name;
        const targetSchema = parsedParams.schema;
        const definition = parsedParams.definition;
        const orReplace = parsedParams.orReplace;
        const algorithm = parsedParams.algorithm;
        const security = parsedParams.security;
        const checkOption = parsedParams.checkOption;

        // P154: Schema existence check when explicitly provided
        if (targetSchema !== undefined && targetSchema !== "") {
          try {
            validateIdentifier(targetSchema, "schema");
          } catch (err: unknown) {
            return formatHandlerErrorResponse(err);
          }
          const schemaCheck = await adapter.executeQuery(
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
            [targetSchema],
          );
          if (schemaCheck.rows === undefined || schemaCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new Error(`Schema '${targetSchema}' does not exist`),
            );
          }
          // If name is not qualified, qualify it with the schema
          if (!name.includes('.')) {
            name = `${targetSchema}.${name}`;
          }
        }

        try {
          validateQualifiedIdentifier(name, "view");
        } catch (err: unknown) {
          return formatHandlerErrorResponse(err);
        }

        const fullViewName = escapeQualifiedTable(name);

        const createClause = orReplace ? "CREATE OR REPLACE" : "CREATE";
        const securityClause = security ? ` SQL SECURITY ${security}` : "";
        let sql = `${createClause} ALGORITHM=${algorithm}${securityClause} VIEW ${fullViewName} AS ${definition}`;

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
        let name = parsedParams.name;
        const targetSchema = parsedParams.schema;

        // P154: Schema existence check when explicitly provided
        if (targetSchema !== undefined && targetSchema !== "") {
          try {
            validateIdentifier(targetSchema, "schema");
          } catch (err: unknown) {
            return formatHandlerErrorResponse(err);
          }
          const schemaCheck = await adapter.executeQuery(
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
            [targetSchema],
          );
          if (schemaCheck.rows === undefined || schemaCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new Error(`Schema '${targetSchema}' does not exist`),
            );
          }
          // If name is not qualified, qualify it with the schema
          if (!name.includes('.')) {
            name = `${targetSchema}.${name}`;
          }
        }

        try {
          validateQualifiedIdentifier(name, "view");
        } catch (err: unknown) {
          return formatHandlerErrorResponse(err);
        }

        // Pre-check: detect no-op when ifExists is true
        let unqualifiedName = name;
        let schemaForCheck = targetSchema;
        if (name.includes('.')) {
          const parts = name.split('.');
          schemaForCheck = parts[0] || targetSchema;
          unqualifiedName = parts[1] || name;
        }

        const checkQuery = "SELECT TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ?";
        const check = await adapter.executeQuery(checkQuery, [schemaForCheck ?? null, unqualifiedName]);
        const objectExists = check.rows !== undefined && check.rows.length > 0;

        if (objectExists) {
          const row = check.rows?.[0];
          if (row && String(row['TABLE_TYPE']) !== 'VIEW') {
            return formatHandlerErrorResponse(
              new Error(`'${schemaForCheck ? schemaForCheck + '.' : ''}${unqualifiedName}' is not VIEW`)
            );
          }
        } else {
          if (parsedParams.ifExists) {
            return withTokenEstimate({
              success: true,
              data: {
                skipped: true,
                reason: `View did not exist`,
              },
            });
          } else {
            return formatHandlerErrorResponse(
              new Error(`Unknown table '${schemaForCheck ? schemaForCheck + '.' : ''}${unqualifiedName}'`),
            );
          }
        }

        const fullViewName = escapeQualifiedTable(name);
        const ifExistsClause = parsedParams.ifExists ? "IF EXISTS " : "";
        const sql = `DROP VIEW ${ifExistsClause}${fullViewName}`;

        try {
          await adapter.executeQuery(sql);
          adapter.clearSchemaCache();
          return withTokenEstimate({
            success: true,
            data: { viewName: name },
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
