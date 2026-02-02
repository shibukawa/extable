import type { Schema } from "./types";

export type UniqueBooleanCommitState = Map<
  string,
  {
    currentRowId: string | null;
    previousRowId: string | null;
  }
>;

const isTrueValue = (value: unknown) =>
  value === true || value === "true" || value === "1" || value === 1;

export function resolveUniqueBooleanCommitState(
  schema: Schema,
  pending: Map<string, Record<string, unknown>>,
  getRawCell: (rowId: string, colKey: string) => unknown,
): UniqueBooleanCommitState {
  const state: UniqueBooleanCommitState = new Map();
  if (pending.size === 0) return state;
  const uniqueCols = new Set<string>();
  for (const col of schema.columns) {
    if (col && col.type === "boolean" && col.unique) {
      uniqueCols.add(String(col.key));
    }
  }
  if (uniqueCols.size === 0) return state;

  for (const [rowId, pendingRow] of pending) {
    for (const [colKey, nextVal] of Object.entries(pendingRow)) {
      const key = String(colKey);
      if (!uniqueCols.has(key)) continue;
      const before = getRawCell(rowId, key);
      const beforeTrue = isTrueValue(before);
      const afterTrue = isTrueValue(nextVal);
      if (beforeTrue === afterTrue) continue;
      const entry = state.get(key) ?? { currentRowId: null, previousRowId: null };
      if (afterTrue && !beforeTrue) entry.currentRowId = rowId;
      if (beforeTrue && !afterTrue) entry.previousRowId = rowId;
      state.set(key, entry);
    }
  }
  return state;
}
