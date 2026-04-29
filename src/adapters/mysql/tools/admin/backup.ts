/**
 * MySQL Admin Tools - Backup and Restore
 *
 * Tools for data export, import, and backup operations.
 * 4 tools: export, import, dump, restore.
 */

import { z } from "zod";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";
import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  ExportTableSchema,
  ExportTableSchemaBase,
  ImportDataSchema,
  ImportDataSchemaBase,
} from "../../schemas/index.js";
import {
  validateIdentifier,
  validateWhereClause,
} from "../../../../utils/validators.js";

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
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, format, where, limit, batch } =
          ExportTableSchema.parse(params);

        // Validate inputs for SQL injection prevention
        validateIdentifier(table, "table");
        if (where) {
          validateWhereClause(where);
        }

        // Get table data
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
        } catch (error) {
          return formatHandlerErrorResponse(error);
        }

        if (format === "CSV") {
          if (rows.length === 0) {
            return { success: true, csv: "", rowCount: 0 };
          }

          const firstRow = rows[0];
          if (!firstRow) {
            return { success: true, csv: "", rowCount: 0 };
          }

          const headers = Object.keys(firstRow);
          const csvLines = [headers.join(",")];

          for (const row of rows) {
            const values = headers.map((h) => formatForCSV(row[h]));
            csvLines.push(values.join(","));
          }

          return {
            success: true,
            csv: csvLines.join("\n"),
            rowCount: rows.length,
          };
        }

        if (format === "JSON") {
          return {
            success: true,
            json: JSON.stringify(rows, null, 2),
            rowCount: rows.length,
          };
        }

        // SQL format
        const firstRow = rows[0];
        if (!firstRow) {
          return { success: true, sql: "", rowCount: 0 };
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

        return {
          success: true,
          sql: insertStatements.join("\n"),
          rowCount: rows.length,
        };
      } catch (err) {
        return formatHandlerErrorResponse(err);
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
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, data } = ImportDataSchema.parse(params);

        // Validate table name for SQL injection prevention
        validateIdentifier(table, "table");

        if (data.length === 0) {
          return { success: true, rowsInserted: 0 };
        }

        // Validate all column names upfront (throws for SQL injection - must not be caught)
        for (const row of data) {
          for (const colName of Object.keys(row)) {
            validateIdentifier(colName, "column");
          }
        }

        let totalInserted = 0;

        try {
          for (const row of data) {
            const columns = Object.keys(row)
              .map((c) => `\`${c}\``)
              .join(", ");
            const placeholders = Object.keys(row)
              .map(() => "?")
              .join(", ");
            const values = Object.values(row).map(val => {
              if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(val)) {
                return val.replace('T', ' ').replace('Z', '').split('.')[0];
              }
              return val;
            });

            const sql = `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`;
            await adapter.executeWriteQuery(sql, values);
            totalInserted++;
          }
        } catch (error) {
          const response = formatHandlerErrorResponse(error);
          return {
            ...response,
            rowsInserted: totalInserted,
          };
        }

        return { success: true, rowsInserted: totalInserted };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createCreateDumpTool(_adapter: MySQLAdapter): ToolDefinition {
  const schemaBase = z.object({
    database: z.string().optional().describe("Database name"),
    tables: z.array(z.string()).optional().describe("Specific tables to dump"),
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
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
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
            return {
              success: false,
              error: `Database '${database}' does not exist.`,
            };
          }
        } catch (dbErr) {
          return formatHandlerErrorResponse(dbErr);
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
                return {
                  success: false,
                  error: `Table '${table}' does not exist in database '${database}'.`,
                };
              }
            } catch (tableErr) {
              return formatHandlerErrorResponse(tableErr);
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

        return {
          success: true,
          command,
          note: "Replace [username] with your MySQL username. Add -h [host] if connecting to a remote server.",
        };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

export function createRestoreDumpTool(_adapter: MySQLAdapter): ToolDefinition {
  const schemaBase = z.object({
    database: z.string().optional().describe("Target database"),
    filename: z.string().optional().default("backup.sql").describe("Dump file to restore"),
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
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
    },
    handler: (params: unknown, _context: RequestContext) => {
      try {
        const { database, filename } = schema.parse(params);

        const command = `mysql -u [username] -p ${database} < ${filename}`;

        return Promise.resolve({
          success: true,
          command,
          note: "Replace [username] with your MySQL username. Add -h [host] if connecting to a remote server.",
        });
      } catch (err) {
        return Promise.resolve(formatHandlerErrorResponse(err));
      }
    },
  };
}
