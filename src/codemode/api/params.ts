import { POSITIONAL_PARAM_MAP, ARRAY_WRAP_MAP } from "./constants/index.js";

/**
 * Normalize parameters to support positional arguments.
 * Handles both single positional args and multiple positional args.
 */
export function normalizeParams(methodName: string, args: unknown[]): unknown {
  // No args - pass through
  if (args.length === 0) return undefined;

  // Single arg handling
  if (args.length === 1) {
    const arg = args[0];

    // Object arg - pass through
    if (typeof arg === "object" && arg !== null && !Array.isArray(arg)) {
      return arg;
    }

    // Array arg - check if we should wrap it
    if (Array.isArray(arg)) {
      const wrapKey = ARRAY_WRAP_MAP[methodName];
      if (wrapKey !== undefined) {
        return { [wrapKey]: arg };
      }
      return arg;
    }

    // String arg - use positional mapping
    if (typeof arg === "string") {
      const paramMapping = POSITIONAL_PARAM_MAP[methodName];
      if (typeof paramMapping === "string") {
        return { [paramMapping]: arg };
      }
      if (Array.isArray(paramMapping) && paramMapping[0] !== undefined) {
        return { [paramMapping[0]]: arg };
      }
      // Fallback: try common parameter names
      return { sql: arg, query: arg, table: arg, name: arg };
    }

    return arg;
  }

  // Multi-arg: check for array+options pattern first
  if (args.length >= 1 && Array.isArray(args[0])) {
    const wrapKey = ARRAY_WRAP_MAP[methodName];
    if (wrapKey !== undefined) {
      const result: Record<string, unknown> = { [wrapKey]: args[0] };
      if (args.length > 1) {
        const lastArg = args[args.length - 1];
        if (
          typeof lastArg === "object" &&
          lastArg !== null &&
          !Array.isArray(lastArg)
        ) {
          Object.assign(result, lastArg);
        }
      }
      return result;
    }
  }

  // Look up positional parameter mapping
  const paramMapping = POSITIONAL_PARAM_MAP[methodName];

  if (paramMapping === undefined) {
    return args[0];
  }

  // Single param mapping - merge trailing options if present
  if (typeof paramMapping === "string") {
    const result: Record<string, unknown> = { [paramMapping]: args[0] };
    if (args.length > 1) {
      const lastArg = args[args.length - 1];
      if (
        typeof lastArg === "object" &&
        lastArg !== null &&
        !Array.isArray(lastArg)
      ) {
        Object.assign(result, lastArg);
      }
    }
    return result;
  }

  // Multi-param mapping (array)
  const result: Record<string, unknown> = {};

  // Check if last arg is an options object that should be merged
  const lastArg = args[args.length - 1];
  const lastArgIsOptionsObject =
    typeof lastArg === "object" &&
    lastArg !== null &&
    !Array.isArray(lastArg) &&
    Object.keys(lastArg).some((k) => paramMapping.includes(k));

  // Map positional args to their keys
  const argsToMap = lastArgIsOptionsObject ? args.length - 1 : args.length;
  for (let i = 0; i < paramMapping.length && i < argsToMap; i++) {
    const key = paramMapping[i];
    if (key !== undefined) {
      if (key.startsWith("...")) {
        result[key.slice(3)] = args.slice(i, argsToMap);
        break;
      }
      result[key] = args[i];
    }
  }

  // Merge trailing options object
  if (args.length > paramMapping.length || lastArgIsOptionsObject) {
    if (
      typeof lastArg === "object" &&
      lastArg !== null &&
      !Array.isArray(lastArg)
    ) {
      Object.assign(result, lastArg);
    }
  }

  return result;
}
