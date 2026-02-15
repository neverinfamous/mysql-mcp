/**
 * mysql-mcp - Code Mode API
 *
 * Exposes all MySQL tools organized by their 24 groups
 * for use within the sandboxed execution environment.
 */

import type { MySQLAdapter } from "../adapters/mysql/MySQLAdapter.js";
import type { ToolDefinition } from "../types/index.js";

/**
 * Method aliases for code mode API.
 * Maps alternate method names to their canonical method names.
 * Format: { groupName: { aliasName: canonicalName } }
 *
 * These aliases handle common naming misguesses where agents
 * might try the redundant prefix pattern (e.g., jsonExtract vs extract).
 */
const METHOD_ALIASES: Record<string, Record<string, string>> = {
  // JSON: mysql_json_extract → extract, but agent might try jsonExtract
  json: {
    jsonExtract: "extract",
    jsonSet: "set",
    jsonInsert: "insert",
    jsonRemove: "remove",
    jsonContains: "contains",
    jsonKeys: "keys",
    jsonReplace: "replace",
    jsonGet: "get",
    jsonSearch: "search",
    jsonUpdate: "update",
    jsonValidate: "validate",
    jsonMerge: "merge",
    jsonNormalize: "normalize",
    jsonDiff: "diff",
    jsonIndexSuggest: "indexSuggest",
    jsonStats: "stats",
    jsonArrayAppend: "arrayAppend",
  },
  // Text: mysql_regexp_match → regexpMatch, but also regex
  text: {
    regex: "regexpMatch",
    regexp: "regexpMatch",
    like: "likeSearch",
    pattern: "likeSearch",
    sound: "soundex",
    substr: "substring",
    concatenate: "concat",
    collation: "collationConvert",
  },
  // Fulltext: intuitive aliases
  fulltext: {
    create: "fulltextCreate",
    drop: "fulltextDrop",
    search: "fulltextSearch",
    boolean: "fulltextBoolean",
    expand: "fulltextExpand",
    createIndex: "fulltextCreate",
    dropIndex: "fulltextDrop",
    naturalLanguage: "fulltextSearch",
    booleanMode: "fulltextBoolean",
    queryExpansion: "fulltextExpand",
  },
  // Transactions: shorter aliases
  transactions: {
    begin: "transactionBegin",
    commit: "transactionCommit",
    rollback: "transactionRollback",
    savepoint: "transactionSavepoint",
    release: "transactionRelease",
    rollbackTo: "transactionRollbackTo",
    execute: "transactionExecute",
  },
  // Performance: intuitive aliases
  performance: {
    queryPlan: "explain",
    analyze: "explainAnalyze",
    slowLog: "slowQueries",
    slow: "slowQueries",
    trace: "optimizerTrace",
    bufferPool: "bufferPoolStats",
    innodb: "innodbStatus",
    stats: "tableStats",
    threads: "threadStats",
    health: "serverHealth",
    processes: "showProcesslist",
    processlist: "showProcesslist",
  },
  // Optimization: shorter aliases
  optimization: {
    recommend: "indexRecommendation",
    indexAdvice: "indexRecommendation",
    usage: "indexUsage",
    hint: "forceIndex",
    forceHint: "forceIndex",
    rewrite: "queryRewrite",
  },
  // Admin: intuitive aliases
  admin: {
    check: "checkTable",
    repair: "repairTable",
    optimize: "optimizeTable",
    analyze: "analyzeTable",
    flush: "flushTables",
    kill: "killQuery",
    pool: "poolStats",
  },
  // Monitoring: intuitive aliases
  monitoring: {
    status: "showStatus",
    variables: "showVariables",
    processes: "showProcesslist",
    processlist: "showProcesslist",
    queries: "queryStats",
    slowlog: "slowQueries",
  },
  // Backup: shorter aliases
  backup: {
    dump: "createDump",
    export: "exportTable",
    import: "importData",
    restore: "restoreDump",
  },
  // Replication: intuitive aliases
  replication: {
    lag: "replicationLag",
    status: "replicationStatus",
    master: "masterStatus",
    slave: "slaveStatus",
    binlog: "binlogEvents",
    gtid: "gtidStatus",
  },
  // Partitioning: shorter aliases
  partitioning: {
    add: "addPartition",
    drop: "dropPartition",
    reorganize: "reorganizePartition",
    info: "partitionInfo",
    list: "partitionInfo", // list() → partitionInfo()
  },
  // Schema: intuitive aliases
  schema: {
    views: "listViews",
    functions: "listFunctions",
    procedures: "listStoredProcedures",
    triggers: "listTriggers",
    constraints: "listConstraints",
    schemas: "listSchemas",
    createDb: "createSchema",
    dropDb: "dropSchema",
  },
  // Events: shorter aliases
  events: {
    create: "eventCreate",
    drop: "eventDrop",
    alter: "eventAlter",
    list: "eventList",
    status: "eventStatus",
    scheduler: "schedulerStatus",
  },
  // Stats: redundant prefix aliases
  stats: {
    statsDescriptive: "descriptive",
    statsPercentiles: "percentiles",
    statsCorrelation: "correlation",
    statsRegression: "regression",
    statsTimeSeries: "timeSeries",
    statsDistribution: "distribution",
    statsHistogram: "histogram",
    statsSampling: "sampling",
    // Intuitive aliases
    summary: "descriptive",
    percentile: "percentiles",
    movingAverage: "timeSeries",
    time_series: "timeSeries",
  },
  // Spatial: intuitive aliases
  spatial: {
    addColumn: "createColumn",
    addIndex: "createIndex",
    dist: "distance",
    distSphere: "distanceSphere",
    geojson: "geojson",
    pointInPolygon: "contains",
  },
  // Security: intuitive aliases
  security: {
    ssl: "sslStatus",
    encryption: "encryptionStatus",
    firewall: "firewallStatus",
    firewallRules: "firewallRules",
    audit: "audit",
    privileges: "userPrivileges",
    password: "passwordValidate",
    mask: "maskData",
    sensitive: "sensitiveTables",
  },
  // Cluster: intuitive aliases
  cluster: {
    status: "clusterStatus",
    instances: "clusterInstances",
    topology: "clusterTopology",
    switchover: "clusterSwitchover",
    routerStatus: "clusterRouterStatus",
    grStatus: "grStatus",
    grMembers: "grMembers",
    grPrimary: "grPrimary",
    grFlowControl: "grFlowControl",
    grTransactions: "grTransactions",
  },
  // Roles: shorter aliases
  roles: {
    create: "roleCreate",
    drop: "roleDrop",
    list: "roleList",
    assign: "roleAssign",
    grant: "roleGrant",
    revoke: "roleRevoke",
    grants: "roleGrants",
    userRoles: "userRoles",
  },
  // DocStore: shorter aliases
  docstore: {
    add: "docAdd",
    find: "docFind",
    modify: "docModify",
    remove: "docRemove",
    createCollection: "docCreateCollection",
    dropCollection: "docDropCollection",
    listCollections: "docListCollections",
    collectionInfo: "docCollectionInfo",
    createIndex: "docCreateIndex",
  },
  // SysSchema: shorter aliases
  sysschema: {
    schemaStats: "sysSchemaStats",
    lockWaits: "sysInnodbLockWaits",
    memory: "sysMemorySummary",
    statements: "sysStatementSummary",
    waits: "sysWaitSummary",
    io: "sysIoSummary",
    users: "sysUserSummary",
    hosts: "sysHostSummary",
  },
  // Router: shorter aliases
  router: {
    status: "routerStatus",
    routes: "routerRoutes",
    metadata: "routerMetadataStatus",
    pool: "routerPoolStatus",
    routeStatus: "routerRouteStatus",
    routeHealth: "routerRouteHealth",
    connections: "routerRouteConnections",
    destinations: "routerRouteDestinations",
    blocked: "routerRouteBlockedHosts",
  },
};

/**
 * Usage examples for each group's help() output.
 * Provides quick-reference examples for common operations.
 */
const GROUP_EXAMPLES: Record<string, string[]> = {
  core: [
    'mysql.core.readQuery("SELECT * FROM users LIMIT 10")',
    'mysql.core.describeTable("users")',
    'mysql.core.createTable("orders", { columns: [{ name: "id", type: "INT AUTO_INCREMENT PRIMARY KEY" }] })',
    "mysql.core.listTables()",
  ],
  transactions: [
    "const { transactionId } = await mysql.transactions.begin()",
    'await mysql.transactions.savepoint({ transactionId, name: "sp1" })',
    'await mysql.transactions.rollbackTo({ transactionId, name: "sp1" })',
    "await mysql.transactions.commit({ transactionId })",
    'await mysql.transactions.execute({ statements: [{ sql: "INSERT..." }, { sql: "UPDATE..." }] })',
  ],
  json: [
    'mysql.json.extract({ table: "docs", column: "data", path: "$.user.name" })',
    'mysql.json.set({ table: "docs", column: "data", path: "$.status", value: "active", where: "id=1" })',
    'mysql.json.contains({ table: "docs", column: "data", candidate: \'{"type": "admin"}\' })',
    "mysql.json.merge({ base: { a: 1 }, overlay: { b: 2 } })",
    'mysql.json.search({ table: "docs", column: "data", searchValue: "active" })',
  ],
  text: [
    'mysql.text.regexpMatch({ table: "users", column: "email", pattern: "^admin@" })',
    'mysql.text.likeSearch({ table: "products", column: "name", pattern: "%widget%" })',
    'mysql.text.soundex({ table: "users", column: "name", value: "Smith" })',
  ],
  fulltext: [
    'mysql.fulltext.fulltextSearch({ table: "articles", columns: ["title", "content"], query: "database" })',
    'mysql.fulltext.fulltextCreate({ table: "articles", columns: ["title", "content"] })',
    'mysql.fulltext.fulltextBoolean({ table: "articles", columns: ["content"], query: "+MySQL -Oracle" })',
  ],
  performance: [
    "mysql.performance.explain({ sql: 'SELECT * FROM orders WHERE status = ?', params: ['active'] })",
    "mysql.performance.slowQueries({ limit: 10 })",
    "mysql.performance.bufferPoolStats()",
    "mysql.performance.innodbStatus()",
    "mysql.performance.tableStats({ table: 'orders' })",
  ],
  optimization: [
    "mysql.optimization.indexRecommendation({ sql: 'SELECT * FROM orders WHERE status = ?' })",
    "mysql.optimization.indexUsage({ table: 'orders' })",
    'mysql.optimization.forceIndex({ sql: "SELECT...", table: "orders", index: "idx_status" })',
  ],
  admin: [
    "mysql.admin.optimizeTable({ table: 'orders' })",
    "mysql.admin.checkTable({ table: 'orders' })",
    "mysql.admin.analyzeTable({ table: 'orders' })",
    "mysql.admin.flushTables()",
    "mysql.admin.killQuery({ processId: 12345 })",
  ],
  monitoring: [
    "mysql.monitoring.showStatus({ pattern: 'Threads%' })",
    "mysql.monitoring.showVariables({ pattern: 'max_connections' })",
    "mysql.monitoring.showProcesslist()",
    "mysql.monitoring.queryStats()",
  ],
  backup: [
    "mysql.backup.createDump({ tables: ['users', 'orders'] })",
    "mysql.backup.exportTable({ table: 'users', format: 'csv' })",
    "mysql.backup.importData({ table: 'users', filePath: '/data/users.csv' })",
    "mysql.backup.restoreDump({ filePath: '/backups/dump.sql' })",
  ],
  replication: [
    "mysql.replication.replicationStatus()",
    "mysql.replication.replicationLag()",
    "mysql.replication.masterStatus()",
    "mysql.replication.binlogEvents({ limit: 20 })",
  ],
  partitioning: [
    "mysql.partitioning.partitionInfo({ table: 'events' })",
    "mysql.partitioning.addPartition({ table: 'events', name: 'p2024q1', values: 'LESS THAN (2024040100)' })",
    "mysql.partitioning.dropPartition({ table: 'events', name: 'p2023q1' })",
  ],
  schema: [
    "mysql.schema.listViews()",
    "mysql.schema.createView({ name: 'active_users', sql: 'SELECT * FROM users WHERE active = 1' })",
    "mysql.schema.listFunctions()",
    "mysql.schema.listTriggers({ table: 'orders' })",
  ],
  events: [
    "mysql.events.eventCreate({ name: 'cleanup', schedule: 'EVERY 1 DAY', body: 'DELETE FROM logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)' })",
    "mysql.events.eventList()",
    "mysql.events.schedulerStatus()",
  ],
  sysschema: [
    "mysql.sysschema.sysSchemaStats({ table: 'users' })",
    "mysql.sysschema.sysStatementSummary({ limit: 10 })",
    "mysql.sysschema.sysInnodbLockWaits()",
    "mysql.sysschema.sysMemorySummary()",
  ],
  stats: [
    "mysql.stats.descriptive({ table: 'orders', column: 'amount' })",
    "mysql.stats.percentiles({ table: 'orders', column: 'amount', percentiles: [0.5, 0.95, 0.99] })",
    "mysql.stats.timeSeries({ table: 'metrics', timeColumn: 'ts', valueColumn: 'value', interval: '1 HOUR' })",
    "mysql.stats.histogram({ table: 'orders', column: 'amount', buckets: 10 })",
  ],
  spatial: [
    "mysql.spatial.distance({ table: 'locations', column: 'geom', point: { x: 40.7, y: -74 } })",
    "mysql.spatial.distanceSphere({ table: 'locations', column: 'geom', lat: 40.7, lng: -74 })",
    "mysql.spatial.point({ x: 40.7, y: -74.0 })",
    "mysql.spatial.buffer({ table: 'areas', column: 'geom', distance: 1000 })",
  ],
  security: [
    "mysql.security.sslStatus()",
    "mysql.security.userPrivileges({ user: 'app_user' })",
    "mysql.security.audit()",
    "mysql.security.sensitiveTables()",
    "mysql.security.passwordValidate({ password: 'test123' })",
  ],
  cluster: [
    "mysql.cluster.clusterStatus()",
    "mysql.cluster.clusterInstances()",
    "mysql.cluster.grStatus()",
    "mysql.cluster.grMembers()",
    "mysql.cluster.clusterTopology()",
  ],
  roles: [
    "mysql.roles.roleCreate({ name: 'app_reader' })",
    "mysql.roles.roleGrant({ role: 'app_reader', privileges: 'SELECT', on: 'mydb.*' })",
    "mysql.roles.roleAssign({ role: 'app_reader', user: 'app_user' })",
    "mysql.roles.roleList()",
  ],
  docstore: [
    "mysql.docstore.docCreateCollection({ name: 'products', schema: 'mydb' })",
    "mysql.docstore.docAdd({ collection: 'products', document: { name: 'Widget', price: 9.99 } })",
    "mysql.docstore.docFind({ collection: 'products', filter: 'price > 5' })",
  ],
  router: [
    "mysql.router.routerStatus()",
    "mysql.router.routerRoutes()",
    "mysql.router.routerRouteHealth({ routeName: 'myroute' })",
  ],
  proxysql: [
    "// ProxySQL requires external ProxySQL admin connection",
    "// See tool descriptions for connection requirements",
  ],
  shell: [
    "// MySQL Shell tools require mysqlsh binary in PATH",
    "// See tool descriptions for configuration options",
  ],
};

/**
 * Mapping of method names to their parameter names for positional argument support.
 * Single string = first positional arg maps to this key
 * Array = multiple positional args map to these keys in order
 *
 * Enables:
 * - `mysql.core.readQuery("SELECT...")` → `{ sql: "SELECT..." }`
 * - `mysql.core.describeTable("users")` → `{ table: "users" }`
 */
const POSITIONAL_PARAM_MAP: Record<string, string | string[]> = {
  // ============ CORE GROUP ============
  readQuery: "sql",
  writeQuery: "sql",
  describeTable: "table",
  dropTable: "table",
  listTables: "database",
  getIndexes: "table",
  dropIndex: "name",
  createTable: ["name", "columns"],
  createIndex: ["table", "columns"],

  // ============ SCHEMA GROUP ============
  createSchema: "name",
  dropSchema: "name",
  listSchemas: "pattern",
  listViews: "database",
  listFunctions: "database",
  listStoredProcedures: "database",
  listTriggers: "table",
  listConstraints: "table",
  createView: ["name", "sql"],

  // ============ JSON GROUP ============
  extract: ["table", "column", "path", "where"],
  set: ["table", "column", "path", "value", "where"],
  insert: ["table", "column", "path", "value", "where"],
  remove: ["table", "column", "path", "where"],
  contains: ["table", "column", "candidate"],
  keys: ["table", "column", "where"],
  replace: ["table", "column", "path", "value", "where"],
  get: ["table", "column", "path"],
  search: ["table", "column", "searchValue"],
  update: ["table", "column", "path", "value", "where"],
  validate: ["table", "column"],
  stats: ["table", "column"],
  indexSuggest: ["table", "column"],
  normalize: ["table", "column"],
  merge: ["base", "overlay"],
  diff: ["doc1", "doc2"],
  arrayAppend: ["table", "column", "path", "value"],

  // ============ TEXT GROUP ============
  regexpMatch: ["table", "column", "pattern"],
  likeSearch: ["table", "column", "pattern"],
  soundex: ["table", "column", "value"],
  substring: ["table", "column"],
  concat: ["table", "columns"],
  collationConvert: ["table", "column", "collation"],

  // ============ FULLTEXT GROUP ============
  fulltextCreate: ["table", "columns"],
  fulltextDrop: ["table", "indexName"],
  fulltextSearch: ["table", "columns", "query"],
  fulltextBoolean: ["table", "columns", "query"],
  fulltextExpand: ["table", "columns", "query"],

  // ============ TRANSACTION GROUP ============
  transactionCommit: "transactionId",
  transactionRollback: "transactionId",
  transactionSavepoint: ["transactionId", "name"],
  transactionRelease: ["transactionId", "name"],
  transactionRollbackTo: ["transactionId", "name"],
  // Short aliases
  commit: "transactionId",
  rollback: "transactionId",
  savepoint: ["transactionId", "name"],
  release: ["transactionId", "name"],
  rollbackTo: ["transactionId", "name"],

  // ============ PERFORMANCE GROUP ============
  explain: "sql",
  explainAnalyze: "sql",

  // ============ ADMIN GROUP ============
  checkTable: "table",
  repairTable: "table",
  optimizeTable: "table",
  analyzeTable: "table",

  // ============ BACKUP GROUP ============
  createDump: "tables",
  exportTable: "table",
  importData: "table",
  restoreDump: "filePath",

  // ============ STATS GROUP ============
  descriptive: ["table", "column"],
  percentiles: ["table", "column", "percentiles"],
  distribution: ["table", "column"],
  histogram: ["table", "column", "buckets"],
  correlation: ["table", "column1", "column2"],
  regression: ["table", "xColumn", "yColumn"],
  sampling: ["table", "sampleSize"],
  timeSeries: ["table", "timeColumn", "valueColumn"],
  // Stats prefixed aliases
  statsTimeSeries: ["table", "timeColumn", "valueColumn"],
  statsDescriptive: ["table", "column"],
  statsPercentiles: ["table", "column", "percentiles"],
  statsDistribution: ["table", "column"],
  statsCorrelation: ["table", "column1", "column2"],
  statsHistogram: ["table", "column", "buckets"],
  statsSampling: ["table", "sampleSize"],
  statsRegression: ["table", "xColumn", "yColumn"],

  // ============ PARTITIONING GROUP ============
  addPartition: ["table", "name", "values"],
  dropPartition: ["table", "name"],
  reorganizePartition: ["table", "partitions"],
  partitionInfo: "table",

  // ============ SPATIAL GROUP ============
  distance: ["table", "column"],
  distanceSphere: ["table", "column"],
  point: ["x", "y"],
  polygon: "coordinates",
};

/**
 * Methods where a single array arg should be wrapped in a specific key
 */
const ARRAY_WRAP_MAP: Record<string, string> = {
  transactionExecute: "statements",
  execute: "statements",
};

/**
 * Normalize parameters to support positional arguments.
 * Handles both single positional args and multiple positional args.
 */
function normalizeParams(methodName: string, args: unknown[]): unknown {
  // No args - pass through
  if (args.length === 0) return undefined;

  // Single arg handling
  if (args.length === 1) {
    const arg = args[0];

    // Object arg - pass through
    if (typeof arg === "object" && arg !== null && !Array.isArray(arg)) {
      return arg;
    }

    // Array arg - check if we should wrap it
    if (Array.isArray(arg)) {
      const wrapKey = ARRAY_WRAP_MAP[methodName];
      if (wrapKey !== undefined) {
        return { [wrapKey]: arg };
      }
      return arg;
    }

    // String arg - use positional mapping
    if (typeof arg === "string") {
      const paramMapping = POSITIONAL_PARAM_MAP[methodName];
      if (typeof paramMapping === "string") {
        return { [paramMapping]: arg };
      }
      if (Array.isArray(paramMapping) && paramMapping[0] !== undefined) {
        return { [paramMapping[0]]: arg };
      }
      // Fallback: try common parameter names
      return { sql: arg, query: arg, table: arg, name: arg };
    }

    return arg;
  }

  // Multi-arg: check for array+options pattern first
  if (args.length >= 1 && Array.isArray(args[0])) {
    const wrapKey = ARRAY_WRAP_MAP[methodName];
    if (wrapKey !== undefined) {
      const result: Record<string, unknown> = { [wrapKey]: args[0] };
      if (args.length > 1) {
        const lastArg = args[args.length - 1];
        if (
          typeof lastArg === "object" &&
          lastArg !== null &&
          !Array.isArray(lastArg)
        ) {
          Object.assign(result, lastArg);
        }
      }
      return result;
    }
  }

  // Look up positional parameter mapping
  const paramMapping = POSITIONAL_PARAM_MAP[methodName];

  if (paramMapping === undefined) {
    return args[0];
  }

  // Single param mapping - merge trailing options if present
  if (typeof paramMapping === "string") {
    const result: Record<string, unknown> = { [paramMapping]: args[0] };
    if (args.length > 1) {
      const lastArg = args[args.length - 1];
      if (
        typeof lastArg === "object" &&
        lastArg !== null &&
        !Array.isArray(lastArg)
      ) {
        Object.assign(result, lastArg);
      }
    }
    return result;
  }

  // Multi-param mapping (array)
  const result: Record<string, unknown> = {};

  // Check if last arg is an options object that should be merged
  const lastArg = args[args.length - 1];
  const lastArgIsOptionsObject =
    typeof lastArg === "object" &&
    lastArg !== null &&
    !Array.isArray(lastArg) &&
    Object.keys(lastArg as Record<string, unknown>).some((k) =>
      paramMapping.includes(k),
    );

  // Map positional args to their keys
  const argsToMap = lastArgIsOptionsObject ? args.length - 1 : args.length;
  for (let i = 0; i < paramMapping.length && i < argsToMap; i++) {
    const key = paramMapping[i];
    const arg = args[i];
    if (key !== undefined) {
      result[key] = arg;
    }
  }

  // Merge trailing options object
  if (args.length > paramMapping.length || lastArgIsOptionsObject) {
    if (
      typeof lastArg === "object" &&
      lastArg !== null &&
      !Array.isArray(lastArg)
    ) {
      Object.assign(result, lastArg);
    }
  }

  return result;
}

/**
 * Dynamic API generator for tool groups
 * Creates methods for each tool in the group
 */
function createGroupApi(
  adapter: MySQLAdapter,
  groupName: string,
  tools: ToolDefinition[],
): Record<string, (...args: unknown[]) => Promise<unknown>> {
  const api: Record<string, (...args: unknown[]) => Promise<unknown>> = {};

  for (const tool of tools) {
    // Convert tool name to method name
    // e.g., mysql_read_query -> readQuery, mysql_json_extract -> extract
    const methodName = toolNameToMethodName(tool.name, groupName);

    api[methodName] = async (...args: unknown[]) => {
      // Normalize positional arguments to object parameters
      const normalizedParams = normalizeParams(methodName, args) ?? {};
      const context = adapter.createContext();
      return tool.handler(normalizedParams, context);
    };
  }

  // Add method aliases for this group
  const aliases = METHOD_ALIASES[groupName];
  if (aliases !== undefined) {
    for (const [aliasName, canonicalName] of Object.entries(aliases)) {
      if (api[canonicalName] !== undefined) {
        api[aliasName] = api[canonicalName];
      }
    }
  }

  return api;
}

/**
 * Convert tool name to camelCase method name
 * Examples:
 *   mysql_read_query (core) -> readQuery
 *   mysql_json_extract (json) -> extract
 *   mysql_fulltext_search (fulltext) -> fulltextSearch
 *   mysql_sys_schema_stats (sysschema) -> sysSchemaStats
 */
function toolNameToMethodName(toolName: string, groupName: string): string {
  // Remove mysql_ prefix
  let name = toolName.replace(/^mysql_/, "");

  // Map group name to its tool name prefix
  // Some groups use different prefixes in tool names
  const groupPrefixMap: Record<string, string> = {
    sysschema: "sys_",
    fulltext: "fulltext_",
    docstore: "doc_",
    transactions: "transaction_",
    // Default: use groupName + "_"
  };

  const groupPrefix = groupPrefixMap[groupName] ?? groupName + "_";

  // For certain groups, keep the prefix as part of the method name
  // because the tool names use a prefix that differs from the group
  const keepPrefix = new Set([
    "fulltext",
    "sysschema",
    "docstore",
    "transactions",
    "cluster",
    "router",
    "spatial",
    "security",
    "stats",
    "roles",
    "events",
  ]);

  if (!keepPrefix.has(groupName) && name.startsWith(groupPrefix)) {
    name = name.substring(groupPrefix.length);
  }

  // Convert snake_case to camelCase
  return name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

// Type alias for group API record
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

  private readonly toolsByGroup: Map<string, ToolDefinition[]>;

  constructor(adapter: MySQLAdapter) {
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
      return Object.keys(groupApi as Record<string, unknown>);
    }
    return [];
  }

  /**
   * Get help information listing all groups and their methods.
   * Call mysql.help() in code mode to discover available APIs.
   *
   * @returns Object with group names as keys and arrays of method names as values
   */
  help(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [group, tools] of this.toolsByGroup) {
      // Skip codemode group itself
      if (group === "codemode") continue;
      result[group] = tools.map((t) => toolNameToMethodName(t.name, group));
    }
    return result;
  }

  /**
   * Create a serializable API binding for the sandbox
   * This creates references that can be called from the vm context
   */
  createSandboxBindings(): Record<string, unknown> {
    const bindings: Record<string, unknown> = {};

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
    ] as const;

    for (const groupName of groupNames) {
      const groupApi = this[groupName];
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

      // Add all methods plus a 'help' property that lists them
      bindings[groupName] = {
        ...groupApi,
        help: () => ({
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
export function createMysqlApi(adapter: MySQLAdapter): MysqlApi {
  return new MysqlApi(adapter);
}
