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
    stats: "tableStats",
    threads: "threadStats",
    queries: "queryStats",
    slowlog: "slowQueries",
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
    serverConfig: "serverConfig",
    config: "serverConfig",
  },
  // Monitoring: intuitive aliases
  monitoring: {
    status: "showStatus",
    variables: "showVariables",
    processes: "showProcesslist",
    processlist: "showProcesslist",
    innodb: "innodbStatus",
    health: "serverHealth",
    pool: "poolStats",
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
    lag: "replicationLag",
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
    innodbLockWaits: "sysInnodbLockWaits",
    memory: "sysMemorySummary",
    memorySummary: "sysMemorySummary",
    statements: "sysStatementSummary",
    statementSummary: "sysStatementSummary",
    waits: "sysWaitSummary",
    waitSummary: "sysWaitSummary",
    io: "sysIoSummary",
    ioSummary: "sysIoSummary",
    users: "sysUserSummary",
    userSummary: "sysUserSummary",
    hosts: "sysHostSummary",
    hostSummary: "sysHostSummary",
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
  // Core: shorter aliases
  core: {
    get: "readQuery",
    query: "readQuery",
    insert: "writeQuery",
    update: "writeQuery",
    delete: "writeQuery",
    list: "listTables",
    describe: "describeTable",
    create: "createTable",
    drop: "dropTable",
  },
};
