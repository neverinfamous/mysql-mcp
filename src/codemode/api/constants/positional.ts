/**
 * Mapping of method names to their parameter names for positional argument support.
 * Single string = first positional arg maps to this key
 * Array = multiple positional args map to these keys in order
 *
 * Enables:
 * - `mysql.core.readQuery("SELECT...")` → `{ sql: "SELECT..." }`
 * - `mysql.core.describeTable("users")` → `{ table: "users" }`
 */
export const POSITIONAL_PARAM_MAP: Record<string, string | string[]> = {
  // ============ CORE GROUP ============
  readQuery: ["sql", "params"],
  writeQuery: ["sql", "params"],
  describeTable: "table",
  dropTable: "table",
  listTables: "database",
  getIndexes: "table",
  dropIndex: "name",
  createTable: ["name", "columns"],
  createIndex: ["table", "columns"],
  enableVersioning: "table",
  disableVersioning: "table",
  checkVersion: ["table", "rowId"],
  conditionalUpdate: ["table", "data", "conditions", "expectedVersion"],

  // ============ SCHEMA GROUP ============
  createSchema: "name",
  dropSchema: "name",
  listSchemas: "pattern",
  listViews: "database",
  listFunctions: "database",
  listStoredProcedures: "database",
  listTriggers: "table",
  listConstraints: "table",
  listEvents: "pattern",
  createView: ["name", "sql"],
  dropView: "name",

  // ============ JSON GROUP ============
  extract: ["table", "column", "path", "where"],
  set: ["table", "column", "path", "value", "where"],
  insert: ["table", "column", "path", "value", "where"],
  remove: ["table", "column", "path", "where"],
  contains: ["table", "column", "value"],
  keys: ["table", "column", "path", "where"],
  replace: ["table", "column", "path", "value", "where"],
  get: ["table", "column", "path", "where"],
  search: ["table", "column", "searchValue"],
  update: ["table", "column", "path", "value", "where"],
  validate: "value",
  stats: ["table", "column"],
  indexSuggest: ["table", "column"],
  normalize: ["table", "column"],
  merge: ["json1", "json2"],
  diff: ["json1", "json2"],
  arrayAppend: ["table", "column", "path", "value", "where"],

  // ============ TEXT GROUP ============
  regexpMatch: ["table", "column", "pattern"],
  likeSearch: ["table", "column", "pattern"],
  soundex: ["table", "column", "value"],
  substring: ["table", "column", "start", "length"],
  concat: ["table", "...columns"],
  collationConvert: ["table", "column", "charset", "collation"],

  // ============ FULLTEXT GROUP ============
  fulltextCreate: ["table", "columns"],
  fulltextDrop: ["table", "indexName"],
  fulltextSearch: ["table", "columns", "query"],
  fulltextBoolean: ["table", "columns", "query"],
  fulltextExpand: ["table", "columns", "query"],

  // ============ TRANSACTION GROUP ============
  transactionBegin: "isolationLevel",
  transactionCommit: "transactionId",
  transactionRollback: "transactionId",
  transactionSavepoint: ["transactionId", "name"],
  transactionRelease: ["transactionId", "name"],
  transactionRollbackTo: ["transactionId", "name"],
  transactionExecute: ["statements", "isolationLevel"],
  // Short aliases
  begin: "isolationLevel",
  commit: "transactionId",
  rollback: "transactionId",
  savepoint: ["transactionId", "name"],
  createSavepoint: ["transactionId", "name"],
  addSavepoint: ["transactionId", "name"],
  release: ["transactionId", "name"],
  releaseSavepoint: ["transactionId", "name"],
  removeSavepoint: ["transactionId", "name"],
  dropSavepoint: ["transactionId", "name"],
  rollbackTo: ["transactionId", "name"],
  rollbackToSavepoint: ["transactionId", "name"],
  revertToSavepoint: ["transactionId", "name"],
  execute: ["statements", "isolationLevel"],

  // ============ PERFORMANCE GROUP ============
  explain: "sql",
  explainAnalyze: "sql",
  indexUsage: "table",
  tableStats: "table",
  threadStats: "limit",
  detectQueryAnomalies: "threshold",
  detectBloatRisk: "table",
  detectConnectionSpike: "warningPercent",

  // ============ OPTIMIZATION GROUP ============
  indexRecommendation: "table",
  forceIndex: ["table", "query", "indexName"],
  mysql_force_index: ["table", "query", "indexName"],
  queryRewrite: "query",
  optimizerTrace: "query",
  mysql_optimizer_trace: "query",

  // ============ ADMIN GROUP ============
  checkTable: "table",
  repairTable: "table",
  optimizeTable: "table",
  analyzeTable: "table",
  killQuery: "processId",
  flushTables: "tables",
  serverConfig: ["action", "setting", "value"],
  appendInsight: "insight",
  auditSearch: "search",

  // ============ MONITORING GROUP ============
  showStatus: "like",
  showVariables: "like",
  showProcesslist: "limit",
  innodbStatus: "summary",
  replicationStatus: "summary",

  // ============ BACKUP GROUP ============
  createDump: "database",
  exportTable: ["table", "outputPath"],
  importData: ["table", "data"],
  restoreDump: ["filename", "database"],
  auditListBackups: "target",
  auditRestoreBackup: "filename",
  auditDiffBackup: "filename",

  // ============ EVENTS GROUP ============
  eventCreate: ["name", "schedule", "body"],
  eventAlter: ["name", "schedule", "body"],
  eventDrop: "name",
  eventList: "schema",
  eventStatus: "name",

  // ============ STATS GROUP ============
  descriptive: ["table", "column"],
  percentiles: ["table", "column", "percentiles"],
  distribution: ["table", "column"],
  histogram: ["table", "column", "buckets"],
  correlation: ["table", "column1", "column2"],
  regression: ["table", "xColumn", "yColumn"],
  sampling: ["table", "sampleSize"],
  timeSeries: ["table", "timeColumn", "valueColumn"],
  rowNumber: ["table", "orderBy", "partitionBy"],
  rank: ["table", "orderBy", "partitionBy"],
  lagLead: ["table", "column", "orderBy"],
  runningTotal: ["table", "column", "orderBy"],
  movingAvg: ["table", "column", "orderBy", "windowSize"],
  ntile: ["table", "orderBy", "buckets"],
  hypothesis: ["table", "column", "hypothesizedMean", "groupColumn"],
  outliers: ["table", "column", "method"],
  topN: ["table", "column", "n"],
  distinct: ["table", "column", "limit"],
  frequency: ["table", "column", "limit"],
  summary: ["table", "columns"],
  // Stats prefixed aliases
  statsTimeSeries: ["table", "timeColumn", "valueColumn"],
  statsDescriptive: ["table", "column"],
  statsPercentiles: ["table", "column", "percentiles"],
  statsDistribution: ["table", "column"],
  statsCorrelation: ["table", "column1", "column2"],
  statsHistogram: ["table", "column", "buckets"],
  statsSampling: ["table", "sampleSize"],
  statsRegression: ["table", "xColumn", "yColumn"],

  // ============ MIGRATION GROUP ============
  init: "database",
  record: ["version", "migrationSql"],
  apply: ["version", "migrationSql"],
  history: "limit",
  status: "database",

  // ============ REPLICATION GROUP ============
  binlogEvents: ["logFile", "position"],

  // ============ ROLES GROUP ============
  roleCreate: "name",
  roleDrop: "name",
  roleGrants: "role",
  roleGrant: ["role", "privileges", "on"],
  roleAssign: ["role", "user"],
  roleRevoke: ["role", "user"],
  roleList: "role",
  userRoles: "user",
  getRoles: "user",

  // ============ VECTOR GROUP ============
  store: ["table", "column", "id", "vector"],
  batchStore: ["table", "column", "items"],
  delete: ["table", "id"],
  get: ["table", "id"],
  search: ["table", "column", "queryVector"],
  rangeSearch: ["table", "column", "queryVector", "maxDistance"],
  hybridSearch: ["table", "vectorColumn", "textColumn", "queryText"],
  info: ["table", "column"],
  createIndex: ["table", "column", "metric"],
  optimize: "table",
  stats: ["table", "column"],

  // ============ DOCSTORE GROUP ============
  docCreateCollection: "name",
  docDropCollection: "name",
  docCollectionInfo: "collection",
  docListCollections: "schema",
  docFind: ["collection", "query"],
  docAdd: ["collection", "document"],
  docModify: ["collection", "documentId", "patch"],
  docRemove: ["collection", "documentId"],
  docCreateIndex: ["collection", "indexName", "fields"],

  // ============ PARTITIONING GROUP ============
  addPartition: ["table", "partitionName", "partitionType", "value"],
  dropPartition: ["table", "partitionName"],
  reorganizePartition: ["table", "fromPartitions", "toPartitions"],
  partitionInfo: "table",

  // ============ SPATIAL GROUP ============
  createColumn: ["table", "column", "type"],
  distance: ["table", "spatialColumn"],
  distanceSphere: ["table", "spatialColumn"],
  point: ["longitude", "latitude"],
  polygon: ["table", "spatialColumn", "coordinates"],
  within: ["table", "spatialColumn", "geometry"],
  intersection: ["geometry1", "geometry2"],
  buffer: ["geometry", "distance"],
  transform: ["geometry", "fromSrid", "toSrid"],
  geojson: "geometry",

  // ============ SHELL GROUP ============
  // Note: exportTable omitted — conflicts with backup group's exportTable
  checkUpgrade: "targetVersion",
  runScript: ["script", "language"],
  importTable: ["inputPath", "schema", "table"],
  importJson: ["inputPath", "schema", "collection"],
  dumpInstance: "outputDir",
  dumpSchemas: ["schemas", "outputDir"],
  dumpTables: ["schema", "tables", "outputDir"],
  loadDump: "inputDir",

  // ============ CLUSTER GROUP ============
  grMembers: "memberId",
  mysql_gr_members: "memberId",
  clusterStatus: "summary",
  mysql_cluster_status: "summary",
  clusterInstances: "limit",
  mysql_cluster_instances: "limit",
  clusterRouterStatus: "summary",
  mysql_cluster_router_status: "summary",

  // ============ INTROSPECTION GROUP ============
  dependencyGraph: "schema",
  topologicalSort: "schema",
  cascadeSimulator: "table",
  schemaSnapshot: "schema",
  constraintAnalysis: "schema",
  migrationRisks: "statements",

  // ============ SECURITY GROUP ============
  passwordValidate: "password",
  maskData: ["value", "type"],
  audit: "user",
  firewallRules: "user",
  userPrivileges: "user",
  sensitiveTables: "schema",

  // ============ ROUTER GROUP ============
  routeStatus: "routeName",
  routeHealth: "routeName",
  routeConnections: "routeName",
  routeDestinations: "routeName",
  routeBlockedHosts: "routeName",
  metadataStatus: "metadataName",
  poolStatus: "poolName",

  // ============ SYSSCHEMA GROUP ============
  sysUserSummary: "user",
  userSummary: "user",
  sysHostSummary: "host",
  hostSummary: "host",
  hosts: "host",
  sysStatementSummary: "orderBy",
  statementSummary: "orderBy",
  statements: "orderBy",
  sysWaitSummary: "type",
  waitSummary: "type",
  waits: "type",
  sysIoSummary: "type",
  ioSummary: "type",
  io: "type",
  sysSchemaStats: "schema",
  schemaStats: "schema",
  sysInnodbLockWaits: "limit",
  lockWaits: "limit",
  innodbLockWaits: "limit",
  sysMemorySummary: "limit",
  memorySummary: "limit",
  memory: "limit",

  // ============ PROXYSQL GROUP ============
  proxysql_status: "summary",
  proxysql_runtime_status: "summary",
  runtimeStatus: "summary",
  proxysql_servers: "hostgroup_id",
  servers: "hostgroup_id",
  proxysql_connection_pool: "hostgroup_id",
  connectionPool: "hostgroup_id",
  proxysql_query_rules: "limit",
  queryRules: "limit",
  proxysql_query_digest: "limit",
  queryDigest: "limit",
  proxysql_commands: "command",
  commands: "command",
  proxysql_users: "username",
  users: "username",
  proxysql_global_variables: "like",
  globalVariables: "like",
  proxysql_process_list: "limit",
  processList: "limit",
  proxysql_memory_stats: "limit",
  memoryStats: "limit",
};

/**
 * Methods where a single array arg should be wrapped in a specific key
 */
export const ARRAY_WRAP_MAP: Record<string, string> = {
  flushTables: "tables",
  transactionExecute: "statements",
  execute: "statements",
  polygon: "coordinates",
};
