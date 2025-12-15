import { generateId } from "./utils";
import type { ColumnSchema, DataSet, InternalRow, Schema, View, StyleDelta } from "./types";
import { validateCellValue } from "./validation";

export class DataModel {
  private schema: Schema;
  private view: View;
  private rows: InternalRow[] = [];
  private pending: Map<string, Record<string | number, unknown>> = new Map();
  private rowVersion: Map<string, number> = new Map();
  private listeners = new Set<() => void>();
  private cellStyles = new Map<string, StyleDelta>();
  private validationErrors = new Map<
    string,
    { rowId: string; colKey: string | number; message: string }
  >();
  private notifySuspended = false;
  private notifyDirty = false;

  constructor(dataset: DataSet, schema: Schema, view: View) {
    this.schema = schema;
    this.view = view;
    this.setData(dataset);
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    if (this.notifySuspended) {
      this.notifyDirty = true;
      return;
    }
    for (const l of this.listeners) l();
  }

  public batchUpdate(run: () => void) {
    this.notifySuspended = true;
    try {
      run();
    } finally {
      this.notifySuspended = false;
      if (this.notifyDirty) {
        this.notifyDirty = false;
        this.notify();
      }
    }
  }

  public setData(dataset: DataSet) {
    this.pending.clear();
    this.cellStyles.clear();
    this.validationErrors.clear();
    this.rows = dataset.rows.map((row, idx) => {
      const id = generateId();
      this.rowVersion.set(id, 0);
      return {
        id,
        raw: row,
        displayIndex: idx + 1,
      };
    });
    this.recomputeValidationErrors();
    this.notify();
  }

  public setSchema(schema: Schema) {
    this.schema = schema;
    this.recomputeValidationErrors();
    this.notify();
  }

  public setView(view: View) {
    this.view = view;
    this.notify();
  }

  public getSchema() {
    return this.schema;
  }

  public getView() {
    return this.view;
  }

  public listRows(): InternalRow[] {
    return this.rows;
  }

  private findRow(rowId: string): { row: InternalRow; index: number } | null {
    const index = this.rows.findIndex((r) => r.id === rowId);
    if (index < 0) return null;
    const row = this.rows[index];
    if (!row) return null;
    return { row, index };
  }

  public getRowHeight(rowId: string) {
    return this.view.rowHeights?.[rowId];
  }

  public setRowHeight(rowId: string, height: number) {
    if (!this.view.rowHeights) this.view.rowHeights = {};
    this.view.rowHeights[rowId] = height;
    this.notify();
  }

  public getCell(rowId: string, key: string | number) {
    const found = this.findRow(rowId);
    if (!found) return undefined;
    const row = found.row;
    const pendingRow = this.pending.get(rowId);
    if (pendingRow && key in pendingRow) return pendingRow[key];
    if (Array.isArray(row.raw)) {
      return row.raw[Number(key)];
    }
    return row.raw[String(key)];
  }

  public getRawCell(rowId: string, key: string | number) {
    const found = this.findRow(rowId);
    if (!found) return undefined;
    const row = found.row;
    if (Array.isArray(row.raw)) {
      return row.raw[Number(key)];
    }
    return row.raw[String(key)];
  }

  public isRowReadonly(rowId: string) {
    const found = this.findRow(rowId);
    if (!found) return false;
    const row = found.row;
    if (Array.isArray(row.raw)) return false;
    return Boolean((row.raw as Record<string, unknown>)._readonly);
  }

  public isColumnReadonly(colKey: string | number) {
    const col = this.schema.columns.find((c) => c.key === colKey);
    return Boolean(col?.readonly);
  }

  public isReadonly(rowId: string, colKey: string | number) {
    return this.isRowReadonly(rowId) || this.isColumnReadonly(colKey);
  }

  public setCell(rowId: string, key: string | number, value: unknown, committed: boolean) {
    const found = this.findRow(rowId);
    if (!found) return;
    const row = found.row;
    const bumpVersion = () => {
      const prev = this.rowVersion.get(rowId) ?? 0;
      this.rowVersion.set(rowId, prev + 1);
    };
    if (committed) {
      if (Array.isArray(row.raw)) {
        row.raw[Number(key)] = value as any;
      } else {
        row.raw[String(key)] = value as any;
      }
      this.pending.delete(rowId);
      bumpVersion();
    } else {
      const rawVal = this.getRawCell(rowId, key);
      const current = this.pending.get(rowId) ?? {};
      if (this.isEqual(rawVal, value)) {
        delete current[key];
      } else {
        current[key] = value;
      }
      const hasKeys = Object.keys(current).length > 0;
      if (hasKeys) {
        this.pending.set(rowId, current);
      } else {
        this.pending.delete(rowId);
      }
      bumpVersion();
    }
    this.updateValidationForCell(rowId, key, this.getCell(rowId, key));
    this.notify();
  }

  public applyPending(rowId: string) {
    const pendingRow = this.pending.get(rowId);
    if (!pendingRow) return;
    const found = this.findRow(rowId);
    if (!found) return;
    const row = found.row;
    for (const [key, val] of Object.entries(pendingRow)) {
      if (Array.isArray(row.raw)) {
        row.raw[Number(key)] = val as any;
      } else {
        row.raw[key] = val as any;
      }
      this.updateValidationForCell(rowId, key, val);
    }
    this.pending.delete(rowId);
    this.notify();
  }

  public clearPending(rowId: string) {
    this.pending.delete(rowId);
    this.notify();
  }

  public getPending() {
    return this.pending;
  }

  public hasPending(rowId: string, key: string | number) {
    const p = this.pending.get(rowId);
    if (!p) return false;
    return key in p;
  }

  public insertRow(rowData: InternalRow["raw"]) {
    return this.insertRowAt(rowData, this.rows.length);
  }

  public insertRowAt(rowData: InternalRow["raw"], index: number, forcedId?: string) {
    const id = forcedId ?? generateId();
    const clamped = Math.max(0, Math.min(index, this.rows.length));
    this.rows.splice(clamped, 0, { id, raw: rowData, displayIndex: 0 });
    this.reindexRows();
    this.rowVersion.set(id, 0);
    this.notify();
    return id;
  }

  public removeRow(rowId: string): { row: InternalRow; index: number } | null {
    const found = this.findRow(rowId);
    if (!found) return null;
    const removed = this.rows.splice(found.index, 1)[0];
    if (!removed) return null;
    this.pending.delete(rowId);
    this.rowVersion.delete(rowId);
    this.reindexRows();
    this.notify();
    return { row: removed, index: found.index };
  }

  public getDisplayIndex(rowId: string) {
    return this.findRow(rowId)?.row.displayIndex;
  }

  public getRowIndex(rowId: string) {
    return this.findRow(rowId)?.index ?? -1;
  }

  public getColumns(): ColumnSchema[] {
    return this.schema.columns;
  }

  public getColumnIndex(colKey: string | number) {
    return this.schema.columns.findIndex((c) => String(c.key) === String(colKey));
  }

  public getColumnByIndex(colIndex: number) {
    return this.schema.columns[colIndex] ?? null;
  }

  public getRowByIndex(rowIndex: number) {
    return this.rows[rowIndex] ?? null;
  }

  private cellStyleKey(rowId: string, colKey: string | number) {
    return `${rowId}::${String(colKey)}`;
  }

  public getValidationErrors() {
    const out = [...this.validationErrors.values()];
    out.sort((a, b) => {
      const ra = this.getRowIndex(a.rowId);
      const rb = this.getRowIndex(b.rowId);
      if (ra !== rb) return ra - rb;
      const ca = this.getColumnIndex(a.colKey);
      const cb = this.getColumnIndex(b.colKey);
      return ca - cb;
    });
    return out;
  }

  private updateValidationForCell(rowId: string, colKey: string | number, value: unknown) {
    const col = this.schema.columns.find((c) => String(c.key) === String(colKey));
    if (!col) return;
    const msg = validateCellValue(value, col);
    const key = this.cellStyleKey(rowId, colKey);
    if (!msg) this.validationErrors.delete(key);
    else this.validationErrors.set(key, { rowId, colKey, message: msg });
  }

  private recomputeValidationErrors() {
    this.validationErrors.clear();
    for (const row of this.rows) {
      for (const col of this.schema.columns) {
        const v = this.getCell(row.id, col.key);
        this.updateValidationForCell(row.id, col.key, v);
      }
    }
  }

  public getCellStyle(rowId: string, colKey: string | number): StyleDelta | null {
    return this.cellStyles.get(this.cellStyleKey(rowId, colKey)) ?? null;
  }

  public setCellStyle(rowId: string, colKey: string | number, style: StyleDelta | null) {
    const key = this.cellStyleKey(rowId, colKey);
    if (!style || Object.keys(style).length === 0) this.cellStyles.delete(key);
    else this.cellStyles.set(key, style);
    this.notify();
  }

  public updateColumnFormat(
    colKey: string | number,
    updater: ColumnSchema["format"] | ((oldValue: ColumnSchema["format"] | undefined) => ColumnSchema["format"] | undefined),
  ) {
    const idx = this.getColumnIndex(colKey);
    if (idx < 0) return;
    const col = this.schema.columns[idx]!;
    const next = typeof updater === "function" ? updater(col.format) : updater;
    col.format = next;
    this.notify();
  }

  private isEqual(a: unknown, b: unknown) {
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    return Object.is(a, b);
  }

  public getRowVersion(rowId: string) {
    return this.rowVersion.get(rowId) ?? 0;
  }

  private reindexRows() {
    let idx = 1;
    for (const row of this.rows) {
      row.displayIndex = idx;
      idx += 1;
    }
  }
}
