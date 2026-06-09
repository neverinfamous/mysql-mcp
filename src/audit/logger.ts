/**
 * mysql-mcp — Audit Logger
 *
 * Async-buffered JSONL writer for the audit trail. Appends one
 * JSON object per line to a configurable file path, or writes to
 * stderr for containerised deployments (`--audit-log stderr`).
 *
 * Non-throwing by design: audit failures log to stderr but never
 * propagate to tool callers.
 */

import { appendFile, mkdir, open, rename, stat } from "node:fs/promises";
import { dirname } from "node:path";
import type { AuditConfig, AuditEntry, AuditCategory } from "./types.js";
import type { SystemDb } from "../observability/system-db.js";

interface AuditLogRow {
  timestamp: string;
  requestId: string;
  tool: string;
  category: string;
  scope: string;
  user: string | null;
  scopesJson: string | null;
  durationMs: number;
  success: number;
  tokenEstimate: number | null;
  error: string | null;
  argsJson: string | null;
  backupPath: string | null;
}

/** Maximum entries to buffer before forcing a flush */
const BUFFER_HIGH_WATER = 50;

/** Auto-flush interval in milliseconds */
const FLUSH_INTERVAL_MS = 100;

/** Default number of recent entries returned by `recent()` */
const DEFAULT_RECENT_COUNT = 50;

/** Special logPath value that routes audit output to stderr */
const STDERR_SENTINEL = "stderr";

/**
 * Maximum bytes to read from the end of the audit log for `recent()`.
 * 64 KB is enough for ~100+ typical JSONL audit entries (~500 bytes each).
 * Files smaller than this are read in full; larger files only read the tail.
 */
const TAIL_READ_BYTES = 65_536;

export class AuditLogger {
  readonly config: AuditConfig;

  private buffer: string[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private activeFlush: Promise<void> | null = null;
  private closed = false;
  private dirEnsured = false;
  private readonly stderrMode: boolean;
  private systemDb: SystemDb | null = null;

  constructor(config: AuditConfig) {
    this.config = config;
    this.stderrMode = config.logPath.toLowerCase() === STDERR_SENTINEL;

    if (config.enabled) {
      // Use unref() so the timer doesn't keep the process alive
      this.flushTimer = setInterval(() => {
        void this.flush();
      }, FLUSH_INTERVAL_MS);
      this.flushTimer.unref();
    }
  }

  /**
   * Append an audit entry to the buffer.
   * Non-blocking — the entry is serialised and queued; the
   * actual file write happens on the next flush cycle.
   */
  log(entry: AuditEntry): void {
    if (this.closed || !this.config.enabled) return;

    this.buffer.push(JSON.stringify(entry));

    // Eagerly flush when the buffer is full
    if (this.buffer.length >= BUFFER_HIGH_WATER) {
      void this.flush();
    }
  }

  /**
   * Set the SystemDb instance for persisting audit logs.
   */
  setSystemDb(systemDb: SystemDb): void {
    this.systemDb = systemDb;
  }

  /**
   * Flush the buffer to disk and SystemDb.
   * Safe to call concurrently — serialises via `this.activeFlush` Promise.
   */
  async flush(): Promise<void> {
    // If a flush is currently running, wait for it to finish
    if (this.activeFlush) {
      await this.activeFlush;
      // If the buffer is empty after waiting, return
      if (this.buffer.length === 0) return;
    }

    if (this.buffer.length === 0) return;

    const doFlush = async (): Promise<void> => {
      // Rotate before writing if the log exceeds the configured size
      await this.rotateIfNeeded();

      // Swap the buffer so new entries can accumulate while we write
      const lines = this.buffer;
      this.buffer = [];

      try {
        if (this.stderrMode) {
          // Stderr mode: write directly, no buffering to disk
          process.stderr.write(lines.join("\n") + "\n");
        } else {
          await this.ensureDirectory();
          // One appendFile call with all buffered lines — each terminated by \n
          await appendFile(
            this.config.logPath,
            lines.join("\n") + "\n",
            "utf-8",
          );
        }

        if (this.systemDb) {
          const db = this.systemDb.getDb();
          const stmt = db.prepare(`
            INSERT INTO audit_logs (timestamp, requestId, tool, category, scope, user, scopesJson, durationMs, success, tokenEstimate, error, argsJson, backupPath)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const transaction = db.transaction((entries: string[]) => {
            for (const line of entries) {
              const log = JSON.parse(line) as AuditEntry;
              stmt.run(
                log.timestamp,
                log.requestId,
                log.tool,
                log.category,
                log.scope,
                log.user ?? null,
                JSON.stringify(log.scopes),
                log.durationMs,
                log.success ? 1 : 0,
                log.tokenEstimate ?? null,
                log.error ?? null,
                log.args ? JSON.stringify(log.args) : null,
                log.backup ?? null,
              );
            }
          });

          transaction(lines);
        }
      } catch (err) {
        // Never throw — audit must not break tool execution
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[AUDIT] Write failed: ${message}\n`);
        // Re-queue the failed lines so they aren't lost
        this.buffer.unshift(...lines);
      }
    };

    this.activeFlush = doFlush();
    try {
      await this.activeFlush;
    } finally {
      this.activeFlush = null;
    }
  }

  /**
   * Gracefully close the logger — flush remaining entries and stop the timer.
   */
  async close(): Promise<void> {
    this.closed = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
  }

  /**
   * Read the most recent audit entries from the log file.
   * Uses a streaming tail-read: only the last TAIL_READ_BYTES (64 KB) are
   * read from disk, preventing O(n) memory spikes for large audit logs.
   * Used by the `mysql://audit` resource.
   *
   * @param count Maximum number of entries to return (default 50)
   */
  async recent(count: number = DEFAULT_RECENT_COUNT): Promise<AuditEntry[]> {
    // Stderr mode has no file to read from
    if (this.stderrMode) return [];

    // Force flush buffered entries to ensure the read includes up-to-the-millisecond events
    await this.flush();

    if (this.systemDb) {
      try {
        const db = this.systemDb.getDb();
        const rows = db
          .prepare(
            `
          SELECT * FROM audit_logs
          ORDER BY timestamp DESC
          LIMIT ?
        `,
          )
          .all(count) as AuditLogRow[];

        return rows.map((row) => ({
          timestamp: row.timestamp,
          requestId: row.requestId,
          tool: row.tool,
          category: row.category as AuditCategory,
          scope: row.scope,
          user: row.user,
          scopes: row.scopesJson ? (JSON.parse(row.scopesJson) as string[]) : [],
          durationMs: row.durationMs,
          success: row.success === 1,
          tokenEstimate: row.tokenEstimate ?? undefined,
          error: row.error ?? undefined,
          args: row.argsJson
            ? (JSON.parse(row.argsJson) as Record<string, unknown>)
            : undefined,
          backup: row.backupPath ?? undefined,
        }));
      } catch {
        // Fall back to file
      }
    }

    try {
      // Open directly — avoids TOCTOU race between stat() and open()
      let fh: Awaited<ReturnType<typeof open>>;
      try {
        fh = await open(this.config.logPath, "r");
      } catch {
        // File does not exist yet
        return [];
      }

      try {
        // stat after open — file is guaranteed to exist since we hold the FD
        const info = await stat(this.config.logPath);
        const fileSize = info.size;
        if (fileSize === 0) return [];

        // Read only the tail of the file — avoids loading entire log into memory
        const readSize = Math.min(fileSize, TAIL_READ_BYTES);
        const startOffset = fileSize - readSize;

        const buf = Buffer.alloc(readSize);
        await fh.read(buf, 0, readSize, startOffset);
        const chunk = buf.toString("utf-8");

        // Split into lines: if we started mid-file, discard the first
        // (likely partial) line
        const rawLines = chunk.split("\n").filter(Boolean);
        const lines = startOffset > 0 ? rawLines.slice(1) : rawLines;
        const tail = lines.slice(-count);

        return tail.reduce<AuditEntry[]>((acc, line) => {
          try {
            acc.push(JSON.parse(line) as AuditEntry);
          } catch {
            // Gracefully ignore corrupted or partial log entries
          }
          return acc;
        }, []);
      } finally {
        await fh.close();
      }
    } catch {
      return [];
    }
  }

  /**
   * Ensure the parent directory of the log file exists.
   */
  private async ensureDirectory(): Promise<void> {
    if (this.dirEnsured) return;
    try {
      await mkdir(dirname(this.config.logPath), { recursive: true });
      this.dirEnsured = true;
    } catch {
      // Directory may already exist — that's fine
      this.dirEnsured = true;
    }
  }

  /**
   * Rotate the log file if it exceeds the configured size limit.
   * Keeps up to 5 rotated files (`.1` through `.5`); older data is discarded.
   * Rotation failure is non-fatal — audit must not block tool execution.
   */
  private async rotateIfNeeded(): Promise<void> {
    if (this.stderrMode || !this.config.maxSizeBytes) return;
    try {
      const info = await stat(this.config.logPath).catch(() => null);
      if (!info || info.size < this.config.maxSizeBytes) return;

      // Cascade rename from .4 to .5, .3 to .4, etc. to keep 5 backups
      for (let i = 4; i >= 1; i--) {
        const oldFile = `${this.config.logPath}.${String(i)}`;
        const newFile = `${this.config.logPath}.${String(i + 1)}`;
        await rename(oldFile, newFile).catch(() => null); // ignore if .i doesn't exist
      }

      // Rename current to .1
      const rotatedPath = `${this.config.logPath}.1`;
      await rename(this.config.logPath, rotatedPath);
    } catch {
      // Rotation failure must not block logging
    }
  }

  /**
   * Search and filter audit entries from the SystemDb.
   */
  async search(filters: {
    tool?: string | undefined;
    category?: string | undefined;
    success?: boolean | undefined;
    requestId?: string | undefined;
    fromTimestamp?: string | undefined;
    toTimestamp?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
  }): Promise<{ entries: AuditEntry[]; totalCount: number }> {
    if (this.stderrMode || !this.systemDb) {
      return { entries: [], totalCount: 0 };
    }

    await this.flush();

    try {
      const db = this.systemDb.getDb();
      let sql = "SELECT * FROM audit_logs WHERE 1=1";
      let countSql = "SELECT COUNT(*) as c FROM audit_logs WHERE 1=1";
      const params: unknown[] = [];

      if (filters.tool) {
        sql += " AND tool = ?";
        countSql += " AND tool = ?";
        params.push(filters.tool);
      }
      if (filters.category) {
        sql += " AND category = ?";
        countSql += " AND category = ?";
        params.push(filters.category);
      }
      if (filters.success !== undefined) {
        sql += " AND success = ?";
        countSql += " AND success = ?";
        params.push(filters.success ? 1 : 0);
      }
      if (filters.requestId) {
        sql += " AND requestId = ?";
        countSql += " AND requestId = ?";
        params.push(filters.requestId);
      }
      if (filters.fromTimestamp) {
        sql += " AND timestamp >= ?";
        countSql += " AND timestamp >= ?";
        params.push(filters.fromTimestamp);
      }
      if (filters.toTimestamp) {
        sql += " AND timestamp <= ?";
        countSql += " AND timestamp <= ?";
        params.push(filters.toTimestamp);
      }

      const totalCount = (db.prepare(countSql).get(...params) as { c: number })
        .c;

      sql += " ORDER BY timestamp DESC LIMIT ? OFFSET ?";
      params.push(filters.limit ?? 50);
      params.push(filters.offset ?? 0);

      const rows = db.prepare(sql).all(...params) as AuditLogRow[];

      const entries = rows.map((row) => ({
        timestamp: row.timestamp,
        requestId: row.requestId,
        tool: row.tool,
        category: row.category as AuditCategory,
        scope: row.scope,
        user: row.user,
        scopes: row.scopesJson ? (JSON.parse(row.scopesJson) as string[]) : [],
        durationMs: row.durationMs,
        success: row.success === 1,
        tokenEstimate: row.tokenEstimate ?? undefined,
        error: row.error ?? undefined,
        args: row.argsJson
          ? (JSON.parse(row.argsJson) as Record<string, unknown>)
          : undefined,
        backup: row.backupPath ?? undefined,
      }));

      return { entries, totalCount };
    } catch {
      return { entries: [], totalCount: 0 };
    }
  }
}

