/**
 * MySQL Admin Tools - Backup and Restore
 *
 * Tools for data export, import, and backup operations.
 * 4 tools: export, import, dump, restore.
 */

import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { ExportTableSchema, ImportDataSchema } from "../../types.js";
import { z } from "zod";
import {
  validateIdentifier,
  validateWhereClause,
} from "../../../../utils/validators.js";

export function createExportTableTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_export_table",
    title: "MySQL Export Table",
    description: "Export table data as SQL INSERT statements or CSV format.",
    group: "backup",
    inputSchema: ExportTableSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, format, where, limit } = ExportTableSchema.parse(params);

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

      const result = await adapter.executeReadQuery(sql);
      const rows = result.rows ?? [];

      if (format === "CSV") {
        if (rows.length === 0) {
          return { csv: "", rowCount: 0 };
        }

        const firstRow = rows[0];
        if (!firstRow) {
          return { csv: "", rowCount: 0 };
        }

        const headers = Object.keys(firstRow);
        const csvLines = [headers.join(",")];

        for (const row of rows) {
          const values = headers.map((h) => {
            const val = row[h];
            if (val === null || val === undefined) return "";
            // Handle objects (JSON columns) by stringifying them
            if (typeof val === "object")
              return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
            if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
            // Numbers and booleans - safe to use directly
            if (typeof val === "number" || typeof val === "boolean")
              return `"${val}"`;
            return "";
          });
          csvLines.push(values.join(","));
        }

        return { csv: csvLines.join("\n"), rowCount: rows.length };
      }

      // SQL format
      const insertStatements: string[] = [];

      for (const row of rows) {
        const columns = Object.keys(row)
          .map((c) => `\`${c}\``)
          .join(", ");
        const values = Object.values(row)
          .map((v) => {
            if (v === null || v === undefined) return "NULL";
            if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
            if (typeof v === "object")
              return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
            // Numbers and booleans - safe to convert
            if (typeof v === "number" || typeof v === "boolean")
              return String(v);
            return "NULL";
          })
          .join(", ");

        insertStatements.push(
          `INSERT INTO \`${table}\` (${columns}) VALUES (${values});`,
        );
      }

      return { sql: insertStatements.join("\n"), rowCount: rows.length };
    },
  };
}

export function createImportDataTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_import_data",
    title: "MySQL Import Data",
    description: "Import data into a table from an array of row objects.",
    group: "backup",
    inputSchema: ImportDataSchema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, data } = ImportDataSchema.parse(params);

      // Validate table name for SQL injection prevention
      validateIdentifier(table, "table");

      if (data.length === 0) {
        return { success: true, rowsInserted: 0 };
      }

      let totalInserted = 0;

      for (const row of data) {
        // Validate column names
        for (const colName of Object.keys(row)) {
          validateIdentifier(colName, "column");
        }
        const columns = Object.keys(row)
          .map((c) => `\`${c}\``)
          .join(", ");
        const placeholders = Object.keys(row)
          .map(() => "?")
          .join(", ");
        const values = Object.values(row);

        const sql = `INSERT INTO \`${table}\` (${columns}) VALUES (${placeholders})`;
        await adapter.executeWriteQuery(sql, values);
        totalInserted++;
      }

      return { success: true, rowsInserted: totalInserted };
    },
  };
}

export function createCreateDumpTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({
    database: z
      .string()
      .optional()
      .describe("Database name (defaults to current)"),
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

  return {
    name: "mysql_create_dump",
    title: "MySQL Create Dump",
    description: "Generate mysqldump command for backing up database.",
    group: "backup",
    inputSchema: schema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { database, tables, noData, singleTransaction } =
        schema.parse(params);

      // Get current database if not specified
      let dbName = database;
      if (!dbName) {
        const result = await adapter.executeReadQuery(
          "SELECT DATABASE() as db",
        );
        const dbValue = result.rows?.[0]?.["db"];
        if (typeof dbValue === "string") {
          dbName = dbValue;
        } else {
          dbName = "";
        }
      }

      let command = `mysqldump -u [username] -p ${dbName}`;

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
        command,
        note: "Replace [username] with your MySQL username. Add -h [host] if connecting to a remote server.",
      };
    },
  };
}

export function createRestoreDumpTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({
    database: z.string().optional().describe("Target database"),
    filename: z.string().default("backup.sql").describe("Dump file to restore"),
  });

  return {
    name: "mysql_restore_dump",
    title: "MySQL Restore Dump",
    description: "Generate command for restoring from mysqldump backup.",
    group: "backup",
    inputSchema: schema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { database, filename } = schema.parse(params);

      let dbName = database;
      if (!dbName) {
        const result = await adapter.executeReadQuery(
          "SELECT DATABASE() as db",
        );
        const dbValue = result.rows?.[0]?.["db"];
        if (typeof dbValue === "string") {
          dbName = dbValue;
        } else {
          dbName = "";
        }
      }

      const command = `mysql -u [username] -p ${dbName} < ${filename}`;

      return {
        command,
        note: "Replace [username] with your MySQL username. Add -h [host] if connecting to a remote server.",
      };
    },
  };
}
