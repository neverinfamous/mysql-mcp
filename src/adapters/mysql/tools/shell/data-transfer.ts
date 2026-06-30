/**
 * MySQL Shell - Data Transfer Tools
 *
 * Tools for importing and exporting data using MySQL Shell utilities.
 */

import { ZodError } from "zod";
import * as path from "path";
import * as fs from "fs";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import {
  ValidationError,
  MySQLMcpError,
  ErrorCategory,
  type ToolDefinition,
  type RequestContext,
} from "../../../../types/index.js";
import { assertSafeIoPath } from "../../../../utils/security-utils.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import {
  ShellExportTableInputSchema,
  ShellExportTableInputSchemaBase,
  ShellImportTableInputSchema,
  ShellImportTableInputSchemaBase,
  ShellImportJSONInputSchema,
  ShellImportJSONInputSchemaBase,
  ShellExportTableOutputSchema,
  ShellImportTableOutputSchema,
  ShellImportJSONOutputSchema,
} from "../../schemas/shell/index.js";
import {
  getShellConfig,
  escapeForJS,
  execShellJS,
  execMySQLShell,
} from "./common.js";

/**
 * Export table to file
 */
export function createShellExportTableTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysqlsh_export_table",
    title: "MySQL Shell Export Table",
    description:
      "Export a MySQL table to a file using util.exportTable(). Supports CSV and TSV formats with WHERE clause filtering.",
    group: "shell",
    inputSchema: ShellExportTableInputSchemaBase,
    outputSchema: ShellExportTableOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      destructiveHint: false,
      sensitiveHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { schema, table, outputPath, outputUrl, format, where } =
          ShellExportTableInputSchema.parse(params);

        // Escape path for JavaScript
        const finalOutputPath = outputPath ?? outputUrl;
        if (!finalOutputPath) {
          throw new ValidationError("outputPath or outputUrl is required");
        }
        
        assertSafeIoPath(finalOutputPath, adapter.getAllowedIoRoots());

        const resolvedPath = path.resolve(finalOutputPath);
        const escapedPath = resolvedPath.replace(/\\/g, "\\\\");

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
        const target = schema ? `${schema}.${table}` : table;
        const jsCode = `return util.exportTable("${target}", "${escapedPath}"${optionsStr});`;

        const result = await execShellJS(jsCode);

        return withTokenEstimate({
          success: true,
          data: {
            schema,
            table,
            outputPath: finalOutputPath,
            format,
            result,
          },
        });
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
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              `Export failed due to insufficient privileges: ${errorMessage}.`,
              "AUTHORIZATION_ERROR",
              ErrorCategory.AUTHORIZATION,
              { suggestion: `Ensure the user has SELECT privilege on the target table.` }
            )
          );
        }
        
        if (
          errorMessage.includes("1146") ||
          errorMessage.includes("doesn't exist") ||
          errorMessage.includes("was not found in the database")
        ) {
          const match1 = /Table '([^']+)' doesn't exist/i.exec(errorMessage);
          const match2 = /table `([^`]+)`\.`([^`]+)` was not found/i.exec(errorMessage);
          const msg = match1 
            ? `Table '${match1[1]}' does not exist` 
            : (match2 ? `Table '${match2[1]}.${match2[2]}' does not exist` : "Table does not exist");
          return formatHandlerErrorResponse(
            new MySQLMcpError(msg, "QUERY_ERROR", ErrorCategory.QUERY, {
              suggestion: "Verify the table name and schema.",
            })
          );
        }
        if (
          errorMessage.includes("1049") ||
          errorMessage.includes("Unknown database")
        ) {
          const match = /Unknown database '([^']+)'/i.exec(errorMessage);
          const msg = match ? `Database '${match[1]}' does not exist` : "Database does not exist";
          return formatHandlerErrorResponse(
            new MySQLMcpError(msg, "QUERY_ERROR", ErrorCategory.QUERY, {
              suggestion: "Verify the schema (database) name.",
            })
          );
        }
        if (errorMessage.includes("1054") || errorMessage.includes("Unknown column")) {
          const match = /Unknown column '([^']+)'/i.exec(errorMessage);
          const msg = match ? `Column '${match[1]}' not found` : "Column not found";
          return formatHandlerErrorResponse(
            new MySQLMcpError(msg, "QUERY_ERROR", ErrorCategory.QUERY, {
              suggestion: "Verify the column name in your query.",
            })
          );
        }
        if (errorMessage.includes("1064") || errorMessage.includes("syntax error")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(`SQL syntax error: ${errorMessage}`, "QUERY_ERROR", ErrorCategory.QUERY, {
              suggestion: "Check your SQL syntax.",
            })
          );
        }

        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Import table from file
 */
export function createShellImportTableTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysqlsh_import_table",
    title: "MySQL Shell Import Table",
    description:
      "Parallel table import using util.importTable(). For CSV files, explicitly set fieldsTerminatedBy to ',' as the delimiter is not auto-detected. Target table must already exist.",
    group: "shell",
    inputSchema: ShellImportTableInputSchemaBase,
    outputSchema: ShellImportTableOutputSchema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false,
      sensitiveHint: false,
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
          throw new ValidationError("inputPath or inputUrl is required");
        }

        assertSafeIoPath(finalInputPath, adapter.getAllowedIoRoots(), false);

        const resolvedPath = path.resolve(finalInputPath);
        const escapedPath = resolvedPath.replace(/\\/g, "\\\\");

        const options: string[] = [];
        if (schema) {
          options.push(`schema: "${schema}"`);
        }
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
        return withTokenEstimate({
          success: true,
          data: {
            inputPath: finalInputPath,
            schema,
            table,
            localInfileEnabled: updateServerSettings,
            result,
          },
        });
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
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              "Import failed: local_infile is disabled on the server.",
              "CONFIGURATION_ERROR",
              ErrorCategory.CONFIGURATION,
              { suggestion: "Set updateServerSettings: true (requires SUPER or SYSTEM_VARIABLES_ADMIN privilege), or manually run: SET GLOBAL local_infile = ON" }
            )
          );
        }
        
        if (
          errorMessage.includes("1146") ||
          errorMessage.includes("doesn't exist") ||
          errorMessage.includes("was not found in the database")
        ) {
          const match1 = /Table '([^']+)' doesn't exist/i.exec(errorMessage);
          const match2 = /table `([^`]+)`\.`([^`]+)` was not found/i.exec(errorMessage);
          const msg = match1 
            ? `Table '${match1[1]}' does not exist` 
            : (match2 ? `Table '${match2[1]}.${match2[2]}' does not exist` : "Table does not exist");
          return formatHandlerErrorResponse(
            new MySQLMcpError(msg, "QUERY_ERROR", ErrorCategory.QUERY, {
              suggestion: "Verify the table name and schema.",
            })
          );
        }
        if (
          errorMessage.includes("1049") ||
          errorMessage.includes("Unknown database")
        ) {
          const match = /Unknown database '([^']+)'/i.exec(errorMessage);
          const msg = match ? `Database '${match[1]}' does not exist` : "Database does not exist";
          return formatHandlerErrorResponse(
            new MySQLMcpError(msg, "QUERY_ERROR", ErrorCategory.QUERY, {
              suggestion: "Verify the schema (database) name.",
            })
          );
        }
        if (errorMessage.includes("1054") || errorMessage.includes("Unknown column")) {
          const match = /Unknown column '([^']+)'/i.exec(errorMessage);
          const msg = match ? `Column '${match[1]}' not found` : "Column not found";
          return formatHandlerErrorResponse(
            new MySQLMcpError(msg, "QUERY_ERROR", ErrorCategory.QUERY, {
              suggestion: "Verify the column name in your query.",
            })
          );
        }
        if (errorMessage.includes("1064") || errorMessage.includes("syntax error")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(`SQL syntax error: ${errorMessage}`, "QUERY_ERROR", ErrorCategory.QUERY, {
              suggestion: "Check your SQL syntax.",
            })
          );
        }

        return formatHandlerErrorResponse(error);
      }
    },
  };
}

/**
 * Import JSON documents
 */
export function createShellImportJSONTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysqlsh_import_json",
    title: "MySQL Shell Import JSON",
    description:
      "Import JSON documents from a file using util.importJson(). Supports NDJSON (one JSON object per line) and multi-line JSON objects (not JSON arrays). REQUIRES X Protocol (port 33060).",
    group: "shell",
    inputSchema: ShellImportJSONInputSchemaBase,
    outputSchema: ShellImportJSONOutputSchema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false,
      sensitiveHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const {
          inputPath,
          inputUrl,
          schema,
          collection,
          tableColumn,
          convertBsonTypes,
        } = ShellImportJSONInputSchema.parse(params);
        const config = getShellConfig();

        const finalInputPath = inputPath ?? inputUrl;
        if (!finalInputPath) {
          throw new ValidationError("inputPath or inputUrl is required");
        }

        assertSafeIoPath(finalInputPath, adapter.getAllowedIoRoots());

        const resolvedPath = path.resolve(finalInputPath);
        
        if (!fs.existsSync(resolvedPath)) {
          throw new MySQLMcpError(
            `Cannot open file '${resolvedPath}': No such file or directory`,
            "QUERY_ERROR",
            ErrorCategory.QUERY,
            { details: { protocol: "X Protocol" } }
          );
        }

        const escapedPath = resolvedPath.replace(/\\/g, "\\\\");

        const options: string[] = [];
        if (schema) {
          options.push(`schema: "${schema}"`);
        }

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
          throw new MySQLMcpError(
            `X Protocol connection failed: ${errorMessage}.`,
            "CONNECTION_ERROR",
            ErrorCategory.CONNECTION,
            {
              suggestion: `Ensure MySQL X Plugin is enabled (port ${process.env["MYSQL_XPORT"] ?? "33060"}) and the user has access. Check: SHOW PLUGINS LIKE 'mysqlx';`,
              details: { protocol: "X Protocol" },
            }
          );
        }

        // Check for X Protocol access denied errors in stderr
        if (
          result.stderr.includes("Access denied") ||
          result.stderr.includes("1045")
        ) {
          throw new MySQLMcpError(
            `X Protocol authentication failed.`,
            "AUTHENTICATION_ERROR",
            ErrorCategory.AUTHENTICATION,
            {
              suggestion: `The user may not have access via X Protocol (port ${process.env["MYSQL_XPORT"] ?? "33060"}). Verify: 1) X Plugin is enabled, 2) User has proper grants, 3) Authentication plugin is compatible (mysql_native_password or caching_sha2_password).`,
              details: { protocol: "X Protocol" },
            }
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
              throw new MySQLMcpError(
                parsed.error ?? "Unknown MySQL Shell error",
                "QUERY_ERROR",
                ErrorCategory.QUERY,
                { details: { protocol: "X Protocol" } }
              );
            }
            return withTokenEstimate({
              success: true,
              data: {
                inputPath: finalInputPath,
                schema,
                collection,
                protocol: "X Protocol",
                result: parsed.result,
              },
            });
          }
        }

        if (result.exitCode !== 0) {
          const stderrText = (result.stderr || result.stdout || "MySQL Shell import failed")
            .replace(/WARNING: Using a password on the command line interface can be insecure\.\s*/gi, "")
            .trim() || "MySQL Shell import failed";
          
          if (stderrText.includes("MySQL Error 2006") || stderrText.includes("server has gone away")) {
            throw new MySQLMcpError(
              stderrText,
              "CONNECTION_ERROR",
              ErrorCategory.CONNECTION,
              { details: { protocol: "X Protocol" }, recoverable: true }
            );
          }

          throw new MySQLMcpError(
            stderrText,
            "QUERY_ERROR",
            ErrorCategory.QUERY,
            { details: { protocol: "X Protocol" } }
          );
        }

        return withTokenEstimate({
          success: true,
          data: {
            inputPath: finalInputPath,
            schema,
            collection,
            protocol: "X Protocol",
            result: { raw: result.stdout },
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
