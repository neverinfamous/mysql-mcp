/**
 * Shared preprocessors for Zod Schemas
 */

// =============================================================================
// Preprocess Utilities
// =============================================================================

/**
 * Convert undefined input to empty object for optional-param tools.
 * Used with z.preprocess() to handle tools called with no arguments.
 */
export function defaultToEmpty(input: unknown): unknown {
  return input ?? {};
}

/**
 * Preprocess table parameters:
 * - Alias: tableName/name → table
 */
export function preprocessTableParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };
  if (result["table"] === undefined) {
    if (result["tableName"] !== undefined)
      result["table"] = result["tableName"];
    else if (result["name"] !== undefined) result["table"] = result["name"];
  }
  return result;
}

/**
 * Preprocess query parameters:
 * - Alias: sql → query
 * - Alias: tx/txId → transactionId
 */
export function preprocessQueryParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };
  if (result["query"] === undefined && result["sql"] !== undefined) {
    result["query"] = result["sql"];
  }
  if (result["transactionId"] === undefined) {
    if (result["txId"] !== undefined) result["transactionId"] = result["txId"];
    else if (result["tx"] !== undefined) result["transactionId"] = result["tx"];
  }
  return result;
}

/**
 * Preprocess transaction ID parameters:
 * - Alias: tx/txId → transactionId
 */
export function preprocessTransactionIdParams(input: unknown): unknown {
  const normalized = defaultToEmpty(input) as Record<string, unknown>;
  if (normalized["transactionId"] === undefined) {
    if (normalized["txId"] !== undefined)
      normalized["transactionId"] = normalized["txId"];
    else if (normalized["tx"] !== undefined)
      normalized["transactionId"] = normalized["tx"];
  }
  return normalized;
}

/**
 * Preprocess savepoint parameters:
 * - Alias: tx/txId → transactionId
 * - Alias: name → savepoint
 */
export function preprocessSavepointParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };
  if (result["transactionId"] === undefined) {
    if (result["txId"] !== undefined) result["transactionId"] = result["txId"];
    else if (result["tx"] !== undefined) result["transactionId"] = result["tx"];
  }
  if (result["savepoint"] === undefined && result["name"] !== undefined) {
    result["savepoint"] = result["name"];
  }
  return result;
}

/**
 * Preprocess create table parameters:
 * - Alias: table/tableName → name
 */
export function preprocessCreateTableParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };
  if (result["name"] === undefined) {
    if (result["table"] !== undefined) result["name"] = result["table"];
    else if (result["tableName"] !== undefined)
      result["name"] = result["tableName"];
  }
  return result;
}

export function preprocessTransactionBeginParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input ?? {};
  const result = { ...(input as Record<string, unknown>) };
  if (result["isolationLevel"] === undefined && result["isolation_level"] !== undefined) {
    result["isolationLevel"] = result["isolation_level"];
  }
  return result;
}

/**
 * Preprocess transaction execute parameters:
 * - Alias: queries/sqls → statements
 * - Alias: isolation_level → isolationLevel
 */
export function preprocessTransactionExecuteParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };

  if (result["isolationLevel"] === undefined && result["isolation_level"] !== undefined) {
    result["isolationLevel"] = result["isolation_level"];
  }

  if (result["statements"] === undefined) {
    if (result["queries"] !== undefined)
      result["statements"] = result["queries"];
    else if (result["sqls"] !== undefined)
      result["statements"] = result["sqls"];
  }

  // Handle arrays of {sql: "..."} objects gracefully
  if (Array.isArray(result["statements"])) {
    result["statements"] = result["statements"].map((s: unknown) => {
      if (typeof s === "object" && s !== null) {
        const obj = s as Record<string, unknown>;
        if ("sql" in obj && typeof obj["sql"] === "string") return obj["sql"];
        if ("query" in obj && typeof obj["query"] === "string")
          return obj["query"];
      }
      return s;
    });
  }

  // Remove alias fields so they don't fail their own Zod validation
  delete result["queries"];
  delete result["sqls"];

  return result;
}

// =============================================================================
// Preprocess: JSON/Text column params (table, column, where aliases)
// =============================================================================

export function preprocessJsonColumnParams(val: unknown): unknown {
  if (val == null || typeof val !== "object") return val ?? {};
  const v = val as Record<string, unknown>;
  return {
    ...v,
    table: v["table"] ?? v["tableName"] ?? v["name"],
    column: v["column"] ?? v["col"],
    where: v["where"] ?? v["filter"],
  };
}

export function preprocessQueryOnlyParams(val: unknown): unknown {
  if (val == null || typeof val !== "object") return val ?? {};
  const v = val as Record<string, unknown>;
  return {
    ...v,
    query: v["query"] ?? v["sql"],
  };
}

// =============================================================================
// Preprocess: Admin table params (normalizes singular 'table' to 'tables' array)
// =============================================================================

export function preprocessAdminTableParams(val: unknown): unknown {
  if (val == null || typeof val !== "object") return val ?? {};
  const v = val as Record<string, unknown>;
  // If 'table' is passed as a string and 'tables' is not set, wrap it into an array
  if (typeof v["table"] === "string" && !Array.isArray(v["tables"])) {
    return { ...v, tables: [v["table"]] };
  }
  // Also support tableName/name aliases → tables
  if (typeof v["tableName"] === "string" && !Array.isArray(v["tables"])) {
    return { ...v, tables: [v["tableName"]] };
  }
  if (typeof v["name"] === "string" && !Array.isArray(v["tables"])) {
    return { ...v, tables: [v["name"]] };
  }
  return v;
}

// =============================================================================
// Preprocess: Docstore filter params (normalize empty {} to undefined)
// =============================================================================

export function preprocessDocFilterParams(val: unknown): unknown {
  if (val == null || typeof val !== "object") return val ?? {};
  const v = val as Record<string, unknown>;
  const result = { ...v };

  // Aliases
  if (result["filter"] === undefined && result["criteria"] !== undefined) {
    // Stringify if criteria is an object, because filter expects a string
    result["filter"] = typeof result["criteria"] === "object" && result["criteria"] !== null
      ? JSON.stringify(result["criteria"])
      : result["criteria"];
  }
  if (result["set"] === undefined && result["update"] !== undefined) {
    result["set"] = result["update"];
  }

  if (result["filter"] !== undefined) {
    if (
      typeof result["filter"] === "object" &&
      result["filter"] !== null &&
      Object.keys(result["filter"]).length === 0
    ) {
      result["filter"] = undefined;
    } else if (result["filter"] === "{}" || result["filter"] === "[]" || result["filter"] === "") {
      result["filter"] = undefined;
    }
  }

  delete result["criteria"];
  delete result["update"];

  return result;
}
