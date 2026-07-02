/**
 * ProxySQL Types and Schemas
 *
 * Type definitions and Zod validation schemas for ProxySQL admin interface tools.
 * ProxySQL uses MySQL-protocol compatible admin interface on port 6032.
 */

import { z } from "zod";
import { BaseOutputSchema } from "./output-schemas.js";

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

export const ProxySQLBaseInputSchema = z.object({}).strict();

export const ProxySQLUsersInputSchemaBase = z.object({
  username: z.unknown().optional().describe("Filter by username"),
});

export const ProxySQLUsersInputSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "string") return { username: val };
    if (typeof val !== "object" || val === null) return val ?? {};
    const result = { ...(val as Record<string, unknown>) };
    
    // Anti-Hallucination: map 'user' or 'name' to 'username'
    if (result["username"] === undefined) {
      if (result["user"] !== undefined) {
        result["username"] = result["user"];
      } else if (result["name"] !== undefined) {
        result["username"] = result["name"];
      }
    }
    delete result["user"];
    delete result["name"];
    
    return result;
  },
  z.object({
    username: z.string().optional().describe("Filter by username. Anti-Hallucination Hint: use 'username', not 'user'."),
  }).strict()
);

export const ProxySQLStatusInputSchemaBase = z.object({
  summary: z
    .unknown()
    .optional()
    .describe(
      "If true (default), returns only key metrics (version, uptime, queries, connections) instead of all status variables. Set to false to get all variables.",
    ),
});

export const ProxySQLStatusInputSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "boolean") return { summary: val };
    if (typeof val !== "object" || val === null) return val ?? {};
    const result = { ...(val as Record<string, unknown>) };
    // Anti-Hallucination: map 'database' to 'summary' because 'status' is heavily overloaded in POSITIONAL_PARAM_MAP
    if (result["database"] !== undefined && result["summary"] === undefined) {
      if (typeof result["database"] === "boolean" || typeof result["database"] === "string") {
        result["summary"] = result["database"];
      }
    }
    // Also map 'table' because 'get' is overloaded to 'table'
    if (result["table"] !== undefined && result["summary"] === undefined) {
      if (typeof result["table"] === "boolean" || typeof result["table"] === "string") {
        result["summary"] = result["table"];
      }
    }
    delete result["database"];
    delete result["table"];
    
    if (typeof result["summary"] === "string") {
      if (result["summary"] === "true") result["summary"] = true;
      else if (result["summary"] === "false") result["summary"] = false;
    }
    return result;
  },
  z.object({
    summary: z
      .boolean()
      .default(true)
      .describe(
        "If true (default), returns only key metrics (version, uptime, queries, connections) instead of all status variables. Anti-Hallucination Hint: pass 'summary', not 'database' or 'table'.",
      ),
  }).strict()
);

export const ProxySQLLimitInputSchemaBase = z.object({
  limit: z
    .unknown()
    .optional()
    .describe("Maximum number of results to return (default: 20)"),
});

export const ProxySQLLimitInputSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "number") return { limit: val };
    if (typeof val !== "object" || val === null) return val ?? {};
    const result = { ...(val as Record<string, unknown>) };
    
    // Anti-hallucination: agents might guess 'count' instead of 'limit'
    if (result["count"] !== undefined && result["limit"] === undefined) {
      result["limit"] = result["count"];
    }
    delete result["count"];

    const limit = result["limit"];
    if (typeof limit === "string" && limit.trim() !== "" && !isNaN(Number(limit))) {
      result["limit"] = Number(limit);
    }
    return result;
  },
  z.object({
    limit: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Maximum number of results to return (default: 20). Anti-Hallucination Hint: use 'limit', not 'count'."),
  }).strict()
);

export const ProxySQLHostgroupInputSchemaBase = z.object({
  hostgroup_id: z.unknown().optional().describe("Filter by hostgroup ID"),
});

export const ProxySQLHostgroupInputSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "number") return { hostgroup_id: val };
    if (typeof val !== "object" || val === null) return val ?? {};
    const result = { ...(val as Record<string, unknown>) };
    // Anti-Hallucination: map 'hostgroup' to 'hostgroup_id'
    if (result["hostgroup"] !== undefined && result["hostgroup_id"] === undefined) {
      result["hostgroup_id"] = result["hostgroup"];
    }
    delete result["hostgroup"];
    
    const hostgroupId = result["hostgroup_id"];
    if (typeof hostgroupId === "string" && hostgroupId.trim() !== "" && !isNaN(Number(hostgroupId))) {
      result["hostgroup_id"] = Number(hostgroupId);
    }
    return result;
  },
  z.object({
    hostgroup_id: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Filter by hostgroup ID. Anti-Hallucination Hint: use 'hostgroup_id', not 'hostgroup'."),
  }).strict()
);

export const ProxySQLVariableFilterSchemaBase = z.object({
  prefix: z
    .unknown()
    .optional()
    .describe("Variable prefix filter: mysql, admin, or all (default: all)"),
  like: z
    .unknown()
    .optional()
    .describe(
      "LIKE pattern to filter variable names (e.g., '%connection%'). Applied after prefix filter.",
    ),
  limit: z
    .unknown()
    .optional()
    .describe("Maximum number of variables to return (default: 10)"),
});

export const ProxySQLVariableFilterSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val !== "object" || val === null) return val ?? {};
    const result = { ...(val as Record<string, unknown>) };
    
    // Anti-Hallucination: map 'pattern', 'search', or 'name' to 'like'
    if (result["like"] === undefined) {
      if (result["pattern"] !== undefined) result["like"] = result["pattern"];
      else if (result["search"] !== undefined) result["like"] = result["search"];
      else if (result["name"] !== undefined) result["like"] = result["name"];
    }
    delete result["pattern"];
    delete result["search"];
    delete result["name"];

    const limit = result["limit"];
    if (typeof limit === "string" && limit.trim() !== "" && !isNaN(Number(limit))) {
      result["limit"] = Number(limit);
    }
    return result;
  },
  z.object({
    prefix: z
      .enum(["mysql", "admin", "all"])
      .optional()
      .describe("Variable prefix filter: mysql, admin, or all (default: all)"),
    like: z
      .string()
      .optional()
      .describe(
        "LIKE pattern to filter variable names (e.g., '%connection%'). Applied after prefix filter.",
      ),
    limit: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Maximum number of variables to return (default: 10)"),
  }).strict()
);

export const ProxySQLCommandInputSchemaBase = z.object({
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

export const ProxySQLCommandInputSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "string") return { command: val };
    if (typeof val !== "object" || val === null) return val ?? {};
    return val;
  },
  z.object({
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
  }).strict()
);

export type ProxySQLCommand = z.infer<
  typeof ProxySQLCommandInputSchema
>["command"];

// =============================================================================
// Tool Output Schemas
// =============================================================================

export const ProxySQLStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    summary: z.boolean(),
    version: z.string(),
    uptime: z.string(),
    stats: z.array(z.record(z.string(), z.unknown())),
    totalVarsAvailable: z.number(),
  }).loose().optional(),
});

export const ProxySQLRuntimeStatusOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    summary: z.boolean(),
    version: z.string(),
    adminVariables: z.array(z.record(z.string(), z.unknown())),
    totalAdminVarsAvailable: z.number(),
  }).loose().optional(),
});

export const ProxySQLServersOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    servers: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).loose().optional(),
});

export const ProxySQLQueryRulesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    queryRules: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).loose().optional(),
});

export const ProxySQLQueryDigestOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    queryDigests: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).loose().optional(),
});

export const ProxySQLConnectionPoolOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    connectionPools: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).loose().optional(),
});

export const ProxySQLUsersOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    users: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).loose().optional(),
});

export const ProxySQLGlobalVariablesOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    variables: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
    totalVarsAvailable: z.number(),
  }).loose().optional(),
});

export const ProxySQLMemoryStatsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    memoryStats: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).loose().optional(),
});

export const ProxySQLCommandsOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    command: z.string(),
    message: z.string(),
  }).loose().optional(),
});

export const ProxySQLProcessListOutputSchema = BaseOutputSchema.extend({
  data: z.object({
    processes: z.array(z.record(z.string(), z.unknown())),
    count: z.number(),
  }).loose().optional(),
});
