/**
 * MySQL Shell - Data Transfer Tools
 *
 * Tools for importing and exporting data using MySQL Shell utilities.
 */

import { ZodError } from "zod";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  ShellExportTableInputSchema,
  ShellExportTableInputSchemaBase,
  ShellImportTableInputSchema,
  ShellImportTableInputSchemaBase,
  ShellImportJSONInputSchema,
  ShellImportJSONInputSchemaBase,
} from "../../schemas/shell.js";
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
    inputSchema: ShellExportTableInputSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { schema, table, outputPath, outputUrl, format, where } =
          ShellExportTableInputSchema.parse(params);

        // Escape path for JavaScript
        const finalOutputPath = outputPath ?? outputUrl;
        if (!finalOutputPath) {
          return { success: false, error: "Validation error: outputPath or outputUrl is required" };
        }
        const escapedPath = finalOutputPath.replace(/\\/g, "\\\\");

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
          outputPath: finalOutputPath,
          format,
          result,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("privilege") ||
          errorMessage.includes("Access denied")
        ) {
          return {
            success: false,
            error: `Export failed due to insufficient privileges: ${errorMessage}.`,
            suggestion: `Ensure the user has SELECT privilege on the target table.`,
          };
        }
        return { success: false, error: errorMessage };
      }
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
    inputSchema: ShellImportTableInputSchemaBase,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const {
          inputPath,
          inputUrl,
          schema,
          table,
          threads,
          skipRows,
          columns,
          fieldsTerminatedBy,
          linesTerminatedBy,
          updateServerSettings,
        } = ShellImportTableInputSchema.parse(params);

        const finalInputPath = inputPath ?? inputUrl;
        if (!finalInputPath) {
          return { success: false, error: "Validation error: inputPath or inputUrl is required" };
        }
        const escapedPath = finalInputPath.replace(/\\/g, "\\\\");

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
          options.push(
            `linesTerminatedBy: ${JSON.stringify(linesTerminatedBy)}`,
          );
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

        const result = await execShellJS(jsCode);
        return {
          success: true,
          inputPath: finalInputPath,
          schema,
          table,
          localInfileEnabled: updateServerSettings,
          result,
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("local_infile") ||
          errorMessage.includes("Loading local data is disabled")
        ) {
          return {
            success: false,
            error: "Import failed: local_infile is disabled on the server.",
            suggestion:
              "Set updateServerSettings: true (requires SUPER or SYSTEM_VARIABLES_ADMIN privilege), or manually run: SET GLOBAL local_infile = ON",
          };
        }
        return {
          success: false,
          error: errorMessage,
        };
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
      "Import JSON documents from a file using util.importJson(). Supports NDJSON (one JSON object per line) and multi-line JSON objects (not JSON arrays). REQUIRES X Protocol (port 33060).",
    group: "shell",
    inputSchema: ShellImportJSONInputSchemaBase,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { inputPath, inputUrl, schema, collection, tableColumn, convertBsonTypes } =
          ShellImportJSONInputSchema.parse(params);
        const config = getShellConfig();

        const finalInputPath = inputPath ?? inputUrl;
        if (!finalInputPath) {
          return { success: false, error: "Validation error: inputPath or inputUrl is required" };
        }
        const escapedPath = finalInputPath.replace(/\\/g, "\\\\");

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
          return {
            success: false,
            error: `X Protocol connection failed: ${errorMessage}.`,
            suggestion: `Ensure MySQL X Plugin is enabled (port ${process.env["MYSQL_XPORT"] ?? "33060"}) and the user has access. Check: SHOW PLUGINS LIKE 'mysqlx';`,
            details: { protocol: "X Protocol" },
          };
        }

        // Check for X Protocol access denied errors in stderr
        if (
          result.stderr.includes("Access denied") ||
          result.stderr.includes("1045")
        ) {
          return {
            success: false,
            error: `X Protocol authentication failed.`,
            suggestion: `The user may not have access via X Protocol (port ${process.env["MYSQL_XPORT"] ?? "33060"}). Verify: 1) X Plugin is enabled, 2) User has proper grants, 3) Authentication plugin is compatible (mysql_native_password or caching_sha2_password).`,
            details: { protocol: "X Protocol" },
          };
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
              return {
                success: false,
                error: parsed.error ?? "Unknown MySQL Shell error",
                details: { protocol: "X Protocol" },
              };
            }
            return {
              success: true,
              inputPath: finalInputPath,
              schema,
              collection,
              protocol: "X Protocol",
              result: parsed.result,
            };
          }
        }

        if (result.exitCode !== 0) {
          return {
            success: false,
            error:
              result.stderr || result.stdout || "MySQL Shell import failed",
            details: { protocol: "X Protocol" },
          };
        }

        return {
          success: true,
          inputPath: finalInputPath,
          schema,
          collection,
          protocol: "X Protocol",
          result: { raw: result.stdout },
        };
      } catch (error) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
      }
    },
  };
}
