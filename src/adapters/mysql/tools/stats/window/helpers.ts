import { escapeIdentifier } from "../../../../../utils/validators.js";

export function selectList(
  selectColumns: string[] | undefined,
  windowExpr: string,
  windowAlias: string,
): string {
  const cols =
    selectColumns && selectColumns.length > 0
      ? selectColumns.map((c) => c === "*" ? "*" : `\`${escapeIdentifier(c)}\``).join(", ")
      : "*";
  return `${cols}, ${windowExpr} AS \`${escapeIdentifier(windowAlias)}\``;
}

export function partitionClause(partitionBy?: string): string {
  if (!partitionBy) return "";
  return `PARTITION BY ${partitionBy}`;
}

export function whereClause(where?: string): string {
  if (!where) return "";
  return `WHERE ${where}`;
}
