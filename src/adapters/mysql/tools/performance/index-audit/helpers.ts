import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import { progressFactory, type ProgressToken } from "../../../../../progress/index.js";
import { ValidationError } from "../../../../../types/modules/errors.js";
import type { ExistingIndex, IndexFinding } from "./types.js";

/** Ensure the table exists if one was specifically requested */
export async function validateTable(adapter: MySQLAdapter, table: string): Promise<void> {
  const tableInfo = await adapter.describeTable(table);
  if (!tableInfo.columns || tableInfo.columns.length === 0) {
    throw new ValidationError(`Table '${table}' does not exist`);
  }
}

/** Get all user-created indexes grouped by table */
export async function getAllUserIndexes(
  adapter: MySQLAdapter,
  table?: string,
): Promise<Map<string, ExistingIndex[]>> {
  const byTable = new Map<string, ExistingIndex[]>();

  if (table) {
    const indexes = await adapter.getTableIndexes(table);
    byTable.set(
      table,
      indexes.map((i) => ({
        name: i.name,
        table,
        columns: i.columns,
        unique: i.unique,
        type: i.type,
      })),
    );
    return byTable;
  }

  // Get all indexes across the database
  const query = `
    SELECT table_name, index_name, column_name, seq_in_index, non_unique, index_type
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    ORDER BY table_name, index_name, seq_in_index
  `;

  const result = await adapter.executeReadQuery(query);
  const rows = (result.rows ?? []);

  const currentIndexes = new Map<string, ExistingIndex>();

  for (const row of rows) {
    const tableName = typeof row["TABLE_NAME"] === "string" ? row["TABLE_NAME"] : "";
    const indexName = typeof row["INDEX_NAME"] === "string" ? row["INDEX_NAME"] : "";
    const colName = typeof row["COLUMN_NAME"] === "string" ? row["COLUMN_NAME"] : "";
    const nonUnique = Number(row["NON_UNIQUE"]) === 1;
    const indexType = typeof row["INDEX_TYPE"] === "string" ? row["INDEX_TYPE"] : "";

    const key = `${tableName}.${indexName}`;
    const existing = currentIndexes.get(key);

    if (existing) {
      existing.columns.push(colName);
    } else {
      currentIndexes.set(key, {
        name: indexName,
        table: tableName,
        columns: [colName],
        unique: !nonUnique,
        type: indexType,
      });
    }
  }

  for (const index of currentIndexes.values()) {
    const tableIndexes = byTable.get(index.table) ?? [];
    tableIndexes.push(index);
    byTable.set(index.table, tableIndexes);
  }

  return byTable;
}

/**
 * Check 1: Redundant indexes (prefix duplicates)
 * An index on (A) is redundant if an index on (A, B) exists on the same table.
 */
export function detectRedundantIndexes(
  indexesByTable: Map<string, ExistingIndex[]>,
): IndexFinding[] {
  const findings: IndexFinding[] = [];

  for (const tableIndexes of indexesByTable.values()) {
    for (let i = 0; i < tableIndexes.length; i++) {
      const shorter = tableIndexes[i];
      if (!shorter || shorter.name === "PRIMARY") continue;

      for (let j = 0; j < tableIndexes.length; j++) {
        if (i === j) continue;
        const longer = tableIndexes[j];
        if (!longer) continue;

        // Check if shorter is a prefix of longer
        if (
          shorter.columns.length < longer.columns.length &&
          shorter.columns.every((col, k) => col === longer.columns[k])
        ) {
          findings.push({
            type: "redundant",
            severity: "warning",
            table: shorter.table,
            index: shorter.name,
            redundantOf: longer.name,
            rationale: `Columns (${shorter.columns.join(", ")}) are a strict prefix of index \`${longer.name}\` (${longer.columns.join(", ")})`,
            suggestion: `Consider dropping \`${shorter.name}\` as it is redundant. The database can use \`${longer.name}\` for these queries instead.`,
            createStatement: `DROP INDEX \`${shorter.name}\` ON \`${shorter.table}\`;`,
          });
        }
      }
    }
  }

  return findings;
}

/**
 * Check 2: Missing FK indexes
 */
export async function detectMissingFkIndexes(
  adapter: MySQLAdapter,
  indexesByTable: Map<string, ExistingIndex[]>,
  targetTable?: string,
): Promise<IndexFinding[]> {
  const findings: IndexFinding[] = [];

  let query = `
    SELECT table_name, column_name, referenced_table_name, referenced_column_name
    FROM information_schema.key_column_usage
    WHERE referenced_table_name IS NOT NULL
      AND table_schema = DATABASE()
  `;

  if (targetTable) {
    query += ` AND table_name = '${targetTable.replace(/'/g, "''")}'`;
  }

  try {
    const result = await adapter.executeReadQuery(query);
    const fks = (result.rows ?? []);

    for (const row of fks) {
      const table = typeof row["TABLE_NAME"] === "string" ? row["TABLE_NAME"] : "";
      const column = typeof row["COLUMN_NAME"] === "string" ? row["COLUMN_NAME"] : "";

      const tableIndexes = indexesByTable.get(table) ?? [];
      const isIndexed = tableIndexes.some((idx) => idx.columns[0] === column);

      if (!isIndexed) {
        const idxName = `idx_${table}_${column}`;
        findings.push({
          type: "missing_fk_index",
          severity: "warning",
          table,
          column,
          rationale: `Column \`${column}\` is a foreign key but lacks an index. This slows down JOINs and cascading deletes/updates.`,
          suggestion: `Create an index on \`${column}\` to improve referential integrity checks and JOIN performance.`,
          createStatement: `CREATE INDEX \`${idxName}\` ON \`${table}\`(\`${column}\`);`,
        });
      }
    }
  } catch {
    // Ignore errors reading key_column_usage
  }

  return findings;
}

/**
 * Check 3: Large tables without secondary indexes
 */
export async function detectUnindexedTables(
  adapter: MySQLAdapter,
  indexesByTable: Map<string, ExistingIndex[]>,
  targetTable?: string,
): Promise<IndexFinding[]> {
  const findings: IndexFinding[] = [];

  let query = `
    SELECT table_name, table_rows
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_type = 'BASE TABLE'
      AND table_rows >= 1000
  `;

  if (targetTable) {
    query += ` AND table_name = '${targetTable.replace(/'/g, "''")}'`;
  }

  try {
    const result = await adapter.executeReadQuery(query);
    const tables = (result.rows ?? []);

    for (const row of tables) {
      const table = typeof row["TABLE_NAME"] === "string" ? row["TABLE_NAME"] : "";
      const rowCount = Number(row["TABLE_ROWS"]);

      const tableIndexes = indexesByTable.get(table) ?? [];
      // Table is unindexed if it has 0 indexes OR only a PRIMARY key
      const hasSecondary = tableIndexes.some((idx) => idx.name !== "PRIMARY");

      if (!hasSecondary) {
        findings.push({
          type: "unindexed_large_table",
          severity: "info",
          table,
          rationale: `Table \`${table}\` has ${rowCount} rows but no secondary indexes.`,
          suggestion: "Consider analyzing query patterns to add secondary indexes, otherwise queries will rely on full table scans.",
        });
      }
    }
  } catch {
    // Ignore errors reading tables
  }

  return findings;
}



/**
 * Check 4: EXPLAIN-based composite/covering index analysis
 */
export async function analyzeQueriesWithExplain(
  adapter: MySQLAdapter,
  queries: string[],
  progressToken?: ProgressToken,
): Promise<IndexFinding[]> {
  const findings: IndexFinding[] = [];
  const reporter = progressFactory.create(progressToken);

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    if (query) {
      reporter?.progress(i, queries.length, `Analyzing query ${i + 1}/${queries.length}`);
    }
    // Safety check: Only analyze SELECT queries
    if (!query || !/^\s*SELECT/i.test(query)) {
      continue;
    }

    try {
      const explainResult = await adapter.executeReadQuery(
        `EXPLAIN FORMAT=JSON ${query}`,
      );
      const rows = explainResult.rows ?? [];
      if (rows.length === 0) continue;

      const explainRaw = rows[0]?.["EXPLAIN"];
      if (typeof explainRaw !== "string") continue;
      const explainStr = explainRaw;

      const parsedExplain: unknown = JSON.parse(explainStr);

      const isRecord = (val: unknown): val is Record<string, unknown> => typeof val === "object" && val !== null && !Array.isArray(val);

      const analyzeNodeInternal = (node: unknown): void => {
        if (!isRecord(node)) return;

        const obj = node;

        // Check for full table scan
        if (obj["access_type"] === "ALL" && typeof obj["table_name"] === "string") {
          // Extract filter conditions if available
          const condition =
            typeof obj["attached_condition"] === "string"
              ? obj["attached_condition"]
              : typeof obj["attached_pushed_condition"] === "string"
                ? obj["attached_pushed_condition"]
                : undefined;
          
          let columns: string[] = [];

          if (condition) {
            // Very simplistic regex to pull column names out of conditions like "`table`.`col` = 5"
            const matches = condition.matchAll(/`([^`]+)`/g);
            const cols = new Set<string>();
            for (const match of matches) {
              const colName = match[1];
              if (colName && colName !== obj["table_name"]) {
                cols.add(colName);
              }
            }
            columns = Array.from(cols);
          }

          if (columns.length > 0) {
            const idxName = `idx_${obj["table_name"]}_${columns.join("_")}`;
            findings.push({
              type: "composite",
              severity: "warning",
              table: obj["table_name"],
              columns,
              rationale: `Query caused a full table scan on \`${obj["table_name"]}\`. Filters found on columns: ${columns.join(", ")}.`,
              suggestion: "Consider creating a composite index on the filtered columns to avoid full table scans.",
              createStatement: `CREATE INDEX \`${idxName}\` ON \`${obj["table_name"]}\`(${columns.map((c: string) => `\`${c}\``).join(", ")});`,
            });
          } else {
            findings.push({
              type: "composite",
              severity: "info",
              table: obj["table_name"],
              rationale: `Query caused a full table scan on \`${obj["table_name"]}\` but no explicit filter columns were extracted.`,
              suggestion: "Review the query's WHERE/JOIN clauses on this table and consider indexing those columns.",
            });
          }
        }

        // Recursive tree walk
        if (Array.isArray(obj["nested_loop"])) {
          for (const nl of obj["nested_loop"]) {
            if (isRecord(nl) && "table" in nl) {
              analyzeNodeInternal(nl["table"]);
            }
          }
        }
        
        if (isRecord(obj["query_block"])) {
          const qb = obj["query_block"];
          if ("table" in qb && qb["table"] != null) {
            analyzeNodeInternal(qb["table"]);
          }
          if (Array.isArray(qb["nested_loop"])) {
            for (const nl of qb["nested_loop"]) {
              if (isRecord(nl) && "table" in nl) {
                analyzeNodeInternal(nl["table"]);
              }
            }
          }
        }
      };

      analyzeNodeInternal(parsedExplain);
    } catch {
      // Ignore EXPLAIN failures (could be bad query syntax)
      continue;
    }
  }

  return findings;
}

/**
 * Check 5: Legacy heuristic matching for column names
 * Used when no specific queries are provided.
 */
export async function heuristicColumnRecommendations(
  adapter: MySQLAdapter,
  indexesByTable: Map<string, ExistingIndex[]>,
  targetTable?: string,
): Promise<IndexFinding[]> {
  const findings: IndexFinding[] = [];

  const tablesToAnalyze = targetTable
    ? [targetTable]
    : Array.from(indexesByTable.keys());

  for (const table of tablesToAnalyze) {
    try {
      const tableInfo = await adapter.describeTable(table);
      if (!tableInfo.columns) continue;

      const tableIndexes = indexesByTable.get(table) ?? [];
      const indexedColumns = new Set(tableIndexes.flatMap((i) => i.columns));

      for (const col of tableInfo.columns) {
        if (indexedColumns.has(col.name)) continue;

        const idxName = `idx_${table}_${col.name}`;
        let rationale = "";

        if (col.name.endsWith("_id") || col.name === "id") {
          rationale = "Foreign key or ID column often benefits from indexing";
        } else if (
          ["created_at", "updated_at", "date", "timestamp"].some((s) =>
            col.name.includes(s),
          )
        ) {
          rationale = "Timestamp columns often used in range queries";
        } else if (
          col.name === "status" ||
          col.name === "type" ||
          col.name === "category"
        ) {
          rationale = "Status/type columns often used in filtering";
        }

        if (rationale) {
          findings.push({
            type: "heuristic",
            severity: "info",
            table,
            column: col.name,
            columns: [col.name],
            rationale,
            suggestion: `Consider adding an index on \`${col.name}\`.`,
            createStatement: `CREATE INDEX \`${idxName}\` ON \`${table}\`(\`${col.name}\`);`,
          });
        }
      }
    } catch {
      // Ignore schema describe errors
    }
  }

  return findings;
}
