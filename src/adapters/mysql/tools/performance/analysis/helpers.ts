/**
 * Maximum reasonable timer value in milliseconds (24 hours).
 * Values exceeding this threshold are timer overflow artifacts from
 * performance_schema's unsigned 64-bit picosecond counters wrapping.
 */
export const MAX_TIMER_MS = 86_400_000;

/**
 * Sanitize timer fields in query result rows.
 * Overflowed values (> 24 hours) are clamped to -1 with an `overflow: true` flag.
 */
export function sanitizeTimerRows(
  rows: Record<string, unknown>[] | undefined,
  timerFields: string[],
): Record<string, unknown>[] {
  if (!rows) return [];
  return rows.map((row) => {
    let hasOverflow = false;
    const sanitized = { ...row };
    for (const field of timerFields) {
      const value = sanitized[field];
      const numValue =
        typeof value === "number"
          ? value
          : typeof value === "string"
            ? parseFloat(value)
            : NaN;
      if (!isNaN(numValue) && numValue > MAX_TIMER_MS) {
        sanitized[field] = -1;
        hasOverflow = true;
      } else if (!isNaN(numValue)) {
        sanitized[field] = numValue;
      }
    }
    if (hasOverflow) {
      sanitized["overflow"] = true;
    }
    return sanitized;
  });
}

export function optimizeExplainJson(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map(optimizeExplainJson);
  }
  if (typeof node === "object" && node !== null) {
    const optimized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      // Strip verbose arrays and deep cost details to conserve tokens
      if (key === "used_columns" || key === "cost_info") {
        continue;
      }
      optimized[key] = optimizeExplainJson(value);
    }
    return optimized;
  }
  return node;
}
