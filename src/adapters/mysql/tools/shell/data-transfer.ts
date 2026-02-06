/**
 * MySQL Shell - Data Transfer Tools
 *
 * Tools for importing and exporting data using MySQL Shell utilities.
 */

import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  ShellExportTableInputSchema,
  ShellImportTableInputSchema,
  ShellImportJSONInputSchema,
} from "../../types/shell-types.js";
import {
  getShellConfig,
  escapeForJS,
  execShellJS,
  execMySQLShell,
} from "./common.js";

/**
 * Export table to file
 */
export function createShellExportTableTool(): ToolDefinition {
  return {
    name: "mysqlsh_export_table",
    title: "MySQL Shell Export Table",
    description:
      "Export a MySQL table to a file using util.exportTable(). Supports CSV and TSV formats with WHERE clause filtering.",
    group: "shell",
    inputSchema: ShellExportTableInputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { schema, table, outputPath, format, where } =
        ShellExportTableInputSchema.parse(params);

      // Escape path for JavaScript
      const escapedPath = outputPath.replace(/\\/g, "\\\\");

      const options: string[] = [];
      if (format === "csv") {
        options.push('fieldsTerminatedBy: ","');
        options.push('fieldsEnclosedBy: "\\""');
      }
      // TSV is the default for util.exportTable(), no special options needed
      if (where) {
        options.push(`where: "${escapeForJS(where)}"`);
      }

      const optionsStr =
        options.length > 0 ? `, { ${options.join(", ")} }` : "";
      const jsCode = `return util.exportTable("${schema}.${table}", "${escapedPath}"${optionsStr});`;

      const result = await execShellJS(jsCode);

      return {
        success: true,
        schema,
        table,
        outputPath,
        format,
        result,
      };
    },
  };
}

/**
 * Import table from file
 */
export function createShellImportTableTool(): ToolDefinition {
  return {
    name: "mysqlsh_import_table",
    title: "MySQL Shell Import Table",
    description:
      "Parallel table import using util.importTable(). For CSV files, explicitly set fieldsTerminatedBy to ',' as the delimiter is not auto-detected. Target table must already exist.",
    group: "shell",
    inputSchema: ShellImportTableInputSchema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const {
        inputPath,
        schema,
        table,
        threads,
        skipRows,
        columns,
        fieldsTerminatedBy,
        linesTerminatedBy,
        updateServerSettings,
      } = ShellImportTableInputSchema.parse(params);

      const escapedPath = inputPath.replace(/\\/g, "\\\\");

      const options: string[] = [];
      options.push(`schema: "${schema}"`);
      options.push(`table: "${table}"`);
      if (threads) {
        options.push(`threads: ${threads}`);
      }
      if (skipRows !== undefined) {
        options.push(`skipRows: ${skipRows}`);
      }
      if (columns && columns.length > 0) {
        options.push(`columns: ${JSON.stringify(columns)}`);
      }
      if (fieldsTerminatedBy) {
        options.push(
          `fieldsTerminatedBy: ${JSON.stringify(fieldsTerminatedBy)}`,
        );
      }
      if (linesTerminatedBy) {
        options.push(`linesTerminatedBy: ${JSON.stringify(linesTerminatedBy)}`);
      }

      // Build JavaScript code that optionally enables local_infile
      let jsCode: string;
      if (updateServerSettings) {
        jsCode = `
                    session.runSql("SET GLOBAL local_infile = ON");
                    return util.importTable("${escapedPath}", { ${options.join(", ")} });
                `;
      } else {
        jsCode = `return util.importTable("${escapedPath}", { ${options.join(", ")} });`;
      }

      try {
        const result = await execShellJS(jsCode);
        return {
          success: true,
          inputPath,
          schema,
          table,
          localInfileEnabled: updateServerSettings,
          result,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("local_infile") ||
          errorMessage.includes("Loading local data is disabled")
        ) {
          throw new Error(
            `Import failed: local_infile is disabled on the server. ` +
              `Either set updateServerSettings: true (requires SUPER or SYSTEM_VARIABLES_ADMIN privilege), ` +
              `or manually run: SET GLOBAL local_infile = ON`,
          );
        }
        throw error;
      }
    },
  };
}

/**
 * Import JSON documents
 */
export function createShellImportJSONTool(): ToolDefinition {
  return {
    name: "mysqlsh_import_json",
    title: "MySQL Shell Import JSON",
    description:
      "Import JSON documents from a file using util.importJson(). File must be NDJSON format (one JSON object per line, not a JSON array). REQUIRES X Protocol (port 33060).",
    group: "shell",
    inputSchema: ShellImportJSONInputSchema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { inputPath, schema, collection, tableColumn, convertBsonTypes } =
        ShellImportJSONInputSchema.parse(params);
      const config = getShellConfig();

      const escapedPath = inputPath.replace(/\\/g, "\\\\");

      const options: string[] = [];
      options.push(`schema: "${schema}"`);

      if (tableColumn) {
        // Importing to a table column
        options.push(`table: "${collection}"`);
        options.push(`tableColumn: "${tableColumn}"`);
      } else {
        // Importing to a collection
        options.push(`collection: "${collection}"`);
      }

      if (convertBsonTypes) {
        options.push("convertBsonTypes: true");
      }

      const jsCode = `return util.importJson("${escapedPath}", { ${options.join(", ")} });`;

      // util.importJson() ALWAYS requires X Protocol (X DevAPI)
      let result;
      try {
        result = await execMySQLShell([
          "--uri",
          config.xConnectionUri,
          "--js",
          "-e",
          `
                        var __result__;
                        try {
                            __result__ = (function() { ${jsCode} })();
                            print(JSON.stringify({ success: true, result: __result__ }));
                        } catch (e) {
                            print(JSON.stringify({ success: false, error: e.message }));
                        }
                    `,
        ]);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw new Error(
          `X Protocol connection failed: ${errorMessage}. ` +
            `Ensure MySQL X Plugin is enabled (port ${process.env["MYSQL_XPORT"] ?? "33060"}) ` +
            `and the user has access. Check: SHOW PLUGINS LIKE 'mysqlx';`,
        );
      }

      // Check for X Protocol access denied errors in stderr
      if (
        result.stderr.includes("Access denied") ||
        result.stderr.includes("1045")
      ) {
        throw new Error(
          `X Protocol authentication failed. The user may not have access via X Protocol (port ${process.env["MYSQL_XPORT"] ?? "33060"}). ` +
            `Verify: 1) X Plugin is enabled, 2) User has proper grants, 3) Authentication plugin is compatible (mysql_native_password or caching_sha2_password).`,
        );
      }

      // Parse result
      const lines = result.stdout.trim().split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line) continue;
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith("{")) {
          let parsed: { success: boolean; result?: unknown; error?: string };
          try {
            parsed = JSON.parse(trimmedLine) as {
              success: boolean;
              result?: unknown;
              error?: string;
            };
          } catch {
            continue;
          }

          if (!parsed.success) {
            throw new Error(parsed.error ?? "Unknown MySQL Shell error");
          }
          return {
            success: true,
            inputPath,
            schema,
            collection,
            protocol: "X Protocol",
            result: parsed.result,
          };
        }
      }

      if (result.exitCode !== 0) {
        throw new Error(
          result.stderr || result.stdout || "MySQL Shell import failed",
        );
      }

      return {
        success: true,
        inputPath,
        schema,
        collection,
        protocol: "X Protocol",
        result: { raw: result.stdout },
      };
    },
  };
}
