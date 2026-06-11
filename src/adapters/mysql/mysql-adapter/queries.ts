import type { MySQLAdapter } from "./mysql-adapter.js";
import type { PoolConnection, FieldPacket } from "mysql2/promise";
import type { QueryResult } from "../../../types/index.js";
import { ConnectionError, QueryError } from "../../../types/index.js";

export class QueryExecutor {
  constructor(private adapter: MySQLAdapter) {}

  async executeQuery(
    sql: string,
    params?: unknown[],
    transactionId?: string,
  ): Promise<QueryResult> {
    if (!this.adapter.pool) {
      throw new ConnectionError("Not connected to database");
    }

    if (transactionId) {
      const conn = this.adapter.getTransactionConnection(transactionId);
      if (!conn) {
        throw new Error(`Invalid transaction ID: ${transactionId}`);
      }
      return this.executeOnConnection(conn, sql, params);
    }

    const startTime = Date.now();

    try {
      const [results, fields] = await this.adapter.pool.execute(sql, params);
      return this.processExecutionResult(results, fields, startTime);
    } catch (error) {
      if (this.isUnsupportedPreparedStatementError(error)) {
        try {
          const [results, fields] = await this.adapter.pool.query(sql, params);
          return this.processExecutionResult(results, fields, startTime);
        } catch (fallbackError) {
          const err = fallbackError as Error;
          throw new QueryError(`Query fallback failed: ${err.message}`, { sql });
        }
      }
      const err = error as Error;
      throw new QueryError(`Query failed: ${err.message}`, { sql });
    }
  }

  async executeOnConnection(
    connection: PoolConnection,
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      const [results, fields] = await connection.execute(
        sql,
        params as (string | number | null)[],
      );
      return this.processExecutionResult(results, fields, startTime);
    } catch (error) {
      if (this.isUnsupportedPreparedStatementError(error)) {
        try {
          const [results, fields] = await connection.query(sql, params);
          return this.processExecutionResult(results, fields, startTime);
        } catch (fallbackError) {
          const err = fallbackError as Error;
          throw new QueryError(`Query fallback failed: ${err.message}`, { sql });
        }
      }
      const err = error as Error;
      throw new QueryError(`Query failed: ${err.message}`, { sql });
    }
  }

  async rawQuery(sql: string): Promise<QueryResult> {
    if (!this.adapter.pool) {
      throw new ConnectionError("Not connected");
    }

    const startTime = Date.now();

    try {
      const [results, fields] = await this.adapter.pool.query(sql);
      return this.processExecutionResult(results, fields, startTime);
    } catch (error) {
      const err = error as Error;
      throw new QueryError(`Raw query failed: ${err.message}`, { sql });
    }
  }

  private isUnsupportedPreparedStatementError(error: unknown): boolean {
    const err = error as { code?: string; message?: string };
    const code = err?.code;
    const message = typeof err?.message === "string" ? err.message : "";

    return (
      code === "ER_UNSUPPORTED_PS" ||
      message.toLowerCase().includes("not supported") ||
      message.includes("ER_UNSUPPORTED_PS")
    );
  }

  private processExecutionResult(
    results: unknown,
    fields: FieldPacket[] | undefined,
    startTime: number,
  ): QueryResult {
    const executionTimeMs = Date.now() - startTime;

    if (Array.isArray(results)) {
      if (results.length > 0 && Array.isArray(results[0])) {
        const flatRows = results[0] as Record<string, unknown>[];
        return { rows: flatRows, executionTimeMs };
      }

      if (
        results.length > 0 &&
        typeof results[0] === "object" &&
        results[0] !== null &&
        "affectedRows" in results[0] &&
        !("Table" in results[0]) &&
        !("name" in results[0])
      ) {
        const resultInfo = results[0] as {
          affectedRows?: number;
          insertId?: number | bigint;
          warningStatus?: number;
        };
        return {
          rowsAffected: resultInfo.affectedRows,
          lastInsertId: resultInfo.insertId,
          warningCount: resultInfo.warningStatus,
          executionTimeMs,
        };
      }

      return {
        rows: results as Record<string, unknown>[],
        executionTimeMs,
        columns: Array.isArray(fields)
          ? fields.map((f) => ({
              name: f.name,
              type: this.adapter.getTypeName(f.type ?? 0),
            }))
          : undefined,
      };
    }

    const resultInfo = results as {
      affectedRows?: number;
      insertId?: number | bigint;
      warningStatus?: number;
    };

    return {
      rowsAffected: resultInfo.affectedRows,
      lastInsertId: resultInfo.insertId,
      warningCount: resultInfo.warningStatus,
      executionTimeMs,
    };
  }
}
