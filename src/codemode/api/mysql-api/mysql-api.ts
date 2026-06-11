import type { MySQLAdapter } from "../../../adapters/mysql/mysql-adapter/index.js";
import type { ToolDefinition } from "../../../types/index.js";
import type { AuditInterceptor } from "../../../audit/interceptor.js";
import { toolNameToMethodName, createGroupApi } from "../generator.js";
import { buildSandboxBindings } from "./bindings.js";

type GroupApiRecord = Record<string, (...args: unknown[]) => Promise<unknown>>;

/**
 * Main API class exposing all tool groups
 */
export class MysqlApi {
  // Core groups (15 original)
  readonly core: GroupApiRecord;
  readonly transactions: GroupApiRecord;
  readonly json: GroupApiRecord;
  readonly text: GroupApiRecord;
  readonly fulltext: GroupApiRecord;
  readonly performance: GroupApiRecord;
  readonly optimization: GroupApiRecord;
  readonly admin: GroupApiRecord;
  readonly monitoring: GroupApiRecord;
  readonly backup: GroupApiRecord;
  readonly replication: GroupApiRecord;
  readonly partitioning: GroupApiRecord;
  readonly router: GroupApiRecord;
  readonly proxysql: GroupApiRecord;
  readonly shell: GroupApiRecord;
  // New groups (9 added in v2.0.0)
  readonly schema: GroupApiRecord;
  readonly events: GroupApiRecord;
  readonly sysschema: GroupApiRecord;
  readonly stats: GroupApiRecord;
  readonly spatial: GroupApiRecord;
  readonly security: GroupApiRecord;
  readonly cluster: GroupApiRecord;
  readonly roles: GroupApiRecord;
  readonly docstore: GroupApiRecord;
  // Phase 3 groups
  readonly introspection: GroupApiRecord;
  readonly migration: GroupApiRecord;
  readonly vector: GroupApiRecord;

  private readonly toolsByGroup: Map<string, ToolDefinition[]>;
  private readonly isReadonly: boolean;

  constructor(adapter: MySQLAdapter, readonly?: boolean) {
    this.isReadonly = readonly ?? false;

    // Get all tool definitions and group them
    const allTools = adapter.getToolDefinitions();
    this.toolsByGroup = this.groupTools(allTools);

    // §1: Get audit interceptor for Code Mode blindspot fix
    const audit: AuditInterceptor | null = adapter.getAuditInterceptor();

    // Create group-specific APIs (all wrapped with audit interceptor when enabled)
    this.core = createGroupApi(
      adapter,
      "core",
      this.toolsByGroup.get("core") ?? [],
      audit,
    );
    this.transactions = createGroupApi(
      adapter,
      "transactions",
      this.toolsByGroup.get("transactions") ?? [],
      audit,
    );
    this.json = createGroupApi(
      adapter,
      "json",
      this.toolsByGroup.get("json") ?? [],
      audit,
    );
    this.text = createGroupApi(
      adapter,
      "text",
      this.toolsByGroup.get("text") ?? [],
      audit,
    );
    this.fulltext = createGroupApi(
      adapter,
      "fulltext",
      this.toolsByGroup.get("fulltext") ?? [],
      audit,
    );
    this.performance = createGroupApi(
      adapter,
      "performance",
      this.toolsByGroup.get("performance") ?? [],
      audit,
    );
    this.optimization = createGroupApi(
      adapter,
      "optimization",
      this.toolsByGroup.get("optimization") ?? [],
      audit,
    );
    this.admin = createGroupApi(
      adapter,
      "admin",
      this.toolsByGroup.get("admin") ?? [],
      audit,
    );
    this.monitoring = createGroupApi(
      adapter,
      "monitoring",
      this.toolsByGroup.get("monitoring") ?? [],
      audit,
    );
    this.backup = createGroupApi(
      adapter,
      "backup",
      this.toolsByGroup.get("backup") ?? [],
      audit,
    );
    this.replication = createGroupApi(
      adapter,
      "replication",
      this.toolsByGroup.get("replication") ?? [],
      audit,
    );
    this.partitioning = createGroupApi(
      adapter,
      "partitioning",
      this.toolsByGroup.get("partitioning") ?? [],
      audit,
    );
    this.router = createGroupApi(
      adapter,
      "router",
      this.toolsByGroup.get("router") ?? [],
      audit,
    );
    this.proxysql = createGroupApi(
      adapter,
      "proxysql",
      this.toolsByGroup.get("proxysql") ?? [],
      audit,
    );
    this.shell = createGroupApi(
      adapter,
      "shell",
      this.toolsByGroup.get("shell") ?? [],
      audit,
    );
    // New groups (9)
    this.schema = createGroupApi(
      adapter,
      "schema",
      this.toolsByGroup.get("schema") ?? [],
      audit,
    );
    this.events = createGroupApi(
      adapter,
      "events",
      this.toolsByGroup.get("events") ?? [],
      audit,
    );
    this.sysschema = createGroupApi(
      adapter,
      "sysschema",
      this.toolsByGroup.get("sysschema") ?? [],
      audit,
    );
    this.stats = createGroupApi(
      adapter,
      "stats",
      this.toolsByGroup.get("stats") ?? [],
      audit,
    );
    this.spatial = createGroupApi(
      adapter,
      "spatial",
      this.toolsByGroup.get("spatial") ?? [],
      audit,
    );
    this.security = createGroupApi(
      adapter,
      "security",
      this.toolsByGroup.get("security") ?? [],
      audit,
    );
    this.cluster = createGroupApi(
      adapter,
      "cluster",
      this.toolsByGroup.get("cluster") ?? [],
      audit,
    );
    this.roles = createGroupApi(
      adapter,
      "roles",
      this.toolsByGroup.get("roles") ?? [],
      audit,
    );
    this.docstore = createGroupApi(
      adapter,
      "docstore",
      this.toolsByGroup.get("docstore") ?? [],
      audit,
    );
    this.introspection = createGroupApi(
      adapter,
      "introspection",
      this.toolsByGroup.get("introspection") ?? [],
      audit,
    );
    this.migration = createGroupApi(
      adapter,
      "migration",
      this.toolsByGroup.get("migration") ?? [],
      audit,
    );
    this.vector = createGroupApi(
      adapter,
      "vector",
      this.toolsByGroup.get("vector") ?? [],
      audit,
    );
  }

  /**
   * Group tools by their tool group
   */
  private groupTools(tools: ToolDefinition[]): Map<string, ToolDefinition[]> {
    const grouped = new Map<string, ToolDefinition[]>();

    for (const tool of tools) {
      const group = tool.group;
      const existing = grouped.get(group);
      if (existing) {
        existing.push(tool);
      } else {
        grouped.set(group, [tool]);
      }
    }

    return grouped;
  }

  /**
   * Get list of available groups and their method counts
   */
  getAvailableGroups(): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const [group, tools] of this.toolsByGroup) {
      groups[group] = tools.length;
    }
    return groups;
  }

  /**
   * Get list of methods available in a group
   */
  getGroupMethods(groupName: string): string[] {
    const groupApi = this[groupName as keyof MysqlApi];
    if (typeof groupApi === "object" && groupApi !== null) {
      return Object.keys(groupApi);
    }
    return [];
  }

  /**
   * Get help information listing all groups and their methods.
   * Call mysql.help() in code mode to discover available APIs.
   *
   * @returns Object with group names as keys and arrays of method names as values
   */
  help(): {
    success: true;
    data: { groups: Record<string, string[]> };
    metrics: { tokenEstimate: number };
  } {
    const result: Record<string, string[]> = {};
    for (const [group, tools] of this.toolsByGroup) {
      // Skip codemode group itself
      if (group === "codemode") continue;
      result[group] = tools.map((t) => toolNameToMethodName(t.name, group));
    }
    return {
      success: true,
      data: { groups: result },
      metrics: { tokenEstimate: 50 },
    };
  }

  /**
   * Create a serializable API binding for the sandbox
   * This creates references that can be called from the vm context
   */
  createSandboxBindings(): Record<string, unknown> {
    return buildSandboxBindings(this, this.isReadonly);
  }
}

/**
 * Create a MysqlApi instance for an adapter
 */
export function createMysqlApi(
  adapter: MySQLAdapter,
  readonly?: boolean,
): MysqlApi {
  return new MysqlApi(adapter, readonly);
}
