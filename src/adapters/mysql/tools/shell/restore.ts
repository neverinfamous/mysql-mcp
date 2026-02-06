/**
 * MySQL Shell - Restore and Scripting Tools
 *
 * Tools for restoring dumps and running custom scripts.
 */

import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  ShellLoadDumpInputSchema,
  ShellRunScriptInputSchema,
} from "../../types/shell-types.js";
import { getShellConfig, execShellJS, execMySQLShell } from "./common.js";

/**
 * Load dump to instance
 */
export function createShellLoadDumpTool(): ToolDefinition {
  return {
    name: "mysqlsh_load_dump",
    title: "MySQL Shell Load Dump",
    description:
      "Load a MySQL Shell dump using util.loadDump(). Restores data from a dump created by dumpInstance, dumpSchemas, or dumpTables. Supports parallel loading.",
    group: "shell",
    inputSchema: ShellLoadDumpInputSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const {
        inputDir,
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

      const escapedPath = inputDir.replace(/\\/g, "\\\\");

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

      try {
        const result = await execShellJS(jsCode, { timeout: 3600000 });
        return {
          success: true,
          inputDir,
          dryRun: dryRun ?? false,
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
            `Load failed: local_infile is disabled on the server. ` +
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
 * Execute script via MySQL Shell
 */
export function createShellRunScriptTool(): ToolDefinition {
  return {
    name: "mysqlsh_run_script",
    title: "MySQL Shell Run Script",
    description:
      "Execute a JavaScript, Python, or SQL script via MySQL Shell. Provides access to X DevAPI, AdminAPI, and all MySQL Shell features.",
    group: "shell",
    inputSchema: ShellRunScriptInputSchema,
    requiredScopes: ["admin"],
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { script, language, timeout } =
        ShellRunScriptInputSchema.parse(params);
      const config = getShellConfig();

      // Build command based on language
      let langFlag: string;
      switch (language) {
        case "js":
          langFlag = "--js";
          break;
        case "py":
          langFlag = "--py";
          break;
        case "sql":
          langFlag = "--sql";
          break;
      }

      let result;
      // SQL scripts with comments or multi-line content break when passed via -e
      // Use --file approach for SQL to properly handle all syntax
      if (language === "sql") {
        const tempFile = join(
          tmpdir(),
          `mysqlsh_script_${Date.now()}_${Math.random().toString(36).slice(2)}.sql`,
        );
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
          // Cleanup temp file
          await fs.unlink(tempFile).catch(() => void 0);
        }
      } else {
        // JS and Python work fine with -e
        const args = ["--uri", config.connectionUri, langFlag, "-e", script];
        result = await execMySQLShell(args, { timeout });
      }

      return {
        success: result.exitCode === 0,
        language,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    },
  };
}
