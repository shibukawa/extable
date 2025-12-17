import type { DataModel } from "./dataModel";
import type { CellAddress } from "./types";

export type ResolvedCellTarget = {
  rowId: string;
  colKey: string;
  rowIndex: number;
  colIndex: number;
};

export function resolveCellAddress(dataModel: DataModel, address: CellAddress): ResolvedCellTarget | null {
  const schema = dataModel.getSchema();
  const rows = dataModel.listRows();

  const resolveByIndex = (rowIndex: number, colIndex: number): ResolvedCellTarget | null => {
    if (!Number.isInteger(rowIndex) || !Number.isInteger(colIndex)) return null;
    if (rowIndex < 0 || rowIndex >= rows.length) return null;
    if (colIndex < 0 || colIndex >= schema.columns.length) return null;
    const row = rows[rowIndex]!;
    const col = schema.columns[colIndex]!;
    return { rowId: row.id, colKey: col.key, rowIndex, colIndex };
  };

  const resolveByKeys = (rowId: string, colKey: string): ResolvedCellTarget | null => {
    const rowIndex = dataModel.getRowIndex(rowId);
    if (rowIndex < 0) return null;
    const colIndex = schema.columns.findIndex((c) => c.key === colKey);
    if (colIndex < 0) return null;
    return { rowId, colKey, rowIndex, colIndex };
  };

  if ("rowId" in address && "colKey" in address) {
    return resolveByKeys(address.rowId, address.colKey);
  }
  if ("rowIndex" in address && "colIndex" in address) {
    return resolveByIndex(address.rowIndex, address.colIndex);
  }
  if ("rowId" in address && "colIndex" in address) {
    const rowIndex = dataModel.getRowIndex(address.rowId);
    if (rowIndex < 0) return null;
    return resolveByIndex(rowIndex, address.colIndex);
  }
  if ("rowIndex" in address && "colKey" in address) {
    const colIndex = schema.columns.findIndex((c) => c.key === address.colKey);
    if (colIndex < 0) return null;
    return resolveByIndex(address.rowIndex, colIndex);
  }

  return null;
}
