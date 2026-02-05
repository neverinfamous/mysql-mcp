/**
 * ProxySQL Types and Schemas
 *
 * Type definitions and Zod validation schemas for ProxySQL admin interface tools.
 * ProxySQL uses MySQL-protocol compatible admin interface on port 6032.
 */

import { z } from "zod";

// =============================================================================
// ProxySQL Configuration
// =============================================================================

export const ProxySQLConfigSchema = z.object({
  host: z.string().default("localhost"),
  port: z.number().default(6032),
  user: z.string().default("admin"),
  password: z.string().default("admin"),
});

export type ProxySQLConfig = z.infer<typeof ProxySQLConfigSchema>;

// =============================================================================
// Stats Response Types
// =============================================================================

export const ProxySQLServerSchema = z.object({
  hostgroup_id: z.number(),
  hostname: z.string(),
  port: z.number(),
  status: z.string(),
  weight: z.number().optional(),
  compression: z.number().optional(),
  max_connections: z.number().optional(),
  max_replication_lag: z.number().optional(),
  use_ssl: z.number().optional(),
  max_latency_ms: z.number().optional(),
  comment: z.string().optional(),
});

export type ProxySQLServer = z.infer<typeof ProxySQLServerSchema>;

export const ProxySQLHostgroupSchema = z.object({
  hostgroup_id: z.number(),
  hostname: z.string(),
  port: z.number(),
  status: z.string(),
  ConnUsed: z.number().optional(),
  ConnFree: z.number().optional(),
  ConnOK: z.number().optional(),
  ConnERR: z.number().optional(),
  MaxConnUsed: z.number().optional(),
  Queries: z.number().optional(),
  Bytes_data_sent: z.number().optional(),
  Bytes_data_recv: z.number().optional(),
  Latency_us: z.number().optional(),
});

export type ProxySQLHostgroup = z.infer<typeof ProxySQLHostgroupSchema>;

export const ProxySQLQueryRuleSchema = z.object({
  rule_id: z.number(),
  active: z.number().optional(),
  username: z.string().optional(),
  schemaname: z.string().optional(),
  match_digest: z.string().optional(),
  match_pattern: z.string().optional(),
  destination_hostgroup: z.number().optional(),
  cache_ttl: z.number().optional(),
  multiplex: z.number().optional(),
  flagOUT: z.number().optional(),
  comment: z.string().optional(),
});

export type ProxySQLQueryRule = z.infer<typeof ProxySQLQueryRuleSchema>;

export const ProxySQLQueryDigestSchema = z.object({
  hostgroup: z.number(),
  schemaname: z.string(),
  username: z.string(),
  digest: z.string(),
  digest_text: z.string(),
  count_star: z.number(),
  first_seen: z.number().optional(),
  last_seen: z.number().optional(),
  sum_time: z.number().optional(),
  min_time: z.number().optional(),
  max_time: z.number().optional(),
});

export type ProxySQLQueryDigest = z.infer<typeof ProxySQLQueryDigestSchema>;

export const ProxySQLConnectionPoolSchema = z.object({
  hostgroup: z.number(),
  srv_host: z.string(),
  srv_port: z.number(),
  status: z.string(),
  ConnUsed: z.number(),
  ConnFree: z.number(),
  ConnOK: z.number(),
  ConnERR: z.number(),
  MaxConnUsed: z.number(),
  Queries: z.number(),
  Bytes_data_sent: z.number(),
  Bytes_data_recv: z.number(),
  Latency_us: z.number(),
});

export type ProxySQLConnectionPool = z.infer<
  typeof ProxySQLConnectionPoolSchema
>;

export const ProxySQLUserSchema = z.object({
  username: z.string(),
  password: z.string().optional(),
  active: z.number().optional(),
  use_ssl: z.number().optional(),
  default_hostgroup: z.number().optional(),
  default_schema: z.string().optional(),
  transaction_persistent: z.number().optional(),
  max_connections: z.number().optional(),
  comment: z.string().optional(),
});

export type ProxySQLUser = z.infer<typeof ProxySQLUserSchema>;

export const ProxySQLGlobalVariableSchema = z.object({
  variable_name: z.string(),
  variable_value: z.string(),
});

export type ProxySQLGlobalVariable = z.infer<
  typeof ProxySQLGlobalVariableSchema
>;

export const ProxySQLMemoryStatsSchema = z.object({
  Variable_Name: z.string(),
  Variable_Value: z.string(),
});

export type ProxySQLMemoryStats = z.infer<typeof ProxySQLMemoryStatsSchema>;

export const ProxySQLProcessSchema = z.object({
  SessionID: z.number().optional(),
  user: z.string().optional(),
  db: z.string().optional(),
  cli_host: z.string().optional(),
  cli_port: z.number().optional(),
  hostgroup: z.number().optional(),
  srv_host: z.string().optional(),
  srv_port: z.number().optional(),
  command: z.string().optional(),
  time_ms: z.number().optional(),
  info: z.string().optional(),
});

export type ProxySQLProcess = z.infer<typeof ProxySQLProcessSchema>;

// =============================================================================
// Tool Input Schemas
// =============================================================================

export const ProxySQLBaseInputSchema = z.object({});

export const ProxySQLLimitInputSchema = z.object({
  limit: z
    .number()
    .optional()
    .describe("Maximum number of results to return (default: 100)"),
});

export const ProxySQLHostgroupInputSchema = z.object({
  hostgroup_id: z.number().optional().describe("Filter by hostgroup ID"),
});

export const ProxySQLVariableFilterSchema = z.object({
  prefix: z
    .enum(["mysql", "admin", "all"])
    .optional()
    .describe("Variable prefix filter: mysql, admin, or all (default: all)"),
});

export const ProxySQLCommandInputSchema = z.object({
  command: z
    .enum([
      "LOAD MYSQL USERS TO RUNTIME",
      "SAVE MYSQL USERS TO DISK",
      "LOAD MYSQL SERVERS TO RUNTIME",
      "SAVE MYSQL SERVERS TO DISK",
      "LOAD MYSQL QUERY RULES TO RUNTIME",
      "SAVE MYSQL QUERY RULES TO DISK",
      "LOAD MYSQL VARIABLES TO RUNTIME",
      "SAVE MYSQL VARIABLES TO DISK",
      "LOAD ADMIN VARIABLES TO RUNTIME",
      "SAVE ADMIN VARIABLES TO DISK",
      "PROXYSQL FLUSH QUERY CACHE",
      "PROXYSQL FLUSH LOGS",
    ])
    .describe("ProxySQL admin command to execute"),
});

export type ProxySQLCommand = z.infer<
  typeof ProxySQLCommandInputSchema
>["command"];
