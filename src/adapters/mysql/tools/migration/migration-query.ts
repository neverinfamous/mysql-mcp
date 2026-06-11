/**
 * MySQL Migration Tools — Query & Rollback
 *
 * Migration rollback, history, and status tools.
 * 3 tools total.
 */

import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";

import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import {
  MigrationRollbackSchemaBase,
  MigrationRollbackSchema,
  MigrationHistorySchemaBase,
  MigrationHistorySchema,
  MigrationStatusSchemaBase,
  MigrationStatusSchema,
  // Output schemas
  MigrationRollbackOutputSchema,
  MigrationHistoryOutputSchema,
  MigrationStatusOutputSchema,
} from "../../schemas/index.js";
import {
  TRACKING_TABLE,
  ensureTrackingTable,
  formatRecord,
} from "./helpers.js";
import { DESTRUCTIVE, READ_ONLY } from "../../../../utils/annotations.js";

// =============================================================================
// mysql_migration_rollback
// =============================================================================

export function createMigrationRollbackTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_migration_rollback",
    description:
      "Roll back a specific migration by ID or version. " +
      "Executes the stored rollback_sql and updates status to 'rolled_back'. " +
      "Use dryRun: true to preview the rollback SQL without executing.",
    group: "migration",
    inputSchema: MigrationRollbackSchemaBase,
    outputSchema: MigrationRollbackOutputSchema,
    annotations: DESTRUCTIVE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = MigrationRollbackSchema.parse(params);

        const dbRow = (
          await adapter.executeReadQuery("SELECT DATABASE() as db")
        ).rows?.[0];
        const targetSchema = (dbRow?.["db"] as string) || "mysql";
        await ensureTrackingTable(adapter, targetSchema);

        if (parsed.id === undefined && parsed.version === undefined) {
          const errorResponse = {
            success: false as const,
            error:
              "Either 'id' or 'version' is required to identify the migration to roll back.",
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: true,
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(errorResponse), "utf8") / 4,
          );
          return withTokenEstimate({ ...errorResponse, metrics: { tokenEstimate } });
        }

        // Coerce id: functional param, return error on wrong type
        let coercedId: number | undefined;
        if (parsed.id !== undefined) {
          const num = parsed.id;
          if (isNaN(num)) {
            const errorResponse = {
              success: false as const,
              error: `Invalid migration id: expected a number, got "${String(parsed.id)}"`,
              code: "VALIDATION_ERROR",
              category: "validation",
              recoverable: true,
            };
            const tokenEstimate = Math.ceil(
              Buffer.byteLength(JSON.stringify(errorResponse), "utf8") / 4,
            );
            return withTokenEstimate({ ...errorResponse, metrics: { tokenEstimate } });
          }
          coercedId = num;
        }

        const qualifiedTable = `${targetSchema}.${TRACKING_TABLE}`;

        // Find the migration
        const whereClause = coercedId !== undefined ? "id = ?" : "version = ?";
        const whereValue = coercedId ?? parsed.version;

        const findResult = await adapter.executeReadQuery(
          `SELECT * FROM ${qualifiedTable} WHERE ${whereClause} ORDER BY id DESC LIMIT 1`,
          [whereValue],
        );

        const findRows = findResult.rows ?? [];
        if (findRows.length === 0) {
          const identifier =
            coercedId !== undefined
              ? `id ${String(coercedId)}`
              : `version "${parsed.version ?? ""}"`;
          const errorResponse = {
            success: false as const,
            error: `Migration not found: ${identifier}`,
            code: "NOT_FOUND",
            category: "validation",
            recoverable: true,
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(errorResponse), "utf8") / 4,
          );
          return withTokenEstimate({ ...errorResponse, metrics: { tokenEstimate } });
        }

        const row = findRows[0] ?? {};
        const rowId = row["id"] as number;
        const rowVersion = row["version"] as string;
        const rowStatus = row["status"] as string;
        const rollbackSql = (row["rollback_sql"] as string | null) ?? null;

        if (rowStatus === "rolled_back") {
          const errorResponse = {
            success: false as const,
            error: `Migration "${rowVersion}" (id: ${String(rowId)}) has already been rolled back.`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: true,
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(errorResponse), "utf8") / 4,
          );
          return withTokenEstimate({ ...errorResponse, metrics: { tokenEstimate } });
        }

        if (rollbackSql === null) {
          const errorResponse = {
            success: false as const,
            error: `Migration "${rowVersion}" (id: ${String(rowId)}) has no rollback SQL stored. Manual rollback required.`,
            code: "VALIDATION_ERROR",
            category: "validation",
            recoverable: true,
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(errorResponse), "utf8") / 4,
          );
          return withTokenEstimate({ ...errorResponse, metrics: { tokenEstimate } });
        }

        if (parsed.dryRun === true) {
          const response = {
            success: true as const,
            data: {
              dryRun: true,
              rollbackSql,
              record: formatRecord(row),
            },
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
        }

        try {
          await adapter.executeWriteQuery(rollbackSql);
          await adapter.executeWriteQuery(
            `UPDATE ${qualifiedTable} SET status = 'rolled_back' WHERE id = ?`,
            [rowId],
          );

          const response = {
            success: true as const,
            data: {
              dryRun: false,
              rollbackSql,
              record: {
                ...formatRecord(row),
                status: "rolled_back",
              },
            },
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          const errorResponse = {
            success: false as const,
            error: `Rollback failed for migration "${rowVersion}" (id: ${String(rowId)}): ${msg}.`,
            code: "QUERY_ERROR",
            category: "query",
            recoverable: false,
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(errorResponse), "utf8") / 4,
          );
          return withTokenEstimate({ ...errorResponse, metrics: { tokenEstimate } });
        }
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

// =============================================================================
// mysql_migration_history
// =============================================================================

export function createMigrationHistoryTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_migration_history",
    description:
      "Query migration history with optional filtering by status and source system. " +
      "Returns paginated results ordered by applied_at descending.",
    group: "migration",
    inputSchema: MigrationHistorySchemaBase,
    outputSchema: MigrationHistoryOutputSchema,
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = MigrationHistorySchema.parse(params);

        const dbRow = (
          await adapter.executeReadQuery("SELECT DATABASE() as db")
        ).rows?.[0];
        const targetSchema = (dbRow?.["db"] as string) || "mysql";
        const qualifiedTable = `${targetSchema}.${TRACKING_TABLE}`;

        await ensureTrackingTable(adapter, targetSchema);

        // Coerce limit/offset: wrong-type values silently default
        const limit = parsed.limit ?? 50;
        const offset = parsed.offset ?? 0;

        // Build dynamic WHERE clause
        const conditions: string[] = [];
        const values: unknown[] = [];

        if (parsed.status != null) {
          conditions.push(`status = ?`);
          values.push(parsed.status);
        }
        if (parsed.sourceSystem != null) {
          conditions.push(`source_system = ?`);
          values.push(parsed.sourceSystem);
        }

        const whereClause =
          conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // Get total count
        const countResult = await adapter.executeReadQuery(
          `SELECT COUNT(*) AS count FROM ${qualifiedTable} ${whereClause}`,
          values.length > 0 ? values : undefined,
        );
        const countRow = (countResult.rows ?? [])[0];
        const total = Number(countRow?.["count"]) || 0;

        // Get page of results (exclude migration_sql for payload efficiency)
        const dataResult = await adapter.executeReadQuery(
          `SELECT m.id, m.version, m.description, m.applied_at, m.applied_by,
                m.migration_hash, m.source_system, m.rollback_sql IS NOT NULL AS has_rollback, m.status, m.error_information,
                (SELECT EXISTS(SELECT 1 FROM ${qualifiedTable} prev WHERE prev.status IN ('applied', 'recorded') AND prev.id < m.id AND prev.version > m.version)) AS out_of_order
         FROM ${qualifiedTable} m
         ${whereClause ? whereClause.replace(/status/g, "m.status").replace(/source_system/g, "m.source_system") : ""}
         ORDER BY m.applied_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
          values.length > 0 ? values : undefined,
        );

        const records = (dataResult.rows ?? []).map(formatRecord);

        const response = {
          success: true as const,
          data: {
            records,
            total,
            limit,
            offset,
          },
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

// =============================================================================
// mysql_migration_status
// =============================================================================

export function createMigrationStatusTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_migration_status",
    description:
      "Get current migration tracking status: latest version, counts by status, " +
      "and list of source systems. Returns initialized: false if tracking table doesn't exist.",
    group: "migration",
    inputSchema: MigrationStatusSchemaBase,
    outputSchema: MigrationStatusOutputSchema,
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = MigrationStatusSchema.parse(params);
        let targetSchema = parsed.schema;

        if (!targetSchema) {
          const dbRow = (
            await adapter.executeReadQuery("SELECT DATABASE() as db")
          ).rows?.[0];
          targetSchema = (dbRow?.["db"] as string) || "mysql";
        }

        // Check if tracking table exists
        const check = await adapter.executeReadQuery(
          `SELECT EXISTS (
          SELECT 1 FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ) AS table_exists`,
          [targetSchema, TRACKING_TABLE],
        );
        const firstRow = (check.rows ?? [])[0];
        const tableExists =
          firstRow?.["table_exists"] === 1 ||
          firstRow?.["table_exists"] === true;

        if (!tableExists) {
          const response = {
            success: true as const,
            data: {
              initialized: false,
              latestVersion: null,
              latestAppliedAt: null,
              counts: {
                total: 0,
                applied: 0,
                recorded: 0,
                rolledBack: 0,
                failed: 0,
              },
              sourceSystems: [],
            },
          };
          const tokenEstimate = Math.ceil(
            Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
          );
          return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
        }

        const qualifiedTable = `${targetSchema}.${TRACKING_TABLE}`;

        // Get aggregate status
        const statsResult = await adapter.executeReadQuery(
          `SELECT
          COUNT(*) AS total,
          SUM(IF(status = 'applied', 1, 0)) AS applied,
          SUM(IF(status = 'recorded', 1, 0)) AS recorded,
          SUM(IF(status = 'rolled_back', 1, 0)) AS rolled_back,
          SUM(IF(status = 'failed', 1, 0)) AS failed
        FROM ${qualifiedTable}`,
        );
        const statsRow = (statsResult.rows ?? [])[0] ?? {};

        // Get latest applied migration
        const latestResult = await adapter.executeReadQuery(
          `SELECT version, applied_at FROM ${qualifiedTable}
         WHERE status = 'applied'
         ORDER BY applied_at DESC LIMIT 1`,
        );
        const latestRow = (latestResult.rows ?? [])[0];

        // Get distinct source systems
        const systemsResult = await adapter.executeReadQuery(
          `SELECT DISTINCT source_system FROM ${qualifiedTable}
         WHERE source_system IS NOT NULL
         ORDER BY source_system`,
        );
        const sourceSystems = (systemsResult.rows ?? []).map(
          (r) => r["source_system"] as string,
        );

        let latestAppliedAt: string | null = null;
        if (latestRow != null) {
          const appliedAt = latestRow["applied_at"];
          latestAppliedAt =
            appliedAt instanceof Date
              ? appliedAt.toISOString()
              : ((typeof appliedAt === "string" ? appliedAt : null) ?? "");
        }

        const response = {
          success: true as const,
          data: {
            initialized: true,
            latestVersion:
              latestRow != null ? (latestRow["version"] as string) : null,
            latestAppliedAt,
            counts: {
              total: Number(statsRow["total"]) || 0,
              applied: Number(statsRow["applied"]) || 0,
              recorded: Number(statsRow["recorded"]) || 0,
              rolledBack: Number(statsRow["rolled_back"]) || 0,
              failed: Number(statsRow["failed"]) || 0,
            },
            sourceSystems,
          },
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return withTokenEstimate({ ...response, metrics: { tokenEstimate } });
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
