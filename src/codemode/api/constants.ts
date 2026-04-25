/**
 * Method aliases for code mode API.
 * Maps alternate method names to their canonical method names.
 * Format: { groupName: { aliasName: canonicalName } }
 *
 * These aliases handle common naming misguesses where agents
 * might try the redundant prefix pattern (e.g., jsonExtract vs extract).
 */
export const METHOD_ALIASES: Record<string, Record<string, string>> = {
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
    status: "slaveStatus",
    master: "masterStatus",
    slave: "slaveStatus",
    binlog: "binlogEvents",
    gtid: "gtidStatus",
    replicationLag: "lag",
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
  // Stats: intuitive aliases
  stats: {
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

    pointInPolygon: "contains",
  },
  // Security: intuitive aliases
  security: {
    ssl: "sslStatus",
    encryption: "encryptionStatus",
    firewall: "firewallStatus",
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
    metadata: "metadataStatus",
    pool: "poolStatus",
    connections: "routeConnections",
    destinations: "routeDestinations",
    blocked: "routeBlockedHosts",
  },
  // Shell: shorter aliases
  shell: {
    run: "runScript",
    script: "runScript",
    upgrade: "checkUpgrade",
    dump: "dumpInstance",
    load: "loadDump",
    export: "exportTable",
    import: "importTable",
  },
};

/**
 * Usage examples for each group's help() output.
 * Provides quick-reference examples for common operations.
 */
export const GROUP_EXAMPLES: Record<string, string[]> = {
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
    'mysql.json.contains({ table: "docs", column: "data", value: \'{"type": "admin"}\' })',
    "mysql.json.merge({ json1: '{\"a\": 1}', json2: '{\"b\": 2}' })",
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
    "mysql.optimization.indexRecommendation({ table: 'orders' })",
    "mysql.optimization.queryRewrite({ query: 'SELECT * FROM orders WHERE status = ?' })",
    'mysql.optimization.forceIndex({ table: "orders", query: "SELECT * FROM orders WHERE status = ?", indexName: "idx_status" })',
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
    "mysql.backup.importData({ table: 'users', data: [{ name: 'Alice', email: 'alice@test.com' }] })",
    "mysql.backup.restoreDump({ filename: 'backup.sql' })",
  ],
  replication: [
    "mysql.replication.slaveStatus()",
    "mysql.replication.lag()",
    "mysql.replication.masterStatus()",
    "mysql.replication.binlogEvents({ limit: 20 })",
  ],
  partitioning: [
    "mysql.partitioning.partitionInfo({ table: 'events' })",
    "mysql.partitioning.addPartition({ table: 'events', partitionName: 'p2024q1', partitionType: 'RANGE', value: '2024040100' })",
    "mysql.partitioning.dropPartition({ table: 'events', partitionName: 'p2023q1' })",
  ],
  schema: [
    "mysql.schema.listViews()",
    "mysql.schema.createView({ name: 'active_users', definition: 'SELECT * FROM users WHERE active = 1' })",
    "mysql.schema.listFunctions()",
    "mysql.schema.listTriggers({ table: 'orders' })",
  ],
  events: [
    "mysql.events.eventCreate({ name: 'cleanup', schedule: { type: 'RECURRING', interval: 1, intervalUnit: 'DAY' }, body: 'DELETE FROM logs WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)' })",
    "mysql.events.eventList()",
    "mysql.events.schedulerStatus()",
  ],
  sysschema: [
    "mysql.sysschema.sysSchemaStats({ schema: 'testdb' })",
    "mysql.sysschema.sysStatementSummary({ limit: 10 })",
    "mysql.sysschema.sysInnodbLockWaits()",
    "mysql.sysschema.sysMemorySummary()",
  ],
  stats: [
    "mysql.stats.descriptive({ table: 'orders', column: 'amount' })",
    "mysql.stats.percentiles({ table: 'orders', column: 'amount', percentiles: [50, 95, 99] })",
    "mysql.stats.timeSeries({ table: 'metrics', timeColumn: 'ts', valueColumn: 'value', interval: 'hour' })",
    "mysql.stats.histogram({ table: 'orders', column: 'amount', buckets: 10 })",
  ],
  spatial: [
    "mysql.spatial.distance({ table: 'locations', spatialColumn: 'geom', point: { longitude: -74, latitude: 40.7 } })",
    "mysql.spatial.distanceSphere({ table: 'locations', spatialColumn: 'geom', point: { longitude: -74, latitude: 40.7 } })",
    "mysql.spatial.point({ longitude: -74, latitude: 40.7 })",
    "mysql.spatial.buffer({ geometry: 'POINT(-74 40.7)', distance: 1000 })",
  ],
  security: [
    "mysql.security.sslStatus()",
    "mysql.security.userPrivileges({ user: 'app_user' })",
    "mysql.security.audit()",
    "mysql.security.sensitiveTables()",
    "mysql.security.passwordValidate({ password: 'test123' })",
  ],
  cluster: [
    "mysql.cluster.clusterStatus({ summary: true })",
    "mysql.cluster.clusterRouterStatus({ summary: true })",
    "mysql.cluster.clusterSwitchover()",
    "mysql.cluster.grMembers()",
    "mysql.cluster.clusterTopology()",
  ],
  roles: [
    "mysql.roles.roleCreate({ name: 'app_reader' })",
    "mysql.roles.roleGrant({ role: 'app_reader', privileges: ['SELECT'], database: 'mydb' })",
    "mysql.roles.roleAssign({ role: 'app_reader', user: 'app_user' })",
    "mysql.roles.roleList()",
  ],
  docstore: [
    "mysql.docstore.docCreateCollection({ name: 'products', schema: 'mydb' })",
    "mysql.docstore.docAdd({ collection: 'products', documents: [{ name: 'Widget', price: 9.99 }] })",
    "mysql.docstore.docFind({ collection: 'products', filter: '$.name' })",
  ],
  router: [
    "mysql.router.status()",
    "mysql.router.routes()",
    "mysql.router.routeHealth({ routeName: 'myroute' })",
  ],
  proxysql: [
    "// ProxySQL requires external ProxySQL admin connection",
    "// See tool descriptions for connection requirements",
  ],
  shell: [
    "mysql.shell.version()",
    'mysql.shell.runScript({ script: \'print("hello")\', language: "js" })',
    "mysql.shell.exportTable({ schema: 'mydb', table: 'users', outputPath: '/tmp/users.csv', format: 'csv' })",
    "mysql.shell.dumpSchemas({ schemas: ['mydb'], outputDir: '/backup/mydb', dryRun: true })",
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
export const POSITIONAL_PARAM_MAP: Record<string, string | string[]> = {
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
  contains: ["table", "column", "value"],
  keys: ["table", "column", "where"],
  replace: ["table", "column", "path", "value", "where"],
  get: ["table", "column", "path"],
  search: ["table", "column", "searchValue"],
  update: ["table", "column", "path", "value", "where"],
  validate: ["table", "column"],
  stats: ["table", "column"],
  indexSuggest: ["table", "column"],
  normalize: ["table", "column"],
  merge: ["json1", "json2"],
  diff: ["json1", "json2"],
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
  restoreDump: "filename",

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
};

