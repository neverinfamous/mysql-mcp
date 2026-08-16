/**
 * mysql-mcp - Token Estimation Utility
 */

export type ContentType = "json" | "sql" | "text";

/**
 * Estimates the number of tokens in a given string based on its content type.
 * Replaces the naive Math.ceil(length / 4) heuristic which significantly
 * underestimates JSON and SQL payloads.
 *
 * @param text The string content to estimate tokens for
 * @param contentType The type of content (json, sql, or text)
 * @returns An estimated token count
 */
export function estimateTokens(
  text: string,
  contentType: ContentType = "text",
): number {
  const bytes = Buffer.byteLength(text, "utf8");
  switch (contentType) {
    case "json":
      // JSON has ~3 bytes/token due to structure characters ({, }, ", :)
      return Math.ceil(bytes / 3);
    case "sql":
      // SQL keywords compress well
      return Math.ceil(bytes / 3.5);
    case "text":
    default:
      // English prose default
      return Math.ceil(bytes / 4);
  }
}

/**
 * Fast, allocation-free byte estimation for objects to avoid JSON.stringify overhead.
 * Cap depth to avoid max call stack size on extremely deep structures.
 *
 * @param obj The object to estimate
 * @param depth Current recursion depth
 * @returns Estimated byte length if stringified
 */
export function estimateObjectBytes(obj: unknown, depth = 0): number {
  if (depth > 10) return 0; // Cap depth
  if (obj === null || obj === undefined) return 4; // "null"
  
  if (typeof obj === "string") {
    return Buffer.byteLength(obj, "utf8") + 2; // +2 for quotes
  }
  
  if (typeof obj === "number" || typeof obj === "boolean") {
    return String(obj).length;
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return 2; // "[]"
    
    // Fast path for large arrays (like rows) to avoid massive CPU cycles
    if (obj.length > 50) {
      let sampleBytes = 0;
      for (let i = 0; i < 5; i++) {
        sampleBytes += estimateObjectBytes(obj[i], depth + 1);
      }
      return 2 + (sampleBytes / 5) * obj.length + (obj.length - 1); // + commas
    }
    
    let bytes = 2; // [ and ]
    for (const item of obj) {
      bytes += estimateObjectBytes(item, depth + 1);
    }
    return bytes + obj.length - 1; // commas
  }
  
  if (typeof obj === "object") {
    let bytes = 2; // { and }
    let keyCount = 0;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        bytes += Buffer.byteLength(key, "utf8") + 3; // "key":
        bytes += estimateObjectBytes((obj as Record<string, unknown>)[key], depth + 1);
        keyCount++;
      }
    }
    return bytes + (keyCount > 0 ? keyCount - 1 : 0); // commas
  }
  
  return 0;
}

/**
 * Fast token estimation for an object without full serialization.
 */
export function estimateObjectTokens(obj: unknown): number {
  const bytes = estimateObjectBytes(obj);
  return Math.ceil(bytes / 3); // JSON has ~3 bytes/token
}
