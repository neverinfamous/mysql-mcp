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
  createView: ["name", "sql"],

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
  exportTable: "table",
  importData: ["table", "data"],
  restoreDump: ["filename", "database"],
  auditListBackups: "target",
  auditRestoreBackup: "filename",
  auditDiffBackup: "filename",

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

  // ============ REPLICATION GROUP ============
  binlogEvents: ["logFile", "position"],

  // ============ PARTITIONING GROUP ============
  addPartition: ["table", "partitionName", "partitionType", "value"],
  dropPartition: ["table", "partitionName"],
  reorganizePartition: ["table", "partitions"],
  partitionInfo: "table",

  // ============ SPATIAL GROUP ============
  distance: ["table", "spatialColumn"],
  distanceSphere: ["table", "spatialColumn"],
  point: ["longitude", "latitude"],
  polygon: "coordinates",

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

  // ============ SECURITY GROUP ============
  passwordValidate: "password",
};

/**
 * Methods where a single array arg should be wrapped in a specific key
 */
export const ARRAY_WRAP_MAP: Record<string, string> = {
  transactionExecute: "statements",
  execute: "statements",
  flushTables: "tables",
};
