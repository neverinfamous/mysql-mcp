import type { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HELP_CONTENT } from "../../constants/server-instructions.js";
import { TOOL_GROUPS } from "../../filtering/tool-constants.js";
import { getEnabledGroups } from "../../filtering/tool-filter.js";
import { metrics } from "../../observability/metrics.js";
import { logger } from "../../utils/logger.js";
import type { ToolGroup } from "../../types/index.js";
import type { AuditLogger } from "../../audit/logger.js";
import type { BackupManager } from "../../audit/backup-manager/index.js";

/**
 * Register mysql://help resources for on-demand reference documentation.
 * Always registers mysql://help (gotchas). Group-specific help is filtered
 * by the tool filter configuration.
 */
export function registerHelpResources(server: SdkMcpServer, enabledTools: Set<string>): void {
  // Always register mysql://help (gotchas + code mode + aliases)
  const gotchasContent = HELP_CONTENT.get("gotchas");
  if (gotchasContent) {
    server.registerResource(
      "mysql_help",
      "mysql://help",
      {
        description:
          "Critical gotchas, parameter aliases, and Code Mode API reference",
        mimeType: "text/markdown",
      },
      () => {
        metrics.recordResourceRead("mysql://help");
        return {
          contents: [
            {
              uri: "mysql://help",
              mimeType: "text/markdown",
              text: gotchasContent,
            },
          ],
        };
      },
    );
  }

  // Derive enabled groups from enabled tools
  const enabledGroups = getEnabledGroups(enabledTools);

  // If Code Mode is enabled, it exposes the full API surface area via the sandbox,
  // so we must register all help resources for the agent to reference.
  if (enabledGroups.has("codemode")) {
    for (const group of Object.keys(TOOL_GROUPS)) {
      enabledGroups.add(group as ToolGroup);
    }
  }

  // Register group-specific help resources based on tool filter
  const groupHelpKeys: { group: ToolGroup; key: string }[] = [
    { group: "core", key: "core" },
    { group: "json", key: "json" },
    { group: "transactions", key: "transactions" },
    { group: "text", key: "text" },
    { group: "fulltext", key: "fulltext" },
    { group: "stats", key: "stats" },
    { group: "spatial", key: "spatial" },
    { group: "admin", key: "admin" },
    { group: "monitoring", key: "monitoring" },
    { group: "performance", key: "performance" },
    { group: "optimization", key: "optimization" },
    { group: "backup", key: "backup" },
    { group: "replication", key: "replication" },
    { group: "partitioning", key: "partitioning" },
    { group: "schema", key: "schema" },
    { group: "introspection", key: "introspection" },
    { group: "migration", key: "migration" },
    { group: "events", key: "events" },
    { group: "sysschema", key: "sysschema" },
    { group: "security", key: "security" },
    { group: "roles", key: "roles" },
    { group: "docstore", key: "docstore" },
    { group: "cluster", key: "cluster" },
    { group: "proxysql", key: "proxysql" },
    { group: "router", key: "router" },
    { group: "shell", key: "shell" },
    { group: "vector", key: "vector" },
  ];

  for (const { group, key } of groupHelpKeys) {
    if (!enabledGroups.has(group)) continue;

    const content = HELP_CONTENT.get(key);
    if (!content) continue;

    server.registerResource(
      `mysql_help_${key}`,
      `mysql://help/${key}`,
      {
        description: `Tool reference for the ${group} tool group`,
        mimeType: "text/markdown",
      },
      () => {
        metrics.recordResourceRead(`mysql://help/${key}`);
        return {
          contents: [
            {
              uri: `mysql://help/${key}`,
              mimeType: "text/markdown",
              text: content,
            },
          ],
        };
      },
    );
  }

  // Log registered help resources
  const registeredHelp = ["mysql://help"];
  for (const { group, key } of groupHelpKeys) {
    if (enabledGroups.has(group)) {
      registeredHelp.push(`mysql://help/${key}`);
    }
  }
  logger.info(`Help resources: ${registeredHelp.join(", ")}`);
}

/**
 * Register mysql://audit resource for forensic trail and snapshots.
 */
export function registerAuditResource(server: SdkMcpServer, auditLogger: AuditLogger | null, backupManager: BackupManager | null): void {
  if (!auditLogger) return;

  server.registerResource(
    "mysql_audit",
    "mysql://audit",
    {
      description:
        "Recent forensic audit trail and pre-mutation snapshot stats",
      mimeType: "application/json",
    },
    async () => {
      metrics.recordResourceRead("mysql://audit");
      if (auditLogger === null) return { contents: [] };

      const recent = await auditLogger.recent(100);
      const backupStats = backupManager !== null
        ? await backupManager.getStats()
        : undefined;

      let tokenEstimate = 0;
      let errors = 0;
      const tools: Record<string, number> = {};

      for (const entry of recent) {
        if (entry.tokenEstimate != null) tokenEstimate += entry.tokenEstimate;
        if (!entry.success) errors++;
        tools[entry.tool] = (tools[entry.tool] ?? 0) + 1;
      }

      const summary = {
        entries: recent.length,
        errors,
        tokenEstimate,
        topTools: Object.entries(tools)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count })),
        ...(backupStats && { backups: backupStats }),
      };

      return {
        contents: [
          {
            uri: "mysql://audit",
            mimeType: "application/json",
            text: JSON.stringify({ summary, recent }, null, 2),
          },
        ],
      };
    },
  );
  logger.info("Registered audit resource: mysql://audit");
}

/**
 * Register mysql://metrics resource for in-memory telemetry
 */
export function registerObservabilityResource(server: SdkMcpServer): void {
  server.registerResource(
    "mysql_metrics",
    "mysql://metrics",
    {
      description: "In-memory streaming metrics including p50/p95/p99 latency and token usage",
      mimeType: "application/json",
    },
    () => {
      metrics.recordResourceRead("mysql://metrics");
      const summary = metrics.getSummary();
      return {
        contents: [
          {
            uri: "mysql://metrics",
            mimeType: "application/json",
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    },
  );
  logger.info("Registered observability resource: mysql://metrics");
}
