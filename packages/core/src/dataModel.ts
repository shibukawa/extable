import { generateId } from './utils';
import type { ColumnSchema, DataSet, InternalRow, Schema, View } from './types';

export class DataModel {
  private schema: Schema;
  private view: View;
  private rows: InternalRow[] = [];
  private pending: Map<string, Record<string | number, unknown>> = new Map();

  constructor(dataset: DataSet, schema: Schema, view: View) {
    this.schema = schema;
    this.view = view;
    this.setData(dataset);
  }

  public setData(dataset: DataSet) {
    this.pending.clear();
    this.rows = dataset.rows.map((row, idx) => ({
      id: generateId(),
      raw: row,
      displayIndex: idx + 1
    }));
  }

  public setSchema(schema: Schema) {
    this.schema = schema;
  }

  public setView(view: View) {
    this.view = view;
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

  public getRowHeight(rowId: string) {
    return this.view.rowHeights?.[rowId];
  }

  public setRowHeight(rowId: string, height: number) {
    if (!this.view.rowHeights) this.view.rowHeights = {};
    this.view.rowHeights[rowId] = height;
  }

  public getCell(rowId: string, key: string | number) {
    const row = this.rows.find((r) => r.id === rowId);
    if (!row) return undefined;
    const pendingRow = this.pending.get(rowId);
    if (pendingRow && key in pendingRow) return pendingRow[key];
    if (Array.isArray(row.raw)) {
      return row.raw[Number(key)];
    }
    return row.raw[String(key)];
  }

  public getRawCell(rowId: string, key: string | number) {
    const row = this.rows.find((r) => r.id === rowId);
    if (!row) return undefined;
    if (Array.isArray(row.raw)) {
      return row.raw[Number(key)];
    }
    return row.raw[String(key)];
  }

  public isRowReadonly(rowId: string) {
    const row = this.rows.find((r) => r.id === rowId);
    if (!row) return false;
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
    const row = this.rows.find((r) => r.id === rowId);
    if (!row) return;
    if (committed) {
      if (Array.isArray(row.raw)) {
        row.raw[Number(key)] = value as any;
      } else {
        row.raw[String(key)] = value as any;
      }
      this.pending.delete(rowId);
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
    }
  }

  public applyPending(rowId: string) {
    const pendingRow = this.pending.get(rowId);
    if (!pendingRow) return;
    const row = this.rows.find((r) => r.id === rowId);
    if (!row) return;
    Object.entries(pendingRow).forEach(([key, val]) => {
      if (Array.isArray(row.raw)) {
        row.raw[Number(key)] = val as any;
      } else {
        row.raw[key] = val as any;
      }
    });
    this.pending.delete(rowId);
  }

  public clearPending(rowId: string) {
    this.pending.delete(rowId);
  }

  public getPending() {
    return this.pending;
  }

  public hasPending(rowId: string, key: string | number) {
    const p = this.pending.get(rowId);
    if (!p) return false;
    return key in p;
  }

  public insertRow(rowData: InternalRow['raw']) {
    const id = generateId();
    const nextIndex = this.rows.reduce((max, r) => Math.max(max, r.displayIndex), 0) + 1;
    this.rows.push({ id, raw: rowData, displayIndex: nextIndex });
    return id;
  }

  public deleteRow(rowId: string) {
    this.rows = this.rows.filter((r) => r.id !== rowId);
    this.pending.delete(rowId);
  }

  public getDisplayIndex(rowId: string) {
    return this.rows.find((r) => r.id === rowId)?.displayIndex;
  }

  public getColumns(): ColumnSchema[] {
    return this.schema.columns;
  }

  private isEqual(a: unknown, b: unknown) {
    if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
    return Object.is(a, b);
  }
}
