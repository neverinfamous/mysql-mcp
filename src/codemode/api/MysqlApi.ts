import type { MySQLAdapter } from "../../adapters/mysql/mysql-adapter.js";
import type { ToolDefinition } from "../../types/index.js";
import { METHOD_ALIASES, GROUP_EXAMPLES } from "./constants.js";
import { toolNameToMethodName, createGroupApi } from "./generator.js";

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

  private readonly toolsByGroup: Map<string, ToolDefinition[]>;
  private readonly isReadonly: boolean;

  constructor(adapter: MySQLAdapter, readonly?: boolean) {
    this.isReadonly = readonly ?? false;

    // Get all tool definitions and group them
    const allTools = adapter.getToolDefinitions();
    this.toolsByGroup = this.groupTools(allTools);

    // Create group-specific APIs - 24 groups
    this.core = createGroupApi(
      adapter,
      "core",
      this.toolsByGroup.get("core") ?? [],
    );
    this.transactions = createGroupApi(
      adapter,
      "transactions",
      this.toolsByGroup.get("transactions") ?? [],
    );
    this.json = createGroupApi(
      adapter,
      "json",
      this.toolsByGroup.get("json") ?? [],
    );
    this.text = createGroupApi(
      adapter,
      "text",
      this.toolsByGroup.get("text") ?? [],
    );
    this.fulltext = createGroupApi(
      adapter,
      "fulltext",
      this.toolsByGroup.get("fulltext") ?? [],
    );
    this.performance = createGroupApi(
      adapter,
      "performance",
      this.toolsByGroup.get("performance") ?? [],
    );
    this.optimization = createGroupApi(
      adapter,
      "optimization",
      this.toolsByGroup.get("optimization") ?? [],
    );
    this.admin = createGroupApi(
      adapter,
      "admin",
      this.toolsByGroup.get("admin") ?? [],
    );
    this.monitoring = createGroupApi(
      adapter,
      "monitoring",
      this.toolsByGroup.get("monitoring") ?? [],
    );
    this.backup = createGroupApi(
      adapter,
      "backup",
      this.toolsByGroup.get("backup") ?? [],
    );
    this.replication = createGroupApi(
      adapter,
      "replication",
      this.toolsByGroup.get("replication") ?? [],
    );
    this.partitioning = createGroupApi(
      adapter,
      "partitioning",
      this.toolsByGroup.get("partitioning") ?? [],
    );
    this.router = createGroupApi(
      adapter,
      "router",
      this.toolsByGroup.get("router") ?? [],
    );
    this.proxysql = createGroupApi(
      adapter,
      "proxysql",
      this.toolsByGroup.get("proxysql") ?? [],
    );
    this.shell = createGroupApi(
      adapter,
      "shell",
      this.toolsByGroup.get("shell") ?? [],
    );
    // New groups (9)
    this.schema = createGroupApi(
      adapter,
      "schema",
      this.toolsByGroup.get("schema") ?? [],
    );
    this.events = createGroupApi(
      adapter,
      "events",
      this.toolsByGroup.get("events") ?? [],
    );
    this.sysschema = createGroupApi(
      adapter,
      "sysschema",
      this.toolsByGroup.get("sysschema") ?? [],
    );
    this.stats = createGroupApi(
      adapter,
      "stats",
      this.toolsByGroup.get("stats") ?? [],
    );
    this.spatial = createGroupApi(
      adapter,
      "spatial",
      this.toolsByGroup.get("spatial") ?? [],
    );
    this.security = createGroupApi(
      adapter,
      "security",
      this.toolsByGroup.get("security") ?? [],
    );
    this.cluster = createGroupApi(
      adapter,
      "cluster",
      this.toolsByGroup.get("cluster") ?? [],
    );
    this.roles = createGroupApi(
      adapter,
      "roles",
      this.toolsByGroup.get("roles") ?? [],
    );
    this.docstore = createGroupApi(
      adapter,
      "docstore",
      this.toolsByGroup.get("docstore") ?? [],
    );
    this.introspection = createGroupApi(
      adapter,
      "introspection",
      this.toolsByGroup.get("introspection") ?? [],
    );
    this.migration = createGroupApi(
      adapter,
      "migration",
      this.toolsByGroup.get("migration") ?? [],
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
  help(): { success: true; groups: Record<string, string[]> } {
    const result: Record<string, string[]> = {};
    for (const [group, tools] of this.toolsByGroup) {
      // Skip codemode group itself
      if (group === "codemode") continue;
      result[group] = tools.map((t) => toolNameToMethodName(t.name, group));
    }
    return { success: true, groups: result };
  }

  /**
   * Create a serializable API binding for the sandbox
   * This creates references that can be called from the vm context
   */
  createSandboxBindings(): Record<string, unknown> {
    const bindings: Record<string, unknown> = {};

    // Groups that are entirely write-oriented (excluded when readonly)
    const writeOnlyGroups = new Set([
      "transactions",
      "admin",
      "backup",
      "partitioning",
      "roles",
      "events",
      "shell",
    ]);

    // Methods within mixed groups that perform writes (excluded when readonly)
    const writeMethods: Record<string, Set<string>> = {
      core: new Set(["writeQuery", "dropTable", "createTable", "createIndex"]),
      docstore: new Set([
        "docAdd",
        "docModify",
        "docRemove",
        "docCreateCollection",
        "docDropCollection",
        "docCreateIndex",
      ]),
      schema: new Set(["createSchema", "dropSchema", "createView"]),
      migration: new Set(["init", "record", "apply", "rollback"]),
      json: new Set([
        "set",
        "insert",
        "remove",
        "replace",
        "update",
        "merge",
        "arrayAppend",
      ]),
      fulltext: new Set(["fulltextCreate", "fulltextDrop"]),
      spatial: new Set(["createColumn", "createIndex"]),
    };

    const groupNames = [
      "core",
      "transactions",
      "json",
      "text",
      "fulltext",
      "performance",
      "optimization",
      "admin",
      "monitoring",
      "backup",
      "replication",
      "partitioning",
      "router",
      "proxysql",
      "shell",
      "schema",
      "events",
      "sysschema",
      "stats",
      "spatial",
      "security",
      "cluster",
      "roles",
      "docstore",
      "introspection",
      "migration",
    ] as const;

    for (const groupName of groupNames) {
      // Skip entire write-only groups when readonly
      if (this.isReadonly && writeOnlyGroups.has(groupName)) {
        const blockedStub = (): { success: false; error: string } => ({
          success: false,
          error: `Readonly mode: the '${groupName}' group is not available in readonly mode`,
        });
        const groupApi = this[groupName];
        const stubbed: Record<string, unknown> = {};
        for (const method of Object.keys(groupApi)) {
          stubbed[method] = blockedStub;
        }
        stubbed["help"] = () => ({
          success: true,
          methods: Object.keys(groupApi),
          readonly: true,
          note: `All methods in '${groupName}' are blocked in readonly mode`,
        });
        bindings[groupName] = stubbed;
        continue;
      }

      const groupApi = this[groupName];
      const groupWriteMethods = this.isReadonly
        ? (writeMethods[groupName] ?? new Set<string>())
        : new Set<string>();
      const allMethodNames = Object.keys(groupApi);

      // Separate canonical methods from aliases for structured help output
      const aliases = METHOD_ALIASES[groupName] ?? {};
      const aliasNames = new Set(Object.keys(aliases));
      const canonicalMethodNames = allMethodNames.filter(
        (name) => !aliasNames.has(name),
      );

      // Filter aliases to only show useful shorthand aliases in help output
      const usefulAliases = allMethodNames.filter((name) => {
        if (!aliasNames.has(name)) return false;
        const lowerGroupName = groupName.toLowerCase();
        const lowerAlias = name.toLowerCase();
        return !lowerAlias.startsWith(lowerGroupName);
      });

      // Build the group API, replacing write methods with stubs when readonly
      const filteredApi: Record<string, unknown> = {};
      for (const method of allMethodNames) {
        // Check if this method (or its canonical target) is a write method
        const canonicalTarget = aliases[method] ?? method;
        const isWrite =
          groupWriteMethods.has(method) ||
          groupWriteMethods.has(canonicalTarget);

        if (isWrite) {
          filteredApi[method] = (): { success: false; error: string } => ({
            success: false,
            error: `Readonly mode: '${groupName}.${method}()' is a write operation and cannot be used when readonly is true`,
          });
        } else {
          filteredApi[method] = groupApi[method];
        }
      }

      // Add all methods plus a 'help' property that lists them
      bindings[groupName] = {
        ...filteredApi,
        help: () => ({
          success: true,
          methods: canonicalMethodNames,
          methodAliases: usefulAliases,
          examples: GROUP_EXAMPLES[groupName],
        }),
      };
    }

    // Add top-level help as directly callable mysql.help()
    bindings["help"] = () => this.help();

    // =========================================================================
    // Top-level convenience aliases
    // =========================================================================

    // Core aliases: mysql.readQuery() → mysql.core.readQuery()
    const coreApi = bindings["core"] as GroupApiRecord | undefined;
    if (coreApi !== undefined) {
      // Query tools
      if (coreApi["readQuery"] !== undefined) {
        bindings["readQuery"] = coreApi["readQuery"];
      }
      if (coreApi["writeQuery"] !== undefined) {
        bindings["writeQuery"] = coreApi["writeQuery"];
      }
      // Table metadata
      if (coreApi["listTables"] !== undefined) {
        bindings["listTables"] = coreApi["listTables"];
      }
      if (coreApi["describeTable"] !== undefined) {
        bindings["describeTable"] = coreApi["describeTable"];
      }
      // Table DDL
      if (coreApi["createTable"] !== undefined) {
        bindings["createTable"] = coreApi["createTable"];
      }
      if (coreApi["dropTable"] !== undefined) {
        bindings["dropTable"] = coreApi["dropTable"];
      }
      // Index tools
      if (coreApi["createIndex"] !== undefined) {
        bindings["createIndex"] = coreApi["createIndex"];
      }
      if (coreApi["getIndexes"] !== undefined) {
        bindings["getIndexes"] = coreApi["getIndexes"];
      }
    }

    // Transaction aliases: mysql.transactionBegin() → mysql.transactions.transactionBegin()
    const transactionsApi = bindings["transactions"] as
      | GroupApiRecord
      | undefined;
    if (transactionsApi !== undefined) {
      for (const method of [
        "transactionBegin",
        "transactionCommit",
        "transactionRollback",
        "transactionSavepoint",
        "transactionRelease",
        "transactionRollbackTo",
        "transactionExecute",
      ]) {
        if (transactionsApi[method] !== undefined) {
          bindings[method] = transactionsApi[method];
        }
      }
    }

    // JSON aliases: mysql.jsonExtract() → mysql.json.extract()
    const jsonApi = bindings["json"] as GroupApiRecord | undefined;
    if (jsonApi !== undefined) {
      for (const method of [
        "extract",
        "set",
        "insert",
        "remove",
        "contains",
        "keys",
        "replace",
        "get",
        "search",
        "update",
        "validate",
        "merge",
        "diff",
        "stats",
        "indexSuggest",
        "normalize",
        "arrayAppend",
      ]) {
        if (jsonApi[method] !== undefined) {
          bindings[`json${method.charAt(0).toUpperCase()}${method.slice(1)}`] =
            jsonApi[method];
        }
      }
    }

    // Performance aliases: mysql.explain() → mysql.performance.explain()
    const performanceApi = bindings["performance"] as
      | GroupApiRecord
      | undefined;
    if (performanceApi !== undefined) {
      for (const method of [
        "explain",
        "explainAnalyze",
        "slowQueries",
        "bufferPoolStats",
        "innodbStatus",
        "tableStats",
        "threadStats",
        "serverHealth",
      ]) {
        if (performanceApi[method] !== undefined) {
          bindings[method] = performanceApi[method];
        }
      }
    }

    // Admin aliases: mysql.optimizeTable() → mysql.admin.optimizeTable()
    const adminApi = bindings["admin"] as GroupApiRecord | undefined;
    if (adminApi !== undefined) {
      for (const method of [
        "checkTable",
        "repairTable",
        "optimizeTable",
        "analyzeTable",
        "flushTables",
        "killQuery",
      ]) {
        if (adminApi[method] !== undefined) {
          bindings[method] = adminApi[method];
        }
      }
    }

    // Monitoring aliases: mysql.showStatus() → mysql.monitoring.showStatus()
    const monitoringApi = bindings["monitoring"] as GroupApiRecord | undefined;
    if (monitoringApi !== undefined) {
      for (const method of [
        "showStatus",
        "showVariables",
        "showProcesslist",
        "queryStats",
      ]) {
        if (monitoringApi[method] !== undefined) {
          bindings[method] = monitoringApi[method];
        }
      }
    }

    // Backup aliases: mysql.createDump() → mysql.backup.createDump()
    const backupApi = bindings["backup"] as GroupApiRecord | undefined;
    if (backupApi !== undefined) {
      for (const method of [
        "createDump",
        "exportTable",
        "importData",
        "restoreDump",
      ]) {
        if (backupApi[method] !== undefined) {
          bindings[method] = backupApi[method];
        }
      }
    }

    // Stats aliases: mysql.descriptive() → mysql.stats.descriptive()
    const statsApi = bindings["stats"] as GroupApiRecord | undefined;
    if (statsApi !== undefined) {
      for (const method of [
        "descriptive",
        "percentiles",
        "correlation",
        "regression",
        "timeSeries",
        "distribution",
        "histogram",
        "sampling",
      ]) {
        if (statsApi[method] !== undefined) {
          bindings[method] = statsApi[method];
        }
      }
    }

    return bindings;
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
