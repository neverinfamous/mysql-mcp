/**
 * MySQL Admin Tools - Backup and Restore
 *
 * Tools for data export, import, and backup operations.
 * 4 tools: export, import, dump, restore.
 */

import { z } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  ExportTableSchema,
  ExportTableSchemaBase,
  ImportDataSchema,
  ImportDataSchemaBase,
  ExportTableOutputSchema,
  ImportDataOutputSchema,
  CreateDumpOutputSchema,
  RestoreDumpOutputSchema,
} from "../../schemas/index.js";
import {
  validateIdentifier,
  validateWhereClause,
} from "../../../../utils/validators.js";
import { READ_ONLY, WRITE, IDEMPOTENT } from "../../../../utils/annotations.js";
import { progressFactory } from "../../../../progress/index.js";

/**
 * Format a value for MySQL export.
 * Handles Date objects, null, undefined, and other types.
 */
function formatForMySQL(val: unknown): string {
  if (val === null || val === undefined) return "NULL";

  // Handle Date objects - format as MySQL datetime
  if (val instanceof Date) {
    const yyyy = val.getUTCFullYear();
    const mm = String(val.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(val.getUTCDate()).padStart(2, "0");
    const hh = String(val.getUTCHours()).padStart(2, "0");
    const mi = String(val.getUTCMinutes()).padStart(2, "0");
    const ss = String(val.getUTCSeconds()).padStart(2, "0");
    return `'${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}'`;
  }

  // Handle objects (JSON columns) - stringify
  if (typeof val === "object") {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  }

  // Handle strings
  if (typeof val === "string") {
    return `'${val.replace(/'/g, "''")}'`;
  }

  // Numbers and booleans
  if (typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }

  return "NULL";
}

/**
 * Format a value for CSV export.
 */
function formatForCSV(val: unknown): string {
  if (val === null || val === undefined) return "";

  // Handle Date objects - format as ISO string without extra quotes
  if (val instanceof Date) {
    const yyyy = val.getUTCFullYear();
    const mm = String(val.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(val.getUTCDate()).padStart(2, "0");
    const hh = String(val.getUTCHours()).padStart(2, "0");
    const mi = String(val.getUTCMinutes()).padStart(2, "0");
    const ss = String(val.getUTCSeconds()).padStart(2, "0");
    return `"${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}"`;
  }

  // Handle objects (JSON columns) - double-quote escaping for CSV
  if (typeof val === "object") {
    return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
  }

  // Handle strings - escape double quotes
  if (typeof val === "string") {
    return `"${val.replace(/"/g, '""')}"`;
  }

  // Numbers and booleans
  if (typeof val === "number" || typeof val === "boolean") {
    return `"${val}"`;
  }

  return "";
}

export function createExportTableTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_export_table",
    title: "MySQL Export Table",
    description: "Export table data as SQL INSERT statements or CSV format.",
    group: "backup",
    inputSchema: ExportTableSchemaBase,
    outputSchema: ExportTableOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, format, where, limit, batch } =
          ExportTableSchema.parse(params);

        // Validate inputs for SQL injection prevention
        validateIdentifier(table, "table");
        if (where) {
          validateWhereClause(where);
        }

        // Verify table exists (P154)
        try {
          const tableCheck = await adapter.executeReadQuery(
            `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
            [table],
          );
          if (!tableCheck.rows || tableCheck.rows.length === 0) {
            return withTokenEstimate({
              success: false,
              error: `Table '${table}' does not exist`,
              details: { exists: false, table },
            });
          }
        } catch (dbErr) {
          return withTokenEstimate(
            formatHandlerErrorResponse(dbErr) as unknown as Record<
              string,
              unknown
            >,
          );
        }

        // Get table data
        const reporter = progressFactory.create(_context.progressToken);
        reporter?.start(2, `Exporting table '${table}'...`);
        reporter?.progress(0, "Executing query...");

        let sql = `SELECT * FROM \`${table}\``;
        if (where) {
          sql += ` WHERE ${where}`;
        }
        if (limit !== undefined) {
          sql += ` LIMIT ${limit}`;
        }

        let rows: Record<string, unknown>[];
        try {
          const result = await adapter.executeReadQuery(sql);
          rows = result.rows ?? [];
          reporter?.progress(1, `Processing ${rows.length} rows...`);
        } catch (error) {
          return withTokenEstimate(
            formatHandlerErrorResponse(error) as unknown as Record<
              string,
              unknown
            >,
          );
        }

        if (format === "CSV") {
          if (rows.length === 0) {
            reporter?.complete();
            return withTokenEstimate({
              success: true,
              data: { csv: "", rowCount: 0 },
            });
          }

          const firstRow = rows[0];
          if (!firstRow) {
            reporter?.complete();
            return withTokenEstimate({
              success: true,
              data: { csv: "", rowCount: 0 },
            });
          }

          const headers = Object.keys(firstRow);
          const csvLines = [headers.join(",")];

          for (const row of rows) {
            const values = headers.map((h) => formatForCSV(row[h]));
            csvLines.push(values.join(","));
          }

          reporter?.complete();
          return withTokenEstimate({
            success: true,
            data: {
              csv: csvLines.join("\n"),
              rowCount: rows.length,
            },
          });
        }

        if (format === "JSON") {
          reporter?.complete();
          return withTokenEstimate({
            success: true,
            data: {
              json: JSON.stringify(rows, null, 2),
              rowCount: rows.length,
            },
          });
        }

        // SQL format
        const firstRow = rows[0];
        if (!firstRow) {
          reporter?.complete();
          return withTokenEstimate({
            success: true,
            data: { sql: "", rowCount: 0 },
          });
        }

        const columns = Object.keys(firstRow)
          .map((c) => `\`${c}\``)
          .join(", ");
        const insertStatements: string[] = [];

        for (let i = 0; i < rows.length; i += batch) {
          const chunk = rows.slice(i, i + batch);
          const valueGroups = chunk.map(
            (row) => `(${Object.values(row).map(formatForMySQL).join(", ")})`,
          );
          insertStatements.push(
            `INSERT INTO \`${table}\` (${columns}) VALUES ${valueGroups.join(", ")};`,
          );
        }

        reporter?.complete();
        return withTokenEstimate({
          success: true,
          data: {
            sql: insertStatements.join("\n"),
            rowCount: rows.length,
          },
        });
      } catch (err) {
        return withTokenEstimate(
          formatHandlerErrorResponse(err) as unknown as Record<string, unknown>,
        );
      }
    },
  };
}

export function createImportDataTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_import_data",
    title: "MySQL Import Data",
    description: "Import data into a table from an array of row objects.",
    group: "backup",
    inputSchema: ImportDataSchemaBase,
    outputSchema: ImportDataOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, data } = ImportDataSchema.parse(params);

        // Validate table name for SQL injection prevention
        validateIdentifier(table, "table");

        if (data.length === 0) {
          return withTokenEstimate({
            success: true,
            data: { rowsInserted: 0 },
          });
        }

        // Validate all column names upfront (throws for SQL injection - must not be caught)
        for (const row of data) {
          for (const colName of Object.keys(row)) {
            validateIdentifier(colName, "column");
          }
        }

        let totalInserted = 0;

        const reporter = progressFactory.create(_context.progressToken);
        reporter?.start(data.length, `Importing ${data.length} rows...`);

        try {
          const firstRow = data[0];
          if (!firstRow)
            return withTokenEstimate({
              success: true,
              data: { rowsInserted: 0 },
            });
          const columnNames = Object.keys(firstRow);
          const columns = columnNames.map((c) => `\`${c}\``).join(", ");

          const batchSize = 100;
          for (let i = 0; i < data.length; i += batchSize) {
            reporter?.progress(
              i,
              `Importing rows ${i} to ${Math.min(i + batchSize, data.length)}...`,
            );
            const chunk = data.slice(i, i + batchSize);
            const valueGroups = [];
            const flatValues: unknown[] = [];

            for (const row of chunk) {
              valueGroups.push(`(${columnNames.map(() => "?").join(", ")})`);
              for (const col of columnNames) {
                let val = row[col];
                if (
                  typeof val === "string" &&
                  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(val)
                ) {
                  val = val.replace("T", " ").replace("Z", "").split(".")[0];
                }
                flatValues.push(val);
              }
            }

            const sql = `INSERT INTO \`${table}\` (${columns}) VALUES ${valueGroups.join(", ")}`;
            await adapter.executeWriteQuery(sql, flatValues);
            totalInserted += chunk.length;
          }
        } catch (error) {
          const response = formatHandlerErrorResponse(error);
          return withTokenEstimate({
            ...response,
            details: {
              ...(response.details ?? {}),
              rowsInserted: totalInserted,
            },
          });
        }

        reporter?.complete();

        return withTokenEstimate({
          success: true,
          data: { rowsInserted: totalInserted },
        });
      } catch (err) {
        return withTokenEstimate(
          formatHandlerErrorResponse(err) as unknown as Record<string, unknown>,
        );
      }
    },
  };
}

export function createCreateDumpTool(_adapter: MySQLAdapter): ToolDefinition {
  const schemaBase = z.object({
    database: z.string().optional().describe("Database name"),
    tables: z
      .array(z.string())
      .min(1, "Tables array cannot be empty if provided")
      .optional()
      .describe("Specific tables to dump"),
    noData: z
      .boolean()
      .optional()
      .default(false)
      .describe("Schema only, no data"),
    singleTransaction: z
      .boolean()
      .optional()
      .default(false)
      .describe("Use single transaction for dump (no locking)"),
  });

  const schema = schemaBase
    .transform((data) => ({
      database: data.database ?? "",
      tables: data.tables,
      noData: data.noData,
      singleTransaction: data.singleTransaction,
    }))
    .refine((data) => data.database !== "", {
      message: "database is required",
    });

  return {
    name: "mysql_create_dump",
    title: "MySQL Create Dump",
    description: "Generate mysqldump command for backing up database.",
    group: "backup",
    inputSchema: schemaBase,
    outputSchema: CreateDumpOutputSchema,
    requiredScopes: ["admin"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { database, tables, noData, singleTransaction } =
          schema.parse(params);

        // Verify database exists
        try {
          const dbCheck = await _adapter.executeReadQuery(
            `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
            [database],
          );
          if (!dbCheck.rows || dbCheck.rows.length === 0) {
            return withTokenEstimate({
              success: false,
              error: `Database '${database}' does not exist.`,
            });
          }
        } catch (dbErr) {
          return withTokenEstimate(
            formatHandlerErrorResponse(dbErr) as unknown as Record<
              string,
              unknown
            >,
          );
        }

        // Verify tables exist if provided
        if (tables && tables.length > 0) {
          for (const table of tables) {
            try {
              const tableCheck = await _adapter.executeReadQuery(
                `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
                [database, table],
              );
              if (!tableCheck.rows || tableCheck.rows.length === 0) {
                return withTokenEstimate({
                  success: false,
                  error: `Table '${table}' does not exist in database '${database}'.`,
                });
              }
            } catch (tableErr) {
              return withTokenEstimate(
                formatHandlerErrorResponse(tableErr) as unknown as Record<
                  string,
                  unknown
                >,
              );
            }
          }
        }

        let command = `mysqldump -u [username] -p ${database}`;

        if (tables && tables.length > 0) {
          command += ` ${tables.join(" ")}`;
        }

        if (noData) {
          command += " --no-data";
        }

        if (singleTransaction) {
          command += " --single-transaction";
        }

        command += " > backup.sql";

        return withTokenEstimate({
          success: true,
          data: {
            command,
            note: "Replace [username] with your MySQL username. Add -h [host] if connecting to a remote server.",
          },
        });
      } catch (err) {
        return withTokenEstimate(
          formatHandlerErrorResponse(err) as unknown as Record<string, unknown>,
        );
      }
    },
  };
}

export function createRestoreDumpTool(_adapter: MySQLAdapter): ToolDefinition {
  const schemaBase = z.object({
    database: z.string().optional().describe("Target database"),
    filename: z
      .string()
      .optional()
      .default("backup.sql")
      .describe("Dump file to restore"),
  });

  const schema = schemaBase
    .transform((data) => ({
      database: data.database ?? "",
      filename: data.filename,
    }))
    .refine((data) => data.database !== "", {
      message: "database is required",
    });

  return {
    name: "mysql_restore_dump",
    title: "MySQL Restore Dump",
    description: "Generate command for restoring from mysqldump backup.",
    group: "backup",
    inputSchema: schemaBase,
    outputSchema: RestoreDumpOutputSchema,
    requiredScopes: ["admin"],
    annotations: IDEMPOTENT,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { database, filename } = schema.parse(params);

        // Verify database exists
        try {
          const dbCheck = await _adapter.executeReadQuery(
            `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`,
            [database],
          );
          if (!dbCheck.rows || dbCheck.rows.length === 0) {
            return withTokenEstimate({
              success: false,
              error: `Database '${database}' does not exist.`,
            });
          }
        } catch (dbErr) {
          return withTokenEstimate(
            formatHandlerErrorResponse(dbErr) as unknown as Record<
              string,
              unknown
            >,
          );
        }

        const command = `mysql -u [username] -p ${database} < ${filename}`;

        return withTokenEstimate({
          success: true,
          data: {
            command,
            note: "Replace [username] with your MySQL username. Add -h [host] if connecting to a remote server.",
          },
        });
      } catch (err) {
        return withTokenEstimate(
          formatHandlerErrorResponse(err) as unknown as Record<string, unknown>,
        );
      }
    },
  };
}
