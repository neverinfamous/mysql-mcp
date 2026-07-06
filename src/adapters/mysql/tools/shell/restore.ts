/**
 * MySQL Shell - Restore and Scripting Tools
 *
 * Tools for restoring dumps and running custom scripts.
 */

import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { ZodError } from "zod";
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
  ShellLoadDumpInputSchema,
  ShellLoadDumpInputSchemaBase,
  ShellRunScriptInputSchema,
  ShellRunScriptInputSchemaBase,
  ShellLoadDumpOutputSchema,
  ShellRunScriptOutputSchema,
} from "../../schemas/shell/index.js";
import { getShellConfig, execShellJS, execMySQLShell } from "./common.js";

/**
 * Load dump to instance
 */
export function createShellLoadDumpTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysqlsh_load_dump",
    title: "MySQL Shell Load Dump",
    description:
      "Load a MySQL Shell dump using util.loadDump(). Restores data from a dump created by dumpInstance, dumpSchemas, or dumpTables. Supports parallel loading.",
    group: "shell",
    inputSchema: ShellLoadDumpInputSchemaBase,
    outputSchema: ShellLoadDumpOutputSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false,
      sensitiveHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const {
          inputDir,
          inputUrl,
          dumpDir,
          threads,
          dryRun,
          includeSchemas,
          excludeSchemas,
          includeTables,
          excludeTables,
          ignoreExistingObjects,
          ignoreVersion,
          resetProgress,
          updateServerSettings,
        } = ShellLoadDumpInputSchema.parse(params);

        const finalInputDir = inputDir ?? inputUrl ?? dumpDir;
        if (!finalInputDir) {
          throw new ValidationError("inputDir or inputUrl is required");
        }

        if (!dryRun) {
          assertSafeIoPath(finalInputDir, adapter.getAllowedIoRoots(), false);
        }

        const resolvedPath = resolve(finalInputDir);
        const escapedPath = resolvedPath.replace(/\\/g, "\\\\");

        const options: string[] = [];
        if (threads) {
          options.push(`threads: ${threads}`);
        }
        if (dryRun) {
          options.push("dryRun: true");
        }
        if (includeSchemas && includeSchemas.length > 0) {
          options.push(`includeSchemas: ${JSON.stringify(includeSchemas)}`);
        }
        if (excludeSchemas && excludeSchemas.length > 0) {
          options.push(`excludeSchemas: ${JSON.stringify(excludeSchemas)}`);
        }
        if (includeTables && includeTables.length > 0) {
          options.push(`includeTables: ${JSON.stringify(includeTables)}`);
        }
        if (excludeTables && excludeTables.length > 0) {
          options.push(`excludeTables: ${JSON.stringify(excludeTables)}`);
        }
        if (ignoreExistingObjects) {
          options.push("ignoreExistingObjects: true");
        }
        if (ignoreVersion) {
          options.push("ignoreVersion: true");
        }
        if (resetProgress) {
          options.push("resetProgress: true");
        }

        const optionsStr =
          options.length > 0 ? `, { ${options.join(", ")} }` : "";

        // Build JavaScript code that optionally enables local_infile
        let jsCode: string;
        if (updateServerSettings) {
          jsCode = `
                      session.runSql("SET GLOBAL local_infile = ON");
                      return util.loadDump("${escapedPath}"${optionsStr});
                  `;
        } else {
          jsCode = `return util.loadDump("${escapedPath}"${optionsStr});`;
        }

        if (dryRun) {
          // For dry runs, use execMySQLShell directly to capture stderr
          // where MySQL Shell outputs the summary of what would be loaded
          const config = getShellConfig();
          const dryRunJsCode = `
            var __result__;
            try {
                __result__ = (function() { ${jsCode} })();
                print(JSON.stringify({ success: true, result: __result__ }));
            } catch (e) {
                print(JSON.stringify({ success: false, error: e.message }));
            }
          `;
          const rawResult = await execMySQLShell(
            ["--uri", config.connectionUri, "--js", "-e", dryRunJsCode],
            { timeout: 3600000 },
          );

          // Parse stderr for dry run summary, filtering out common warnings
          const stderrClean = rawResult.stderr
            .replace(
              /WARNING: Using a password on the command line interface can be insecure\.\s*/gi,
              "",
            )
            .trim();

          // Check for errors in the JSON output
          const lines = rawResult.stdout.trim().split("\n");
          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            if (!line) continue;
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith("{")) {
              let parsed: {
                success: boolean;
                result?: unknown;
                error?: string;
              };
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
                const errorMessage =
                  typeof parsed.error === "string"
                    ? parsed.error
                    : "Unknown MySQL Shell error";
                if (
                  errorMessage.includes("local_infile") ||
                  errorMessage.includes("Loading local data is disabled")
                ) {
                  throw new MySQLMcpError(
                    "Load failed: local_infile is disabled on the server.",
                    "CONFIGURATION_ERROR",
                    ErrorCategory.CONFIGURATION,
                    { suggestion: "Set updateServerSettings: true (requires SUPER or SYSTEM_VARIABLES_ADMIN privilege), or manually run: SET GLOBAL local_infile = ON" }
                  );
                }
                if (errorMessage.includes("Duplicate objects")) {
                  throw new MySQLMcpError(
                    errorMessage,
                    "CONFLICT_ERROR",
                    ErrorCategory.QUERY,
                    { suggestion: "Use ignoreExistingObjects: true to skip existing objects" }
                  );
                }
                throw new MySQLMcpError(
                  errorMessage,
                  "QUERY_ERROR",
                  ErrorCategory.QUERY
                );
              }
              break;
            }
          }

          return withTokenEstimate({
            success: true,
            data: {
              inputDir: finalInputDir,
              dryRun: true,
              localInfileEnabled: updateServerSettings,
              dryRunOutput: stderrClean || undefined,
            },
          });
        }

        const result = await execShellJS(jsCode, { timeout: 3600000 });
        return withTokenEstimate({
          success: true,
          data: {
            inputDir: finalInputDir,
            dryRun: false,
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
              "Load failed: local_infile is disabled on the server.",
              "CONFIGURATION_ERROR",
              ErrorCategory.CONFIGURATION,
              { suggestion: "Set updateServerSettings: true (requires SUPER or SYSTEM_VARIABLES_ADMIN privilege), or manually run: SET GLOBAL local_infile = ON" }
            )
          );
        }
        if (errorMessage.includes("Duplicate objects")) {
          return formatHandlerErrorResponse(
            new MySQLMcpError(
              errorMessage,
              "CONFLICT_ERROR",
              ErrorCategory.QUERY,
              { suggestion: "Use ignoreExistingObjects: true to skip existing objects" }
            )
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createShellRunScriptTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysqlsh_run_script",
    title: "MySQL Shell Run Script",
    description:
      "Execute a JavaScript, Python, or SQL script via MySQL Shell. Provides access to X DevAPI, AdminAPI, and all MySQL Shell features. NOTE: The script executes inside the MySQL Shell process, so file access inside the script is not restricted by allowedIoRoots. Use carefully.",
    group: "shell",
    inputSchema: ShellRunScriptInputSchemaBase,
    outputSchema: ShellRunScriptOutputSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false,
      sensitiveHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { script, scriptPath, language, dryRun, timeout } =
          ShellRunScriptInputSchema.parse(params);
        const config = getShellConfig();

        // Build command based on language
        let langFlag: string;
        switch (language) {
          case "js":
          case "javascript":
            langFlag = "--js";
            break;
          case "py":
          case "python":
            langFlag = "--py";
            break;
          case "sql":
            langFlag = "--sql";
            break;
          default:
            return withTokenEstimate({
              success: false,
              error: "Invalid language",
            });
        }

        if (scriptPath) {
          assertSafeIoPath(scriptPath, adapter.getAllowedIoRoots(), false);
          try {
            await fs.access(scriptPath);
          } catch {
            throw new MySQLMcpError(
              `Script file not found: ${scriptPath}`,
              "VALIDATION_ERROR",
              ErrorCategory.VALIDATION
            );
          }
        }

        if (dryRun) {
          return withTokenEstimate({
            success: true,
            data: {
              language,
              exitCode: 0,
              stdout: "Dry run successful",
              stderr: "",
            },
          });
        }

        let result;
        if (scriptPath) {
          const args = ["--uri", config.connectionUri, langFlag, "--file", scriptPath];
          result = await execMySQLShell(args, { timeout });
        } else if (language === "sql") {
          // SQL scripts with comments or multi-line content break when passed via -e
          // Use --file approach for SQL to properly handle all syntax
          // Create a secure temp directory via mkdtemp (restrictive permissions,
          // unique path) to avoid CodeQL js/insecure-temporary-file alert.
          const tempDir = await fs.mkdtemp(join(tmpdir(), `mysqlsh_script_`));
          const tempFile = join(tempDir, "script.sql");
          try {
            await fs.writeFile(tempFile, script, "utf8");
            const args = [
              "--uri",
              config.connectionUri,
              langFlag,
              "--file",
              tempFile,
            ];
            result = await execMySQLShell(args, { timeout });
          } finally {
            // Cleanup temp directory and its contents
            await fs.rm(tempDir, { recursive: true }).catch(() => void 0);
          }
        } else {
          // JS and Python work fine with -e
          const args = ["--uri", config.connectionUri, langFlag, "-e", script];
          result = await execMySQLShell(args, { timeout });
        }

        if (result.exitCode !== 0) {
          throw new MySQLMcpError(
            result.stderr
              ? result.stderr.trim()
              : `Script failed with exit code ${result.exitCode}`,
            "QUERY_ERROR",
            ErrorCategory.QUERY,
            { details: {
                language,
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
            } }
          );
        }

        return withTokenEstimate({
          success: true,
          data: {
            language,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
          },
        });
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}
