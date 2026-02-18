/**
 * MySQL MCP Resources
 *
 * Provides structured data access via URI patterns.
 * 18 resources total.
 */
import type { MySQLAdapter } from "../MySQLAdapter.js";
import type { ResourceDefinition } from "../../../types/index.js";

// Core resources
import { createSchemaResource } from "./schema.js";
import { createTablesResource } from "./tables.js";
import { createVariablesResource } from "./variables.js";
import { createStatusResource } from "./status.js";
import { createProcesslistResource } from "./processlist.js";
import { createPoolResource } from "./pool.js";

// Extended monitoring resources
import { createCapabilitiesResource } from "./capabilities.js";
import { createHealthResource } from "./health.js";
import { createPerformanceResource } from "./performance.js";
import { createIndexesResource } from "./indexes.js";
import { createReplicationResource } from "./replication.js";
import { createInnodbResource } from "./innodb.js";

// New resources (6)
import { createEventsResource } from "./events.js";
import { createSysSchemaResource } from "./sysschema.js";
import { createLocksResource } from "./locks.js";
import { createClusterResource } from "./cluster.js";
import { createSpatialResource } from "./spatial.js";
import { createDocstoreResource } from "./docstore.js";

/**
 * Get all MySQL resources (18 total)
 *
 * Core (6):
 * - mysql://schema - Full database schema
 * - mysql://tables - Table listing with metadata
 * - mysql://variables - Server configuration variables
 * - mysql://status - Server status metrics
 * - mysql://processlist - Active connections and queries
 * - mysql://pool - Connection pool statistics
 *
 * Extended Monitoring (6):
 * - mysql://capabilities - Server version, features, tool categories
 * - mysql://health - Comprehensive database health status
 * - mysql://performance - Query performance metrics
 * - mysql://indexes - Index usage and statistics
 * - mysql://replication - Replication status and lag
 * - mysql://innodb - InnoDB buffer pool and engine metrics
 *
 * New (6):
 * - mysql://events - Event Scheduler status and scheduled events
 * - mysql://sysschema - sys schema diagnostics summary
 * - mysql://locks - InnoDB lock contention detection
 * - mysql://cluster - Group Replication/InnoDB Cluster status
 * - mysql://spatial - Spatial columns and indexes
 * - mysql://docstore - Document Store collections
 */
export function getMySQLResources(adapter: MySQLAdapter): ResourceDefinition[] {
  return [
    // Core resources
    createSchemaResource(adapter),
    createTablesResource(adapter),
    createVariablesResource(adapter),
    createStatusResource(adapter),
    createProcesslistResource(adapter),
    createPoolResource(adapter),
    // Extended monitoring resources
    createCapabilitiesResource(adapter),
    createHealthResource(adapter),
    createPerformanceResource(adapter),
    createIndexesResource(adapter),
    createReplicationResource(adapter),
    createInnodbResource(adapter),
    // New resources (6)
    createEventsResource(adapter),
    createSysSchemaResource(adapter),
    createLocksResource(adapter),
    createClusterResource(adapter),
    createSpatialResource(adapter),
    createDocstoreResource(adapter),
  ];
}
