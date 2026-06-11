import type { MySQLAdapter } from "./mysql-adapter.js";
import type {
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
  AdapterCapabilities,
  ToolGroup,
} from "../../../types/index.js";

// Import tool modules
import { getCoreTools } from "../tools/core.js";
import { getTransactionTools } from "../tools/transactions.js";
import { getJsonTools, getJsonHelperTools, getJsonEnhancedTools } from "../tools/json/index.js";
import { getTextTools, getFulltextTools } from "../tools/text/index.js";
import { getPerformanceTools, getOptimizationTools } from "../tools/performance/index.js";
import { getAdminTools, getMonitoringTools, getBackupTools } from "../tools/admin/index.js";
import { getReplicationTools } from "../tools/replication.js";
import { getPartitioningTools } from "../tools/partitioning.js";
import { getRouterTools } from "../tools/router.js";
import { getProxySQLTools } from "../tools/proxysql.js";
import { getShellTools } from "../tools/shell/index.js";
import { getSchemaTools } from "../tools/schema/index.js";
import { getEventTools } from "../tools/events.js";
import { getSysSchemaTools } from "../tools/sysschema/index.js";
import { getStatsTools } from "../tools/stats/index.js";
import { getSpatialTools } from "../tools/spatial/index.js";
import { getSecurityTools } from "../tools/security/index.js";
import { getClusterTools } from "../tools/cluster/index.js";
import { getRoleTools } from "../tools/roles.js";
import { getDocStoreTools } from "../tools/docstore/index.js";
import { getIntrospectionTools } from "../tools/introspection/index.js";
import { getMigrationTools } from "../tools/migration/index.js";
import { getVectorTools } from "../tools/vector/index.js";
import { getCodeModeTools } from "../tools/codemode/index.js";

import { getMySQLResources } from "../resources/index.js";
import { getMySQLPrompts } from "../prompts/index.js";

export class ToolRegistry {
  private cachedToolDefinitions: ToolDefinition[] | null = null;
  private cachedResourceDefinitions: ResourceDefinition[] | null = null;
  private cachedPromptDefinitions: PromptDefinition[] | null = null;

  constructor(private adapter: MySQLAdapter) {}

  getCapabilities(): AdapterCapabilities {
    return {
      json: true,
      fullTextSearch: true,
      vector: false, // MySQL doesn't have native vector support
      geospatial: true,
      transactions: true,
      preparedStatements: true,
      connectionPooling: true,
      partitioning: true,
      replication: true,
    };
  }

  getSupportedToolGroups(): ToolGroup[] {
    return [
      "core", "json", "text", "fulltext", "performance", "optimization",
      "admin", "monitoring", "backup", "replication", "partitioning",
      "transactions", "router", "proxysql", "shell", "schema", "events",
      "sysschema", "stats", "spatial", "security", "cluster", "roles",
      "docstore", "introspection", "migration", "vector", "codemode",
    ];
  }

  getToolDefinitions(): ToolDefinition[] {
    if (this.cachedToolDefinitions) {
      return this.cachedToolDefinitions;
    }

    this.cachedToolDefinitions = [
      ...getCoreTools(this.adapter),
      ...getTransactionTools(this.adapter),
      ...getJsonTools(this.adapter),
      ...getJsonHelperTools(this.adapter),
      ...getJsonEnhancedTools(this.adapter),
      ...getTextTools(this.adapter),
      ...getFulltextTools(this.adapter),
      ...getPerformanceTools(this.adapter),
      ...getOptimizationTools(this.adapter),
      ...getAdminTools(this.adapter),
      ...getMonitoringTools(this.adapter),
      ...getBackupTools(this.adapter),
      ...getReplicationTools(this.adapter),
      ...getPartitioningTools(this.adapter),
      ...getRouterTools(this.adapter),
      ...getProxySQLTools(this.adapter),
      ...getShellTools(this.adapter),
      ...getSchemaTools(this.adapter),
      ...getEventTools(this.adapter),
      ...getSysSchemaTools(this.adapter),
      ...getStatsTools(this.adapter),
      ...getSpatialTools(this.adapter),
      ...getSecurityTools(this.adapter),
      ...getClusterTools(this.adapter),
      ...getRoleTools(this.adapter),
      ...getDocStoreTools(this.adapter),
      ...getIntrospectionTools(this.adapter),
      ...getMigrationTools(this.adapter),
      ...getVectorTools(this.adapter),
      ...getCodeModeTools(this.adapter),
    ];

    return this.cachedToolDefinitions;
  }

  getResourceDefinitions(): ResourceDefinition[] {
    if (this.cachedResourceDefinitions) return this.cachedResourceDefinitions;
    this.cachedResourceDefinitions = getMySQLResources(this.adapter);
    return this.cachedResourceDefinitions;
  }

  getPromptDefinitions(): PromptDefinition[] {
    if (this.cachedPromptDefinitions) return this.cachedPromptDefinitions;
    this.cachedPromptDefinitions = getMySQLPrompts(this.adapter);
    return this.cachedPromptDefinitions;
  }
}
