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
