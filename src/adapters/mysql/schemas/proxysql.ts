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
}).loose();

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
}).loose();

export type ProxySQLHostgroup = z.infer<typeof ProxySQLHostgroupSchema>;

export const ProxySQLQueryRuleSchema = z.object({
  rule_id: z.coerce.number(),
  active: z.coerce.number().optional(),
  username: z.string().nullable().optional(),
  schemaname: z.string().nullable().optional(),
  client_addr: z.string().nullable().optional(),
  proxy_addr: z.string().nullable().optional(),
  proxy_port: z.coerce.number().nullable().optional(),
  digest: z.string().nullable().optional(),
  match_digest: z.string().nullable().optional(),
  match_pattern: z.string().nullable().optional(),
  negate_match_pattern: z.coerce.number().optional(),
  re_modifiers: z.string().nullable().optional(),
  replace_pattern: z.string().nullable().optional(),
  destination_hostgroup: z.coerce.number().optional(),
  cache_ttl: z.coerce.number().optional(),
  cache_empty_result: z.coerce.number().nullable().optional(),
  cache_timeout: z.coerce.number().nullable().optional(),
  reconnect: z.coerce.number().nullable().optional(),
  timeout: z.coerce.number().nullable().optional(),
  retries: z.coerce.number().nullable().optional(),
  delay: z.coerce.number().nullable().optional(),
  next_query_flagIN: z.coerce.number().nullable().optional(),
  mirror_flagOUT: z.coerce.number().nullable().optional(),
  mirror_hostgroup: z.coerce.number().nullable().optional(),
  error_msg: z.string().nullable().optional(),
  OK_msg: z.string().nullable().optional(),
  sticky_conn: z.coerce.number().nullable().optional(),
  multiplex: z.coerce.number().optional(),
  gtid_from_hostgroup: z.coerce.number().nullable().optional(),
  log: z.coerce.number().nullable().optional(),
  apply: z.coerce.number().optional(),
  flagIN: z.coerce.number().optional(),
  flagOUT: z.coerce.number().optional(),
  attributes: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
}).loose();

export type ProxySQLQueryRule = z.infer<typeof ProxySQLQueryRuleSchema>;

export const ProxySQLQueryDigestSchema = z.object({
  hostgroup: z.coerce.number(),
  schemaname: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  digest: z.string(),
  digest_text: z.string(),
  count_star: z.coerce.number(),
  first_seen: z.coerce.number().optional(),
  last_seen: z.coerce.number().optional(),
  sum_time: z.coerce.number().optional(),
  min_time: z.coerce.number().optional(),
  max_time: z.coerce.number().optional(),
}).loose();

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
}).loose();

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
}).loose();

export type ProxySQLUser = z.infer<typeof ProxySQLUserSchema>;

export const ProxySQLGlobalVariableSchema = z.object({
  variable_name: z.string(),
  variable_value: z.string(),
}).loose();

export type ProxySQLGlobalVariable = z.infer<
  typeof ProxySQLGlobalVariableSchema
>;

export const ProxySQLMemoryStatsSchema = z.object({
  Variable_Name: z.string(),
  Variable_Value: z.string(),
}).loose();

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
}).loose();

export type ProxySQLProcess = z.infer<typeof ProxySQLProcessSchema>;

// =============================================================================
// Tool Input Schemas
// =============================================================================

export const ProxySQLBaseInputSchemaBase = z.object({}).loose();

export const ProxySQLBaseInputSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val !== "object" || val === null) return val ?? {};
    const result = { ...(val as Record<string, unknown>) };
    
    // Anti-Hallucination: Agents may send limit/count to tools that don't support it
    delete result["limit"];
    delete result["count"];
    delete result["max"];
    delete result["top"];
    delete result["rows"];
    delete result["size"];
    delete result["take"];
    delete result["sort"];
    delete result["orderBy"];
    delete result["order_by"];
    
    // Anti-Hallucination: Agents may send summary/database to status-like tools
    delete result["summary"];
    delete result["database"];
    delete result["schema"];
    delete result["table"];
    delete result["status"];
    delete result["stats"];
    delete result["variables"];
    delete result["metrics"];
    delete result["filter"];
    delete result["pattern"];
    delete result["search"];
    delete result["like"];
    delete result["name"];
    delete result["variable"];
    delete result["category"];
    delete result["type"];
    delete result["group"];
    delete result["query"];
    delete result["sql"];
    delete result["statement"];
    delete result["command"];
    delete result["user"];
    delete result["username"];
    delete result["hostgroup"];
    delete result["hostgroup_id"];
    delete result["server"];
    delete result["host"];
    delete result["port"];
    delete result["id"];
    delete result["rule_id"];
    delete result["match_digest"];
    delete result["digest"];
    delete result["SessionID"];
    delete result["cli_host"];
    delete result["cli_port"];
    delete result["srv_host"];
    delete result["srv_port"];
    delete result["time_ms"];
    delete result["info"];
    
    return result;
  },
  z.object({}).strict()
);

export const ProxySQLUsersInputSchemaBase = z.object({
  username: z.any().optional().describe("Filter by username. Anti-Hallucination Hint: use 'username', not 'user'."),
  user: z.any().optional().describe("Alias for username"),
  name: z.any().optional().describe("Alias for username"),
  id: z.any().optional().describe("Alias for username"),
}).loose();

export const ProxySQLUsersInputSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "string") return { username: val };
    if (typeof val === "number") return { username: String(val) };
    if (typeof val !== "object" || val === null) return val ?? {};
    const result = { ...(val as Record<string, unknown>) };
    
    // Anti-Hallucination: map 'user' or 'name' or 'id' to 'username'
    if (result["username"] === undefined) {
      if (result["user"] !== undefined) {
        result["username"] = result["user"];
      } else if (result["name"] !== undefined) {
        result["username"] = result["name"];
      } else if (result["id"] !== undefined) {
        result["username"] = result["id"];
      }
    }
    delete result["user"];
    delete result["name"];
    delete result["id"];

    // Anti-Hallucination: Agents may send limit/count to tools that don't support it
    delete result["limit"];
    delete result["count"];
    delete result["max"];
    delete result["top"];
    delete result["rows"];
    delete result["size"];
    delete result["take"];
    
    // Anti-Hallucination: Agents may send database/summary to list tools
    delete result["database"];
    delete result["schema"];
    delete result["table"];
    delete result["status"];
    delete result["stats"];
    delete result["summary"];
    delete result["variables"];
    delete result["metrics"];
    delete result["category"];
    delete result["type"];
    delete result["filter"];
    delete result["group"];
    delete result["active"];
    delete result["role"];
    delete result["privileges"];
    delete result["server"];
    delete result["hostname"];
    
    const username = result["username"];
    if (username !== undefined && typeof username !== "string") {
      if (typeof username === "number" || typeof username === "boolean") {
        result["username"] = String(username);
      }
    }
    
    return result;
  },
  z.object({
    username: z.string().optional().describe("Filter by username. Anti-Hallucination Hint: use 'username', not 'user'."),
  }).strict()
);

export const ProxySQLStatusInputSchemaBase = z.object({
  summary: z
    .any()
    .optional()
    .describe(
      "If true (default), returns only key metrics (version, uptime, queries, connections) instead of all status variables. Anti-Hallucination Hint: pass 'summary', not 'database' or 'table'.",
    ),
  database: z.any().optional().describe("Alias for summary"),
  table: z.any().optional().describe("Alias for summary"),
  category: z.any().optional().describe("Ignored alias"),
  type: z.any().optional().describe("Ignored alias"),
  filter: z.any().optional().describe("Ignored alias"),
}).loose();

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
    if (result["status"] !== undefined && result["summary"] === undefined) {
      if (typeof result["status"] === "boolean" || typeof result["status"] === "string") result["summary"] = result["status"];
    }
    delete result["status"];
    if (result["stats"] !== undefined && result["summary"] === undefined) {
      if (typeof result["stats"] === "boolean" || typeof result["stats"] === "string") result["summary"] = result["stats"];
    }
    delete result["stats"];
    if (result["variables"] !== undefined && result["summary"] === undefined) {
      if (typeof result["variables"] === "boolean" || typeof result["variables"] === "string") result["summary"] = result["variables"];
    }
    delete result["variables"];
    if (result["metrics"] !== undefined && result["summary"] === undefined) {
      if (typeof result["metrics"] === "boolean" || typeof result["metrics"] === "string") result["summary"] = result["metrics"];
    }
    delete result["metrics"];
    
    delete result["database"];
    delete result["schema"];
    delete result["table"];
    delete result["category"];
    delete result["type"];
    delete result["filter"];
    delete result["group"];
    delete result["hostgroup"];
    delete result["hostgroup_id"];
    delete result["info"];
    delete result["name"];
    delete result["variable"];
    
    // Anti-Hallucination: Agents may send limit/count to tools that don't support it
    delete result["limit"];
    delete result["count"];
    delete result["max"];
    delete result["top"];
    delete result["rows"];
    delete result["size"];
    delete result["take"];
    
    if (typeof result["summary"] === "number") {
      result["summary"] = result["summary"] !== 0;
    } else if (typeof result["summary"] === "string") {
      const s = result["summary"].toLowerCase();
      if (s === "true" || s === "yes" || s === "1" || s === "t" || s === "y") result["summary"] = true;
      else if (s === "false" || s === "no" || s === "0" || s === "f" || s === "n") result["summary"] = false;
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
    .any()
    .optional()
    .describe("Maximum number of results to return (default: 20). Anti-Hallucination Hint: use 'limit', not 'count'."),
  count: z.any().optional().describe("Alias for limit"),
  max: z.any().optional().describe("Alias for limit"),
  top: z.any().optional().describe("Alias for limit"),
  rows: z.any().optional().describe("Alias for limit"),
  size: z.any().optional().describe("Alias for limit"),
  take: z.any().optional().describe("Alias for limit"),
}).loose();

export const ProxySQLLimitInputSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "number") return { limit: Math.floor(val) };
    if (typeof val !== "object" || val === null) return val ?? {};
    const result = { ...(val as Record<string, unknown>) };
    
    // Anti-hallucination: agents might guess 'count' instead of 'limit'
    if (result["limit"] === undefined) {
      if (result["count"] !== undefined) result["limit"] = result["count"];
      else if (result["max"] !== undefined) result["limit"] = result["max"];
      else if (result["top"] !== undefined) result["limit"] = result["top"];
      else if (result["rows"] !== undefined) result["limit"] = result["rows"];
      else if (result["size"] !== undefined) result["limit"] = result["size"];
      else if (result["take"] !== undefined) result["limit"] = result["take"];
    }
    delete result["count"];
    delete result["max"];
    delete result["top"];
    delete result["rows"];
    delete result["size"];
    delete result["take"];
    
    // Anti-Hallucination: Agents may send database/summary/query/filter to limit tools
    delete result["database"];
    delete result["schema"];
    delete result["db"];
    delete result["table"];
    delete result["status"];
    delete result["state"];
    delete result["stats"];
    delete result["summary"];
    delete result["variables"];
    delete result["metrics"];
    delete result["category"];
    delete result["type"];
    delete result["filter"];
    delete result["group"];
    delete result["query"];
    delete result["sql"];
    delete result["statement"];
    delete result["user"];
    delete result["username"];
    delete result["host"];
    delete result["port"];
    delete result["id"];
    delete result["session"];
    delete result["session_id"];
    delete result["client"];
    delete result["client_host"];
    delete result["server"];
    delete result["server_host"];
    delete result["time"];
    delete result["command"];
    delete result["hostgroup"];
    delete result["hostgroup_id"];
    delete result["destination_hostgroup"];
    delete result["rule_id"];
    delete result["active"];
    delete result["match_digest"];
    delete result["digest"];
    delete result["client_ip"];
    delete result["client_port"];
    delete result["server_ip"];
    delete result["server_port"];
    delete result["ip"];
    delete result["ip_address"];
    delete result["process_id"];
    delete result["pid"];
    delete result["thread_id"];
    delete result["connection_id"];
    delete result["client_addr"];
    delete result["proxy_addr"];
    delete result["SessionID"];
    delete result["cli_host"];
    delete result["cli_port"];
    delete result["srv_host"];
    delete result["srv_port"];
    delete result["time_ms"];
    delete result["info"];

    const limit = result["limit"];
    if (limit !== undefined) {
      if (typeof limit === "string") {
        if (limit.trim() !== "") {
          const parsed = Number(limit);
          if (!isNaN(parsed)) {
            result["limit"] = Math.floor(parsed);
          }
        } else {
          delete result["limit"];
        }
      } else if (typeof limit === "number") {
        result["limit"] = Math.floor(limit);
      }
    }
    return result;
  },
  z.object({
    limit: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe("Maximum number of results to return (default: 20, max: 100). Anti-Hallucination Hint: use 'limit', not 'count'."),
  }).strict()
);

export const ProxySQLHostgroupInputSchemaBase = z.object({
  hostgroup_id: z.any().optional().describe("Filter by hostgroup ID. Anti-Hallucination Hint: use 'hostgroup_id', not 'hostgroup'."),
  hostgroup: z.any().optional().describe("Alias for hostgroup ID"),
  id: z.any().optional().describe("Alias for hostgroup ID"),
}).loose();

export const ProxySQLHostgroupInputSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "number") return { hostgroup_id: val };
    if (typeof val !== "object" || val === null) return val ?? {};
    const result = { ...(val as Record<string, unknown>) };
    // Anti-Hallucination: map 'hostgroup' or 'id' to 'hostgroup_id'
    if (result["hostgroup_id"] === undefined) {
      if (result["hostgroup"] !== undefined) {
        result["hostgroup_id"] = result["hostgroup"];
      } else if (result["id"] !== undefined) {
        result["hostgroup_id"] = result["id"];
      }
    }
    delete result["hostgroup"];
    delete result["id"];

    // Anti-Hallucination: Agents may send limit/count to tools that don't support it
    delete result["limit"];
    delete result["count"];
    delete result["max"];
    delete result["top"];
    delete result["rows"];
    delete result["size"];
    delete result["take"];
    
    // Anti-Hallucination: Agents may send database/summary to list tools
    delete result["database"];
    delete result["schema"];
    delete result["table"];
    delete result["status"];
    delete result["stats"];
    delete result["summary"];
    delete result["variables"];
    delete result["metrics"];
    delete result["category"];
    delete result["type"];
    delete result["filter"];
    delete result["group"];
    delete result["server"];
    delete result["hostname"];
    delete result["port"];
    delete result["host"];
    delete result["name"];
    
    const hostgroupId = result["hostgroup_id"];
    if (typeof hostgroupId === "string") {
      if (hostgroupId.trim() !== "" && !isNaN(Number(hostgroupId))) {
        result["hostgroup_id"] = Number(hostgroupId);
      }
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
    .any()
    .optional()
    .describe("Variable prefix filter: mysql, admin, or all (default: all)"),
  like: z
    .any()
    .optional()
    .describe(
      "LIKE pattern to filter variable names (e.g., '%connection%'). Applied after prefix filter.",
    ),
  limit: z
    .any()
    .optional()
    .describe("Maximum number of variables to return (default: 10)"),
  count: z.any().optional().describe("Alias for limit"),
  max: z.any().optional().describe("Alias for limit"),
  top: z.any().optional().describe("Alias for limit"),
  rows: z.any().optional().describe("Alias for limit"),
  size: z.any().optional().describe("Alias for limit"),
  take: z.any().optional().describe("Alias for limit"),
  pattern: z.any().optional().describe("Alias for like"),
  search: z.any().optional().describe("Alias for like"),
  name: z.any().optional().describe("Alias for like"),
  variable_name: z.any().optional().describe("Alias for like"),
  variable: z.any().optional().describe("Alias for like"),
}).loose();

export const ProxySQLVariableFilterSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val !== "object" || val === null) return val ?? {};
    const result = { ...(val as Record<string, unknown>) };
    
    // Anti-Hallucination: map 'pattern', 'search', or 'name' to 'like'
    if (result["like"] === undefined) {
      if (result["pattern"] !== undefined) result["like"] = result["pattern"];
      else if (result["search"] !== undefined) result["like"] = result["search"];
      else if (result["name"] !== undefined) result["like"] = result["name"];
      else if (result["variable_name"] !== undefined) result["like"] = result["variable_name"];
      else if (result["variable"] !== undefined) result["like"] = result["variable"];
    }
    delete result["pattern"];
    delete result["search"];
    delete result["name"];
    delete result["variable_name"];
    delete result["variable"];

    // Anti-Hallucination: Agents may send database/summary to list tools
    delete result["database"];
    delete result["schema"];
    delete result["table"];
    delete result["status"];
    delete result["stats"];
    delete result["summary"];
    delete result["metrics"];
    delete result["category"];
    delete result["type"];
    delete result["filter"];
    delete result["group"];
    delete result["variables"];
    delete result["info"];

    if (result["like"] !== undefined) {
      if (typeof result["like"] !== "string") {
        if (typeof result["like"] === "number" || typeof result["like"] === "boolean") {
          result["like"] = String(result["like"]);
        }
      }
    }

    if (result["limit"] === undefined) {
      if (result["count"] !== undefined) result["limit"] = result["count"];
      else if (result["max"] !== undefined) result["limit"] = result["max"];
      else if (result["top"] !== undefined) result["limit"] = result["top"];
      else if (result["rows"] !== undefined) result["limit"] = result["rows"];
      else if (result["size"] !== undefined) result["limit"] = result["size"];
      else if (result["take"] !== undefined) result["limit"] = result["take"];
    }
    delete result["count"];
    delete result["max"];
    delete result["top"];
    delete result["rows"];
    delete result["size"];
    delete result["take"];

    if (result["prefix"] !== undefined) {
      if (typeof result["prefix"] === "string") {
        const p = result["prefix"].toLowerCase();
        if (p === "mysql" || p === "admin" || p === "all") {
          result["prefix"] = p;
        }
      }
    }

    const limit = result["limit"];
    if (limit !== undefined) {
      if (typeof limit === "string" && limit.trim() !== "") {
        const parsed = Number(limit);
        if (!isNaN(parsed)) {
          result["limit"] = Math.floor(parsed);
        }
      } else if (typeof limit === "number") {
        result["limit"] = Math.floor(limit);
      }
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
      .regex(/^[a-zA-Z0-9_%\-. *]+$/, "Invalid like pattern — only alphanumeric, underscore, dash, dot, percent (%), and space characters are allowed")
      .optional()
      .describe(
        "LIKE pattern to filter variable names (e.g., '%connection%'). Applied after prefix filter.",
      ),
    limit: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe("Maximum number of variables to return (default: 10, max: 100)"),
  }).strict()
);

export const ProxySQLCommandInputSchemaBase = z.object({
  command: z
    .enum([
      "LOAD MYSQL USERS TO RUNTIME",
      "SAVE MYSQL USERS TO DISK",
      "LOAD MYSQL USERS FROM DISK",
      "LOAD MYSQL USERS FROM CONFIG",
      "LOAD MYSQL SERVERS TO RUNTIME",
      "SAVE MYSQL SERVERS TO DISK",
      "LOAD MYSQL SERVERS FROM DISK",
      "LOAD MYSQL SERVERS FROM CONFIG",
      "LOAD MYSQL QUERY RULES TO RUNTIME",
      "SAVE MYSQL QUERY RULES TO DISK",
      "LOAD MYSQL QUERY RULES FROM DISK",
      "LOAD MYSQL QUERY RULES FROM CONFIG",
      "LOAD MYSQL VARIABLES TO RUNTIME",
      "SAVE MYSQL VARIABLES TO DISK",
      "LOAD MYSQL VARIABLES FROM DISK",
      "LOAD MYSQL VARIABLES FROM CONFIG",
      "LOAD ADMIN VARIABLES TO RUNTIME",
      "SAVE ADMIN VARIABLES TO DISK",
      "LOAD ADMIN VARIABLES FROM DISK",
      "LOAD ADMIN VARIABLES FROM CONFIG",
      "PROXYSQL FLUSH QUERY CACHE",
      "PROXYSQL FLUSH LOGS"
    ])
    .optional()
    .describe("ProxySQL admin command to execute. Valid commands: LOAD/SAVE <item> TO RUNTIME/DISK, LOAD <item> FROM DISK/CONFIG (where <item> is MYSQL USERS, MYSQL SERVERS, MYSQL QUERY RULES, MYSQL VARIABLES, ADMIN VARIABLES), PROXYSQL FLUSH QUERY CACHE, PROXYSQL FLUSH LOGS. Anti-Hallucination Hint: use 'command', not 'query' or 'sql'."),
  sql: z.string().optional().describe("Alias for command"),
  query: z.string().optional().describe("Alias for command"),
  statement: z.string().optional().describe("Alias for command"),
  action: z.string().optional().describe("Alias for command"),
  cmd: z.string().optional().describe("Alias for command"),
}).loose();

export const ProxySQLCommandInputSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val === "string") return { command: val.toUpperCase().replace(/\bMEMORY\b/g, "RUNTIME") };
    if (typeof val !== "object" || val === null) return val ?? {};
    const result = { ...(val as Record<string, unknown>) };
    
    // Anti-Hallucination: map 'sql' or 'query' or 'statement' to 'command'
    if (result["command"] === undefined) {
      if (result["sql"] !== undefined) {
        result["command"] = result["sql"];
      } else if (result["query"] !== undefined) {
        result["command"] = result["query"];
      } else if (result["statement"] !== undefined) {
        result["command"] = result["statement"];
      } else if (result["action"] !== undefined) {
        result["command"] = result["action"];
      } else if (result["cmd"] !== undefined) {
        result["command"] = result["cmd"];
      }
    }
    delete result["sql"];
    delete result["query"];
    delete result["statement"];
    delete result["action"];
    delete result["cmd"];
    
    // Anti-Hallucination: Agents may send limit/count to tools that don't support it
    delete result["limit"];
    delete result["count"];
    delete result["max"];
    delete result["top"];
    delete result["rows"];
    delete result["size"];
    delete result["take"];
    delete result["sort"];
    delete result["orderBy"];
    delete result["order_by"];
    delete result["database"];
    delete result["schema"];
    delete result["table"];
    delete result["status"];
    delete result["stats"];
    delete result["variables"];
    delete result["filter"];
    delete result["pattern"];
    delete result["search"];
    delete result["like"];
    delete result["name"];
    delete result["user"];
    delete result["username"];
    delete result["hostgroup"];
    delete result["hostgroup_id"];
    delete result["server"];
    delete result["host"];
    delete result["port"];
    delete result["id"];
    delete result["rule_id"];
    delete result["match_digest"];
    delete result["digest"];
    
    if (typeof result["command"] === "string") {
      result["command"] = result["command"].toUpperCase().replace(/\bMEMORY\b/g, "RUNTIME");
    }
    
    return result;
  },
  z.object({
    command: z
      .enum([
        "LOAD MYSQL USERS TO RUNTIME",
        "SAVE MYSQL USERS TO DISK",
        "LOAD MYSQL USERS FROM DISK",
        "LOAD MYSQL USERS FROM CONFIG",
        "LOAD MYSQL SERVERS TO RUNTIME",
        "SAVE MYSQL SERVERS TO DISK",
        "LOAD MYSQL SERVERS FROM DISK",
        "LOAD MYSQL SERVERS FROM CONFIG",
        "LOAD MYSQL QUERY RULES TO RUNTIME",
        "SAVE MYSQL QUERY RULES TO DISK",
        "LOAD MYSQL QUERY RULES FROM DISK",
        "LOAD MYSQL QUERY RULES FROM CONFIG",
        "LOAD MYSQL VARIABLES TO RUNTIME",
        "SAVE MYSQL VARIABLES TO DISK",
        "LOAD MYSQL VARIABLES FROM DISK",
        "LOAD MYSQL VARIABLES FROM CONFIG",
        "LOAD ADMIN VARIABLES TO RUNTIME",
        "SAVE ADMIN VARIABLES TO DISK",
        "LOAD ADMIN VARIABLES FROM DISK",
        "LOAD ADMIN VARIABLES FROM CONFIG",
        "PROXYSQL FLUSH QUERY CACHE",
        "PROXYSQL FLUSH LOGS",
      ])
      .describe("ProxySQL admin command to execute. Anti-Hallucination Hint: use 'command', not 'query' or 'sql'."),
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
