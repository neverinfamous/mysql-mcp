/**
 * mysql-mcp - OAuth Scopes
 *
 * Scope definitions and utilities for MySQL MCP OAuth 2.0.
 */

import type { ToolGroup } from "../types/index.js";

// =============================================================================
// Scope Definitions
// =============================================================================

/**
 * Standard OAuth scopes for mysql-mcp
 */
export const SCOPES = {
  /** Read-only access to all databases */
  READ: "read",

  /** Read and write access to all databases */
  WRITE: "write",

  /** Administrative access (OPTIMIZE, ANALYZE, etc.) */
  ADMIN: "admin",

  /** Full access to all operations */
  FULL: "full",
} as const;

export type StandardScope = (typeof SCOPES)[keyof typeof SCOPES];

/**
 * All supported scopes including patterns
 */
export const ALL_SCOPES = [
  SCOPES.READ,
  SCOPES.WRITE,
  SCOPES.ADMIN,
  SCOPES.FULL,
  // Pattern scopes: db:{name}, table:{db}:{table}
] as const;

// =============================================================================
// Tool Group to Scope Mapping
// =============================================================================

/**
 * Map tool groups to required minimum scopes
 */
export const TOOL_GROUP_SCOPES: Record<ToolGroup, StandardScope> = {
  core: SCOPES.READ,
  json: SCOPES.READ,
  text: SCOPES.READ,
  fulltext: SCOPES.READ,
  performance: SCOPES.READ,
  optimization: SCOPES.READ,
  monitoring: SCOPES.READ,
  admin: SCOPES.ADMIN,
  backup: SCOPES.ADMIN,
  replication: SCOPES.ADMIN,
  partitioning: SCOPES.ADMIN,
  transactions: SCOPES.WRITE,
  router: SCOPES.READ,
  proxysql: SCOPES.READ,
  shell: SCOPES.ADMIN,
  // New tool groups (v2.0.0)
  schema: SCOPES.READ,
  events: SCOPES.ADMIN,
  sysschema: SCOPES.READ,
  stats: SCOPES.READ,
  spatial: SCOPES.READ,
  security: SCOPES.ADMIN,
  cluster: SCOPES.READ,
  roles: SCOPES.ADMIN,
  docstore: SCOPES.WRITE,
  codemode: SCOPES.ADMIN,
};

// =============================================================================
// Scope Utilities
// =============================================================================

/**
 * Parse scope string into array
 */
export function parseScopes(scopeString: string | undefined): string[] {
  if (!scopeString) return [];
  return scopeString.split(" ").filter((s) => s.length > 0);
}

/**
 * Check if granted scopes include the required scope
 */
export function hasScope(
  grantedScopes: string[],
  requiredScope: string,
): boolean {
  // Full scope grants everything
  if (grantedScopes.includes(SCOPES.FULL)) {
    return true;
  }

  // Direct match
  if (grantedScopes.includes(requiredScope)) {
    return true;
  }

  // Admin scope includes write and read
  if (requiredScope === SCOPES.READ || requiredScope === SCOPES.WRITE) {
    if (grantedScopes.includes(SCOPES.ADMIN)) {
      return true;
    }
  }

  // Write scope includes read
  if (requiredScope === SCOPES.READ) {
    if (grantedScopes.includes(SCOPES.WRITE)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if granted scopes include any of the required scopes
 */
export function hasAnyScope(
  grantedScopes: string[],
  requiredScopes: string[],
): boolean {
  return requiredScopes.some((scope) => hasScope(grantedScopes, scope));
}

/**
 * Check if granted scopes include all of the required scopes
 */
export function hasAllScopes(
  grantedScopes: string[],
  requiredScopes: string[],
): boolean {
  return requiredScopes.every((scope) => hasScope(grantedScopes, scope));
}

/**
 * Get the required scope for a tool group
 */
export function getScopeForToolGroup(group: ToolGroup): StandardScope {
  return TOOL_GROUP_SCOPES[group] ?? SCOPES.READ;
}

/**
 * Check if database-specific scope matches
 */
export function hasDatabaseScope(
  grantedScopes: string[],
  database: string,
): boolean {
  // Full or admin grants all databases
  if (
    grantedScopes.includes(SCOPES.FULL) ||
    grantedScopes.includes(SCOPES.ADMIN)
  ) {
    return true;
  }

  // Check for db:{name} pattern
  const dbScope = `db:${database}`;
  return grantedScopes.includes(dbScope);
}

/**
 * Check if table-specific scope matches
 */
export function hasTableScope(
  grantedScopes: string[],
  database: string,
  table: string,
): boolean {
  // Full or admin grants all tables
  if (
    grantedScopes.includes(SCOPES.FULL) ||
    grantedScopes.includes(SCOPES.ADMIN)
  ) {
    return true;
  }

  // Check for db:{name} scope (grants access to all tables in db)
  if (hasDatabaseScope(grantedScopes, database)) {
    return true;
  }

  // Check for table:{db}:{table} pattern
  const tableScope = `table:${database}:${table}`;
  return grantedScopes.includes(tableScope);
}

/**
 * Get scope display name
 */
export function getScopeDisplayName(scope: string): string {
  switch (scope) {
    case SCOPES.READ:
      return "Read Only";
    case SCOPES.WRITE:
      return "Read/Write";
    case SCOPES.ADMIN:
      return "Administrative";
    case SCOPES.FULL:
      return "Full Access";
    default:
      if (scope.startsWith("db:")) {
        return `Database: ${scope.slice(3)}`;
      }
      if (scope.startsWith("table:")) {
        return `Table: ${scope.slice(6)}`;
      }
      return scope;
  }
}
