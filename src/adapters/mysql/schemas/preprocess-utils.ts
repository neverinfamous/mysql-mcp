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
 * Ensures a JSON path starts with '$' (e.g. converting 'brand' to '$.brand').
 * Also validates basic MySQL JSON path syntax to prevent connection crashes.
 */
export function ensureJsonPath(p: string | undefined): string | undefined;
export function ensureJsonPath(p: string): string;
export function ensureJsonPath(p: string | undefined): string | undefined {
  if (!p) return p;
  
  let formatted = p;
  if (!formatted.startsWith("$")) {
    formatted = formatted.startsWith("[") ? "$" + formatted : "$." + formatted;
  }
  
  // Basic validation to prevent DB connection crashes on invalid paths
  // If the path contains an unquoted string inside brackets (like `$.[invalid]`), MySQL crashes.
  // If the path contains an unquoted key starting with a number (like `$.123`), MySQL crashes.
  // If the path ends with `**`, MySQL crashes.
  if (/\[[^\d*"']+\]/.test(formatted) || /\.\d/.test(formatted) || formatted.trim().endsWith("**")) {
    const err = new Error(`Invalid JSON path syntax: ${p}`);
    err.name = "ValidationError";
    throw err;
  }
  
  return formatted;
}

/**
 * Preprocess database parameters:
 * - Alias: db/schema → database
 */
export function preprocessDatabaseParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };
  if (result["database"] === undefined) {
    if (result["db"] !== undefined) result["database"] = result["db"];
    else if (result["schema"] !== undefined) result["database"] = result["schema"];
  }
  return result;
}

/**
 * Preprocess execute code params:
 * - Alias: script/query/sql -> code
 */
export function preprocessExecuteCodeParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input ?? {};
  const result = { ...(input as Record<string, unknown>) };
  if (result["code"] === undefined) {
    if (result["script"] !== undefined) result["code"] = result["script"];
    else if (result["query"] !== undefined) result["code"] = result["query"];
    else if (result["sql"] !== undefined) result["code"] = result["sql"];
    else if (result["javascript"] !== undefined) result["code"] = result["javascript"];
    else if (result["js"] !== undefined) result["code"] = result["js"];
    else if (result["command"] !== undefined) result["code"] = result["command"];
    else if (result["execute"] !== undefined) result["code"] = result["execute"];
    else if (result["eval"] !== undefined) result["code"] = result["eval"];
  }
  return result;
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
    else if (result["collectionName"] !== undefined) result["name"] = result["collectionName"];
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
  if (result["documents"] === undefined) {
    if (result["document"] !== undefined) {
      result["documents"] = Array.isArray(result["document"]) ? result["document"] : [result["document"]];
    } else if (result["data"] !== undefined) {
      result["documents"] = Array.isArray(result["data"]) ? result["data"] : [result["data"]];
    } else if (result["items"] !== undefined) {
      result["documents"] = Array.isArray(result["items"]) ? result["items"] : [result["items"]];
    }
  }
  if (typeof result["documents"] === "string") {
    try {
      const parsed = JSON.parse(result["documents"]) as unknown;
      result["documents"] = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // ignore
    }
  } else if (Array.isArray(result["documents"])) {
    result["documents"] = result["documents"].map((d: unknown) => {
      if (typeof d === "string") {
        try {
          return JSON.parse(d) as unknown;
        } catch {
          return d;
        }
      }
      return d;
    });
  }

  if (result["name"] !== undefined && typeof result["name"] !== "string") {
    if (typeof result["name"] === "number" || typeof result["name"] === "boolean") {
      result["name"] = String(result["name"]);
    } else if (typeof result["name"] === "object") {
      result["name"] = JSON.stringify(result["name"]);
    }
  }
  if (result["collection"] !== undefined && typeof result["collection"] !== "string") {
    if (typeof result["collection"] === "number" || typeof result["collection"] === "boolean") {
      result["collection"] = String(result["collection"]);
    } else if (typeof result["collection"] === "object") {
      result["collection"] = JSON.stringify(result["collection"]);
    }
  }
  if (result["schema"] !== undefined && typeof result["schema"] !== "string") {
    if (typeof result["schema"] === "number" || typeof result["schema"] === "boolean") {
      result["schema"] = String(result["schema"]);
    }
  }
  if (typeof result["ifNotExists"] === "string") {
    result["ifNotExists"] = result["ifNotExists"].toLowerCase() === "true";
  }
  if (typeof result["ifExists"] === "string") {
    result["ifExists"] = result["ifExists"].toLowerCase() === "true";
  }

  delete result["collectionName"];
  delete result["table"];
  delete result["tableName"];
  delete result["tbl"];
  delete result["database"];
  delete result["document"];
  delete result["data"];
  delete result["items"];

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
    if (result["tableName"] !== undefined) result["table"] = result["tableName"];
    else if (result["name"] !== undefined) result["table"] = result["name"];
    else if (result["tbl"] !== undefined) result["table"] = result["tbl"];
    else if (result["table_name"] !== undefined) result["table"] = result["table_name"];
  }

  if (typeof result["table"] === "string" && (result["table"].startsWith("{") || result["table"].startsWith("["))) {
    try {
      const parsed = JSON.parse(result["table"]) as unknown;
      if (typeof parsed === "object" && parsed !== null) {
        result["table"] = parsed;
      }
    } catch {
      // Ignore
    }
  }

  if (typeof result["table"] === "object" && result["table"] !== null) {
    const nested = result["table"] as Record<string, unknown>;
    if (typeof nested["name"] === "string") result["table"] = nested["name"];
    else if (typeof nested["tableName"] === "string") result["table"] = nested["tableName"];
    else if (typeof nested["table"] === "string") result["table"] = nested["table"];
  }

  if (typeof result["ifExists"] === "string") {
    result["ifExists"] = result["ifExists"].toLowerCase() === "true";
  }
  if (typeof result["ifNotExists"] === "string") {
    result["ifNotExists"] = result["ifNotExists"].toLowerCase() === "true";
  }

  return result;
}

/**
 * Preprocess check version parameters:
 * - Alias: id -> rowId
 */
export function preprocessCheckVersionParams(input: unknown): unknown {
  const result = preprocessTableParams(input) as Record<string, unknown>;
  if (typeof result !== "object" || result === null) return result;
  
  if (result["rowId"] === undefined && result["id"] !== undefined) {
    result["rowId"] = result["id"];
  }
  
  return result;
}

/**
 * Preprocess index parameters:
 * - Alias: column -> columns
 * - Coerce string to array
 * - Handle comma-separated columns string
 * - Alias: index_name -> indexName/name
 * - Alias: indexType -> type
 */
export function preprocessIndexParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };

  if (result["table"] === undefined) {
    if (result["tableName"] !== undefined) result["table"] = result["tableName"];
    else if (result["tbl"] !== undefined) result["table"] = result["tbl"];
    else if (result["table_name"] !== undefined) result["table"] = result["table_name"];
    // We explicitly omit 'name' -> 'table' aliasing because 'name' is the indexName
  }

  if (typeof result["table"] === "object" && result["table"] !== null) {
    const nested = result["table"] as Record<string, unknown>;
    if (typeof nested["name"] === "string") result["table"] = nested["name"];
    else if (typeof nested["tableName"] === "string") result["table"] = nested["tableName"];
    else if (typeof nested["table"] === "string") result["table"] = nested["table"];
  }

  if (result["name"] === undefined) {
    if (result["indexName"] !== undefined) result["name"] = result["indexName"];
    else if (result["index_name"] !== undefined) result["name"] = result["index_name"];
  }

  if (typeof result["name"] === "object" && result["name"] !== null) {
    const nested = result["name"] as Record<string, unknown>;
    if (typeof nested["name"] === "string") result["name"] = nested["name"];
    else if (typeof nested["indexName"] === "string") result["name"] = nested["indexName"];
  }

  if (result["type"] === undefined && result["indexType"] !== undefined) {
    result["type"] = result["indexType"];
  }

  if (typeof result["type"] === "string") {
    result["type"] = result["type"].toUpperCase();
  }
  if (typeof result["indexType"] === "string") {
    result["indexType"] = result["indexType"].toUpperCase();
  }

  if (result["columns"] === undefined && result["column"] !== undefined) {
    result["columns"] = result["column"];
  }

  if (typeof result["columns"] === "object" && result["columns"] !== null && !Array.isArray(result["columns"])) {
    const obj = result["columns"] as Record<string, unknown>;
    result["columns"] = [obj["name"] ?? obj["column"] ?? obj["columnName"] ?? obj["field"] ?? JSON.stringify(obj)];
  }

  if (typeof result["columns"] === "string") {
    if (result["columns"].includes(",")) {
      result["columns"] = result["columns"].split(",").map((c) => c.trim());
    } else {
      result["columns"] = [result["columns"]];
    }
  } else if (Array.isArray(result["columns"])) {
    if (result["columns"].length === 1 && typeof result["columns"][0] === "string" && result["columns"][0].includes(",")) {
      result["columns"] = result["columns"][0].split(",").map((c) => c.trim());
    } else {
      // Harden against AI hallucinating an array of objects instead of strings
      result["columns"] = result["columns"].map((c: unknown) => {
        if (typeof c === "object" && c !== null) {
          const obj = c as Record<string, unknown>;
          return obj["name"] ?? obj["column"] ?? obj["columnName"] ?? obj["field"] ?? JSON.stringify(c);
        }
        return c;
      });
    }
  }

  if (typeof result["unique"] === "string") {
    result["unique"] = result["unique"].toLowerCase() === "true";
  }
  if (typeof result["ifNotExists"] === "string") {
    result["ifNotExists"] = result["ifNotExists"].toLowerCase() === "true";
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

  // Helper to normalize condition items
  const normalizeConditionItem = (c: unknown): unknown => {
    if (typeof c === "object" && c !== null && !Array.isArray(c)) {
      const obj = c as Record<string, unknown>;
      if ("column" in obj) return obj;
      // Convert { id: 1 } to [{ column: "id", value: 1 }]
      const keys = Object.keys(obj);
      if (keys.length > 0) {
        return keys.map((k) => ({ column: k, value: obj[k] }));
      }
    }
    return c;
  };

  const conditions = result["conditions"];
  const condition = result["condition"];
  
  if (result["data"] === undefined && result["updates"] !== undefined) {
    result["data"] = result["updates"];
  }
  
  let rawConditions: unknown[] = [];
  
  if (conditions !== undefined) {
    rawConditions = Array.isArray(conditions) ? conditions : [conditions];
  } else if (condition !== undefined) {
    rawConditions = Array.isArray(condition) ? condition : [condition];
  } else if (result["rowId"] !== undefined || result["id"] !== undefined) {
    const val = result["rowId"] ?? result["id"];
    const idCol = result["idColumn"] ?? "id";
    rawConditions = [{ column: idCol, value: val }];
  }

  if (rawConditions.length > 0) {
    // Flatten in case normalizeConditionItem returned an array
    result["conditions"] = rawConditions.flatMap(normalizeConditionItem);
  }

  if (result["expectedVersion"] === undefined && result["version"] !== undefined) {
    result["expectedVersion"] = result["version"];
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
  
  if (result["queryVector"] === undefined) {
    if (result["vector"] !== undefined) result["queryVector"] = result["vector"];
    else if (result["query"] !== undefined) result["queryVector"] = result["query"];
    else if (result["sql"] !== undefined) result["queryVector"] = result["sql"];
    else if (result["search"] !== undefined) result["queryVector"] = result["search"];
  }
  
  if (result["vector"] === undefined && result["queryVector"] !== undefined) {
    result["vector"] = result["queryVector"];
  }

  if (result["id"] === undefined) {
    if (result["rowId"] !== undefined) result["id"] = result["rowId"];
    else if (result["recordId"] !== undefined) result["id"] = result["recordId"];
  }

  if (result["idColumn"] === undefined) {
    if (result["idCol"] !== undefined) result["idColumn"] = result["idCol"];
    else if (result["primaryKey"] !== undefined) result["idColumn"] = result["primaryKey"];
  }

  if (result["column"] === undefined) {
    if (result["vectorColumn"] !== undefined) result["column"] = result["vectorColumn"];
    else if (result["col"] !== undefined) result["column"] = result["col"];
  }

  if (result["vectorColumn"] === undefined && result["column"] !== undefined) {
    result["vectorColumn"] = result["column"];
  }

  // Coerce vector/queryVector from string to array if agent hallucinated a stringified array
  if (typeof result["queryVector"] === "string") {
    try {
      const parsed = JSON.parse(result["queryVector"]) as unknown;
      if (Array.isArray(parsed)) {
        result["queryVector"] = parsed;
      } else if (typeof input === "object" && input !== null && (input as Record<string, unknown>)["queryVector"] === undefined) {
        delete result["queryVector"];
      }
    } catch {
      // Ignore parse error, but if it came from an alias, it's likely meant for queryText
      if (typeof input === "object" && input !== null && (input as Record<string, unknown>)["queryVector"] === undefined) {
        delete result["queryVector"];
      }
    }
  }
  if (typeof result["vector"] === "string") {
    try {
      const parsed = JSON.parse(result["vector"]) as unknown;
      if (Array.isArray(parsed)) {
        result["vector"] = parsed;
      } else if (typeof input === "object" && input !== null && (input as Record<string, unknown>)["vector"] === undefined) {
        delete result["vector"];
      }
    } catch {
      // Ignore parse error, but if it came from an alias, it's likely meant for queryText
      if (typeof input === "object" && input !== null && (input as Record<string, unknown>)["vector"] === undefined) {
        delete result["vector"];
      }
    }
  }

  if (result["maxDistance"] === undefined) {
    if (result["distance"] !== undefined) result["maxDistance"] = result["distance"];
    else if (result["radius"] !== undefined) result["maxDistance"] = result["radius"];
  }
  
  if (result["queryText"] === undefined) {
    if (result["query"] !== undefined) result["queryText"] = result["query"];
    else if (result["sql"] !== undefined) result["queryText"] = result["sql"];
    else if (result["search"] !== undefined) result["queryText"] = result["search"];
  }
  
  if (typeof result["metric"] === "string") {
    result["metric"] = result["metric"].toUpperCase();
  }

  if (result["k"] === undefined && result["limit"] !== undefined) {
    result["k"] = result["limit"];
  }
  if (result["limit"] === undefined && result["k"] !== undefined) {
    result["limit"] = result["k"];
  }

  if (typeof result["k"] === "string") {
    const parsed = parseInt(result["k"], 10);
    if (!isNaN(parsed)) result["k"] = parsed;
  }
  if (typeof result["limit"] === "string") {
    const parsed = parseInt(result["limit"], 10);
    if (!isNaN(parsed)) result["limit"] = parsed;
  }
  if (typeof result["maxDistance"] === "string") {
    const parsed = parseFloat(result["maxDistance"]);
    if (!isNaN(parsed)) result["maxDistance"] = parsed;
  }
  if (typeof result["rrfK"] === "string") {
    const parsed = parseInt(result["rrfK"], 10);
    if (!isNaN(parsed)) result["rrfK"] = parsed;
  }
  if (typeof result["vectorWeight"] === "string") {
    const parsed = parseFloat(result["vectorWeight"]);
    if (!isNaN(parsed)) result["vectorWeight"] = parsed;
  }
  if (typeof result["textWeight"] === "string") {
    const parsed = parseFloat(result["textWeight"]);
    if (!isNaN(parsed)) result["textWeight"] = parsed;
  }

  if (Array.isArray(result["items"])) {
    result["items"] = result["items"].map((item: unknown) => {
      if (typeof item === "object" && item !== null) {
        const itemObj = { ...(item as Record<string, unknown>) };
        
        if (itemObj["id"] === undefined) {
          if (itemObj["rowId"] !== undefined) itemObj["id"] = itemObj["rowId"];
          else if (itemObj["recordId"] !== undefined) itemObj["id"] = itemObj["recordId"];
        }

        if (itemObj["vector"] === undefined) {
          if (itemObj["queryVector"] !== undefined) itemObj["vector"] = itemObj["queryVector"];
          else if (itemObj["query"] !== undefined) itemObj["vector"] = itemObj["query"];
          else if (itemObj["sql"] !== undefined) itemObj["vector"] = itemObj["sql"];
          else if (itemObj["search"] !== undefined) itemObj["vector"] = itemObj["search"];
        }

        if (typeof itemObj["vector"] === "string") {
          try {
            const parsed = JSON.parse(itemObj["vector"]) as unknown;
            if (Array.isArray(parsed)) {
              itemObj["vector"] = parsed;
            } else if ((item as Record<string, unknown>)["vector"] === undefined) {
              delete itemObj["vector"];
            }
          } catch {
            if ((item as Record<string, unknown>)["vector"] === undefined) {
              delete itemObj["vector"];
            }
          }
        }
        
        return itemObj;
      }
      return item;
    });
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
    else if (result["transaction_id"] !== undefined) result["transactionId"] = result["transaction_id"];
  }
  if (result["params"] === undefined) {
    if (result["parameters"] !== undefined) result["params"] = result["parameters"];
    else if (result["values"] !== undefined) result["params"] = result["values"];
  }
  if (result["params"] !== undefined && !Array.isArray(result["params"])) {
    result["params"] = [result["params"]];
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
    else if (normalized["transaction_id"] !== undefined)
      normalized["transactionId"] = normalized["transaction_id"];
  }

  if (normalized["transactionId"] !== undefined) {
    if (typeof normalized["transactionId"] === "number") {
      normalized["transactionId"] = String(normalized["transactionId"]);
    } else if (Array.isArray(normalized["transactionId"])) {
      normalized["transactionId"] = String(normalized["transactionId"][0] ?? "");
    } else if (typeof normalized["transactionId"] === "object" && normalized["transactionId"] !== null) {
      const obj = normalized["transactionId"] as Record<string, unknown>;
      const rawVal = obj["transactionId"] ?? obj["txId"] ?? obj["tx"] ?? obj["transaction_id"] ?? normalized["transactionId"];
      normalized["transactionId"] = typeof rawVal === "string" ? rawVal : (JSON.stringify(rawVal) ?? "");
    }
  }

  delete normalized["txId"];
  delete normalized["tx"];
  delete normalized["transaction_id"];

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
    else if (result["transaction_id"] !== undefined) result["transactionId"] = result["transaction_id"];
  }
  if (result["savepoint"] === undefined) {
    if (result["name"] !== undefined) result["savepoint"] = result["name"];
    else if (result["savepointName"] !== undefined) result["savepoint"] = result["savepointName"];
    else if (result["id"] !== undefined) result["savepoint"] = result["id"];
    else if (result["savepoint_name"] !== undefined) result["savepoint"] = result["savepoint_name"];
  }

  if (result["transactionId"] !== undefined) {
    if (typeof result["transactionId"] === "number") {
      result["transactionId"] = String(result["transactionId"]);
    } else if (Array.isArray(result["transactionId"])) {
      result["transactionId"] = String(result["transactionId"][0] ?? "");
    } else if (typeof result["transactionId"] === "object" && result["transactionId"] !== null) {
      const obj = result["transactionId"] as Record<string, unknown>;
      const rawVal = obj["transactionId"] ?? obj["txId"] ?? obj["tx"] ?? obj["transaction_id"] ?? result["transactionId"];
      result["transactionId"] = typeof rawVal === "string" ? rawVal : (JSON.stringify(rawVal) ?? "");
    }
  }

  if (result["savepoint"] !== undefined) {
    if (typeof result["savepoint"] === "number") {
      result["savepoint"] = String(result["savepoint"]);
    } else if (Array.isArray(result["savepoint"])) {
      result["savepoint"] = String(result["savepoint"][0] ?? "");
    } else if (typeof result["savepoint"] === "object" && result["savepoint"] !== null) {
      const obj = result["savepoint"] as Record<string, unknown>;
      const rawVal = obj["savepoint"] ?? obj["name"] ?? obj["savepointName"] ?? obj["id"] ?? obj["savepoint_name"] ?? result["savepoint"];
      result["savepoint"] = typeof rawVal === "string" ? rawVal : (JSON.stringify(rawVal) ?? "");
    }
  }

  delete result["txId"];
  delete result["tx"];
  delete result["transaction_id"];
  delete result["name"];
  delete result["savepointName"];
  delete result["id"];
  delete result["savepoint_name"];

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

  if (result["columns"] !== undefined && !Array.isArray(result["columns"])) {
    if (typeof result["columns"] === "string") {
      try {
        const parsed = JSON.parse(result["columns"]) as unknown;
        if (Array.isArray(parsed)) {
          result["columns"] = parsed;
        } else {
          result["columns"] = [{ name: result["columns"], type: "VARCHAR(255)" }];
        }
      } catch {
        result["columns"] = [{ name: result["columns"], type: "VARCHAR(255)" }];
      }
    } else if (typeof result["columns"] === "object" && result["columns"] !== null) {
      // Hardening: If it's a single object instead of an array, wrap it in an array
      result["columns"] = [result["columns"]];
    }
  }

  if (typeof result["ifNotExists"] === "string") {
    result["ifNotExists"] = result["ifNotExists"].toLowerCase() === "true";
  }

  return result;
}

export function preprocessTransactionBeginParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input ?? {};
  const result = { ...(input as Record<string, unknown>) };
  if (result["isolationLevel"] === undefined) {
    if (result["isolation_level"] !== undefined) result["isolationLevel"] = result["isolation_level"];
    else if (result["level"] !== undefined) result["isolationLevel"] = result["level"];
  }
  
  if (result["isolationLevel"] !== undefined) {
    if (Array.isArray(result["isolationLevel"])) {
      result["isolationLevel"] = String(result["isolationLevel"][0] ?? "");
    } else if (typeof result["isolationLevel"] === "object" && result["isolationLevel"] !== null) {
      const obj = result["isolationLevel"] as Record<string, unknown>;
      const rawVal = obj["isolationLevel"] ?? obj["isolation_level"] ?? obj["level"] ?? result["isolationLevel"];
      result["isolationLevel"] = typeof rawVal === "string" ? rawVal : (JSON.stringify(rawVal) ?? "");
    }
  }

  if (typeof result["isolationLevel"] === "string") {
    result["isolationLevel"] = result["isolationLevel"].toUpperCase();
  }
  
  delete result["isolation_level"];
  delete result["level"];
  
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

  if (result["isolationLevel"] === undefined) {
    if (result["isolation_level"] !== undefined) result["isolationLevel"] = result["isolation_level"];
    else if (result["level"] !== undefined) result["isolationLevel"] = result["level"];
  }

  if (result["isolationLevel"] !== undefined) {
    if (Array.isArray(result["isolationLevel"])) {
      result["isolationLevel"] = String(result["isolationLevel"][0] ?? "");
    } else if (typeof result["isolationLevel"] === "object" && result["isolationLevel"] !== null) {
      const obj = result["isolationLevel"] as Record<string, unknown>;
      const rawVal = obj["isolationLevel"] ?? obj["isolation_level"] ?? obj["level"] ?? result["isolationLevel"];
      result["isolationLevel"] = typeof rawVal === "string" ? rawVal : (JSON.stringify(rawVal) ?? "");
    }
  }

  if (typeof result["isolationLevel"] === "string") {
    result["isolationLevel"] = result["isolationLevel"].toUpperCase();
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

  if (typeof result["statements"] === "string") {
    if (result["statements"].trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(result["statements"]) as unknown;
        if (Array.isArray(parsed)) {
          result["statements"] = parsed;
        } else {
          result["statements"] = [result["statements"]];
        }
      } catch {
        result["statements"] = [result["statements"]];
      }
    } else {
      result["statements"] = [result["statements"]];
    }
  } else if (result["statements"] !== undefined && !Array.isArray(result["statements"])) {
    result["statements"] = [result["statements"]];
  }

  // Handle arrays of {sql: "..."} objects gracefully
  if (Array.isArray(result["statements"])) {
    result["statements"] = result["statements"].map((s: unknown) => {
      if (typeof s === "object" && s !== null) {
        const obj = s as Record<string, unknown>;
        const rawParams = obj["params"] ?? obj["parameters"] ?? obj["values"];
        
        let params = rawParams;
        if (typeof rawParams === "string" && rawParams.trim().startsWith("[")) {
          try {
            const parsed = JSON.parse(rawParams) as unknown;
            if (Array.isArray(parsed)) params = parsed;
          } catch {
            // Ignore
          }
        }
        
        const paramsArray = params !== undefined ? (Array.isArray(params) ? params : [params]) : undefined;
        
        if ("sql" in obj && typeof obj["sql"] === "string") {
          return paramsArray !== undefined ? { sql: obj["sql"], params: paramsArray } : obj["sql"];
        }
        if ("query" in obj && typeof obj["query"] === "string") {
          return paramsArray !== undefined ? { sql: obj["query"], params: paramsArray } : obj["query"];
        }
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
  if (where !== undefined && typeof where === 'object' && where !== null && !Array.isArray(where)) {
    const obj = where as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length > 0) {
      const conditions: string[] = [];
      for (const k of keys) {
        if (k === undefined) continue;
        const val = obj[k];
        let formattedVal = "''";
        if (typeof val === 'string') {
          // Escape backslashes and single quotes to prevent syntax errors
          const escapedVal = val.replace(/\\/g, '\\\\').replace(/'/g, "''");
          formattedVal = `'${escapedVal}'`;
        } else if (typeof val === 'number' || typeof val === 'boolean') {
          formattedVal = String(val);
        }
        conditions.push(`\`${k}\` = ${formattedVal}`);
      }
      if (conditions.length > 0) {
        where = conditions.join(" AND ");
      }
    }
  }
  
  if (where === undefined && (v["rowId"] !== undefined || v["id"] !== undefined)) {
    const idCol = (v["idColumn"] as string | undefined) ?? "id";
    const rowId = v["rowId"] ?? v["id"];
    let formattedRowId = "''";
    if (typeof rowId === 'string') {
      const escapedRowId = rowId.replace(/\\/g, '\\\\').replace(/'/g, "''");
      formattedRowId = `'${escapedRowId}'`;
    } else if (typeof rowId === 'number' || typeof rowId === 'boolean') {
      formattedRowId = String(rowId);
    }
    where = `\`${idCol}\` = ${formattedRowId}`;
  }
  
  const coerceString = (val: unknown, isWhere = false): unknown => {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return JSON.stringify(val);
    if (isWhere && (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint')) return val;
    if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'bigint') return val.toString();
    return val;
  };

  const rawTable = v["table"] ?? v["tableName"] ?? v["name"] ?? v["tbl"] ?? v["table_name"];
  const rawColumn = v["column"] ?? v["col"] ?? v["columnName"] ?? v["valueColumn"] ?? v["fieldName"] ?? v["c"];
  const rawPath = v["path"] ?? v["json_path"] ?? v["jsonPath"] ?? v["key"] ?? (Array.isArray(v["keys"]) ? undefined : v["keys"]);
  const rawSearchValue = v["searchValue"] ?? v["searchString"] ?? v["searchStr"] ?? v["value"] ?? v["val"] ?? v["search"] ?? v["text"] ?? v["content"] ?? v["keyword"];

  const rawPaths = v["paths"] ?? v["keys"];
  let finalPaths: unknown = rawPaths;
  if (rawPaths !== undefined) {
    if (Array.isArray(rawPaths)) {
      finalPaths = rawPaths.map(p => ensureJsonPath(coerceString(p) as string | undefined ?? ""));
    } else {
      finalPaths = ensureJsonPath(coerceString(rawPaths) as string | undefined ?? "");
    }
  }

  const result: Record<string, unknown> = {
    ...v,
    table: coerceString(rawTable),
    column: coerceString(rawColumn),
    path: ensureJsonPath(coerceString(rawPath) as string | undefined),
    paths: finalPaths,
    where: coerceString(where, true),
    searchValue: coerceString(rawSearchValue),
  };

  // We've consolidated where-like aliases into `where`. Delete them so they don't bypass validation via z.coerce.string()
  result["filter"] = undefined;
  result["condition"] = undefined;
  result["query"] = undefined;
  result["sql"] = undefined;

  return result;
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
  
  // Hardening: Handle if 'tables' or aliases are passed as stringified objects
  const checkStringified = (key: string): void => {
    const kVal = v[key];
    if (typeof kVal === "string" && (kVal.startsWith("{") || kVal.startsWith("["))) {
      try {
        const parsed = JSON.parse(kVal) as unknown;
        if (typeof parsed === "object" && parsed !== null) {
          v[key] = parsed;
        }
      } catch {
        // Ignore
      }
    }
  };
  checkStringified("tables");
  checkStringified("table");
  checkStringified("tableName");
  checkStringified("name");

  // Hardening: Handle if 'tables' or aliases are passed as objects instead of strings
  const extractNested = (key: string): void => {
    const kVal = v[key];
    if (typeof kVal === "object" && kVal !== null && !Array.isArray(kVal)) {
      const nested = kVal as Record<string, unknown>;
      if (typeof nested["name"] === "string") v[key] = nested["name"];
      else if (typeof nested["tableName"] === "string") v[key] = nested["tableName"];
      else if (typeof nested["table"] === "string") v[key] = nested["table"];
      else if (typeof nested["tables"] === "string") v[key] = nested["tables"];
      else if (Array.isArray(nested["tables"])) v[key] = nested["tables"];
      else if (Array.isArray(nested["name"])) v[key] = nested["name"];
      else if (Array.isArray(nested["tableName"])) v[key] = nested["tableName"];
      else if (Array.isArray(nested["table"])) v[key] = nested["table"];
    }
  };
  extractNested("tables");
  extractNested("table");
  extractNested("tableName");
  extractNested("name");

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

  // Handle comma-separated strings inside arrays and harden against array of objects
  if (Array.isArray(v["tables"])) {
    if (v["tables"].length === 1 && typeof v["tables"][0] === "string" && v["tables"][0].includes(",")) {
      v["tables"] = v["tables"][0].split(",").map((t: string) => t.trim());
    } else {
      v["tables"] = v["tables"].flatMap((t: unknown) => {
        if (typeof t === "object" && t !== null) {
          const obj = t as Record<string, unknown>;
          t = obj["name"] ?? obj["tableName"] ?? obj["table"] ?? JSON.stringify(obj);
        }
        if (typeof t === "string" && t.includes(",")) {
          return t.split(",").map((part) => part.trim());
        }
        return t;
      });
    }
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
    } else if (result["sql"] !== undefined) {
      result["filter"] = typeof result["sql"] === "object" && result["sql"] !== null
          ? JSON.stringify(result["sql"])
          : result["sql"];
    } else if (result["where"] !== undefined) {
      result["filter"] = typeof result["where"] === "object" && result["where"] !== null
          ? JSON.stringify(result["where"])
          : result["where"];
    } else if (result["search"] !== undefined) {
      result["filter"] = typeof result["search"] === "object" && result["search"] !== null
          ? JSON.stringify(result["search"])
          : result["search"];
    }
  }
  if (result["set"] === undefined) {
    if (result["patch"] !== undefined) {
      result["set"] = result["patch"];
    } else if (result["update"] !== undefined) {
      result["set"] = result["update"];
    }
  }

  if (typeof result["set"] === "string") {
    try {
      const parsed = JSON.parse(result["set"]) as unknown;
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        result["set"] = parsed;
      }
    } catch {
      // Ignore
    }
  }

  if (typeof result["unset"] === "string") {
    try {
      const parsed = JSON.parse(result["unset"]) as unknown;
      if (Array.isArray(parsed)) {
        result["unset"] = parsed;
      }
    } catch {
      const rawUnset = result["unset"] as string;
      if (rawUnset.includes(",")) {
        result["unset"] = rawUnset.split(",").map((s: string) => s.trim());
      } else {
        result["unset"] = [rawUnset];
      }
    }
  }

  if (result["filter"] !== undefined) {
    if (typeof result["filter"] !== "string") {
      result["filter"] = JSON.stringify(result["filter"]);
    }
    
    if (
      result["filter"] === "{}" ||
      result["filter"] === "[]" ||
      result["filter"] === '""' ||
      result["filter"] === ""
    ) {
      result["filter"] = undefined;
    }
  }

  if (typeof result["set"] === "string") {
    try {
      result["set"] = JSON.parse(result["set"]) as unknown;
    } catch {
      // ignore
    }
  }

  if (typeof result["unset"] === "string") {
    try {
      const parsed = JSON.parse(result["unset"]) as unknown;
      result["unset"] = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      result["unset"] = (result["unset"] as string).split(",").map((s: string) => s.trim());
    }
  } else if (result["unset"] !== undefined && !Array.isArray(result["unset"])) {
    result["unset"] = [result["unset"]];
  }

  if (typeof result["arrayAppend"] === "string") {
    try {
      result["arrayAppend"] = JSON.parse(result["arrayAppend"]) as unknown;
    } catch {
      // ignore
    }
  }

  if (typeof result["limit"] === "string") {
    const parsed = parseInt(result["limit"], 10);
    if (!isNaN(parsed)) result["limit"] = parsed;
  }
  if (typeof result["offset"] === "string") {
    const parsed = parseInt(result["offset"], 10);
    if (!isNaN(parsed)) result["offset"] = parsed;
  }

  if (typeof result["fields"] === "string") {
    try {
      const parsed = JSON.parse(result["fields"]) as unknown;
      result["fields"] = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      result["fields"] = (result["fields"] as string).split(",").map((s: string) => s.trim());
    }
  } else if (result["fields"] !== undefined && !Array.isArray(result["fields"])) {
    result["fields"] = [result["fields"]];
  }

  delete result["criteria"];
  delete result["condition"];
  delete result["update"];
  delete result["query"];
  delete result["sql"];
  delete result["where"];
  delete result["documentId"];
  delete result["search"];
  delete result["patch"];

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

  if (result["collection"] === undefined) {
    if (result["collectionName"] !== undefined) result["collection"] = result["collectionName"];
    else if (result["table"] !== undefined) result["collection"] = result["table"];
    else if (result["tableName"] !== undefined) result["collection"] = result["tableName"];
    else if (result["tbl"] !== undefined) result["collection"] = result["tbl"];
  }

  if (result["schema"] === undefined && result["database"] !== undefined) {
    result["schema"] = result["database"];
  }

  if (result["name"] === undefined) {
    if (result["indexName"] !== undefined) result["name"] = result["indexName"];
    else if (result["index"] !== undefined) result["name"] = result["index"];
  }

  if (typeof result["fields"] === "string") {
    try {
      const parsed = JSON.parse(result["fields"]) as unknown;
      result["fields"] = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      result["fields"] = [{ path: result["fields"] }];
    }
  } else if (typeof result["fields"] === "object" && result["fields"] !== null && !Array.isArray(result["fields"])) {
    result["fields"] = [result["fields"]];
  }

  if (Array.isArray(result["fields"])) {
    result["fields"] = result["fields"].map((f: unknown) => {
      if (typeof f === "string") return { path: ensureJsonPath(f) };
      if (typeof f !== "object" || f === null) return f;
      const fieldObj = { ...(f as Record<string, unknown>) };
      if (fieldObj["path"] === undefined && fieldObj["field"] !== undefined) {
        fieldObj["path"] = fieldObj["field"];
        delete fieldObj["field"];
      }
      if (typeof fieldObj["path"] === "string") {
        fieldObj["path"] = ensureJsonPath(fieldObj["path"]);
      }
      if (typeof fieldObj["type"] === "string") {
        const upType = fieldObj["type"].toUpperCase();
        if (upType === "INTEGER") fieldObj["type"] = "INT";
        else fieldObj["type"] = upType;
      }
      return fieldObj;
    });
  }

  delete result["collectionName"];
  delete result["table"];
  delete result["tableName"];
  delete result["tbl"];
  delete result["database"];
  delete result["indexName"];
  delete result["index"];

  return result;
}

export function preprocessBinlogEventsParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input ?? {};
  const result = { ...(input as Record<string, unknown>) };

  if (result["logFile"] === undefined) {
    if (result["file"] !== undefined) result["logFile"] = result["file"];
    else if (result["filename"] !== undefined) result["logFile"] = result["filename"];
    else if (result["fileName"] !== undefined) result["logFile"] = result["fileName"];
    else if (result["binlog"] !== undefined) result["logFile"] = result["binlog"];
    else if (result["log_file"] !== undefined) result["logFile"] = result["log_file"];
    else if (result["name"] !== undefined) result["logFile"] = result["name"];
  }
  
  if (result["position"] === undefined) {
    if (result["pos"] !== undefined) result["position"] = result["pos"];
    else if (result["start"] !== undefined) result["position"] = result["start"];
  }

  delete result["file"];
  delete result["filename"];
  delete result["fileName"];
  delete result["binlog"];
  delete result["log_file"];
  delete result["name"];
  delete result["pos"];
  delete result["start"];

  return result;
}

export function preprocessSpatialParams(input: unknown): unknown {
  const result = preprocessTableParams(input) as Record<string, unknown>;
  if (typeof result !== "object" || result === null) return result;

  if (Array.isArray(input)) {
    if (result["geometry1"] === undefined && input.length > 0) result["geometry1"] = input[0];
    if (result["geometry2"] === undefined && input.length > 1) result["geometry2"] = input[1];
    if (result["srid"] === undefined && input.length > 2) result["srid"] = input[2];
  } else {
    if (result["geometry1"] === undefined && result["0"] !== undefined) result["geometry1"] = result["0"];
    if (result["geometry2"] === undefined && result["1"] !== undefined) result["geometry2"] = result["1"];
  }

  if (result["spatialColumn"] === undefined) {
    let col = result["geometryColumn"] ?? result["column"] ?? result["columnName"] ?? result["geomColumn"] ?? result["col"] ?? result["columns"];
    if (Array.isArray(col)) col = col[0];
    if (typeof col === "object" && col !== null) {
      col = (col as Record<string, unknown>)["name"] ?? (col as Record<string, unknown>)["column"] ?? JSON.stringify(col);
    }
    if (col !== undefined) result["spatialColumn"] = col;
  }

  if (result["type"] === undefined) {
    if (result["geometryType"] !== undefined) result["type"] = result["geometryType"];
    else if (result["geomType"] !== undefined) result["type"] = result["geomType"];
  }

  if (result["polygon"] === undefined) {
    if (result["wkt"] !== undefined) result["polygon"] = result["wkt"];
    else if (result["geometry"] !== undefined) result["polygon"] = result["geometry"];
    else if (result["value"] !== undefined) result["polygon"] = result["value"];
    else if (result["point"] !== undefined) {
      result["polygon"] = Array.isArray(result["point"]) ? JSON.stringify(result["point"]) : result["point"];
    }
  }

  if (result["geometry"] === undefined) {
    if (result["wkt"] !== undefined) result["geometry"] = result["wkt"];
    else if (result["polygon"] !== undefined) result["geometry"] = result["polygon"];
    else if (result["point"] !== undefined) {
      result["geometry"] = Array.isArray(result["point"]) ? JSON.stringify(result["point"]) : result["point"];
    }
  }
  
  if (result["geometry1"] === undefined && result["geomColumn1"] !== undefined) result["geometry1"] = result["geomColumn1"];
  if (result["geometry2"] === undefined && result["geomColumn2"] !== undefined) result["geometry2"] = result["geomColumn2"];

  return result;
}

export function preprocessStatsParams(input: unknown): unknown {
  const result = preprocessTableParams(input) as Record<string, unknown>;
  if (typeof result !== "object" || result === null) return result;

  if (result["column"] === undefined) {
    if (result["columnName"] !== undefined) result["column"] = result["columnName"];
    else if (result["col"] !== undefined) result["column"] = result["col"];
    else if (result["fieldName"] !== undefined) result["column"] = result["fieldName"];
  }

  if (result["timeColumn"] === undefined) {
    if (result["time"] !== undefined) result["timeColumn"] = result["time"];
    else if (result["dateColumn"] !== undefined) result["timeColumn"] = result["dateColumn"];
    else if (result["timestamp"] !== undefined) result["timeColumn"] = result["timestamp"];
  }

  if (result["valueColumn"] === undefined) {
    if (result["val"] !== undefined) result["valueColumn"] = result["val"];
    else if (result["value"] !== undefined) result["valueColumn"] = result["value"];
    else if (result["valColumn"] !== undefined) result["valueColumn"] = result["valColumn"];
  }

  if (result["xColumn"] === undefined) {
    if (result["columnX"] !== undefined) result["xColumn"] = result["columnX"];
    else if (result["colX"] !== undefined) result["xColumn"] = result["colX"];
    else if (result["x"] !== undefined) result["xColumn"] = result["x"];
  }

  if (result["yColumn"] === undefined) {
    if (result["columnY"] !== undefined) result["yColumn"] = result["columnY"];
    else if (result["colY"] !== undefined) result["yColumn"] = result["colY"];
    else if (result["y"] !== undefined) result["yColumn"] = result["y"];
  }

  return result;
}

