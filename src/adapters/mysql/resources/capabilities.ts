/**
 * MySQL Resource - Capabilities
 *
 * Provides server version, available features, and tool categories.
 */
import type { MySQLAdapter } from "../MySQLAdapter.js";
import type {
  ResourceDefinition,
  RequestContext,
} from "../../../types/index.js";
import {
  TOOL_GROUPS,
  META_GROUPS,
  getMetaGroupInfo,
  getToolGroupInfo,
} from "../../../filtering/ToolFilter.js";

export function createCapabilitiesResource(
  adapter: MySQLAdapter,
): ResourceDefinition {
  return {
    uri: "mysql://capabilities",
    name: "Server Capabilities",
    title: "MySQL Server Capabilities",
    description:
      "MySQL server version, extensions, and available tool categories",
    mimeType: "application/json",
    annotations: {
      audience: ["user", "assistant"],
      priority: 0.9,
    },
    handler: async (_uri: string, _context: RequestContext) => {
      // Get server version
      const versionResult = await adapter.executeQuery(
        "SELECT VERSION() as version",
      );
      const version =
        (versionResult.rows?.[0]?.["version"] as string) ?? "unknown";

      // Get available features
      const features = {
        json: version.startsWith("5.7") || version.startsWith("8."),
        fulltext: true,
        partitioning: true,
        replication: true,
        gtid:
          version.startsWith("5.6") ||
          version.startsWith("5.7") ||
          version.startsWith("8."),
      };

      // Get tool groups and meta-groups info
      const toolGroupList = getToolGroupInfo();
      const metaGroupList = getMetaGroupInfo();

      return {
        server: {
          version,
          features,
        },
        toolCategoryCount: Object.keys(TOOL_GROUPS).length,
        metaGroupCount: Object.keys(META_GROUPS).length,
        toolGroups: toolGroupList,
        metaGroups: metaGroupList,
      };
    },
  };
}
