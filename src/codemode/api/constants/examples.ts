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
    "mysql.admin.serverConfig({ logLevel: 'debug' })",
  ],
  monitoring: [
    "mysql.monitoring.showStatus({ pattern: 'Threads%' })",
    "mysql.monitoring.showVariables({ pattern: 'max_connections' })",
    "mysql.monitoring.showProcesslist()",
    "mysql.monitoring.innodbStatus()",
  ],
  backup: [
    "mysql.backup.createDump({ tables: ['users', 'orders'] })",
    "mysql.backup.exportTable({ table: 'users', format: 'csv' })",
    "mysql.backup.importData({ table: 'users', data: [{ name: 'Alice', email: 'alice@test.com' }] })",
    "mysql.backup.restoreDump({ filename: 'backup.sql' })",
  ],
  replication: [
    "mysql.replication.slaveStatus()",
    "mysql.replication.replicationLag()",
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
    "mysql.sys.schemaStats({ schema: 'testdb' })",
    "mysql.sys.statementSummary({ limit: 10 })",
    "mysql.sys.innodbLockWaits()",
    "mysql.sys.memorySummary()",
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
