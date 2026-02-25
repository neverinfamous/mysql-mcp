import { z, ZodError } from "zod";

/** Extract human-readable messages from a ZodError instead of raw JSON array */
function formatZodError(error: ZodError): string {
  return error.issues.map((i) => i.message).join("; ");
}
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";

const ListSchemasSchema = z.object({
  pattern: z
    .string()
    .optional()
    .describe('Filter pattern (LIKE syntax, e.g. "app_%")'),
});

const CreateSchemaSchema = z.object({
  name: z.string().describe("Schema/database name"),
  charset: z.string().default("utf8mb4").describe("Character set"),
  collation: z.string().default("utf8mb4_unicode_ci").describe("Collation"),
  ifNotExists: z.boolean().default(true).describe("Add IF NOT EXISTS clause"),
});

const DropSchemaSchema = z.object({
  name: z.string().describe("Schema/database name to drop"),
  ifExists: z.boolean().default(true).describe("Add IF EXISTS clause"),
});

/**
 * List all schemas/databases
 */
export function createListSchemasTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_list_schemas",
    title: "MySQL List Schemas",
    description:
      "List all databases/schemas with metadata including charset and collation.",
    group: "schema",
    inputSchema: ListSchemasSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      let parsed;
      try {
        parsed = ListSchemasSchema.parse(params);
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        throw error;
      }
      const { pattern } = parsed;

      let query = `
                SELECT 
                    SCHEMA_NAME as name,
                    DEFAULT_CHARACTER_SET_NAME as charset,
                    DEFAULT_COLLATION_NAME as collation
                FROM information_schema.SCHEMATA
                WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
            `;

      const queryParams: unknown[] = [];
      if (pattern) {
        query += " AND SCHEMA_NAME LIKE ?";
        queryParams.push(pattern);
      }

      query += " ORDER BY SCHEMA_NAME";

      const result = await adapter.executeQuery(query, queryParams);
      return {
        schemas: result.rows,
        count: result.rows?.length ?? 0,
      };
    },
  };
}

/**
 * Create a new schema/database
 */
export function createCreateSchemaTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_create_schema",
    title: "MySQL Create Schema",
    description:
      "Create a new database/schema with specified charset and collation.",
    group: "schema",
    inputSchema: CreateSchemaSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      let parsed;
      try {
        parsed = CreateSchemaSchema.parse(params);
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        throw error;
      }
      const { name, charset, collation, ifNotExists } = parsed;

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        return { success: false, error: "Invalid schema name" };
      }

      if (!/^[a-zA-Z0-9_]+$/.test(charset)) {
        return { success: false, error: `Invalid charset: ${charset}` };
      }
      if (!/^[a-zA-Z0-9_]+$/.test(collation)) {
        return { success: false, error: `Invalid collation: ${collation}` };
      }

      // Pre-check: detect no-op when ifNotExists is true
      if (ifNotExists) {
        const check = await adapter.executeQuery(
          "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
          [name],
        );
        if (check.rows && check.rows.length > 0) {
          return {
            success: true,
            skipped: true,
            reason: "Schema already exists",
            schemaName: name,
          };
        }
      }

      const ifNotExistsClause = ifNotExists ? "IF NOT EXISTS " : "";
      const sql = `CREATE DATABASE ${ifNotExistsClause}\`${name}\` CHARACTER SET ${charset} COLLATE ${collation}`;

      try {
        await adapter.executeQuery(sql);
        return { success: true, schemaName: name };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("database exists")) {
          return {
            success: false,
            error: `Schema '${name}' already exists`,
          };
        }
        return {
          success: false,
          error: message
            .replace(/^Query failed:\s*/i, "")
            .replace(/^Execute failed:\s*/i, ""),
        };
      }
    },
  };
}

/**
 * Drop a schema/database
 */
export function createDropSchemaTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_drop_schema",
    title: "MySQL Drop Schema",
    description:
      "Drop a database/schema. WARNING: This permanently deletes all data.",
    group: "schema",
    inputSchema: DropSchemaSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      let parsed;
      try {
        parsed = DropSchemaSchema.parse(params);
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return { success: false, error: formatZodError(error) };
        }
        throw error;
      }
      const { name, ifExists } = parsed;

      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
        return { success: false, error: "Invalid schema name" };
      }

      const systemSchemas = [
        "mysql",
        "information_schema",
        "performance_schema",
        "sys",
      ];
      if (systemSchemas.includes(name.toLowerCase())) {
        return { success: false, error: "Cannot drop system schema" };
      }

      // Pre-check: detect no-op when ifExists is true
      if (ifExists) {
        const check = await adapter.executeQuery(
          "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?",
          [name],
        );
        if (!check.rows || check.rows.length === 0) {
          return {
            success: true,
            skipped: true,
            reason: "Schema did not exist",
            schemaName: name,
          };
        }
      }

      const ifExistsClause = ifExists ? "IF EXISTS " : "";
      try {
        await adapter.executeQuery(
          `DROP DATABASE ${ifExistsClause}\`${name}\``,
        );
        return { success: true, schemaName: name };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          message.toLowerCase().includes("database doesn't exist") ||
          message.toLowerCase().includes("database does not exist")
        ) {
          return {
            success: false,
            error: `Schema '${name}' does not exist`,
          };
        }
        return {
          success: false,
          error: message
            .replace(/^Query failed:\s*/i, "")
            .replace(/^Execute failed:\s*/i, ""),
        };
      }
    },
  };
}
