/**
 * Fulltext search helper utilities.
 */

/**
 * Sanitizes a MySQL fulltext search query by:
 * 1. Normalizing whitespace
 * 2. Balancing double quotes (strip if unbalanced)
 * 3. Balancing parentheses (strip if unbalanced)
 * 4. Stripping stray/dangling operators (+, -, >, <, ~, *) at end of query
 * 5. Removing empty quoted phrases ("")
 */
export function sanitizeFulltextQuery(query: string): string {
  if (!query) return "";

  // 1. Normalize whitespace
  let clean = query.replace(/\s+/g, " ").trim();

  // 2. Balance double quotes
  const quoteCount = (clean.match(/"/g) ?? []).length;
  if (quoteCount % 2 !== 0) {
    clean = clean.replace(/"/g, "");
  }

  // 3. Balance parentheses
  let depth = 0;
  for (const ch of clean) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
  }
  if (depth !== 0) {
    clean = clean.replace(/[()]/g, "");
  }

  // 4. Strip trailing operators
  clean = clean.replace(/[+\-><~*]+\s*$/, "").trim();

  // 5. Remove empty quoted phrases
  clean = clean.replace(/""\s*/g, "").trim();

  return clean;
}
