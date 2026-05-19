/**
 * MySQL Admin Tools - Audit Backups
 *
 * Exposes the Audit Subsystem's pre-mutation snapshots to the agent.
 */

import { z } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import type { BackupManager } from "../../../../audit/backup-manager.js";
import { READ_ONLY, WRITE } from "../../../../utils/annotations.js";
import { progressFactory } from "../../../../progress/index.js";

export function createAuditListBackupsTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  const schema = z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(50)
      .describe("Max backups to return"),
    target: z
      .string()
      .optional()
      .describe("Filter by exact target object name (e.g. users)"),
  });

  return {
    name: "mysql_audit_list_backups",
    title: "MySQL Audit List Backups",
    description:
      "List available pre-mutation snapshots captured before destructive operations.",
    group: "backup",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { limit, target } = schema.parse(params);

        // This relies on the DatabaseAdapter having the backupManager available
        // Need to add it to the MySQLAdapter subclass
        const backupManager = (
          adapter as unknown as { backupManager?: BackupManager }
        ).backupManager;
        if (!backupManager) {
          return withTokenEstimate({
            success: false,
            error: "Backup Manager is not enabled or available",
          });
        }

        const snapshots = await backupManager.listSnapshots();

        let filtered = snapshots;
        if (target) {
          filtered = filtered.filter((s) => s.target === target);
        }

        return withTokenEstimate({
          success: true,
          backups: filtered.slice(0, limit),
          total: filtered.length,
        });
      } catch (err) {
        return withTokenEstimate(
          formatHandlerErrorResponse(err) as unknown as Record<string, unknown>,
        );
      }
    },
  };
}

export function createAuditRestoreBackupTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  const schema = z.object({
    filename: z.string().describe("Snapshot filename to restore"),
    includeData: z
      .boolean()
      .default(false)
      .describe("Execute INSERT data if present in snapshot"),
    dryRun: z
      .boolean()
      .default(false)
      .describe("Return the DDL/DML without executing it"),
  });

  return {
    name: "mysql_audit_restore_backup",
    title: "MySQL Audit Restore Backup",
    description: "Restore a specific pre-mutation snapshot to the database.",
    group: "backup",
    inputSchema: schema,
    requiredScopes: ["admin"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { filename, includeData, dryRun } = schema.parse(params);

        const backupManager = (
          adapter as unknown as { backupManager?: BackupManager }
        ).backupManager;
        if (!backupManager) {
          return withTokenEstimate({
            success: false,
            error: "Backup Manager is not enabled or available",
          });
        }

        const snapshot = await backupManager.getSnapshot(filename);
        if (!snapshot) {
          return withTokenEstimate({
            success: false,
            error: `Snapshot not found or unreadable: ${filename}`,
          });
        }

        const operations = [snapshot.ddl];
        if (includeData && snapshot.data) {
          operations.push(snapshot.data);
        }

        const combinedSql = operations.join("\n\n");

        if (dryRun) {
          return withTokenEstimate({
            success: true,
            dryRun: true,
            sql: combinedSql,
            metadata: snapshot.metadata,
          });
        }

        // Execute the statements
        // We split by standard delimiter for simplistic execution
        // Note: For multi-statement execution in MySQL, standard mysql2 requires multipleStatements: true
        // But the DatabaseAdapter's executeWriteQuery doesn't inherently split.
        // We'll just pass the full script if multipleStatements is enabled, or warn.

        const reporter = progressFactory.create(_context.progressToken);
        reporter?.start(1, `Restoring snapshot ${filename}...`);

        await adapter.executeWriteQuery(combinedSql);

        reporter?.complete();

        return withTokenEstimate({
          success: true,
          restoredFilename: filename,
          metadata: snapshot.metadata,
        });
      } catch (err) {
        return withTokenEstimate(
          formatHandlerErrorResponse(err) as unknown as Record<string, unknown>,
        );
      }
    },
  };
}

export function createAuditDiffBackupTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  const schema = z.object({
    filename: z
      .string()
      .describe("Snapshot filename to compare against current schema"),
  });

  return {
    name: "mysql_audit_diff_backup",
    title: "MySQL Audit Diff Backup",
    description:
      "Compare a snapshot's DDL against the current live schema of the object.",
    group: "backup",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { filename } = schema.parse(params);

        const backupManager = (
          adapter as unknown as { backupManager?: BackupManager }
        ).backupManager;
        if (!backupManager) {
          return withTokenEstimate({
            success: false,
            error: "Backup Manager is not enabled or available",
          });
        }

        const snapshot = await backupManager.getSnapshot(filename);
        if (!snapshot) {
          return withTokenEstimate({
            success: false,
            error: `Snapshot not found or unreadable: ${filename}`,
          });
        }

        const { target, schema: schemaName } = snapshot.metadata;

        // Get current DDL
        let liveDdl = "";
        try {
          // Parse schema.table if applicable
          let tableName = target;
          let currentSchema = schemaName;

          if (target.includes(".")) {
            const parts = target.split(".");
            if (parts[0] && parts[1]) {
              currentSchema = parts[0];
              tableName = parts[1];
            }
          }

          const dbRow = (
            await adapter.executeReadQuery("SELECT DATABASE() as db")
          ).rows?.[0];
          const dbName = dbRow?.["db"];
          const dbRes = currentSchema
            ? currentSchema
            : typeof dbName === "string"
              ? dbName
              : "mysql";

          const result = await adapter.executeReadQuery(
            `SHOW CREATE TABLE \`${dbRes}\`.\`${tableName}\``,
          );
          if (Array.isArray(result.rows)) {
            const row = result.rows[0];
            if (row !== undefined) {
              if (typeof row["Create Table"] === "string") {
                liveDdl = row["Create Table"];
              } else if (typeof row["Create View"] === "string") {
                liveDdl = row["Create View"];
              }
            }
          }
        } catch {
          liveDdl = `-- Object "${target}" does not exist in current schema`;
        }

        return withTokenEstimate({
          success: true,
          snapshotDdl: snapshot.ddl,
          liveDdl: liveDdl,
          metadata: snapshot.metadata,
        });
      } catch (err) {
        return withTokenEstimate(
          formatHandlerErrorResponse(err) as unknown as Record<string, unknown>,
        );
      }
    },
  };
}
