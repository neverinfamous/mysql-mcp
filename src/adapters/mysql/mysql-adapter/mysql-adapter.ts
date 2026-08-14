/**
 * mysql-mcp - MySQL Adapter
 *
 * Main MySQL database adapter with connection pooling,
 * query execution, and tool registration.
 */

import type { PoolConnection } from "mysql2/promise";
import { DatabaseAdapter } from "../../database-adapter/index.js";
import { ConnectionPool } from "../../../pool/connection-pool.js";
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
} from "../../../types/index.js";
import { ConnectionError } from "../../../types/index.js";
import { logger } from "../../../utils/logger.js";
import { VERSION } from "../../../version.js";
import { metrics } from "../../../observability/metrics.js";
import { execSync } from "node:child_process";

import { SchemaManager } from "../schema-manager.js";
import { TransactionManager } from "./transactions.js";
import { QueryExecutor } from "./queries.js";
import { ToolRegistry } from "./registry.js";

/**
 * MySQL Database Adapter
 */
export class MySQLAdapter extends DatabaseAdapter {
  readonly type = "mysql" as const;
  readonly name = "MySQL Adapter";
  readonly version = VERSION;

  public pool: ConnectionPool | null = null;
  public activeTransactions = new Map<string, PoolConnection>();
  public origIsolationLevels = new Map<string, string>();

  private config: DatabaseConfig | null = null;
  private isConnecting = false;

  private schemaManager = new SchemaManager(this);
  private transactions = new TransactionManager(this);
  private executor = new QueryExecutor(this);
  private registry = new ToolRegistry(this);

  /**
   * MySQL type number to name mapping (hoisted for performance)
   */
  private static readonly TYPE_NAMES: Record<number, string> = {
    0: "DECIMAL", 1: "TINYINT", 2: "SMALLINT", 3: "INT", 4: "FLOAT",
    5: "DOUBLE", 6: "NULL", 7: "TIMESTAMP", 8: "BIGINT", 9: "MEDIUMINT",
    10: "DATE", 11: "TIME", 12: "DATETIME", 13: "YEAR", 14: "NEWDATE",
    15: "VARCHAR", 16: "BIT", 245: "JSON", 246: "NEWDECIMAL", 247: "ENUM",
    248: "SET", 249: "TINYBLOB", 250: "MEDIUMBLOB", 251: "LONGBLOB",
    252: "BLOB", 253: "VARCHAR", 254: "CHAR", 255: "GEOMETRY",
  };

  // =========================================================================
  // Connection Lifecycle
  // =========================================================================

  async connect(config: DatabaseConfig): Promise<void> {
    if (this.connected) {
      logger.warn("Already connected");
      return;
    }

    this.config = config;

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
      dateStrings: config.options?.dateStrings ?? false,
      connectTimeout: config.options?.connectTimeout ?? 30000,
    };

    const attemptHosts = [poolConfig.host];

    // Windows native WSL fallback: If host is localhost/127.0.0.1 and we are on Windows,
    // we may encounter ECONNREFUSED due to WSL2 port forwarding issues.
    if (
      process.platform === "win32" &&
      (poolConfig.host === "127.0.0.1" || poolConfig.host === "localhost")
    ) {
      try {
        const output = execSync("wsl hostname -I", { encoding: "utf8" });
        const ip = output.trim().split(/\s+/)[0];
        if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
          attemptHosts.push(ip);
          logger.debug(`Added WSL native fallback IP: ${ip}`);
        }
      } catch {
        // Ignore error if wsl is not available
      }
    }

    let lastError: unknown;

    for (const host of attemptHosts) {
      this.pool = new ConnectionPool({ ...poolConfig, host });

      try {
        await this.pool.initialize();
        const pool = this.pool;
        metrics.setPoolStatsProvider(() => {
          if (pool === null) return { total: 0, active: 0, idle: 0, waiting: 0, totalQueries: 0 };
          return pool.getStats();
        });
        this.connected = true;
        
        logger.info("MySQL adapter connected", {
          host: host,
          originalHost: poolConfig.host !== host ? poolConfig.host : undefined,
          port: poolConfig.port,
          database: poolConfig.database,
        });
        return; // Success
      } catch (error) {
        lastError = error;
        this.pool = null; // Reset for next attempt
        
        // Only try the next host if it was a connection refusal
        const errMessage = String(error);
        if (!errMessage.includes("ECONNREFUSED") && !errMessage.includes("connect ETIMEDOUT")) {
          break;
        }
      }
    }

    throw new ConnectionError(`Failed to connect: ${String(lastError)}`);
  }

  /**
   * Lazily ensure the connection is established for resilient query execution.
   */
  async ensureConnection(): Promise<void> {
    if (this.pool && this.connected) return;
    if (!this.config) throw new ConnectionError("No configuration available for reconnection");

    if (this.isConnecting) {
      // Wait for the active connection attempt to finish
      let attempts = 0;
      while (this.isConnecting && attempts < 50) {
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }
      if (this.pool && this.connected) return;
      throw new ConnectionError("Reconnection failed");
    }

    this.isConnecting = true;
    try {
      await this.connect(this.config);
    } catch (err) {
      logger.error("Lazy reconnection failed", { error: String(err) });
      throw err;
    } finally {
      this.isConnecting = false;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.pool) {
      return;
    }

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
    this.config = null;
    logger.info("MySQL adapter disconnected");
  }

  async getHealth(): Promise<HealthStatus> {
    if (!this.pool) {
      return { connected: false, error: "Not connected" };
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
    return this.executor.executeQuery(sql, params, transactionId);
  }

  async executeWriteQuery(
    sql: string,
    params?: unknown[],
    transactionId?: string,
  ): Promise<QueryResult> {
    this.validateQuery(sql, false);
    return this.executor.executeQuery(sql, params, transactionId);
  }

  async executeQuery(
    sql: string,
    params?: unknown[],
    transactionId?: string,
  ): Promise<QueryResult> {
    return this.executor.executeQuery(sql, params, transactionId);
  }

  async executeOnConnection(
    connection: PoolConnection,
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult> {
    return this.executor.executeOnConnection(connection, sql, params);
  }

  async rawQuery(sql: string): Promise<QueryResult> {
    return this.executor.rawQuery(sql);
  }

  // =========================================================================
  // Transaction Support
  // =========================================================================

  async beginTransaction(isolationLevel?: string): Promise<string> {
    return this.transactions.beginTransaction(isolationLevel);
  }

  async commitTransaction(transactionId: string): Promise<void> {
    return this.transactions.commitTransaction(transactionId);
  }

  async rollbackTransaction(transactionId: string): Promise<void> {
    return this.transactions.rollbackTransaction(transactionId);
  }

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

  async getTableIndexes(tableName: string): Promise<IndexInfo[]> {
    return this.schemaManager.getTableIndexes(tableName);
  }

  // =========================================================================
  // Capabilities
  // =========================================================================

  getCapabilities(): AdapterCapabilities {
    return this.registry.getCapabilities();
  }

  getSupportedToolGroups(): ToolGroup[] {
    return this.registry.getSupportedToolGroups();
  }

  // =========================================================================
  // Tool/Resource/Prompt Registration
  // =========================================================================

  getToolDefinitions(): ToolDefinition[] {
    return this.registry.getToolDefinitions();
  }

  getResourceDefinitions(): ResourceDefinition[] {
    return this.registry.getResourceDefinitions();
  }

  getPromptDefinitions(): PromptDefinition[] {
    return this.registry.getPromptDefinitions();
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  getPool(): ConnectionPool | null {
    return this.pool;
  }

  clearSchemaCache(): void {
    this.schemaManager.clearCache();
    this.emit("schemaChanged");
  }

  getActiveTransactionIds(): string[] {
    return Array.from(this.activeTransactions.keys());
  }

  getTypeName(typeNum: number): string {
    return MySQLAdapter.TYPE_NAMES[typeNum] ?? `UNKNOWN(${typeNum})`;
  }
}
