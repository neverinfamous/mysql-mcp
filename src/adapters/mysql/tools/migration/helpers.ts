/**
 * MySQL Migration Tools — Shared Helpers
 *
 * Constants, SQL builders, and utilities used by migration tool factories.
 */

import { createHash } from "node:crypto";
import type { MySQLAdapter } from "../../mysql-adapter.js";

// =============================================================================
// Migration tracking — shared helpers
// =============================================================================

export const TRACKING_TABLE = "_mcp_schema_versions";

/**
 * Build the CREATE TABLE DDL for the tracking table.
 * Accepts a pre-computed qualified table name.
 */
export function buildCreateTrackingTableSql(qualifiedTable: string): string {
  return `
CREATE TABLE IF NOT EXISTS ${qualifiedTable} (
  id INT AUTO_INCREMENT PRIMARY KEY,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  applied_by VARCHAR(255),
  migration_hash VARCHAR(64) NOT NULL,
  migration_sql TEXT NOT NULL,
  source_system VARCHAR(50),
  rollback_sql TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'applied',
  error_information TEXT,
  CHECK (status IN ('applied', 'recorded', 'rolled_back', 'failed'))
)`;
}

/**
 * Ensure the _mcp_schema_versions table exists in the target schema (defaults to active database).
 * Returns true if the table was newly created, false if it already existed.
 */
export async function ensureTrackingTable(
  adapter: MySQLAdapter,
  schema?: string,
): Promise<boolean> {
  let targetSchema = schema;
  if (!targetSchema) {
    const dbRow = (await adapter.executeReadQuery("SELECT DATABASE() as db"))
      .rows?.[0];
    targetSchema = (dbRow?.["db"] as string) || "mysql";
  }

  const check = await adapter.executeReadQuery(
    `SELECT EXISTS (
      SELECT 1 FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    ) AS table_exists`,
    [targetSchema, TRACKING_TABLE],
  );

  const firstRow = (check.rows ?? [])[0];
  const existed =
    firstRow?.["table_exists"] === 1 || firstRow?.["table_exists"] === true;

  if (!existed) {
    const qualifiedTable = `${targetSchema}.${TRACKING_TABLE}`;
    await adapter.executeWriteQuery(
      buildCreateTrackingTableSql(qualifiedTable),
    );
  }
  return !existed;
}

export function hashMigrationSql(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

/**
 * Check for an already-applied migration with the same SQL hash.
 * Returns an error result object if duplicate found, or null if clear.
 */
export async function checkDuplicateHash(
  adapter: MySQLAdapter,
  version: string,
  migrationSql: string,
  schema?: string,
): Promise<{
  migrationHash: string;
  duplicateError: null | {
    success: false;
    error: string;
    code: string;
    category: string;
    recoverable: boolean;
    metrics?: { tokenEstimate: number };
  };
}> {
  let targetSchema = schema;
  if (!targetSchema) {
    const dbRow = (await adapter.executeReadQuery("SELECT DATABASE() as db"))
      .rows?.[0];
    targetSchema = (dbRow?.["db"] as string) || "mysql";
  }
  const qualifiedTable = `${targetSchema}.${TRACKING_TABLE}`;

  const migrationHash = hashMigrationSql(migrationSql);

  // Check for checksum mismatch on the same version
  const versionCheck = await adapter.executeReadQuery(
    `SELECT id, migration_hash FROM ${qualifiedTable} WHERE version = ? AND status IN ('applied', 'recorded')`,
    [version],
  );
  if (versionCheck.rows && versionCheck.rows.length > 0) {
    for (const row of versionCheck.rows) {
      if (row["migration_hash"] !== migrationHash) {
        const duplicateError = {
          success: false as const,
          error: `Checksum mismatch for migration "${version}". The version already exists but with a different SQL hash.`,
          code: "CHECKSUM_MISMATCH",
          category: "validation",
          recoverable: false,
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(duplicateError), "utf8") / 4,
        );
        return {
          migrationHash,
          duplicateError: { ...duplicateError, metrics: { tokenEstimate } },
        };
      }
    }
  }

  // Check for duplicate hash
  const dupCheck = await adapter.executeReadQuery(
    `SELECT id, version, status FROM ${qualifiedTable}
     WHERE migration_hash = ? AND status = 'applied'`,
    [migrationHash],
  );
  const dupRows = dupCheck.rows ?? [];
  if (dupRows.length > 0) {
    const dup = dupRows[0] ?? {};
    const dupId = dup["id"] as number;
    const dupVersion = dup["version"] as string;

    if (dupVersion === version) {
      const duplicateError = {
        success: false as const,
        error: `Migration "${version}" has already been applied.`,
        code: "ALREADY_APPLIED",
        category: "validation",
        recoverable: true,
      };
      const tokenEstimate = Math.ceil(
        Buffer.byteLength(JSON.stringify(duplicateError), "utf8") / 4,
      );
      return {
        migrationHash,
        duplicateError: { ...duplicateError, metrics: { tokenEstimate } },
      };
    }

    const duplicateError = {
      success: false as const,
      error:
        `Duplicate migration detected: version "${dupVersion}" (id: ${String(dupId)}) has the same SQL hash. ` +
        `Use a different migration SQL or roll back the existing one first.`,
      code: "DUPLICATE_MIGRATION",
      category: "validation",
      recoverable: true,
    };
    const tokenEstimate = Math.ceil(
      Buffer.byteLength(JSON.stringify(duplicateError), "utf8") / 4,
    );
    return {
      migrationHash,
      duplicateError: { ...duplicateError, metrics: { tokenEstimate } },
    };
  }
  return { migrationHash, duplicateError: null };
}

export interface FormattedRecord {
  id: number;
  version: string;
  description: string | null;
  appliedAt: string;
  appliedBy: string | null;
  migrationHash: string;
  sourceSystem: string | null;
  status: string;
  errorInformation?: string | null;
  outOfOrder?: boolean;
}

export function formatRecord(row: Record<string, unknown>): FormattedRecord {
  const appliedAt = row["applied_at"];
  const appliedAtStr =
    appliedAt instanceof Date
      ? appliedAt.toISOString()
      : ((appliedAt as string | null) ?? "");
  return {
    id: row["id"] as number,
    version: row["version"] as string,
    description: (row["description"] as string | null) ?? null,
    appliedAt: appliedAtStr,
    appliedBy: (row["applied_by"] as string | null) ?? null,
    migrationHash: row["migration_hash"] as string,
    sourceSystem: (row["source_system"] as string | null) ?? null,
    status: row["status"] as string,
    ...(row["error_information"] !== undefined
      ? {
          errorInformation: (row["error_information"] as string | null) ?? null,
        }
      : {}),
    ...(row["out_of_order"] !== undefined
      ? {
          outOfOrder: Boolean(row["out_of_order"]),
        }
      : {}),
  };
}
