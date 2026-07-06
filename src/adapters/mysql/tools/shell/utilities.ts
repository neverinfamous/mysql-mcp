/**
 * MySQL Shell - Utility Tools
 *
 * Tools for server maintenance and upgrade compatibility checking.
 */

import { ZodError } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { ShellCheckUpgradeInputSchema, ShellCheckUpgradeInputSchemaBase, ShellCheckUpgradeOutputSchema } from "../../schemas/shell/index.js";
import { getShellConfig, escapeForJS, execMySQLShell } from "./common.js";

/**
 * Check server upgrade compatibility
 */
export function createShellCheckUpgradeTool(): ToolDefinition {
  return {
    name: "mysqlsh_check_upgrade",
    title: "MySQL Shell Check Upgrade",
    description:
      "Check MySQL server upgrade compatibility using util.checkForServerUpgrade(). Identifies potential issues before upgrading to a newer MySQL version.",
    group: "shell",
    inputSchema: ShellCheckUpgradeInputSchemaBase,
    outputSchema: ShellCheckUpgradeOutputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      destructiveHint: false,
      sensitiveHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { targetVersion, outputFormat } =
          ShellCheckUpgradeInputSchema.parse(params);
        const config = getShellConfig();

        // Use connection URI string instead of session object
        // The util.checkForServerUpgrade() accepts a URI string as first arg
        const escapedUri = escapeForJS(config.connectionUri);

        // Force JSON output format to ensure parseable results
        const options: string[] = ['outputFormat: "JSON"'];
        if (targetVersion) {
          options.push(`targetVersion: "${targetVersion}"`);
        }

        const jsCode = `util.checkForServerUpgrade("${escapedUri}", { ${options.join(", ")} });`;

        let rawResult;
        try {
          rawResult = await execMySQLShell(
            ["--uri", config.connectionUri, "--js", "-e", jsCode],
            { timeout: 120000 }
          );
          if (rawResult.exitCode !== 0) {
            const errorMsg = (rawResult.stderr || rawResult.stdout || "MySQL Shell command failed")
              .replace(/WARNING: Using a password on the command line interface can be insecure\.\s*/gi, "")
              .trim() || "MySQL Shell command failed";
            throw new Error(errorMsg);
          }
        } catch (error) {
          return formatHandlerErrorResponse(error);
        }

        // Try to parse the upgrade check result from stdout
        let checkResult: unknown;
        if (rawResult?.stdout) {
          try {
            // Find the start of the JSON object in case there are warnings
            const stdoutStr = rawResult.stdout.trim();
            const jsonStart = stdoutStr.indexOf('{');
            if (jsonStart !== -1) {
              const jsonStr = stdoutStr.substring(jsonStart);
              checkResult = JSON.parse(jsonStr) as unknown;
            }
          } catch {
            // parsing failed, checkResult remains undefined
          }
        }

        if (checkResult !== undefined && typeof checkResult === "object" && checkResult !== null) {
          const typedResult = checkResult as {
            errorCount?: number;
            warningCount?: number;
            noticeCount?: number;
            checksPerformed?: { status?: string; detectedProblems?: unknown[]; description?: string }[];
            targetVersion?: string;
            serverVersion?: string;
          };

          if (typedResult.checksPerformed !== undefined && Array.isArray(typedResult.checksPerformed)) {
            typedResult.checksPerformed = typedResult.checksPerformed.filter(check => {
              const hasProblems = check.detectedProblems !== undefined && Array.isArray(check.detectedProblems) && check.detectedProblems.length > 0;
              
              if (hasProblems && outputFormat !== "TEXT") {
                const allProblems = check.detectedProblems as { level?: string }[];
                const errorsOnly = allProblems.filter(p => p.level === "Error");
                
                if (allProblems.length > errorsOnly.length) {
                   check.detectedProblems = errorsOnly;
                   const omitted = allProblems.length - errorsOnly.length;
                   check.description = (check.description ?? "") + ` [NOTE: ${omitted} Warnings/Notices omitted to save context space. Use outputFormat: "TEXT" to view them.]`;
                }
              }

              return check.status !== "OK" || hasProblems;
            });
          }

          return withTokenEstimate({
            success: true,
            data: {
              targetVersion: typedResult.targetVersion ?? targetVersion,
              serverVersion: typedResult.serverVersion,
              errorCount: typedResult.errorCount ?? 0,
              warningCount: typedResult.warningCount ?? 0,
              noticeCount: typedResult.noticeCount ?? 0,
              checksPerformed: typedResult.checksPerformed?.length ?? 0,
              upgradeCheck:
                outputFormat === "TEXT"
                  ? "Use outputFormat: JSON for detailed results"
                  : typedResult,
            },
          });
        }

        return withTokenEstimate({
          success: true,
          data: {
            targetVersion: targetVersion ?? "latest",
            errorCount: 0,
            warningCount: 0,
            noticeCount: 0,
            upgradeCheck: rawResult?.stdout,
          },
        });
      } catch (error) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}
