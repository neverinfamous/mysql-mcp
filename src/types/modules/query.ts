/**
 * Query and Schema Types
 * 
 * Type definitions for query results, columns, tables, indexes,
 * and other database schema elements.
 */

/**
 * Query execution result
 */
export interface QueryResult {
    /** Rows returned (for SELECT queries) */
    rows?: Record<string, unknown>[];

    /** Number of rows affected (for INSERT/UPDATE/DELETE) */
    rowsAffected?: number;

    /** Last inserted ID (for INSERT with auto-increment) */
    lastInsertId?: number | bigint;

    /** Warning count */
    warningCount?: number;

    /** Query execution time in milliseconds */
    executionTimeMs?: number;

    /** Column metadata */
    columns?: ColumnInfo[];

    /** Field info from MySQL */
    fields?: FieldInfo[];
}

/**
 * Column metadata information
 */
export interface ColumnInfo {
    name: string;
    type: string;
    nullable?: boolean;
    primaryKey?: boolean;
    defaultValue?: unknown;
    autoIncrement?: boolean;
    unsigned?: boolean;
    zerofill?: boolean;
    characterSet?: string;
    collation?: string;
    comment?: string;
}

/**
 * MySQL field information from result set
 */
export interface FieldInfo {
    name: string;
    table: string;
    database: string;
    type: number;
    length: number;
    flags: number;
}

/**
 * Table information
 */
export interface TableInfo {
    name: string;
    schema?: string;
    type: 'table' | 'view' | 'materialized_view';
    engine?: string;
    rowCount?: number;
    dataLength?: number;
    indexLength?: number;
    createTime?: Date;
    updateTime?: Date;
    collation?: string;
    comment?: string;
    columns?: ColumnInfo[];
}

/**
 * Schema information for a database
 */
export interface SchemaInfo {
    tables: TableInfo[];
    views?: TableInfo[];
    indexes?: IndexInfo[];
    constraints?: ConstraintInfo[];
    routines?: RoutineInfo[];
    triggers?: TriggerInfo[];
}

/**
 * Index information
 */
export interface IndexInfo {
    name: string;
    tableName: string;
    columns: string[];
    unique: boolean;
    type: 'BTREE' | 'HASH' | 'FULLTEXT' | 'SPATIAL';
    cardinality?: number;
}

/**
 * Constraint information
 */
export interface ConstraintInfo {
    name: string;
    tableName: string;
    type: 'primary_key' | 'foreign_key' | 'unique' | 'check';
    columns: string[];
    referencedTable?: string;
    referencedColumns?: string[];
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

/**
 * Stored procedure/function information
 */
export interface RoutineInfo {
    name: string;
    type: 'PROCEDURE' | 'FUNCTION';
    database: string;
    definer: string;
    created: Date;
    modified: Date;
}

/**
 * Trigger information
 */
export interface TriggerInfo {
    name: string;
    table: string;
    event: 'INSERT' | 'UPDATE' | 'DELETE';
    timing: 'BEFORE' | 'AFTER';
    statement: string;
}
