/**
 * MySQL Migration Tools — Query & Rollback
 *
 * Migration rollback, history, and status tools.
 * 3 tools total.
 */

import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { ValidationError } from "../../../../types/index.js";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";
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
} from "../../types.js";
import {
  TRACKING_TABLE,
  ensureTrackingTable,
  formatRecord,
} from "./helpers.js";

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
    annotations: { readOnlyHint: false, destructiveHint: true },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = MigrationRollbackSchema.parse(params);

        const dbRow = (await adapter.executeReadQuery("SELECT DATABASE() as db")).rows?.[0];
        const targetSchema = (dbRow?.["db"] as string) || "mysql";
        await ensureTrackingTable(adapter, targetSchema);

        if (parsed.id === undefined && parsed.version === undefined) {
          throw new ValidationError(
            "Either 'id' or 'version' is required to identify the migration to roll back.",
          );
        }

        // Coerce id: functional param, return error on wrong type
        let coercedId: number | undefined;
        if (parsed.id !== undefined) {
          const num = parsed.id;
          if (isNaN(num)) {
            throw new ValidationError(
              `Invalid migration id: expected a number, got "${String(parsed.id)}"`,
            );
          }
          coercedId = num;
        }

        const qualifiedTable = `${targetSchema}.${TRACKING_TABLE}`;

        // Find the migration
        const whereClause =
          coercedId !== undefined ? "id = ?" : "version = ?";
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
          return {
            success: false,
            error: `Migration not found: ${identifier}`,
            code: "NOT_FOUND",
            category: "validation",
            recoverable: true,
          };
        }

        const row = findRows[0] ?? {};
        const rowId = row["id"] as number;
        const rowVersion = row["version"] as string;
        const rowStatus = row["status"] as string;
        const rollbackSql = (row["rollback_sql"] as string | null) ?? null;

        if (rowStatus === "rolled_back") {
          throw new ValidationError(
            `Migration "${rowVersion}" (id: ${String(rowId)}) has already been rolled back.`,
          );
        }

        if (rollbackSql === null) {
          throw new ValidationError(
            `Migration "${rowVersion}" (id: ${String(rowId)}) has no rollback SQL stored. Manual rollback required.`,
          );
        }

        if (parsed.dryRun === true) {
          return {
            success: true,
            dryRun: true,
            rollbackSql,
            record: formatRecord(row),
          };
        }

        try {
          await adapter.executeReadQuery(rollbackSql);
          await adapter.executeReadQuery(
            `UPDATE ${qualifiedTable} SET status = 'rolled_back' WHERE id = ?`,
            [rowId],
          );


          return {
            success: true,
            dryRun: false,
            rollbackSql,
            record: {
              ...formatRecord(row),
              status: "rolled_back",
            },
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new ValidationError(
            `Rollback failed for migration "${rowVersion}" (id: ${String(rowId)}): ${msg}.`,
          );
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
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = MigrationHistorySchema.parse(params);
        
        const dbRow = (await adapter.executeReadQuery("SELECT DATABASE() as db")).rows?.[0];
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
          `SELECT id, version, description, applied_at, applied_by,
                migration_hash, source_system, rollback_sql IS NOT NULL AS has_rollback, status, error_information
         FROM ${qualifiedTable}
         ${whereClause}
         ORDER BY applied_at DESC
         LIMIT ? OFFSET ?`,
          [...values, limit, offset],
        );

        const records = (dataResult.rows ?? []).map(formatRecord);

        return {
          success: true,
          records,
          total,
          limit,
          offset,
        };
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
    annotations: { readOnlyHint: true, idempotentHint: true },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = MigrationStatusSchema.parse(params);
        let targetSchema = parsed.schema;
        
        if (!targetSchema) {
          const dbRow = (await adapter.executeReadQuery("SELECT DATABASE() as db")).rows?.[0];
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
        const tableExists = firstRow?.["table_exists"] === 1 || firstRow?.["table_exists"] === true;

        if (!tableExists) {
          return {
            success: true,
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
          };
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
              : ((appliedAt as string | null) ?? "");
        }

        return {
          success: true,
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
        };
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
