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
      let jsCode = `return util.checkForServerUpgrade("${escapedUri}"`;

      const options: string[] = [];
      if (targetVersion) {
        options.push(`targetVersion: "${targetVersion}"`);
      }
      if (outputFormat) {
        options.push(`outputFormat: "${outputFormat}"`);
      }

      if (options.length > 0) {
        jsCode += `, { ${options.join(", ")} }`;
      }
      jsCode += ");";

      const result = await execShellJS(jsCode, { timeout: 120000 });

      return {
        success: true,
        upgradeCheck: result,
      };
    },
  };
}
