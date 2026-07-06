/**
 * Check if an error is a MySQL duplicate key name error (ER_DUP_KEYNAME, code 1061)
 */
export function isDuplicateKeyError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      (err as Error & { errno?: number }).errno === 1061 ||
      err.message.includes("Duplicate key name")
    );
  }
  return false;
}

/**
 * Check if an error is a MySQL can't drop key error (ER_CANT_DROP_FIELD_OR_KEY, code 1091)
 */
export function isCantDropKeyError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      (err as Error & { errno?: number }).errno === 1091 ||
      err.message.includes("check that column/key exists")
    );
  }
  return false;
}

/**
 * Truncate string values in rows to maxLength if specified
 */
export function truncateRowValues(
  rows: Record<string, unknown>[],
  columns: string[],
  maxLength?: number,
): Record<string, unknown>[] {
  if (maxLength === undefined || maxLength === null || maxLength <= 0)
    return rows;
  return rows.map((row) => {
    const truncated = { ...row };
    for (const col of columns) {
      const val = truncated[col];
      if (typeof val === "string" && val.length > maxLength) {
        truncated[col] = val.substring(0, maxLength) + "...";
      }
    }
    return truncated;
  });
}
