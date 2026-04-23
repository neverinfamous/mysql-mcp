/**
 * MySQL Migration Tools — Schema Version Tracking
 *
 * Migration init, record, and apply tools.
 * 3 tools total.
 */

import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { QueryError } from "../../../../types/index.js";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";
import {
  MigrationInitSchemaBase,
  MigrationInitSchema,
  MigrationRecordSchemaBase,
  MigrationRecordSchema,
  MigrationApplySchemaBase,
  MigrationApplySchema,
  // Output schemas
} from "../../schemas/index.js";
import {
  TRACKING_TABLE,
  buildCreateTrackingTableSql,
  ensureTrackingTable,
  checkDuplicateHash,
  formatRecord,
} from "./helpers.js";

// =============================================================================
// mysql_migration_init
// =============================================================================

export function createMigrationInitTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_migration_init",
    description:
      "Initialize or verify the schema version tracking table (_mcp_schema_versions). " +
      "Idempotent — safe to call repeatedly. Returns current tracking state.",
    group: "migration",
    inputSchema: MigrationInitSchemaBase,
    annotations: { readOnlyHint: false },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = MigrationInitSchema.parse(params);
        
        let targetSchema = parsed.schema;
        if (!targetSchema) {
          const dbRow = (await adapter.executeReadQuery("SELECT DATABASE() as db")).rows?.[0];
          targetSchema = (dbRow?.["db"] as string) || "mysql";
        }

        const qualifiedTable = `${targetSchema}.${TRACKING_TABLE}`;

        const check = await adapter.executeReadQuery(
          `SELECT EXISTS (
          SELECT 1 FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ) AS table_exists`,
          [targetSchema, TRACKING_TABLE],
        );
        const firstRow = (check.rows ?? [])[0];
        const existed = firstRow?.["table_exists"] === 1 || firstRow?.["table_exists"] === true;

        if (!existed) {
          await adapter.executeReadQuery(
            buildCreateTrackingTableSql(qualifiedTable),
          );
        }

        const countResult = await adapter.executeReadQuery(
          `SELECT COUNT(*) AS count FROM ${qualifiedTable}`,
        );
        const countRow = (countResult.rows ?? [])[0];
        const existingRecords = (Number(countRow?.["count"]) || 0);

        return {
          success: true,
          tableCreated: !existed,
          tableName: qualifiedTable,
          existingRecords,
        };
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

// =============================================================================
// mysql_migration_record
// =============================================================================

export function createMigrationRecordTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_migration_record",
    description:
      "Record a migration in the schema version tracking table with status 'recorded' (metadata only, SQL not executed). " +
      "Use mysql_migration_apply instead to execute SQL and record with status 'applied'. " +
      "Auto-provisions the tracking table on first use. " +
      "Computes SHA-256 hash for idempotency detection.",
    group: "migration",
    inputSchema: MigrationRecordSchemaBase,
    annotations: { readOnlyHint: false },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = MigrationRecordSchema.parse(params);
        await ensureTrackingTable(adapter);

        const { migrationHash, duplicateError } = await checkDuplicateHash(
          adapter,
          parsed.migrationSql,
        );
        if (duplicateError) return duplicateError;

        const dbRow = (await adapter.executeReadQuery("SELECT DATABASE() as db")).rows?.[0];
        const targetSchema = (dbRow?.["db"] as string) || "mysql";
        const qualifiedTable = `${targetSchema}.${TRACKING_TABLE}`;

        await adapter.executeReadQuery(
          `INSERT INTO ${qualifiedTable}
         (version, description, applied_by, migration_hash, migration_sql, source_system, rollback_sql, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'recorded')`,
          [
            parsed.version,
            parsed.description ?? null,
            parsed.appliedBy ?? null,
            migrationHash,
            parsed.migrationSql,
            parsed.sourceSystem ?? null,
            parsed.rollbackSql ?? null,
          ],
        );
        
        // Fetch the newly inserted record since MySQL doesn't support RETURNING
        const result = await adapter.executeReadQuery(
          `SELECT * FROM ${qualifiedTable} WHERE version = ? AND migration_hash = ? ORDER BY id DESC LIMIT 1`,
          [parsed.version, migrationHash]
        );

        const resultRows = result.rows ?? [];
        if (resultRows.length === 0) {
          return {
            success: false,
            error: "Failed to insert migration record.",
          };
        }
        const row = resultRows[0] ?? {};
        return {
          success: true,
          record: formatRecord(row),
        };
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

// =============================================================================
// mysql_migration_apply
// =============================================================================

export function createMigrationApplyTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_migration_apply",
    description:
      "Execute migration SQL and record it atomically. Note: MySQL DDL statements cannot be rolled back, they commit the current transaction. " +
      "Auto-provisions the tracking table on first use. " +
      "Use mysql_migration_record instead if you only need to log an already-applied migration.",
    group: "migration",
    inputSchema: MigrationApplySchemaBase,
    annotations: { readOnlyHint: false, destructiveHint: true },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = MigrationApplySchema.parse(params);
        await ensureTrackingTable(adapter);

        const { migrationHash, duplicateError } = await checkDuplicateHash(
          adapter,
          parsed.migrationSql,
        );
        if (duplicateError) return duplicateError;

        const dbRow = (await adapter.executeReadQuery("SELECT DATABASE() as db")).rows?.[0];
        const targetSchema = (dbRow?.["db"] as string) || "mysql";
        const qualifiedTable = `${targetSchema}.${TRACKING_TABLE}`;

        // We do not use transactions for DDL in MySQL because MySQL DDL commits implicitly
        // We will just execute it, and if it succeeds, write the record.
        try {
          // Execute the migration SQL
          await adapter.executeReadQuery(parsed.migrationSql);

          // Record in tracking table
          await adapter.executeReadQuery(
            `INSERT INTO ${qualifiedTable}
           (version, description, applied_by, migration_hash, migration_sql, source_system, rollback_sql, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'applied')`,
            [
              parsed.version,
              parsed.description ?? null,
              parsed.appliedBy ?? null,
              migrationHash,
              parsed.migrationSql,
              parsed.sourceSystem ?? null,
              parsed.rollbackSql ?? null,
            ],
          );



          const result = await adapter.executeReadQuery(
            `SELECT * FROM ${qualifiedTable} WHERE version = ? AND migration_hash = ? ORDER BY id DESC LIMIT 1`,
            [parsed.version, migrationHash]
          );

          const resultRows = result.rows ?? [];
          if (resultRows.length === 0) {
            return {
              success: false,
              error:
                "Migration was applied but failed to insert tracking record.",
            };
          }
          const row = resultRows[0] ?? {};
          return {
            success: true,
            record: formatRecord(row),
          };
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);

          // Record a 'failed' entry
          try {
            await adapter.executeReadQuery(
              `INSERT INTO ${qualifiedTable}
             (version, description, applied_by, migration_hash, migration_sql, source_system, rollback_sql, status, error_information)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'failed', ?)`,
              [
                parsed.version,
                parsed.description ?? null,
                parsed.appliedBy ?? null,
                migrationHash,
                parsed.migrationSql,
                parsed.sourceSystem ?? null,
                parsed.rollbackSql ?? null,
                message,
              ],
            );
          } catch {
            // Best-effort: if we can't record the failure, still return the error
          }

          throw new QueryError(
            `Migration "${parsed.version}" failed: ${message}. Warning: If this was a DDL statement, partial changes may exist.`,
          );
        }
      } catch (error: unknown) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
