export type FindingType =
  | "redundant"
  | "missing_fk_index"
  | "unindexed_large_table"
  | "composite"
  | "covering"
  | "heuristic";

export type FindingSeverity = "info" | "warning" | "error";

export interface IndexFinding {
  type: FindingType;
  severity: FindingSeverity;
  table: string;
  index?: string;
  redundantOf?: string;
  column?: string;
  columns?: string[];
  rationale: string;
  suggestion: string;
  createStatement?: string;
}

export interface ExistingIndex {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  type: string;
}

export interface FkRelationship {
  table: string;
  column: string;
  refTable: string;
  refColumn: string;
}
