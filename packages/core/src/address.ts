import type { DataModel } from "./dataModel";
import type { CellAddress, ExcelRef } from "./types";

function excelColumnToIndex(col: string) {
  let out = 0;
  for (let i = 0; i < col.length; i += 1) {
    const c = col.charCodeAt(i);
    if (c < 65 || c > 90) return -1; // A..Z
    out = out * 26 + (c - 64); // 1..26
  }
  return out - 1; // 0-based
}

function parseExcelRef(ref: string): { rowIndex: number; colIndex: number } | null {
  const m = /^([A-Z]{1,2})([1-9][0-9]{0,5})$/.exec(ref);
  if (!m) return null;
  const colIndex = excelColumnToIndex(m[1]!);
  const rowNum = Number(m[2]);
  if (!Number.isFinite(rowNum) || rowNum < 1) return null;
  // MVP cap: 1..100000
  if (rowNum > 100000) return null;
  if (colIndex < 0) return null;
  return { rowIndex: rowNum - 1, colIndex };
}

export type ResolvedCellTarget = {
  rowId: string;
  colKey: string | number;
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

  const resolveByKeys = (rowId: string, colKey: string | number): ResolvedCellTarget | null => {
    const rowIndex = dataModel.getRowIndex(rowId);
    if (rowIndex < 0) return null;
    const colIndex = schema.columns.findIndex((c) => String(c.key) === String(colKey));
    if (colIndex < 0) return null;
    return { rowId, colKey, rowIndex, colIndex };
  };

  if (typeof address === "string") {
    const parsed = parseExcelRef(address as ExcelRef);
    if (!parsed) return null;
    return resolveByIndex(parsed.rowIndex, parsed.colIndex);
  }

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
    const colIndex = schema.columns.findIndex((c) => String(c.key) === String(address.colKey));
    if (colIndex < 0) return null;
    return resolveByIndex(address.rowIndex, colIndex);
  }

  return null;
}

