import { ResourceTemplate } from "@modelcontextprotocol/server";
import type { McpServer as SdkMcpServer, Variables } from "@modelcontextprotocol/server";
import type { McpServer } from "./mcp-server.js";
import { HELP_CONTENT } from "../../constants/server-instructions.js";
import { TOOL_GROUPS } from "../../filtering/tool-constants.js";
import { getEnabledGroups, getToolGroup } from "../../filtering/tool-filter.js";
import { metrics } from "../../observability/metrics/index.js";
import { logger } from "../../utils/logger.js";
import type { ToolGroup } from "../../types/index.js";
import type { AuditLogger } from "../../audit/logger.js";
import type { BackupManager } from "../../audit/backup-manager/index.js";
import { extractJsonSchema, extractParameterSummary } from "./schema-extractor.js";

const GROUP_DESCRIPTIONS: Record<string, string> = {
  core: "Basic CRUD, schema operations, and query execution",
  json: "JSON data manipulation and querying",
  text: "Text string operations and manipulation",
  fulltext: "Full-text search indexing and querying",
  performance: "Performance Schema insights and tuning",
  optimization: "Query optimization and EXPLAIN analysis",
  admin: "Server administration and configuration",
  monitoring: "Server status and monitoring metrics",
  backup: "Database backup and restoration",
  replication: "Replication status and management",
  partitioning: "Table partitioning operations",
  transactions: "Transaction management and isolation levels",
  router: "MySQL Router configuration and status",
  proxysql: "ProxySQL configuration and connection pooling",
  shell: "MySQL Shell operations and script execution",
  schema: "Information Schema queries and database metadata",
  events: "Event Scheduler and scheduled tasks",
  sysschema: "Sys Schema for DBA diagnostics",
  stats: "Optimizer statistics and histogram management",
  spatial: "Geospatial data types and GIS functions",
  security: "Users, grants, and TLS configuration",
  cluster: "InnoDB Cluster and Group Replication",
  roles: "Role-based access control (RBAC)",
  docstore: "X DevAPI and Document Store",
  introspection: "Agent reflection and MCP tool metadata",
  migration: "Data import, export, and migration",
  vector: "Vector embeddings and similarity search",
  codemode: "Advanced ad-hoc scripting via Node.js sandbox",
  gotchas: "Crucial context and behavioral rules for MySQL interactions",
};

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
      const allTools = Array.from(server.getAdapters().values()).flatMap(adapter => adapter.getToolDefinitions());
      
      for (const tool of allTools) {
        if (!toolFilter.enabledTools.has(tool.name) && !enabledGroups.has("codemode")) continue;
        
        const toolGroup = getToolGroup(tool.name) ?? "core";
        
        if (toolGroup === "codemode") continue;
        
        groups[toolGroup] ??= { tools: [] };
        groups[toolGroup]?.tools.push(tool.name);
      }

      // Ensure 'gotchas' is included
      groups["gotchas"] = { tools: [] };

      // Calculate an approximate token count based on stringification
      const payloadString = JSON.stringify(groups);
      const tokenEstimate = Math.ceil(payloadString.length / 4);

      const formattedGroups = Object.keys(groups).map((groupName) => {
        const groupInfo = groups[groupName];
        return {
          name: groupName,
          description: GROUP_DESCRIPTIONS[groupName] || `Tools related to ${groupName}`,
          toolCount: groupInfo?.tools.length ?? 0,
          readOnly: false, // Could be derived from tool annotations if needed
          tools: groupInfo?.tools ?? [],
          helpUri: `mysql://help/${groupName}`,
        };
      });

      return {
        contents: [
          {
            uri: "mysql://help",
            mimeType: "application/json",
            text: JSON.stringify(
              {
                totalTools: allTools.length,
                totalGroups: formattedGroups.length,
                groups: formattedGroups,
                hint: "Read mysql://help/{group} for detailed parameter info on each tool.",
                _meta: { tokenEstimate }
              },
              null,
              2
            ),
          },
        ],
        ...{ ttlMs: 3600000, cacheScope: "public" },
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
      
      const content = HELP_CONTENT.get(group);
      
      if (!content) {
        throw new Error(`Help group '${group}' not found`);
      }

      metrics.recordResourceRead(`mysql://help/${group}`);

      const allTools = Array.from(server.getAdapters().values()).flatMap(adapter => adapter.getToolDefinitions());
      const toolFilter = server.getToolFilter();
      const codemodeEnabled = getEnabledGroups(toolFilter.enabledTools).has("codemode");

      // Find tools belonging to this group
      const groupToolsList = TOOL_GROUPS[group as keyof typeof TOOL_GROUPS] ?? [];
      const toolDefs = allTools.filter(t => groupToolsList.includes(t.name));

      const formattedTools = toolDefs.map(tool => {
        let parameters: { name: string; type: string; required: boolean; description?: string }[] = [];
        const hasOutputSchema = !!tool.outputSchema;
        
        try {
          const jsonSchema = extractJsonSchema(tool.inputSchema);
          if (jsonSchema !== null) {
            parameters = extractParameterSummary(jsonSchema);
          }
        } catch {
          // Fallback if extraction fails
        }

        // Apply codemode name rewriting if codemode is enabled
        let toolName = tool.name;
        if (codemodeEnabled && toolName.startsWith("mysql_")) {
          const camelName = toolName.slice(6).replace(/_([a-z])/g, (_, p1: string) => p1.toUpperCase());
          toolName = `mysql.${group}.${camelName}`;
        }

        return {
          name: toolName,
          title: tool.title ?? toolName,
          description: tool.description,
          parameters,
          annotations: tool.annotations ?? {},
          hasOutputSchema,
        };
      });

      const payload = {
        group,
        description: GROUP_DESCRIPTIONS[group] ?? `Documentation for ${group}`,
        toolCount: formattedTools.length,
        tools: formattedTools,
        helpContent: content,
      };

      const payloadString = JSON.stringify(payload);
      const tokenEstimate = Math.ceil(payloadString.length / 4);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                ...payload,
                _meta: { tokenEstimate }
              },
              null,
              2
            ),
          },
        ],
        ...{ ttlMs: 3600000, cacheScope: "public" },
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
        if (entry.completionTokens != null) tokenEstimate += entry.completionTokens;
        if (!entry.success) errors++;
        
        if (!entry.tool.startsWith("mysql://")) {
          tools[entry.tool] = (tools[entry.tool] ?? 0) + 1;
        }
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
        ...{ ttlMs: 0, cacheScope: "private" },
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
        ...{ ttlMs: 0, cacheScope: "private" },
      };
    },
  );
  logger.info("Registered observability resource: mysql://metrics");
}
