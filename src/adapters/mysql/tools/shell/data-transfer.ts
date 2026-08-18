/**
 * MySQL Shell - Data Transfer Tools
 *
 * Tools for importing and exporting data using MySQL Shell utilities.
 */

import { ZodError } from "zod";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
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
  mapHostPathToContainer,
  getWorkspaceRoot,
  ANSI_ESCAPE_REGEX,
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
      idempotentHint: true,
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

        const hostResolvedPath = path.resolve(finalOutputPath);
        const targetDir = path.dirname(hostResolvedPath);
        if (!fs.existsSync(targetDir)) {
          throw new MySQLMcpError(
            `Output directory does not exist.`,
            "VALIDATION_ERROR",
            ErrorCategory.VALIDATION,
            { suggestion: "Ensure the directory for the output file exists.", details: { outputDir: targetDir } }
          );
        }
        
        const resolvedPath = mapHostPathToContainer(finalOutputPath).replace(/\\/g, "/");
        const escapedPath = escapeForJS(resolvedPath);

        const options: string[] = [];
        if (format === "csv") {
          options.push('fieldsTerminatedBy: ","');
          options.push('fieldsEnclosedBy: \'"\'');
        }
        // TSV is the default for util.exportTable(), no special options needed
        if (where) {
          options.push(`where: "${escapeForJS(where)}"`);
        }

        const optionsStr =
          options.length > 0 ? `, { ${options.join(", ")} }` : "";
        const target = schema ? JSON.stringify(`${schema}.${table}`) : JSON.stringify(table);
        const jsCode = `return util.exportTable(${target}, "${escapedPath}"${optionsStr});`;

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
          const match = /MySQL Error \d+ \(\d+\): (.*)/i.exec(errorMessage) ?? /syntax error[^:]*:?(.*)/i.exec(errorMessage);
          const msg = match?.[1] ? match[1].trim() : errorMessage.replace(ANSI_ESCAPE_REGEX, "").substring(0, 200);
          return formatHandlerErrorResponse(
            new MySQLMcpError(`SQL syntax error: ${msg}`, "QUERY_ERROR", ErrorCategory.QUERY, {
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
          fieldsEnclosedBy,
          linesTerminatedBy,
          updateServerSettings,
        } = ShellImportTableInputSchema.parse(params);

        const finalInputPath = inputPath ?? inputUrl;
        if (!finalInputPath) {
          throw new ValidationError("inputPath or inputUrl is required");
        }

        assertSafeIoPath(finalInputPath, adapter.getAllowedIoRoots(), false);

        const hostResolvedPath = path.resolve(finalInputPath);
        if (!fs.existsSync(hostResolvedPath)) {
          throw new MySQLMcpError(
            `Input file does not exist.`,
            "VALIDATION_ERROR",
            ErrorCategory.VALIDATION,
            { suggestion: "Ensure the input file exists and the path is correct.", details: { inputPath: finalInputPath } }
          );
        }

        const resolvedPath = mapHostPathToContainer(finalInputPath).replace(/\\/g, "/");
        const escapedPath = escapeForJS(resolvedPath);

        const options: string[] = [];
        if (schema) {
          options.push(`schema: ${JSON.stringify(schema)}`);
        }
        options.push(`table: ${JSON.stringify(table)}`);
        if (threads !== undefined) {
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
        if (fieldsEnclosedBy) {
          options.push(
            `fieldsEnclosedBy: ${JSON.stringify(fieldsEnclosedBy)}`,
          );
        }
        if (linesTerminatedBy) {
          options.push(
            `linesTerminatedBy: ${JSON.stringify(linesTerminatedBy)}`,
          );
        }

        // Build JavaScript code that optionally enables local_infile
        let jsCode: string;
        const setLocalInfileClient = `
          try { shell.options.set("localInfile", true); } catch(e) {}
          try { shell.options['localInfile'] = true; } catch(e) {}
        `;
        if (updateServerSettings) {
          jsCode = `
                      session.runSql("SET GLOBAL local_infile = ON");
                      ${setLocalInfileClient}
                      return util.importTable("${escapedPath}", { ${options.join(", ")} });
                  `;
        } else {
          jsCode = `
                      ${setLocalInfileClient}
                      return util.importTable("${escapedPath}", { ${options.join(", ")} });
                  `;
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
          errorMessage.includes("--super-read-only") ||
          errorMessage.includes("--read-only")
        ) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              "The MySQL server is running in read-only mode (likely a replica). Switch to a primary node for write operations.",
              "AUTHORIZATION_ERROR",
              ErrorCategory.AUTHORIZATION,
              { suggestion: "Execute writes against the primary node, or use the router's R/W port instead of the R/O port." }
            )
          );
        }

        if (
          errorMessage.includes("Loading local data is disabled") ||
          errorMessage.includes("Unsupported 'LOAD DATA LOCAL INFILE'") ||
          errorMessage.includes("local_infile")
        ) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              "Import failed: local_infile is disabled on the server or client, or you are connected via ProxySQL.",
              "CONFIGURATION_ERROR",
              ErrorCategory.CONFIGURATION,
              { suggestion: "Set updateServerSettings: true (requires SUPER), manually run: SET GLOBAL local_infile = ON, or ensure you are connecting directly to MySQL (ProxySQL does not support LOAD DATA LOCAL INFILE)." }
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
          const match = /MySQL Error \d+ \(\d+\): (.*)/i.exec(errorMessage) ?? /syntax error[^:]*:?(.*)/i.exec(errorMessage);
          const msg = match?.[1] ? match[1].trim() : errorMessage.replace(ANSI_ESCAPE_REGEX, "").substring(0, 200);
          return formatHandlerErrorResponse(
            new MySQLMcpError(`SQL syntax error: ${msg}`, "QUERY_ERROR", ErrorCategory.QUERY, {
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

        const hostResolvedPath = path.resolve(finalInputPath);
        if (!fs.existsSync(hostResolvedPath)) {
          throw new MySQLMcpError(
            `Input file does not exist.`,
            "VALIDATION_ERROR",
            ErrorCategory.VALIDATION,
            { suggestion: "Ensure the input file exists and the path is correct.", details: { protocol: "X Protocol", inputPath: finalInputPath } }
          );
        }

        const resolvedPath = mapHostPathToContainer(finalInputPath).replace(/\\/g, "/");
        const escapedPath = escapeForJS(resolvedPath);

        const options: string[] = [];
        if (schema) {
          options.push(`schema: ${JSON.stringify(schema)}`);
        }

        if (tableColumn) {
          // Importing to a table column
          options.push(`table: ${JSON.stringify(collection)}`);
          options.push(`tableColumn: ${JSON.stringify(tableColumn)}`);
        } else {
          // Importing to a collection
          options.push(`collection: ${JSON.stringify(collection)}`);
        }

        if (convertBsonTypes) {
          options.push("convertBsonTypes: true");
        }

        const jsCode = `return util.importJson("${escapedPath}", { ${options.join(", ")} });`;

        let result;
        try {
          const wrappedCode = `
                          var __result__;
                          try {
                              __result__ = (function() { ${jsCode} })();
                              print(JSON.stringify({ success: true, result: __result__ }));
                          } catch (e) {
                              print(JSON.stringify({ success: false, error: e.message }));
                          }
                      `;
          const args = ["--uri", config.xConnectionUri, "--js"];
          if (config.dockerContainer) {
            const scratchDir = path.join(getWorkspaceRoot(), ".agents", "scratch");
            if (!fs.existsSync(scratchDir)) {
              fs.mkdirSync(scratchDir, { recursive: true });
            }
            const tempId = crypto.randomUUID();
            const tempFile = path.join(scratchDir, `mysqlsh-${tempId}.js`);
            fs.writeFileSync(tempFile, wrappedCode, "utf8");
            
            try {
              const containerPath = mapHostPathToContainer(tempFile);
              args.push("-f", containerPath);
              result = await execMySQLShell(args);
            } finally {
              try {
                fs.unlinkSync(tempFile);
              } catch {
                // Ignore
              }
            }
          } else if (process.platform !== "win32") {
            args.push("-f", "/dev/stdin");
            result = await execMySQLShell(args, { input: wrappedCode });
          } else {
            args.push("-e", wrappedCode);
            result = await execMySQLShell(args);
          }
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
              const errorMsg = parsed.error ?? "Unknown MySQL Shell error";
              if (errorMsg.includes("MySQL Error 2006") || errorMsg.includes("server has gone away") || errorMsg.includes("MySQL Error 2002") || errorMsg.includes("No connection could be made")) {
                throw new MySQLMcpError(
                  errorMsg,
                  "CONNECTION_ERROR",
                  ErrorCategory.CONNECTION,
                  { details: { protocol: "X Protocol" }, recoverable: true }
                );
              }
              throw new MySQLMcpError(
                errorMsg,
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
                result: parsed.result ?? { raw: result.stdout, stderr: result.stderr },
              },
            });
          }
        }

        if (result.exitCode !== 0) {
          const stderrText = (result.stderr || result.stdout || "MySQL Shell import failed")
            .replace(ANSI_ESCAPE_REGEX, "")
            .replace(/Cannot set LC_ALL to locale[^\n]*\n?/gi, "")
            .replace(/WARNING: Using a password on the command line interface can be insecure\.\s*/gi, "")
            .trim() || "MySQL Shell import failed";
          
          if (stderrText.includes("MySQL Error 2006") || stderrText.includes("server has gone away") || stderrText.includes("MySQL Error 2002") || stderrText.includes("No connection could be made")) {
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
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        if (
          errorMessage.includes("--super-read-only") ||
          errorMessage.includes("--read-only")
        ) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              "The MySQL server is running in read-only mode (likely a replica). Switch to a primary node for write operations.",
              "AUTHORIZATION_ERROR",
              ErrorCategory.AUTHORIZATION,
              { suggestion: "Execute writes against the primary node, or use the router's R/W port instead of the R/O port." }
            )
          );
        }

        if (
          errorMessage.includes("contains invalid bytes") ||
          errorMessage.includes("Document is missing a required field") ||
          errorMessage.includes("Premature end of input stream")
        ) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              "JSON import failed: The input file is not valid NDJSON (e.g., it is a JSON array, plain text, or malformed JSON). util.importJson() requires NDJSON (one valid JSON object per line).",
              "VALIDATION_ERROR",
              ErrorCategory.VALIDATION,
              { suggestion: "Convert the file to NDJSON (JSON Lines) format where each valid JSON object is on a new line, and ensure there are no arrays or unclosed objects." }
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
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
