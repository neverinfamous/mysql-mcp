import type { BackupConfig } from "../types.js";
import { MAX_SAMPLE_ROWS, DEFAULT_MAX_DATA_SIZE_BYTES } from "./constants.js";

/**
 * Interface for database queries needed by the backup manager.
 * Avoids circular imports from the full adapter.
 */
export interface SnapshotQueryAdapter {
  executeQuery(
    sql: string,
    params?: unknown[],
  ): Promise<{
    rows?: Record<string, unknown>[];
  }>;
  describeTable(
    table: string,
    schema?: string,
  ): Promise<{
    columns?: {
      name: string;
      type: string;
      nullable?: boolean;
      defaultValue?: unknown;
    }[];
    primaryKey?: string[] | null;
  }>;
}

export async function buildTableDdl(
  tableName: string,
  schemaName: string,
  adapter: SnapshotQueryAdapter,
): Promise<string> {
  try {
    const result = await adapter.executeQuery(
      `SHOW CREATE TABLE \`${schemaName}\`.\`${tableName}\``,
    );
    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      if (row?.["Create Table"] != null) {
        const val = row["Create Table"];
        return typeof val === "string" ? val : "";
      }
      if (row?.["Create View"] != null) {
        const val = row["Create View"];
        return typeof val === "string" ? val : "";
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(
      `[AUDIT-BACKUP] SHOW CREATE failed for ${tableName}: ${msg}\n`,
    );
  }
  return `-- Object "${schemaName}"."${tableName}" does not exist or cannot be described`;
}

export async function captureVolumeMetadata(
  tableName: string,
  schemaName: string,
  adapter: SnapshotQueryAdapter,
): Promise<{ rowCount?: number; totalSizeBytes?: number }> {
  try {
    const sizeResult = await adapter.executeQuery(
      `SELECT TABLE_ROWS AS row_count,
              (DATA_LENGTH + INDEX_LENGTH) AS total_size_bytes
       FROM information_schema.TABLES
       WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?`,
      [tableName, schemaName],
    );
    const sizeRow = sizeResult.rows?.[0];

    if (sizeRow) {
      let rowCount: number | undefined;
      const rawRowCount = sizeRow["row_count"];
      if (typeof rawRowCount === "number") {
        rowCount = rawRowCount;
      } else if (typeof rawRowCount === "string") {
        rowCount = parseInt(rawRowCount, 10);
      }

      if (rowCount === null || rowCount === undefined || isNaN(rowCount)) {
        rowCount = undefined;
      }

      let totalSizeBytes: number | undefined;
      const rawTotalSize = sizeRow["total_size_bytes"];
      if (typeof rawTotalSize === "number") {
        totalSizeBytes = rawTotalSize;
      } else if (typeof rawTotalSize === "string") {
        totalSizeBytes = parseInt(rawTotalSize, 10);
      }

      return {
        ...(rowCount !== undefined && { rowCount }),
        ...(totalSizeBytes !== undefined && { totalSizeBytes }),
      };
    }
  } catch {
    // Volume metadata is best-effort — don't fail the snapshot
  }
  return {};
}

export async function captureTableData(
  tableName: string,
  schemaName: string,
  totalSizeBytes: number | undefined,
  adapter: SnapshotQueryAdapter,
  config: BackupConfig,
): Promise<{
  data?: string;
  dataSkipped: boolean;
  dataSkippedReason?: string;
}> {
  if (!config.includeData) {
    return { dataSkipped: false };
  }

  const maxDataSize = config.maxDataSizeBytes || DEFAULT_MAX_DATA_SIZE_BYTES;

  if (totalSizeBytes !== undefined && totalSizeBytes > maxDataSize) {
    const sizeMB = Math.round(totalSizeBytes / (1024 * 1024));
    const thresholdMB = Math.round(maxDataSize / (1024 * 1024));
    return {
      dataSkipped: true,
      dataSkippedReason: `Table size ~${String(sizeMB)}MB exceeds ${String(thresholdMB)}MB threshold`,
    };
  }

  try {
    const result = await adapter.executeQuery(
      `SELECT * FROM \`${schemaName}\`.\`${tableName}\` LIMIT ${String(MAX_SAMPLE_ROWS)}`,
    );
    if (result.rows && result.rows.length > 0) {
      const firstRow = result.rows[0];
      if (firstRow) {
        const cols = Object.keys(firstRow)
          .map((c) => `\`${c}\``)
          .join(", ");
        const data = result.rows
          .map((row) => {
            const vals = Object.values(row)
              .map((v) => {
                if (v === null) return "NULL";
                if (typeof v === "string")
                  return `'${v.replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
                if (typeof v === "number" || typeof v === "boolean")
                  return String(v);
                if (v instanceof Date)
                  return `'${v.toISOString().slice(0, 19).replace("T", " ")}'`;
                return `'${JSON.stringify(v).replace(/'/g, "''").replace(/\\/g, "\\\\")}'`;
              })
              .join(", ");
            return `INSERT INTO \`${schemaName}\`.\`${tableName}\` (${cols}) VALUES (${vals});`;
          })
          .join("\n");
        return { data, dataSkipped: false };
      }
    }
  } catch {
    // Data capture is best-effort
  }

  return { dataSkipped: false };
}

export async function captureSchemaDropSnapshot(
  schema: string,
  adapter: SnapshotQueryAdapter,
): Promise<string> {
  let ddl = `-- Pre-drop snapshot of database "${schema}"\n`;
  try {
    const tables = await adapter.executeQuery(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'`,
      [schema],
    );
    if (tables.rows) {
      ddl += `-- Tables: ${tables.rows.map((r) => String(r["TABLE_NAME"])).join(", ")}\n`;
    }
    const views = await adapter.executeQuery(
      `SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = ?`,
      [schema],
    );
    if (views.rows) {
      ddl += `-- Views: ${views.rows.map((r) => String(r["TABLE_NAME"])).join(", ")}\n`;
    }
  } catch {
    ddl += "-- Could not enumerate database objects\n";
  }

  return ddl;
}
