import { z } from "zod";

import {
  formatHandlerErrorResponse,
  withTokenEstimate,
  stripErrorPrefix,
} from "../core/error-helpers.js";
import { BaseOutputSchema } from "../../schemas/output-schemas.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import {
  MySQLMcpError,
  ErrorCategory,
} from "../../../../types/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  validateQualifiedIdentifier,
  escapeQualifiedTable,
} from "../../../../utils/validators.js";
import { READ_ONLY, WRITE, DESTRUCTIVE } from "../../../../utils/annotations.js";

const ListTriggersSchemaBase = z.object({
  table: z.string().optional().describe("Filter by table name"),
  tableName: z.string().optional().describe("Alias for table"),
  schema: z
    .string()
    .optional()
    .describe("Schema name to list triggers for (defaults to current database)"),
  database: z.string().optional().describe("Alias for schema"),
  dbName: z.string().optional().describe("Alias for schema"),
  limit: z.number().default(50).describe("Maximum number of results to return"),
  offset: z.number().default(0).describe("Number of results to skip"),
});

const extractNestedString = (v: unknown): string | undefined => {
  if (typeof v === "string") return v === "" ? undefined : v;
  if (typeof v === "object" && v !== null) {
    const inner = v as Record<string, unknown>;
    const extracted = inner['name'] ?? inner['triggerName'] ?? inner['tableName'] ?? inner['table'] ?? inner['schema'] ?? inner['database'] ?? inner['dbName'] ?? inner['body'] ?? inner['statement'] ?? inner['definition'];
    if (typeof extracted === "string" && extracted !== "") return extracted;
  }
  return undefined;
};

const ListTriggersSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      return {
        ...obj,
        table: extractNestedString(obj['table']) ?? extractNestedString(obj['tableName']),
        schema: extractNestedString(obj['schema']) ?? extractNestedString(obj['database']) ?? extractNestedString(obj['dbName']),
      };
    }
    return val;
  },
  z.object({
    table: z.string().optional(),
    schema: z.string().optional(),
    limit: z.number().min(1, "Limit must be at least 1").max(1000, "Limit cannot exceed 1000").default(50),
    offset: z.number().min(0, "Offset cannot be negative").default(0),
  })
);

const ListTriggersOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    triggers: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).optional()
});

const CreateTriggerSchemaBase = z.object({
  name: z.string().default("").describe("Trigger name"),
  triggerName: z.string().default("").describe("Alias for name"),
  schema: z.string().optional().describe("Schema name (defaults to current database)"),
  database: z.string().optional().describe("Alias for schema"),
  table: z.string().default("").describe("Table the trigger is on"),
  tableName: z.string().default("").describe("Alias for table"),
  timing: z.enum(["BEFORE", "AFTER"]).describe("Trigger timing"),
  event: z.enum(["INSERT", "UPDATE", "DELETE"]).describe("Trigger event"),
  body: z.string().default("").describe("Trigger body SQL (e.g., SET NEW.updated_at = NOW())"),
  statement: z.string().default("").describe("Alias for body"),
  definition: z.string().default("").describe("Alias for body"),
  order: z.enum(["FOLLOWS", "PRECEDES"]).optional().describe("Trigger ordering"),
  otherTrigger: z.string().optional().describe("Trigger name for FOLLOWS/PRECEDES"),
  ifNotExists: z.boolean().default(false).describe("Use IF NOT EXISTS (MySQL 8.0.29+)"),
});

const CreateTriggerSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      return {
        ...obj,
        name: extractNestedString(obj['name']) ?? extractNestedString(obj['triggerName']),
        schema: extractNestedString(obj['schema']) ?? extractNestedString(obj['database']),
        table: extractNestedString(obj['table']) ?? extractNestedString(obj['tableName']),
        body: extractNestedString(obj['body']) ?? extractNestedString(obj['statement']) ?? extractNestedString(obj['definition']),
      };
    }
    return val;
  },
  z.object({
    name: z.string().default(""),
    schema: z.string().optional(),
    table: z.string().default(""),
    timing: z.enum(["BEFORE", "AFTER"]),
    event: z.enum(["INSERT", "UPDATE", "DELETE"]),
    body: z.string().default(""),
    order: z.enum(["FOLLOWS", "PRECEDES"]).optional(),
    otherTrigger: z.string().optional(),
    ifNotExists: z.boolean().default(false),
  }).refine((data) => data.name !== "", {
    message: "Trigger name is required",
    path: ["name"]
  }).refine((data) => data.table !== "", {
    message: "Table name is required",
    path: ["table"]
  }).refine((data) => data.body !== "", {
    message: "Trigger body is required",
    path: ["body"]
  }).refine((data) => !(data.order && !data.otherTrigger), {
    message: "otherTrigger is required when order is specified",
    path: ["otherTrigger"]
  }).refine((data) => !(data.otherTrigger && !data.order), {
    message: "order is required when otherTrigger is specified",
    path: ["order"]
  })
);

const CreateTriggerOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    triggerName: z.string(),
  }).optional()
});

const DropTriggerSchemaBase = z.object({
  name: z.string().default("").describe("Trigger name"),
  triggerName: z.string().default("").describe("Alias for name"),
  schema: z.string().optional().describe("Schema name (defaults to current database)"),
  database: z.string().optional().describe("Alias for schema"),
  ifExists: z.boolean().default(false).describe("Use IF EXISTS"),
});

const DropTriggerSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      return {
        ...obj,
        name: extractNestedString(obj['name']) ?? extractNestedString(obj['triggerName']),
        schema: extractNestedString(obj['schema']) ?? extractNestedString(obj['database']),
      };
    }
    return val;
  },
  z.object({
    name: z.string().default(""),
    schema: z.string().optional(),
    ifExists: z.boolean().default(false),
  }).refine((data) => data.name !== "", {
    message: "Trigger name is required",
    path: ["name"]
  })
);

const DropTriggerOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    triggerName: z.string().optional(),
    skipped: z.boolean().optional(),
    reason: z.string().optional(),
  }).optional()
});

/**
 * List triggers
 */
export function createListTriggersTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_list_triggers",
    title: "MySQL List Triggers",
    description: "List all triggers with event timing, action, and definition.",
    group: "schema",
    inputSchema: ListTriggersSchemaBase,
    outputSchema: ListTriggersOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsedParams = ListTriggersSchema.parse(params);
        const targetSchema = parsedParams.schema;
        const table = parsedParams.table;

        // P154: Schema existence check
        if (targetSchema !== undefined && targetSchema !== "") {
          const schemaCheck = await adapter.executeQuery(
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
            [targetSchema],
          );
          if (schemaCheck.rows === undefined || schemaCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(
                `Schema '${targetSchema}' does not exist`,
                "DATABASE_NOT_FOUND",
                ErrorCategory.RESOURCE
              )
            );
          }
        }

        let unqualifiedTable = table;
        
        // P154: Table existence check when explicitly provided
        if (table !== undefined && table !== "") {
          let tableSchemaForCheck = targetSchema;
          if (table.includes('.')) {
            const parts = table.split('.');
            tableSchemaForCheck = parts[0] || targetSchema;
            unqualifiedTable = parts[1] || table;
          }

          const tableCheckQuery = "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ?";
          const tableCheck = await adapter.executeQuery(
            tableCheckQuery,
            [tableSchemaForCheck || null, unqualifiedTable],
          );
          if (tableCheck.rows === undefined || tableCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(
                `Table '${table}' does not exist`,
                "TABLE_NOT_FOUND",
                ErrorCategory.RESOURCE
              )
            );
          }
        }

        let query = `
                SELECT
                    TRIGGER_NAME as name,
                    EVENT_OBJECT_TABLE as tableName,
                    EVENT_MANIPULATION as event,
                    ACTION_TIMING as timing,
                    ACTION_STATEMENT as statement,
                    DEFINER as definer,
                    CREATED as created
                FROM information_schema.TRIGGERS
                WHERE TRIGGER_SCHEMA = COALESCE(?, DATABASE())
            `;

        const queryParams: unknown[] = [targetSchema || null];

        if (table !== undefined && table !== "") {
            query += " AND EVENT_OBJECT_TABLE = ?";
            queryParams.push(unqualifiedTable);
        }

        query +=
          ` ORDER BY EVENT_OBJECT_TABLE, ACTION_TIMING, EVENT_MANIPULATION LIMIT ${parsedParams.limit} OFFSET ${parsedParams.offset}`;
        
        const result = await adapter.executeQuery(query, queryParams);
        return withTokenEstimate({
          success: true,
          data: {
            triggers: result.rows,
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
 * Create a trigger
 */
export function createCreateTriggerTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_create_trigger",
    title: "MySQL Create Trigger",
    description: "Create a new trigger.",
    group: "schema",
    inputSchema: CreateTriggerSchemaBase,
    outputSchema: CreateTriggerOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsedParams = CreateTriggerSchema.parse(params);
        let name = parsedParams.name;
        const targetSchema = parsedParams.schema;
        const table = parsedParams.table;
        const timing = parsedParams.timing;
        const event = parsedParams.event;
        const body = parsedParams.body;
        const order = parsedParams.order;
        const otherTrigger = parsedParams.otherTrigger;
        const ifNotExists = parsedParams.ifNotExists;

        // P154: Schema existence check when explicitly provided
        if (targetSchema !== undefined && targetSchema !== "") {
          const schemaCheck = await adapter.executeQuery(
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
            [targetSchema],
          );
          if (schemaCheck.rows === undefined || schemaCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(
                `Schema '${targetSchema}' does not exist`,
                "DATABASE_NOT_FOUND",
                ErrorCategory.RESOURCE
              )
            );
          }
          // If name is not qualified, qualify it with the schema
          if (!name.includes('.')) {
            name = `${targetSchema}.${name}`;
          }
        }

        // P154: Table existence check against INFORMATION_SCHEMA
        const schemaForCheck = targetSchema || null;
        let unqualifiedTable = table;
        let tableSchemaForCheck = schemaForCheck;
        
        if (table.includes('.')) {
          const parts = table.split('.');
          tableSchemaForCheck = parts[0] || schemaForCheck;
          unqualifiedTable = parts[1] || table;
        }
        
        const tableCheck = await adapter.executeQuery(
          "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ?",
          [tableSchemaForCheck, unqualifiedTable],
        );
        if (tableCheck.rows === undefined || tableCheck.rows.length === 0) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              `Table '${table}' does not exist`,
              "TABLE_NOT_FOUND",
              ErrorCategory.RESOURCE
            )
          );
        }

        try {
          validateQualifiedIdentifier(name, "trigger");
        } catch (err: unknown) {
          return formatHandlerErrorResponse(err);
        }

        const fullTriggerName = escapeQualifiedTable(name);
        const fullTableName = escapeQualifiedTable(table);
        const ifNotExistsClause = ifNotExists ? "IF NOT EXISTS " : "";
        let sql = `CREATE TRIGGER ${ifNotExistsClause}${fullTriggerName} ${timing} ${event} ON ${fullTableName} FOR EACH ROW`;

        if (order && otherTrigger) {
          try {
            validateQualifiedIdentifier(otherTrigger, "trigger");
          } catch (err: unknown) {
            return formatHandlerErrorResponse(err);
          }
          const fullOtherTriggerName = escapeQualifiedTable(otherTrigger);
          sql += ` ${order} ${fullOtherTriggerName}`;
        } else if (order && !otherTrigger) {
          return formatHandlerErrorResponse(
            new Error("Validation error: otherTrigger is required when order is specified"),
          );
        }
        
        sql += ` ${body}`;

        try {
          await adapter.executeQuery(sql);
          adapter.clearSchemaCache();
          return withTokenEstimate({
            success: true,
            data: { triggerName: name },
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.toLowerCase().includes("already exists")) {
            return formatHandlerErrorResponse(
              new Error(`Trigger '${name}' already exists`),
            );
          }
          if (message.includes("does not exist") && message.includes("Referenced trigger")) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(
                stripErrorPrefix(message),
                "TRIGGER_NOT_FOUND",
                ErrorCategory.RESOURCE
              )
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
 * Drop a trigger
 */
export function createDropTriggerTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_drop_trigger",
    title: "MySQL Drop Trigger",
    description: "Drop a trigger.",
    group: "schema",
    inputSchema: DropTriggerSchemaBase,
    outputSchema: DropTriggerOutputSchema,
    requiredScopes: ["write"],
    annotations: DESTRUCTIVE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsedParams = DropTriggerSchema.parse(params);
        let name = parsedParams.name;
        const targetSchema = parsedParams.schema;

        // P154: Schema existence check when explicitly provided
        if (targetSchema !== undefined && targetSchema !== "") {
          const schemaCheck = await adapter.executeQuery(
            "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
            [targetSchema],
          );
          if (schemaCheck.rows === undefined || schemaCheck.rows.length === 0) {
            return formatHandlerErrorResponse(
              new MySQLMcpError(
                `Schema '${targetSchema}' does not exist`,
                "DATABASE_NOT_FOUND",
                ErrorCategory.RESOURCE
              )
            );
          }
          // If name is not qualified, qualify it with the schema
          if (!name.includes('.')) {
            name = `${targetSchema}.${name}`;
          }
        }

        try {
          validateQualifiedIdentifier(name, "trigger");
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

        const checkQuery = "SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = COALESCE(?, DATABASE()) AND TRIGGER_NAME = ?";
        const check = await adapter.executeQuery(checkQuery, [schemaForCheck ?? null, unqualifiedName]);
        const triggerAbsent = check.rows === undefined || check.rows.length === 0;

        if (triggerAbsent) {
          if (parsedParams.ifExists) {
            return withTokenEstimate({
              success: true,
              data: {
                skipped: true,
                reason: "Trigger did not exist",
              },
            });
          } else {
            return formatHandlerErrorResponse(
              new MySQLMcpError(
                `Unknown trigger '${schemaForCheck ? schemaForCheck + '.' : ''}${unqualifiedName}'`,
                "TRIGGER_NOT_FOUND",
                ErrorCategory.RESOURCE
              )
            );
          }
        }

        const fullTriggerName = escapeQualifiedTable(name);
        const ifExistsClause = parsedParams.ifExists ? "IF EXISTS " : "";
        const sql = `DROP TRIGGER ${ifExistsClause}${fullTriggerName}`;

        try {
          await adapter.executeQuery(sql);
          adapter.clearSchemaCache();
          return withTokenEstimate({
            success: true,
            data: { triggerName: name },
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


