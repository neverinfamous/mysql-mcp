import type {
  QueryResult,
  TableInfo,
  SchemaInfo,
  IndexInfo,
  ColumnInfo,
} from "../../types/index.js";
import { ValidationError } from "../../types/index.js";

export interface QueryExecutor {
  executeQuery(sql: string, params?: unknown[]): Promise<QueryResult>;
}

/**
 * Default cache TTL in milliseconds (configurable via METADATA_CACHE_TTL_MS env var)
 */
const DEFAULT_CACHE_TTL_MS = parseInt(
  process.env["METADATA_CACHE_TTL_MS"] ?? "30000",
  10,
);

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class SchemaManager {
  private metadataCache = new Map<string, CacheEntry<unknown>>();
  private cacheTtlMs = DEFAULT_CACHE_TTL_MS;

  constructor(private executor: QueryExecutor) {}

  /**
   * Get cached value if not expired
   */
  private getCached(key: string): unknown {
    const entry = this.metadataCache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.cacheTtlMs) {
      this.metadataCache.delete(key);
      return undefined;
    }
    return entry.data;
  }

  /**
   * Set cache value
   */
  private setCache(key: string, data: unknown): void {
    this.metadataCache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Clear all cached metadata (useful after schema changes)
   */
  clearCache(): void {
    this.metadataCache.clear();
  }

  async getSchema(): Promise<SchemaInfo> {
    const tables = await this.listTables();
    const views = tables.filter((t) => t.type === "view");
    const realTables = tables.filter((t) => t.type === "table");

    // Performance optimization: fetch all indexes in a single query instead of N+1
    const indexes = await this.getAllIndexes();

    return {
      tables: realTables,
      views,
      indexes,
    };
  }

  /**
   * Get all indexes across all tables in a single query
   * Performance optimization: eliminates N+1 query pattern
   */
  private async getAllIndexes(): Promise<IndexInfo[]> {
    // Check cache first
    const cached = this.getCached("all_indexes") as IndexInfo[] | undefined;
    if (cached) return cached;

    const result = await this.executor.executeQuery(`
            SELECT 
                s.TABLE_NAME as tableName,
                s.INDEX_NAME as name,
                s.NON_UNIQUE as nonUnique,
                s.COLUMN_NAME as columnName,
                s.INDEX_TYPE as type,
                s.CARDINALITY as cardinality
            FROM information_schema.STATISTICS s
            INNER JOIN information_schema.TABLES t 
                ON s.TABLE_SCHEMA = t.TABLE_SCHEMA AND s.TABLE_NAME = t.TABLE_NAME
            WHERE s.TABLE_SCHEMA = DATABASE()
              AND t.TABLE_TYPE = 'BASE TABLE'
            ORDER BY s.TABLE_NAME, s.INDEX_NAME, s.SEQ_IN_INDEX
        `);

    // Group columns by table+index name
    const indexMap = new Map<string, IndexInfo>();

    for (const row of result.rows ?? []) {
      const tableName = row["tableName"] as string;
      const indexName = row["name"] as string;
      const mapKey = `${tableName}.${indexName}`;
      const existing = indexMap.get(mapKey);

      if (existing) {
        existing.columns.push(row["columnName"] as string);
      } else {
        indexMap.set(mapKey, {
          name: indexName,
          tableName,
          columns: [row["columnName"] as string],
          unique: row["nonUnique"] === 0,
          type: row["type"] as "BTREE" | "HASH" | "FULLTEXT" | "SPATIAL",
          cardinality: row["cardinality"] as number | undefined,
        });
      }
    }

    const indexes = Array.from(indexMap.values());
    this.setCache("all_indexes", indexes);
    return indexes;
  }

  async listTables(databaseName?: string): Promise<TableInfo[]> {
    const schemaClause = databaseName
      ? "TABLE_SCHEMA = ?"
      : "TABLE_SCHEMA = DATABASE()";
    const params = databaseName ? [databaseName] : [];

    const result = await this.executor.executeQuery(
      `
            SELECT 
                TABLE_NAME as name,
                TABLE_TYPE as type,
                ENGINE as engine,
                TABLE_ROWS as rowCount,
                DATA_LENGTH as dataLength,
                INDEX_LENGTH as indexLength,
                CREATE_TIME as createTime,
                UPDATE_TIME as updateTime,
                TABLE_COLLATION as collation,
                TABLE_COMMENT as comment
            FROM information_schema.TABLES
            WHERE ${schemaClause}
            ORDER BY TABLE_NAME
        `,
      params,
    );

    return (result.rows ?? []).map((row) => ({
      name: row["name"] as string,
      type:
        (row["type"] as string) === "VIEW"
          ? ("view" as const)
          : ("table" as const),
      engine: row["engine"] as string | undefined,
      rowCount: row["rowCount"] as number | undefined,
      dataLength: row["dataLength"] as number | undefined,
      indexLength: row["indexLength"] as number | undefined,
      createTime: row["createTime"] as Date | undefined,
      updateTime: row["updateTime"] as Date | undefined,
      collation: row["collation"] as string | undefined,
      comment: row["comment"] as string | undefined,
    }));
  }

  async describeTable(tableName: string): Promise<TableInfo> {
    // Validate table name (allow schema.table format)
    if (!/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)?$/.test(tableName)) {
      throw new ValidationError("Invalid table name");
    }

    const [part1, part2] = tableName.split(".");
    let schemaName: string | undefined;
    let shortTableName: string;

    if (part2) {
      schemaName = part1;
      shortTableName = part2;
    } else {
      shortTableName = tableName;
    }

    const schemaClause = schemaName
      ? "TABLE_SCHEMA = ?"
      : "TABLE_SCHEMA = DATABASE()";
    const params = schemaName ? [schemaName, shortTableName] : [shortTableName];

    // Get column information
    const columnsResult = await this.executor.executeQuery(
      `
            SELECT 
                COLUMN_NAME as name,
                DATA_TYPE as type,
                IS_NULLABLE as nullable,
                COLUMN_KEY as columnKey,
                COLUMN_DEFAULT as defaultValue,
                EXTRA as extra,
                CHARACTER_SET_NAME as characterSet,
                COLLATION_NAME as collation,
                COLUMN_COMMENT as comment
            FROM information_schema.COLUMNS
            WHERE ${schemaClause}
              AND TABLE_NAME = ?
            ORDER BY ORDINAL_POSITION
        `,
      params,
    );

    const columns: ColumnInfo[] = (columnsResult.rows ?? []).map((row) => ({
      name: row["name"] as string,
      type: row["type"] as string,
      nullable: row["nullable"] === "YES",
      primaryKey: row["columnKey"] === "PRI",
      defaultValue: row["defaultValue"],
      autoIncrement: (row["extra"] as string)?.includes("auto_increment"),
      characterSet: row["characterSet"] as string | undefined,
      collation: row["collation"] as string | undefined,
      comment: row["comment"] as string | undefined,
    }));

    // Get table info
    const tableResult = await this.executor.executeQuery(
      `
            SELECT 
                TABLE_TYPE as type,
                ENGINE as engine,
                TABLE_ROWS as rowCount,
                TABLE_COLLATION as collation,
                TABLE_COMMENT as comment
            FROM information_schema.TABLES
            WHERE ${schemaClause}
              AND TABLE_NAME = ?
        `,
      params,
    );

    const tableRow = tableResult.rows?.[0];

    return {
      name: tableName,
      type: tableRow?.["type"] === "VIEW" ? "view" : "table",
      engine: tableRow?.["engine"] as string | undefined,
      rowCount: tableRow?.["rowCount"] as number | undefined,
      collation: tableRow?.["collation"] as string | undefined,
      comment: tableRow?.["comment"] as string | undefined,
      columns,
    };
  }

  async listSchemas(): Promise<string[]> {
    const result = await this.executor.executeQuery(`SHOW DATABASES`);
    return (result.rows ?? []).map((row) => {
      const values = Object.values(row);
      return values[0] as string;
    });
  }

  /**
   * Get indexes for a table
   */
  async getTableIndexes(tableName: string): Promise<IndexInfo[]> {
    // Validate table name (allow schema.table format)
    if (!/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)?$/.test(tableName)) {
      throw new ValidationError("Invalid table name");
    }

    const [part1, part2] = tableName.split(".");
    let schemaName: string | undefined;
    let shortTableName: string;

    if (part2) {
      schemaName = part1;
      shortTableName = part2;
    } else {
      shortTableName = tableName;
    }

    const schemaClause = schemaName
      ? "TABLE_SCHEMA = ?"
      : "TABLE_SCHEMA = DATABASE()";
    const params = schemaName ? [schemaName, shortTableName] : [shortTableName];

    const result = await this.executor.executeQuery(
      `
            SELECT 
                INDEX_NAME as name,
                NON_UNIQUE as nonUnique,
                COLUMN_NAME as columnName,
                INDEX_TYPE as type,
                CARDINALITY as cardinality
            FROM information_schema.STATISTICS
            WHERE ${schemaClause}
              AND TABLE_NAME = ?
            ORDER BY INDEX_NAME, SEQ_IN_INDEX
        `,
      params,
    );

    // Group columns by index name
    const indexMap = new Map<string, IndexInfo>();

    for (const row of result.rows ?? []) {
      const name = row["name"] as string;
      const existing = indexMap.get(name);

      if (existing) {
        existing.columns.push(row["columnName"] as string);
      } else {
        indexMap.set(name, {
          name,
          tableName,
          columns: [row["columnName"] as string],
          unique: row["nonUnique"] === 0,
          type: row["type"] as "BTREE" | "HASH" | "FULLTEXT" | "SPATIAL",
          cardinality: row["cardinality"] as number | undefined,
        });
      }
    }

    return Array.from(indexMap.values());
  }
}
