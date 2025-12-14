import { generateId } from "./utils";
import type { ColumnSchema, DataSet, InternalRow, Schema, View } from "./types";

export class DataModel {
  private schema: Schema;
  private view: View;
  private rows: InternalRow[] = [];
  private pending: Map<string, Record<string | number, unknown>> = new Map();
  private rowVersion: Map<string, number> = new Map();
  private listeners = new Set<() => void>();

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
    for (const l of this.listeners) l();
  }

  public setData(dataset: DataSet) {
    this.pending.clear();
    this.rows = dataset.rows.map((row, idx) => {
      const id = generateId();
      this.rowVersion.set(id, 0);
      return {
        id,
        raw: row,
        displayIndex: idx + 1,
      };
    });
    this.notify();
  }

  public setSchema(schema: Schema) {
    this.schema = schema;
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
