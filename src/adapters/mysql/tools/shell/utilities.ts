/**
 * MySQL Shell - Utility Tools
 *
 * Tools for server maintenance and upgrade compatibility checking.
 */

import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { ShellCheckUpgradeInputSchema } from "../../types/shell-types.js";
import { getShellConfig, escapeForJS, execShellJS } from "./common.js";

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
    inputSchema: ShellCheckUpgradeInputSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
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

      const jsCode = `return util.checkForServerUpgrade("${escapedUri}", { ${options.join(", ")} });`;

      let result;
      try {
        result = await execShellJS(jsCode, { timeout: 120000 });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return { success: false, error: errorMessage };
      }

      // Parse the upgrade check result
      // util.checkForServerUpgrade returns { errorCount, warningCount, noticeCount, ... }
      if (
        result !== null &&
        result !== undefined &&
        typeof result === "object"
      ) {
        const checkResult = result as {
          errorCount?: number;
          warningCount?: number;
          noticeCount?: number;
          checksPerformed?: unknown[];
          targetVersion?: string;
          serverVersion?: string;
        };

        return {
          success: true,
          targetVersion: checkResult.targetVersion ?? targetVersion,
          serverVersion: checkResult.serverVersion,
          errorCount: checkResult.errorCount ?? 0,
          warningCount: checkResult.warningCount ?? 0,
          noticeCount: checkResult.noticeCount ?? 0,
          checksPerformed: checkResult.checksPerformed?.length ?? 0,
          upgradeCheck:
            outputFormat === "TEXT"
              ? "Use outputFormat: JSON for detailed results"
              : checkResult,
        };
      }

      return {
        success: true,
        targetVersion: targetVersion ?? "latest",
        errorCount: 0,
        warningCount: 0,
        noticeCount: 0,
        upgradeCheck: result,
      };
    },
  };
}
