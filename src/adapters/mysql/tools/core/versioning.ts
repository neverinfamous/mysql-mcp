import type { MySQLAdapter } from "../../mysql-adapter.js";
import type { ToolDefinition, RequestContext } from "../../../../types/index.js";
import { READ_ONLY, WRITE } from "../../../../utils/annotations.js";
import { formatHandlerErrorResponse, withTokenEstimate } from "./error-helpers.js";
import {
  EnableVersioningSchema,
  EnableVersioningOutputSchema,
  DisableVersioningSchema,
  DisableVersioningOutputSchema,
  CheckVersionSchema,
  CheckVersionOutputSchema,
  ConditionalUpdateSchema,
  ConditionalUpdateOutputSchema,
} from "../../schemas/index.js";

/**
 * Builds a simple WHERE clause from a conditions array.
 */
function buildWhereClause(conditions: { column: string; operator?: string; value: unknown }[]): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const clauses: string[] = [];
  for (const cond of conditions) {
    const col = `\`${cond.column.replace(/`/g, "")}\``;
    const op = cond.operator || "=";
    clauses.push(`${col} ${op} ?`);
    params.push(cond.value);
  }
  return { sql: clauses.join(" AND "), params };
}

/**
 * Helper to escape table/schema identifiers
 */
function escapeId(id: string): string {
  return id
    .split(".")
    .map((part) => `\`${part.replace(/`/g, "")}\``)
    .join(".");
}

/**
 * Enable Optimistic Concurrency Control on a table.
 */
export function createEnableVersioningTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_enable_versioning",
    title: "MySQL Enable Versioning",
    description:
      "Enable optimistic concurrency control (OCC) on a table. Adds a _version column and an auto-increment trigger.",
    group: "core",
    inputSchema: EnableVersioningSchema,
    outputSchema: EnableVersioningOutputSchema,
    requiredScopes: ["admin"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table } = EnableVersioningSchema.parse(params);
        const safeTable = escapeId(table);
        // We use just the table name without schema for the trigger name to keep it simple,
        // though trigger names must be unique within the schema.
        const baseName = table.includes(".") ? (table.split(".")[1] ?? table) : table;
        const triggerName = `_mcp_version_${baseName.replace(/[^a-zA-Z0-9_]/g, "")}`;

        // Check if _version already exists
        const describeInfo = await adapter.describeTable(table);
        if (!describeInfo.columns || describeInfo.columns.length === 0) {
          return withTokenEstimate({
            success: false,
            error: `Table '${table}' does not exist`,
          });
        }

        const hasVersionColumn = describeInfo.columns.some(
          (col) => col.name === "_version",
        );

        if (!hasVersionColumn) {
          await adapter.executeWriteQuery(
            `ALTER TABLE ${safeTable} ADD COLUMN _version INT NOT NULL DEFAULT 1`,
            [],
          );
        }

        // In MySQL, triggers for updates usually look like this:
        // CREATE TRIGGER <name> BEFORE UPDATE ON <table> FOR EACH ROW SET NEW._version = OLD._version + 1;
        // First drop it if it exists to be safe
        try {
          await adapter.executeWriteQuery(`DROP TRIGGER IF EXISTS \`${triggerName}\``, []);
        } catch {
          // ignore
        }

        const triggerSql = `
CREATE TRIGGER \`${triggerName}\`
BEFORE UPDATE ON ${safeTable}
FOR EACH ROW
BEGIN
  SET NEW._version = OLD._version + 1;
END;`.trim();

        await adapter.executeWriteQuery(triggerSql, []);
        
        adapter.clearSchemaCache();

        return withTokenEstimate({
          success: true,
          data: {
            message: hasVersionColumn
              ? `Versioning already active on '${table}', trigger ensured.`
              : `Versioning enabled on '${table}'. Added _version column and trigger.`,
            alreadyEnabled: hasVersionColumn,
          },
        });
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Disable Optimistic Concurrency Control on a table.
 */
export function createDisableVersioningTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_disable_versioning",
    title: "MySQL Disable Versioning",
    description:
      "Disable optimistic concurrency control (OCC) on a table. Drops the _version column and its trigger.",
    group: "core",
    inputSchema: DisableVersioningSchema,
    outputSchema: DisableVersioningOutputSchema,
    requiredScopes: ["admin"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, ifExists } = DisableVersioningSchema.parse(params);
        const safeTable = escapeId(table);
        const baseName = table.includes(".") ? (table.split(".")[1] ?? table) : table;
        const triggerName = `_mcp_version_${baseName.replace(/[^a-zA-Z0-9_]/g, "")}`;

        const describeInfo = await adapter.describeTable(table);
        if (!describeInfo.columns || describeInfo.columns.length === 0) {
          if (ifExists) {
            return withTokenEstimate({
              success: true,
              data: {
                message: `Table '${table}' does not exist (no changes made).`,
              },
            });
          }
          return withTokenEstimate({
            success: false,
            error: `Table '${table}' does not exist.`,
          });
        }

        const hasVersionColumn = describeInfo.columns.some(
          (col) => col.name === "_version",
        );

        await adapter.executeWriteQuery(`DROP TRIGGER IF EXISTS \`${triggerName}\``, []);

        if (hasVersionColumn) {
          await adapter.executeWriteQuery(
            `ALTER TABLE ${safeTable} DROP COLUMN _version`,
            [],
          );
        }

        adapter.clearSchemaCache();

        return withTokenEstimate({
          success: true,
          data: {
            message: hasVersionColumn
              ? `Versioning disabled on '${table}'. Dropped _version column and trigger.`
              : `Versioning already disabled on '${table}', trigger dropped if existed.`,
          },
        });
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Check current version of a row.
 */
export function createCheckVersionTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_check_version",
    title: "MySQL Check Version",
    description:
      "Read the current _version of a specific row for optimistic concurrency control.",
    group: "core",
    inputSchema: CheckVersionSchema,
    outputSchema: CheckVersionOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, idColumn = "id", rowId } = CheckVersionSchema.parse(params);
        const safeTable = escapeId(table);
        const safeIdCol = `\`${idColumn.replace(/`/g, "")}\``;

        const describeInfo = await adapter.describeTable(table);
        if (!describeInfo.columns || describeInfo.columns.length === 0) {
          return withTokenEstimate({
            success: false,
            error: `Table '${table}' does not exist.`,
          });
        }

        const sql = `SELECT * FROM ${safeTable} WHERE ${safeIdCol} = ? LIMIT 1`;
        const result = await adapter.executeReadQuery(sql, [rowId]);

        if (!result.rows || result.rows.length === 0) {
          return withTokenEstimate({
            success: false,
            error: `Row not found in table '${table}' with ${safeIdCol} = ${String(rowId)}`,
          });
        }

        const row = result.rows[0];
        if (row && typeof row["_version"] === "number") {
          return withTokenEstimate({
            success: true,
            data: {
              version: row["_version"],
              row,
            },
          });
        } else {
          return withTokenEstimate({
            success: false,
            error: `Table '${table}' does not appear to have versioning enabled (missing _version column).`,
          });
        }
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Conditionally update a row if the version matches.
 */
export function createConditionalUpdateTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_conditional_update",
    title: "MySQL Conditional Update",
    description:
      "Update a row only if its _version matches expectedVersion. Prevents lost updates in multi-agent environments.",
    group: "core",
    inputSchema: ConditionalUpdateSchema,
    outputSchema: ConditionalUpdateOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, data, conditions, expectedVersion } =
          ConditionalUpdateSchema.parse(params);

        const safeTable = escapeId(table);
        const columns = Object.keys(data);
        if (columns.length === 0) {
          return withTokenEstimate({
            success: false,
            error: "Update data cannot be empty",
          });
        }

        if (conditions.length === 0) {
          return withTokenEstimate({
            success: false,
            error: "Conditions are required to identify the row",
          });
        }

        const describeInfo = await adapter.describeTable(table);
        if (!describeInfo.columns || describeInfo.columns.length === 0) {
          return withTokenEstimate({
            success: false,
            error: `Table '${table}' does not exist.`,
          });
        }

        const queryParams: unknown[] = [];
        const setClauses = columns
          .map((c) => `\`${c.replace(/`/g, "")}\` = ?`)
          .join(", ");
        queryParams.push(...Object.values(data));

        const { sql: whereSql, params: whereParams } = buildWhereClause(conditions);
        queryParams.push(...whereParams);

        // Append version guard
        queryParams.push(expectedVersion);

        const updateSql = `UPDATE ${safeTable} SET ${setClauses} WHERE (${whereSql}) AND _version = ?`;
        const result = await adapter.executeWriteQuery(updateSql, queryParams);

        if (result.rowsAffected === 0) {
          // Check if row exists at all to differentiate NotFound from Conflict
          const checkSql = `SELECT _version FROM ${safeTable} WHERE ${whereSql}`;
          const checkResult = await adapter.executeReadQuery(
            checkSql,
            whereParams,
          );

          if (!checkResult.rows || checkResult.rows.length === 0) {
            return withTokenEstimate({
              success: false,
              error: "Row not found matching the provided conditions",
            });
          }

          const currentVersionRaw = checkResult.rows[0]?.["_version"];
          if (currentVersionRaw === undefined || currentVersionRaw === null) {
            return withTokenEstimate({
              success: false,
              error: `Table '${table}' does not appear to have versioning enabled (missing _version column).`,
            });
          }

          const currentVersion = Number(currentVersionRaw);
          return withTokenEstimate({
            success: false,
            error: `Version conflict: expected version ${String(expectedVersion)} but row has version ${currentVersion}. Re-read the row and retry.`,
            errorDetails: {
              conflictType: "version_mismatch",
              suggestion: "Re-read the row to get the current version, then retry the update.",
              expectedVersion,
              currentVersion,
            }
          });
        }

        return withTokenEstimate({
          success: true,
          data: {
            rowsAffected: result.rowsAffected,
            currentVersion: expectedVersion + 1, // Predict next version since it updated
          },
        });
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
