/**
 * mysql-mcp - MySQL Adapter
 *
 * Main MySQL database adapter with connection pooling,
 * query execution, and tool registration.
 */

import type { PoolConnection, FieldPacket } from "mysql2/promise";
import { DatabaseAdapter } from "../DatabaseAdapter.js";
import { ConnectionPool } from "../../pool/ConnectionPool.js";
import type {
  DatabaseConfig,
  QueryResult,
  SchemaInfo,
  TableInfo,
  IndexInfo,
  HealthStatus,
  AdapterCapabilities,
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
  ToolGroup,
} from "../../types/index.js";
import {
  ConnectionError,
  QueryError,
  TransactionError,
} from "../../types/index.js";
import { logger } from "../../utils/logger.js";

// Import tool modules
import { getCoreTools } from "./tools/core.js";
import { getTransactionTools } from "./tools/transactions.js";
import {
  getJsonTools,
  getJsonHelperTools,
  getJsonEnhancedTools,
} from "./tools/json/index.js";
import { getTextTools, getFulltextTools } from "./tools/text/index.js";
import {
  getPerformanceTools,
  getOptimizationTools,
} from "./tools/performance/index.js";
import {
  getAdminTools,
  getMonitoringTools,
  getBackupTools,
} from "./tools/admin/index.js";
import { getReplicationTools } from "./tools/replication.js";
import { getPartitioningTools } from "./tools/partitioning.js";
import { getRouterTools } from "./tools/router.js";
import { getProxySQLTools } from "./tools/proxysql.js";
import { getShellTools } from "./tools/shell/index.js";
// New tool modules (9 new groups)
import { getSchemaTools } from "./tools/schema/index.js";
import { getEventTools } from "./tools/events.js";
import { getSysSchemaTools } from "./tools/sysschema/index.js";
import { getStatsTools } from "./tools/stats/index.js";
import { getSpatialTools } from "./tools/spatial/index.js";
import { getSecurityTools } from "./tools/security/index.js";
import { getClusterTools } from "./tools/cluster/index.js";
import { getRoleTools } from "./tools/roles.js";
import { getDocStoreTools } from "./tools/docstore.js";
import { getCodeModeTools } from "./tools/codemode/index.js";
import { getMySQLResources } from "./resources/index.js";
import { getMySQLPrompts } from "./prompts/index.js";
import { SchemaManager } from "./SchemaManager.js";

/**
 * MySQL Database Adapter
 */
export class MySQLAdapter extends DatabaseAdapter {
  readonly type = "mysql" as const;
  readonly name = "MySQL Adapter";
  readonly version = "0.1.0";

  private pool: ConnectionPool | null = null;
  private activeTransactions = new Map<string, PoolConnection>();
  private cachedToolDefinitions: ToolDefinition[] | null = null;
  private cachedResourceDefinitions: ResourceDefinition[] | null = null;
  private cachedPromptDefinitions: PromptDefinition[] | null = null;
  private schemaManager = new SchemaManager(this);

  /**
   * MySQL type number to name mapping (hoisted for performance)
   */
  private static readonly TYPE_NAMES: Record<number, string> = {
    0: "DECIMAL",
    1: "TINYINT",
    2: "SMALLINT",
    3: "INT",
    4: "FLOAT",
    5: "DOUBLE",
    6: "NULL",
    7: "TIMESTAMP",
    8: "BIGINT",
    9: "MEDIUMINT",
    10: "DATE",
    11: "TIME",
    12: "DATETIME",
    13: "YEAR",
    14: "NEWDATE",
    15: "VARCHAR",
    16: "BIT",
    245: "JSON",
    246: "NEWDECIMAL",
    247: "ENUM",
    248: "SET",
    249: "TINYBLOB",
    250: "MEDIUMBLOB",
    251: "LONGBLOB",
    252: "BLOB",
    253: "VARCHAR",
    254: "CHAR",
    255: "GEOMETRY",
  };

  // =========================================================================
  // Connection Lifecycle
  // =========================================================================

  async connect(config: DatabaseConfig): Promise<void> {
    if (this.connected) {
      logger.warn("Already connected");
      return;
    }

    // Build pool configuration
    const poolConfig = {
      host: config.host ?? "localhost",
      port: config.port ?? 3306,
      user: config.username ?? "root",
      password: config.password ?? "",
      database: config.database ?? "",
      pool: config.pool,
      ssl: config.options?.ssl as boolean | undefined,
      charset: config.options?.charset ?? "utf8mb4",
      timezone: config.options?.timezone ?? "local",
      connectTimeout: config.options?.connectTimeout ?? 10000,
    };

    this.pool = new ConnectionPool(poolConfig);

    try {
      await this.pool.initialize();
      this.connected = true;
      logger.info("MySQL adapter connected", {
        host: poolConfig.host,
        port: poolConfig.port,
        database: poolConfig.database,
      });
    } catch (error) {
      this.pool = null;
      throw new ConnectionError(`Failed to connect: ${String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.pool) {
      return;
    }

    // Close any active transactions
    for (const [id, conn] of this.activeTransactions) {
      try {
        await conn.rollback();
        logger.warn(`Rolled back orphaned transaction: ${id}`);
      } catch (error) {
        logger.warn(
          `Failed to rollback orphaned transaction ${id}: ${String(error)}`,
        );
      } finally {
        try {
          conn.release();
        } catch {
          // Ignore release errors
        }
      }
    }
    this.activeTransactions.clear();

    await this.pool.shutdown();
    this.pool = null;
    this.connected = false;
    logger.info("MySQL adapter disconnected");
  }

  async getHealth(): Promise<HealthStatus> {
    if (!this.pool) {
      return {
        connected: false,
        error: "Not connected",
      };
    }

    return this.pool.checkHealth();
  }

  // =========================================================================
  // Query Execution
  // =========================================================================

  async executeReadQuery(
    sql: string,
    params?: unknown[],
    transactionId?: string,
  ): Promise<QueryResult> {
    this.validateQuery(sql, true);
    return this.executeQuery(sql, params, transactionId);
  }

  async executeWriteQuery(
    sql: string,
    params?: unknown[],
    transactionId?: string,
  ): Promise<QueryResult> {
    this.validateQuery(sql, false);
    return this.executeQuery(sql, params, transactionId);
  }

  async executeQuery(
    sql: string,
    params?: unknown[],
    transactionId?: string,
  ): Promise<QueryResult> {
    if (!this.pool) {
      throw new ConnectionError("Not connected to database");
    }

    if (transactionId) {
      const conn = this.getTransactionConnection(transactionId);
      if (!conn) {
        throw new TransactionError(`Invalid transaction ID: ${transactionId}`);
      }
      return this.executeOnConnection(conn, sql, params);
    }

    const startTime = Date.now();

    try {
      const [results, fields] = await this.pool.execute(sql, params);
      return this.processExecutionResult(results, fields, startTime);
    } catch (error) {
      if (this.isUnsupportedPreparedStatementError(error)) {
        // Fallback to text protocol for statements not supported in prepared mode
        try {
          const [results, fields] = await this.pool.query(sql, params);
          return this.processExecutionResult(results, fields, startTime);
        } catch (fallbackError) {
          const err = fallbackError as Error;
          throw new QueryError(`Query fallback failed: ${err.message}`, {
            sql,
          });
        }
      }
      const err = error as Error;
      throw new QueryError(`Query failed: ${err.message}`, { sql });
    }
  }

  /**
   * Execute a query on a specific connection (for transactions)
   */
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
        // Fallback to text protocol
        try {
          const [results, fields] = await connection.query(
            sql,
            params as (string | number | null)[],
          );
          return this.processExecutionResult(results, fields, startTime);
        } catch (fallbackError) {
          const err = fallbackError as Error;
          throw new QueryError(`Query fallback failed: ${err.message}`, {
            sql,
          });
        }
      }
      const err = error as Error;
      throw new QueryError(`Query failed: ${err.message}`, { sql });
    }
  }

  /**
   * Execute raw SQL using query() instead of execute()
   * Use this for commands not supported in prepared statement protocol:
   * - CHECK TABLE, SAVEPOINT, RELEASE SAVEPOINT, ROLLBACK TO SAVEPOINT
   * - SHOW commands with LIKE patterns
   */
  async rawQuery(sql: string): Promise<QueryResult> {
    if (!this.pool) {
      throw new ConnectionError("Not connected");
    }

    const startTime = Date.now();

    try {
      // Use query() which doesn't use prepared statements
      // Unlike execute(), query() is required for certain MySQL commands
      const [results, fields] = await this.pool.query(sql);
      return this.processExecutionResult(results, fields, startTime);
    } catch (error) {
      const err = error as Error;
      throw new QueryError(`Raw query failed: ${err.message}`, { sql });
    }
  }

  // =========================================================================
  // Transaction Support
  // =========================================================================

  /**
   * Begin a transaction
   */
  async beginTransaction(isolationLevel?: string): Promise<string> {
    if (!this.pool) {
      throw new ConnectionError("Not connected");
    }

    // Validate isolation level against allowlist before interpolation
    const VALID_ISOLATION_LEVELS = [
      "READ UNCOMMITTED",
      "READ COMMITTED",
      "REPEATABLE READ",
      "SERIALIZABLE",
    ];
    if (
      isolationLevel &&
      !VALID_ISOLATION_LEVELS.includes(isolationLevel.toUpperCase())
    ) {
      throw new TransactionError(
        `Invalid isolation level: ${isolationLevel}. Must be one of: ${VALID_ISOLATION_LEVELS.join(", ")}`,
      );
    }

    const connection = await this.pool.getConnection();
    const transactionId = crypto.randomUUID();

    try {
      if (isolationLevel) {
        await connection.execute(
          `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`,
        );
      }
      await connection.beginTransaction();
      this.activeTransactions.set(transactionId, connection);
      return transactionId;
    } catch (error) {
      connection.release();
      throw new TransactionError(
        `Failed to begin transaction: ${String(error)}`,
      );
    }
  }

  /**
   * Commit a transaction
   */
  async commitTransaction(transactionId: string): Promise<void> {
    const connection = this.activeTransactions.get(transactionId);
    if (!connection) {
      throw new TransactionError(`Transaction not found: ${transactionId}`);
    }

    try {
      await connection.commit();
    } finally {
      connection.release();
      this.activeTransactions.delete(transactionId);
    }
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(transactionId: string): Promise<void> {
    const connection = this.activeTransactions.get(transactionId);
    if (!connection) {
      throw new TransactionError(`Transaction not found: ${transactionId}`);
    }

    try {
      await connection.rollback();
    } finally {
      connection.release();
      this.activeTransactions.delete(transactionId);
    }
  }

  /**
   * Get connection for a transaction
   */
  getTransactionConnection(transactionId: string): PoolConnection | undefined {
    return this.activeTransactions.get(transactionId);
  }

  // =========================================================================
  // Schema Operations
  // =========================================================================

  async getSchema(): Promise<SchemaInfo> {
    return this.schemaManager.getSchema();
  }

  async listTables(databaseName?: string): Promise<TableInfo[]> {
    return this.schemaManager.listTables(databaseName);
  }

  async describeTable(tableName: string): Promise<TableInfo> {
    return this.schemaManager.describeTable(tableName);
  }

  async listSchemas(): Promise<string[]> {
    return this.schemaManager.listSchemas();
  }

  /**
   * Get indexes for a table
   */
  async getTableIndexes(tableName: string): Promise<IndexInfo[]> {
    return this.schemaManager.getTableIndexes(tableName);
  }

  // =========================================================================
  // Capabilities
  // =========================================================================

  getCapabilities(): AdapterCapabilities {
    return {
      json: true,
      fullTextSearch: true,
      vector: false, // MySQL doesn't have native vector support
      geospatial: true,
      transactions: true,
      preparedStatements: true,
      connectionPooling: true,
      partitioning: true,
      replication: true,
    };
  }

  getSupportedToolGroups(): ToolGroup[] {
    return [
      "core",
      "json",
      "text",
      "fulltext",
      "performance",
      "optimization",
      "admin",
      "monitoring",
      "backup",
      "replication",
      "partitioning",
      "transactions",
      "router",
      "proxysql",
      "shell",
      // New groups (9)
      "schema",
      "events",
      "sysschema",
      "stats",
      "spatial",
      "security",
      "cluster",
      "roles",
      "docstore",
      "codemode",
    ];
  }

  // =========================================================================
  // Tool/Resource/Prompt Registration
  // =========================================================================

  getToolDefinitions(): ToolDefinition[] {
    if (this.cachedToolDefinitions) {
      return this.cachedToolDefinitions;
    }

    this.cachedToolDefinitions = [
      ...getCoreTools(this),
      ...getTransactionTools(this),
      ...getJsonTools(this),
      ...getJsonHelperTools(this),
      ...getJsonEnhancedTools(this),
      ...getTextTools(this),
      ...getFulltextTools(this),
      ...getPerformanceTools(this),
      ...getOptimizationTools(this),
      ...getAdminTools(this),
      ...getMonitoringTools(this),
      ...getBackupTools(this),
      ...getReplicationTools(this),
      ...getPartitioningTools(this),
      ...getRouterTools(this),
      ...getProxySQLTools(this),
      ...getShellTools(this),
      // New tool groups (9 groups, 80 tools)
      ...getSchemaTools(this),
      ...getEventTools(this),
      ...getSysSchemaTools(this),
      ...getStatsTools(this),
      ...getSpatialTools(this),
      ...getSecurityTools(this),
      ...getClusterTools(this),
      ...getRoleTools(this),
      ...getDocStoreTools(this),
      ...getCodeModeTools(this),
    ];

    return this.cachedToolDefinitions;
  }

  getResourceDefinitions(): ResourceDefinition[] {
    if (this.cachedResourceDefinitions) return this.cachedResourceDefinitions;
    this.cachedResourceDefinitions = getMySQLResources(this);
    return this.cachedResourceDefinitions;
  }

  getPromptDefinitions(): PromptDefinition[] {
    if (this.cachedPromptDefinitions) return this.cachedPromptDefinitions;
    this.cachedPromptDefinitions = getMySQLPrompts(this);
    return this.cachedPromptDefinitions;
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  /**
   * Get the connection pool (for monitoring tools)
   */
  getPool(): ConnectionPool | null {
    return this.pool;
  }

  /**
   * Get IDs of all active transactions (for Code Mode cleanup)
   */
  getActiveTransactionIds(): string[] {
    return Array.from(this.activeTransactions.keys());
  }

  /**
   * Check if error is due to unsupported prepared statement
   */
  private isUnsupportedPreparedStatementError(error: unknown): boolean {
    const err = error as { code?: string; message?: string };
    const code = err?.code;
    const message = typeof err?.message === "string" ? err.message : "";

    // Message is e.g.: "Execute failed: This command is not supported..."
    // No debug throw needed now

    return (
      code === "ER_UNSUPPORTED_PS" ||
      message.toLowerCase().includes("not supported") ||
      message.includes("ER_UNSUPPORTED_PS")
    );
  }

  /**
   * Process execution results into QueryResult
   */
  /**
   * Process execution results into QueryResult
   */
  private processExecutionResult(
    results: unknown,
    fields: FieldPacket[] | undefined,
    startTime: number,
  ): QueryResult {
    const executionTimeMs = Date.now() - startTime;

    if (Array.isArray(results)) {
      return {
        rows: results as Record<string, unknown>[],
        executionTimeMs,
        columns: Array.isArray(fields)
          ? fields.map((f) => ({
              name: f.name,
              type: this.getTypeName(f.type ?? 0),
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

  /**
   * Convert MySQL type number to name
   */
  private getTypeName(typeNum: number): string {
    return MySQLAdapter.TYPE_NAMES[typeNum] ?? `UNKNOWN(${typeNum})`;
  }
}
