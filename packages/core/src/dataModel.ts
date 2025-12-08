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
    this.rows = dataset.rows.map((row) => ({
      id: generateId(),
      raw: row
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
      const current = this.pending.get(rowId) ?? {};
      current[key] = value;
      this.pending.set(rowId, current);
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
    this.rows.push({ id, raw: rowData });
    return id;
  }

  public deleteRow(rowId: string) {
    this.rows = this.rows.filter((r) => r.id !== rowId);
    this.pending.delete(rowId);
  }

  public getColumns(): ColumnSchema[] {
    return this.schema.columns;
  }
}
