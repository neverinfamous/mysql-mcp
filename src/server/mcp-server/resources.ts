import type { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import type { McpServer } from "./mcp-server.js";
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
export function registerHelpResources(server: McpServer): void {
  const sdkServer = server.getSdkServer();

  sdkServer.registerResource(
    "mysql_help",
    "mysql://help",
    {
      description: "Directory of all available tool groups and tools",
      mimeType: "application/json",
    },
    () => {
      metrics.recordResourceRead("mysql://help");

      const toolFilter = server.getToolFilter();
      let enabledGroups = getEnabledGroups(toolFilter.enabledTools);
      
      // If Code Mode is enabled, it exposes the full API surface area via the sandbox,
      // so we must register all help resources for the agent to reference.
      if (enabledGroups.has("codemode")) {
        const allGroups = new Set<ToolGroup>();
        for (const group of Object.keys(TOOL_GROUPS)) {
          allGroups.add(group as ToolGroup);
        }
        enabledGroups = allGroups;
      }

      const groups: Record<string, { tools: string[] }> = {};
      
      // Gather actual tools dynamically from adapters
      for (const adapter of server.getAdapters().values()) {
        const tools = adapter.getToolDefinitions();
        for (const tool of tools) {
          if (!toolFilter.enabledTools.has(tool.name) && !enabledGroups.has("codemode")) continue;
          
          let toolGroup = "core";
          for (const [g, groupTools] of Object.entries(TOOL_GROUPS)) {
            if (groupTools.includes(tool.name)) {
              toolGroup = g;
              break;
            }
          }
          
          if (toolGroup === "codemode") continue;
          
          groups[toolGroup] ??= { tools: [] };
          groups[toolGroup]?.tools.push(tool.name);
        }
      }

      // Ensure 'gotchas' is included
      groups["gotchas"] = { tools: [] };

      return {
        contents: [
          {
            uri: "mysql://help",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                description: "List of available tool groups. Read mysql://help/{group} for specific tool documentation.",
                groups: Object.keys(groups),
                _meta: { groups }
              },
              null,
              2
            ),
          },
        ],
      };
    },
  );

  const template = new ResourceTemplate("mysql://help/{group}", { list: undefined });
  sdkServer.registerResource(
    "mysql_help_group",
    template,
    {
      description: "Specific documentation for a tool group",
      mimeType: "application/json",
    },
    (uri: URL, variables: Variables) => {
      const group = variables["group"] as string;
      metrics.recordResourceRead(`mysql://help/${group}`);
      
      const content = HELP_CONTENT.get(group);
      
      if (!content) {
        throw new Error(`Help group '${group}' not found`);
      }

      const toolFilter = server.getToolFilter();
      let enabledGroups = getEnabledGroups(toolFilter.enabledTools);
      if (enabledGroups.has("codemode")) {
        const allGroups = new Set<ToolGroup>();
        for (const g of Object.keys(TOOL_GROUPS)) {
          allGroups.add(g as ToolGroup);
        }
        enabledGroups = allGroups;
      }

      if (group !== "gotchas" && !enabledGroups.has(group as ToolGroup)) {
        throw new Error(`Help group '${group}' is disabled`);
      }

      const toolSchemas: unknown[] = [];
      if (group !== "gotchas") {
        const groupToolNames = (TOOL_GROUPS as Record<string, string[]>)[group] ?? [];
        for (const adapter of server.getAdapters().values()) {
          const tools = adapter.getToolDefinitions();
          for (const tool of tools) {
            if (groupToolNames.includes(tool.name)) {
              if (toolFilter.enabledTools.has(tool.name) || enabledGroups.has("codemode")) {
                toolSchemas.push({
                  name: tool.name,
                  description: tool.description,
                  inputSchema: ('~standard' in (tool.inputSchema as any))
                    ? (tool.inputSchema as any)['~standard'].jsonSchema.input()
                    : (tool.inputSchema as { toJSONSchema: () => unknown }).toJSONSchema(),
                  ...(tool.outputSchema 
                    ? { outputSchema: ('~standard' in (tool.outputSchema as any))
                        ? (tool.outputSchema as any)['~standard'].jsonSchema.output()
                        : (tool.outputSchema as { toJSONSchema: () => unknown }).toJSONSchema() } 
                    : {})
                });
              }
            }
          }
        }
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                group,
                documentation: content,
                tools: toolSchemas
              },
              null,
              2
            ),
          },
        ],
      };
    },
  );

  logger.info("Help resources: mysql://help, mysql://help/{group}");
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
