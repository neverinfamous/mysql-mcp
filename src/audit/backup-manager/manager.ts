import {
  writeFile,
  readFile,
  readdir,
  mkdir,
  stat,
  unlink,
  rename,
} from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { gunzipSync, gzip as gzipCb } from "node:zlib";
import { promisify } from "node:util";

const gzipAsync = promisify(gzipCb);

import type {
  BackupConfig,
  SnapshotMetadata,
  SnapshotContent,
} from "../types.js";

import {
  SNAPSHOT_TOOL_ARGS,
  SNAPSHOT_EXT,
  SNAPSHOT_EXT_LEGACY,
} from "./constants.js";

import {
  type SnapshotQueryAdapter,
  buildTableDdl,
  captureVolumeMetadata,
  captureTableData,
  captureSchemaDropSnapshot,
} from "./capture.js";

export class BackupManager {
  readonly config: BackupConfig;
  private readonly snapshotDir: string;
  private dirEnsured = false;
  private readonly pendingWrites = new Set<Promise<void>>();

  constructor(config: BackupConfig, auditLogPath: string) {
    this.config = config;
    const logDir = dirname(auditLogPath);
    this.snapshotDir = join(logDir, "snapshots");
  }

  shouldSnapshot(toolName: string): boolean {
    return this.config.enabled && toolName in SNAPSHOT_TOOL_ARGS;
  }

  async createSnapshot(
    toolName: string,
    args: Record<string, unknown>,
    requestId: string,
    adapter: SnapshotQueryAdapter,
    logAs?: string,
  ): Promise<string | undefined> {
    if (!this.shouldSnapshot(toolName)) return undefined;

    try {
      const mapping = SNAPSHOT_TOOL_ARGS[toolName];
      if (!mapping) return undefined;

      const rawTarget = args[mapping.targetKey];
      const target = typeof rawTarget === "string" ? rawTarget : "unknown";
      const rawSchema = mapping.schemaKey ? args[mapping.schemaKey] : undefined;
      let schema: string | undefined =
        typeof rawSchema === "string" ? rawSchema : undefined;

      if (!schema) {
        try {
          const dbRes = await adapter.executeQuery("SELECT DATABASE() as db");
          const dbVal = dbRes.rows?.[0]?.["db"];
          schema = typeof dbVal === "string" ? dbVal : "mysql";
        } catch {
          schema = "mysql";
        }
      }

      if (toolName === "mysql_drop_schema") {
        const ddl = await captureSchemaDropSnapshot(target, adapter);
        return await this.writeSnapshot(
          logAs ?? toolName,
          target,
          target,
          requestId,
          ddl,
        );
      }

      return await this.captureObjectSnapshot(
        logAs ?? toolName,
        target,
        schema,
        requestId,
        adapter,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[AUDIT-BACKUP] Snapshot failed for ${toolName}: ${message}\n`,
      );
      return undefined;
    }
  }

  async listSnapshots(): Promise<SnapshotMetadata[]> {
    try {
      await this.ensureDirectory();
      const files = await readdir(this.snapshotDir);
      const snapshots: SnapshotMetadata[] = [];

      for (const file of files) {
        if (!file.endsWith(SNAPSHOT_EXT) && !file.endsWith(SNAPSHOT_EXT_LEGACY))
          continue;
        try {
          const parsed = await this.readSnapshotFile(file);
          if (parsed) {
            snapshots.push({ ...parsed.metadata, filename: file });
          }
        } catch {
          // Skip corrupt
        }
      }

      snapshots.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return snapshots;
    } catch {
      return [];
    }
  }

  async getSnapshot(filename: string): Promise<SnapshotContent | null> {
    try {
      const safe = basename(filename);
      return await this.readSnapshotFile(safe);
    } catch {
      return null;
    }
  }

  async cleanup(): Promise<number> {
    if (!this.config.enabled) return 0;

    try {
      const files = await readdir(this.snapshotDir);
      const snapshotFiles = files.filter(
        (f) => f.endsWith(SNAPSHOT_EXT) || f.endsWith(SNAPSHOT_EXT_LEGACY),
      );

      if (snapshotFiles.length === 0) return 0;

      const fileInfos: { name: string; mtime: Date; path: string }[] = [];
      for (const file of snapshotFiles) {
        const filePath = join(this.snapshotDir, file);
        try {
          const stats = await stat(filePath);
          fileInfos.push({ name: file, mtime: stats.mtime, path: filePath });
        } catch {
          // skip inaccessible
        }
      }

      fileInfos.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

      let deleted = 0;
      const now = Date.now();
      const maxAgeMs = this.config.maxAgeDays * 24 * 60 * 60 * 1000;

      for (const info of fileInfos) {
        const age = now - info.mtime.getTime();
        const overAge = age > maxAgeMs;
        const overCount = fileInfos.length - deleted > this.config.maxCount;

        if (overAge || overCount) {
          try {
            await unlink(info.path);
            deleted++;
          } catch {
            // skip undeletable
          }
        }
      }

      if (deleted > 0) {
        process.stderr.write(
          `[AUDIT-BACKUP] Cleaned up ${String(deleted)} snapshot(s)\n`,
        );
      }

      return deleted;
    } catch {
      return 0;
    }
  }

  async flush(): Promise<void> {
    if (this.pendingWrites.size > 0) {
      await Promise.allSettled(this.pendingWrites);
    }
  }

  async getStats(): Promise<{
    count: number;
    oldestAge?: string;
    totalSizeKB: number;
  }> {
    try {
      const files = await readdir(this.snapshotDir);
      const snapshotFiles = files.filter(
        (f) => f.endsWith(SNAPSHOT_EXT) || f.endsWith(SNAPSHOT_EXT_LEGACY),
      );
      let totalSize = 0;
      let oldestMtime: Date | undefined;

      for (const file of snapshotFiles) {
        try {
          const stats = await stat(join(this.snapshotDir, file));
          totalSize += stats.size;
          if (!oldestMtime || stats.mtime < oldestMtime) {
            oldestMtime = stats.mtime;
          }
        } catch {
          // skip
        }
      }

      return {
        count: snapshotFiles.length,
        ...(oldestMtime && { oldestAge: oldestMtime.toISOString() }),
        totalSizeKB: Math.round(totalSize / 1024),
      };
    } catch {
      return { count: 0, totalSizeKB: 0 };
    }
  }

  private async captureObjectSnapshot(
    toolName: string,
    target: string,
    schema: string,
    requestId: string,
    adapter: SnapshotQueryAdapter,
  ): Promise<string | undefined> {
    let tableName = target;
    let schemaName = schema;
    if (target.includes(".")) {
      const parts = target.split(".");
      if (parts.length === 2 && parts[0] && parts[1]) {
        schemaName = parts[0];
        tableName = parts[1];
      }
    }

    const ddl = await buildTableDdl(tableName, schemaName, adapter);
    const { rowCount, totalSizeBytes } = await captureVolumeMetadata(
      tableName,
      schemaName,
      adapter,
    );
    const { data, dataSkipped, dataSkippedReason } = await captureTableData(
      tableName,
      schemaName,
      totalSizeBytes,
      adapter,
      this.config,
    );

    return this.writeSnapshot(
      toolName,
      tableName,
      schemaName,
      requestId,
      ddl,
      data,
      {
        ...(rowCount !== undefined && { rowCount }),
        ...(totalSizeBytes !== undefined && { totalSizeBytes }),
        ...(dataSkipped && { dataSkipped }),
        ...(dataSkippedReason !== undefined && { dataSkippedReason }),
      },
    );
  }

  private async writeSnapshot(
    tool: string,
    target: string,
    schema: string,
    requestId: string,
    ddl: string,
    data?: string,
    volumeMeta?: {
      rowCount?: number;
      totalSizeBytes?: number;
      dataSkipped?: boolean;
      dataSkippedReason?: string;
    },
  ): Promise<string | undefined> {
    await this.ensureDirectory();

    const timestamp = new Date().toISOString();
    const safeTarget = target.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeTool = tool.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${timestamp.replace(/[:.]/g, "-")}_${safeTool}_${safeTarget}${SNAPSHOT_EXT}`;

    const content: SnapshotContent = {
      metadata: {
        timestamp,
        tool,
        target,
        schema,
        type: data ? "ddl+data" : "ddl",
        requestId,
        sizeBytes: 0,
        ...(volumeMeta?.rowCount !== undefined && {
          rowCount: volumeMeta.rowCount,
        }),
        ...(volumeMeta?.totalSizeBytes !== undefined && {
          totalSizeBytes: volumeMeta.totalSizeBytes,
        }),
        ...(volumeMeta?.dataSkipped && { dataSkipped: true }),
        ...(volumeMeta?.dataSkippedReason && {
          dataSkippedReason: volumeMeta.dataSkippedReason,
        }),
      },
      ddl,
      data,
    };

    const json = JSON.stringify(content, null, 2);
    const sizeBytes = Buffer.byteLength(json, "utf-8");
    const finalJson = json.replace(
      '"sizeBytes": 0',
      `"sizeBytes": ${String(sizeBytes)}`,
    );

    const compressed = await gzipAsync(Buffer.from(finalJson, "utf-8"));
    const filePath = join(this.snapshotDir, filename);

    const tmpPath = `${filePath}.tmp`;
    const writePromise = writeFile(tmpPath, compressed)
      .then(() => rename(tmpPath, filePath))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(
          `[AUDIT-BACKUP] Async write failed for ${filename}: ${msg}\n`,
        );
        void unlink(tmpPath).catch(() => null);
      });
    this.pendingWrites.add(writePromise);
    void writePromise.finally(() => {
      this.pendingWrites.delete(writePromise);
    });

    return filename;
  }

  private async readSnapshotFile(
    filename: string,
  ): Promise<SnapshotContent | null> {
    const filePath = join(this.snapshotDir, filename);
    const raw = await readFile(filePath);

    if (raw[0] === 0x1f && raw[1] === 0x8b) {
      const decompressed = gunzipSync(raw);
      return JSON.parse(decompressed.toString("utf-8")) as SnapshotContent;
    }

    return JSON.parse(raw.toString("utf-8")) as SnapshotContent;
  }

  private async ensureDirectory(): Promise<void> {
    if (this.dirEnsured) return;
    try {
      await mkdir(this.snapshotDir, { recursive: true });
      this.dirEnsured = true;
    } catch {
      this.dirEnsured = true;
    }
  }
}
