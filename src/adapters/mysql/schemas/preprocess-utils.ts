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
 * Preprocess document collection params:
 * - Alias: collection -> name
 */
export function preprocessDocCollectionParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };
  if (result["name"] === undefined) {
    if (result["collection"] !== undefined) result["name"] = result["collection"];
    else if (result["table"] !== undefined) result["name"] = result["table"];
    else if (result["tableName"] !== undefined) result["name"] = result["tableName"];
    else if (result["tbl"] !== undefined) result["name"] = result["tbl"];
  }
  if (result["collection"] === undefined && result["name"] !== undefined) {
    result["collection"] = result["name"];
  }
  if (result["schema"] === undefined && result["database"] !== undefined) {
    result["schema"] = result["database"];
  }
  if (result["documents"] === undefined && result["document"] !== undefined) {
    result["documents"] = Array.isArray(result["document"]) ? result["document"] : [result["document"]];
  }
  return result;
}

/**
 * Preprocess table parameters:
 * - Alias: tableName/name/tbl → table
 */
export function preprocessTableParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };
  if (result["table"] === undefined) {
    if (result["tableName"] !== undefined)
      result["table"] = result["tableName"];
    else if (result["name"] !== undefined) result["table"] = result["name"];
    else if (result["tbl"] !== undefined) result["table"] = result["tbl"];
  }
  return result;
}

/**
 * Preprocess conditional update parameters:
 * - Alias: condition -> conditions
 * - Normalizes string/object condition to array
 */
export function preprocessConditionalUpdateParams(input: unknown): unknown {
  const result = preprocessTableParams(input) as Record<string, unknown>;
  if (typeof result !== "object" || result === null) return result;

  const conditions = result["conditions"];
  const condition = result["condition"];
  if (conditions === undefined && condition !== undefined) {
    if (Array.isArray(condition)) {
      result["conditions"] = condition;
    } else if (typeof condition === "object" && condition !== null) {
      result["conditions"] = [condition];
    } else if (typeof condition === "string") {
      result["conditions"] = [condition];
    }
  }
  return result;
}

/**
 * Preprocess vector parameters:
 * - Alias: vector → queryVector
 * - Alias: distance → maxDistance
 * - Alias: query → queryText
 */
export function preprocessVectorParams(input: unknown): unknown {
  const result = preprocessTableParams(input) as Record<string, unknown>;
  if (typeof result !== "object" || result === null) return result;
  
  if (result["queryVector"] === undefined && result["vector"] !== undefined) {
    result["queryVector"] = result["vector"];
  }
  if (result["maxDistance"] === undefined && result["distance"] !== undefined) {
    result["maxDistance"] = result["distance"];
  }
  if (result["queryText"] === undefined && result["query"] !== undefined) {
    result["queryText"] = result["query"];
  }
  
  if (typeof result["metric"] === "string") {
    result["metric"] = result["metric"].toUpperCase();
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
  if (result["savepoint"] === undefined) {
    if (result["name"] !== undefined) result["savepoint"] = result["name"];
    else if (result["savepointName"] !== undefined) result["savepoint"] = result["savepointName"];
    else if (result["id"] !== undefined) result["savepoint"] = result["id"];
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
  if (
    result["isolationLevel"] === undefined &&
    result["isolation_level"] !== undefined
  ) {
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

  if (
    result["isolationLevel"] === undefined &&
    result["isolation_level"] !== undefined
  ) {
    result["isolationLevel"] = result["isolation_level"];
  }

  if (result["statements"] === undefined) {
    if (result["queries"] !== undefined)
      result["statements"] = result["queries"];
    else if (result["sqls"] !== undefined)
      result["statements"] = result["sqls"];
    else if (result["query"] !== undefined)
      result["statements"] = result["query"];
    else if (result["sql"] !== undefined)
      result["statements"] = result["sql"];
  }

  // Wrap singular string in array
  if (typeof result["statements"] === "string") {
    result["statements"] = [result["statements"]];
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
  
  let where = v["where"] ?? v["filter"] ?? v["condition"] ?? v["query"] ?? v["sql"];
  if (where === undefined && v["idColumn"] !== undefined && v["rowId"] !== undefined) {
    const idCol = v["idColumn"] as string;
    const rowId = v["rowId"];
    let formattedRowId = "''";
    if (typeof rowId === 'string') {
      formattedRowId = `'${rowId}'`;
    } else if (typeof rowId === 'number' || typeof rowId === 'boolean') {
      formattedRowId = String(rowId);
    }
    where = `\`${idCol}\` = ${formattedRowId}`;
  }
  
  return {
    ...v,
    table: v["table"] ?? v["tableName"] ?? v["name"],
    column: v["column"] ?? v["col"] ?? v["columnName"] ?? v["valueColumn"] ?? v["fieldName"],
    path: v["path"] ?? v["json_path"] ?? v["jsonPath"],
    where,
    searchValue: v["searchValue"] ?? v["searchString"],
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
  const v = { ...(val as Record<string, unknown>) };
  
  // If 'tables' is passed as a string (e.g. via codemode positional arg), wrap it into an array
  if (typeof v["tables"] === "string") {
    v["tables"] = [v["tables"]];
  }
  
  if (!Array.isArray(v["tables"])) {
    if (Array.isArray(v["table"])) v["tables"] = v["table"];
    else if (typeof v["table"] === "string") v["tables"] = [v["table"]];
    else if (Array.isArray(v["tableName"])) v["tables"] = v["tableName"];
    else if (typeof v["tableName"] === "string") v["tables"] = [v["tableName"]];
    else if (Array.isArray(v["name"])) v["tables"] = v["name"];
    else if (typeof v["name"] === "string") v["tables"] = [v["name"]];
  }

  // Remove alias fields so they don't fail their own Zod validation
  delete v["table"];
  delete v["tableName"];
  delete v["name"];
  
  return v;
}

// =============================================================================
// Preprocess: Docstore filter params (normalize empty {} to undefined)
// =============================================================================

export function preprocessDocFilterParams(val: unknown): unknown {
  if (val == null || typeof val !== "object") return val ?? {};
  // Call preprocessDocCollectionParams to handle collection/name aliases
  const v = preprocessDocCollectionParams(val) as Record<string, unknown>;
  const result = { ...v };

  if (result["schema"] === undefined && result["database"] !== undefined) {
    result["schema"] = result["database"];
  }

  // Aliases
  if (result["filter"] === undefined) {
    if (result["documentId"] !== undefined) {
      if (typeof result["documentId"] === "string") {
        result["filter"] = result["documentId"];
      } else if (typeof result["documentId"] === "number" || typeof result["documentId"] === "boolean") {
        result["filter"] = String(result["documentId"]);
      } else {
        result["filter"] = JSON.stringify(result["documentId"]);
      }
    } else if (result["criteria"] !== undefined) {
      // Stringify if criteria is an object, because filter expects a string
      result["filter"] =
        typeof result["criteria"] === "object" && result["criteria"] !== null
          ? JSON.stringify(result["criteria"])
          : result["criteria"];
    } else if (result["condition"] !== undefined) {
      result["filter"] =
        typeof result["condition"] === "object" && result["condition"] !== null
          ? JSON.stringify(result["condition"])
          : result["condition"];
    } else if (result["query"] !== undefined) {
      result["filter"] = typeof result["query"] === "object" && result["query"] !== null
          ? JSON.stringify(result["query"])
          : result["query"];
    }
  }
  if (result["set"] === undefined) {
    if (result["patch"] !== undefined) {
      result["set"] = result["patch"];
    } else if (result["update"] !== undefined) {
      result["set"] = result["update"];
    }
  }

  if (result["filter"] !== undefined) {
    if (
      typeof result["filter"] === "object" &&
      result["filter"] !== null &&
      Object.keys(result["filter"]).length === 0
    ) {
      result["filter"] = undefined;
    } else if (
      result["filter"] === "{}" ||
      result["filter"] === "[]" ||
      result["filter"] === ""
    ) {
      result["filter"] = undefined;
    }
  }

  delete result["criteria"];
  delete result["condition"];
  delete result["update"];
  delete result["query"];

  return result;
}

export function preprocessEventParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input ?? {};
  const result = { ...(input as Record<string, unknown>) };
  if (result["name"] === undefined && result["eventName"] !== undefined) {
    result["name"] = result["eventName"];
  }
  return result;
}

export function preprocessDocIndexParams(val: unknown): unknown {
  if (val == null || typeof val !== "object") return val ?? {};
  const result = { ...(val as Record<string, unknown>) };

  if (result["schema"] === undefined && result["database"] !== undefined) {
    result["schema"] = result["database"];
  }

  if (result["name"] === undefined && result["indexName"] !== undefined) {
    result["name"] = result["indexName"];
  }

  if (Array.isArray(result["fields"])) {
    result["fields"] = result["fields"].map((f: unknown) => {
      if (typeof f !== "object" || f === null) return f;
      const fieldObj = { ...(f as Record<string, unknown>) };
      if (fieldObj["path"] === undefined && fieldObj["field"] !== undefined) {
        fieldObj["path"] = fieldObj["field"];
        delete fieldObj["field"];
      }
      if (typeof fieldObj["type"] === "string") {
        const upType = fieldObj["type"].toUpperCase();
        if (upType === "INTEGER") fieldObj["type"] = "INT";
        else fieldObj["type"] = upType;
      }
      return fieldObj;
    });
  }

  return result;
}

export function preprocessBinlogEventsParams(input: unknown): unknown {
  const result = defaultToEmpty(input) as Record<string, unknown>;
  if (typeof result !== "object" || result === null) return result;

  if (result["logFile"] === undefined) {
    if (result["file"] !== undefined) result["logFile"] = result["file"];
    else if (result["filename"] !== undefined) result["logFile"] = result["filename"];
    else if (result["binlog"] !== undefined) result["logFile"] = result["binlog"];
    else if (result["log_file"] !== undefined) result["logFile"] = result["log_file"];
    else if (result["name"] !== undefined) result["logFile"] = result["name"];
  }
  
  if (result["position"] === undefined) {
    if (result["pos"] !== undefined) result["position"] = result["pos"];
    else if (result["start"] !== undefined) result["position"] = result["start"];
  }

  return result;
}
