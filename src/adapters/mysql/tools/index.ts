/**
 * MySQL Adapter Tools - Index
 * 
 * Aggregates all tool exports for the MySQL adapter.
 */

// Core tools
export { getCoreTools } from './core.js';

// Transaction tools
export { getTransactionTools } from './transactions.js';

// JSON tools
export { getJsonTools, getJsonHelperTools, getJsonEnhancedTools } from './json/index.js';

// Text and fulltext tools
export { getTextTools, getFulltextTools } from './text/index.js';

// Performance and optimization tools
export { getPerformanceTools, getOptimizationTools } from './performance/index.js';

// Admin, monitoring, and backup tools
export { getAdminTools, getMonitoringTools, getBackupTools } from './admin/index.js';

// Replication and partitioning tools
export { getReplicationTools } from './replication.js';
export { getPartitioningTools } from './partitioning.js';

// Router management tools
export { getRouterTools } from './router.js';

// ProxySQL management tools
export { getProxySQLTools } from './proxysql.js';

// Schema management tools
export { getSchemaTools } from './schema/index.js';

// Event scheduler tools
export { getEventTools } from './events.js';

// sys schema tools
export { getSysSchemaTools } from './sysschema/index.js';

// Statistics tools
export { getStatsTools } from './stats/index.js';

// Spatial/GIS tools
export { getSpatialTools } from './spatial/index.js';

// Security tools
export { getSecurityTools } from './security/index.js';

// Cluster/Group Replication tools
export { getClusterTools } from './cluster/index.js';

// Role management tools
export { getRoleTools } from './roles.js';

// Document Store tools
export { getDocStoreTools } from './docstore.js';
