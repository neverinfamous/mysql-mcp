import type { MysqlApi } from "./mysql-api.js";
import { METHOD_ALIASES, GROUP_EXAMPLES } from "../constants/index.js";

type GroupApiRecord = Record<string, (...args: unknown[]) => Promise<unknown>>;

/**
 * Create a serializable API binding for the sandbox
 * This creates references that can be called from the vm context
 */
export function buildSandboxBindings(
  api: MysqlApi,
  isReadonly: boolean,
): Record<string, unknown> {
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
    vector: new Set(["store", "batchStore", "delete", "createIndex", "optimize"]),
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
    "vector",
  ] as const;

  for (const groupName of groupNames) {
    // Skip entire write-only groups when readonly
    if (isReadonly && writeOnlyGroups.has(groupName)) {
      const blockedStub = (): { success: false; error: string } => ({
        success: false,
        error: `Readonly mode: the '${groupName}' group is not available in readonly mode`,
      });
      const groupApi = api[groupName];
      const stubbed: Record<string, unknown> = {};
      for (const method of Object.keys(groupApi)) {
        stubbed[method] = blockedStub;
      }
      stubbed["help"] = () => ({
        success: true,
        data: {
          methods: Object.keys(groupApi),
          readonly: true,
          note: `All methods in '${groupName}' are blocked in readonly mode`,
        },
        metrics: { tokenEstimate: 30 },
      });
      bindings[groupName] = stubbed;
      continue;
    }

    const groupApi = api[groupName];
    const groupWriteMethods = isReadonly
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
        data: {
          methods: canonicalMethodNames,
          methodAliases: usefulAliases,
          examples: GROUP_EXAMPLES[groupName],
        },
        metrics: { tokenEstimate: 50 },
      }),
    };
  }

  // Add top-level help as directly callable mysql.help()
  bindings["help"] = () => api.help();

  // Progress notification reporting
  bindings["reportProgress"] = async (
    progress: number,
    total?: number,
    message?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    if (api.baseContext?.progressToken !== undefined) {
      // Create reporter using dynamic import to avoid circular dependencies
      try {
        const { progressFactory } = await import("../../../progress/index.js");
        const reporter = progressFactory.create(api.baseContext.progressToken);
        reporter?.report(progress, total, message);
        return { success: true };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
    return { success: false, error: "No progress token available in context" };
  };

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
      "innodbStatus",
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

  // Vector aliases: mysql.vectorSearch() → mysql.vector.search()
  const vectorApi = bindings["vector"] as GroupApiRecord | undefined;
  if (vectorApi !== undefined) {
    for (const method of [
      "search",
      "rangeSearch",
      "hybridSearch",
    ]) {
      if (vectorApi[method] !== undefined) {
        bindings[`vector${method.charAt(0).toUpperCase()}${method.slice(1)}`] =
          vectorApi[method];
      }
    }
  }

  // Expose 'sys' as an alias for 'sysschema'
  bindings["sys"] = bindings["sysschema"];

  return bindings;
}
