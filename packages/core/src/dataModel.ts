import { generateId } from "./utils";
import type {
  CellDiagnostic,
  ColumnSchema,
  ConditionalStyleFn,
  DataSet,
  InternalRow,
  Schema,
  StyleDelta,
  View,
} from "./types";
import { validateCellValue } from "./validation";

export class DataModel {
  private schema: Schema;
  private view: View;
  private rows: InternalRow[] = [];
  private pending: Map<string, Record<string | number, unknown>> = new Map();
  private rowVersion: Map<string, number> = new Map();
  private listeners = new Set<() => void>();
  private cellStyles = new Map<string, StyleDelta>();
  private cellConditionalStyles = new Map<string, ConditionalStyleFn>();
  private computedCache = new Map<
    string,
    {
      version: number;
      formulaRef: unknown;
      value: unknown;
      textOverride?: string;
      diagnostic: CellDiagnostic | null;
    }
  >();
  private conditionalCache = new Map<
    string,
    {
      version: number;
      fnRef: unknown;
      delta: StyleDelta | null;
      diagnostic: CellDiagnostic | null;
      forceErrorText: boolean;
    }
  >();
  private rowConditionalCache = new Map<
    string,
    {
      version: number;
      fnRef: unknown;
      delta: StyleDelta | null;
      diagnostic: CellDiagnostic | null;
      forceErrorText: boolean;
    }
  >();
  private formulaDiagnostics = new Map<string, CellDiagnostic>();
  private conditionalDiagnostics = new Map<string, CellDiagnostic>();
  private baseValidationErrors = new Map<string, { rowId: string; colKey: string | number; message: string }>();
  private uniqueValidationErrors = new Map<string, { rowId: string; colKey: string | number; message: string }>();
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
    this.cellConditionalStyles.clear();
    this.computedCache.clear();
    this.conditionalCache.clear();
    this.rowConditionalCache.clear();
    this.formulaDiagnostics.clear();
    this.conditionalDiagnostics.clear();
    this.baseValidationErrors.clear();
    this.uniqueValidationErrors.clear();
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
    this.computedCache.clear();
    this.conditionalCache.clear();
    this.rowConditionalCache.clear();
    this.formulaDiagnostics.clear();
    this.conditionalDiagnostics.clear();
    this.recomputeValidationErrors();
    this.notify();
  }

  public setView(view: View) {
    this.view = view;
    this.notify();
  }

  public getSchema() {
    // Return renderable schema (exclude reserved meta columns like "__row__").
    // Use `getFullSchema()` when callers need access to meta columns.
    return { ...this.schema, columns: this.getColumns() } as Schema;
  }

  public getColumns(): ColumnSchema[] {
    // "__row__" is reserved for row header selection and row-level conditional style metadata.
    // It must not be treated as a renderable column.
    return this.schema.columns.filter((c) => String(c.key) !== "__row__");
  }

  public getRowConditionalStyleFn(): ConditionalStyleFn | null {
    const col = this.schema.columns.find((c) => String(c.key) === "__row__");
    return col?.conditionalStyle ?? null;
  }

  public getView() {
    return this.view;
  }

  public getFullSchema() {
    return this.schema;
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
    const col = this.schema.columns.find((c) => String(c.key) === String(colKey));
    return Boolean(col?.readonly || col?.formula);
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
    const col = this.schema.columns.find((c) => String(c.key) === String(key));
    if (col?.unique) this.recomputeUniqueValidationForColumn(key);
    // Invalidate computed/conditional caches for the row by version mismatch; clear diagnostics eagerly.
    this.clearDiagnosticsForCell(rowId, key);
    this.notify();
  }

  public applyPending(rowId: string) {
    const pendingRow = this.pending.get(rowId);
    if (!pendingRow) return;
    const found = this.findRow(rowId);
    if (!found) return;
    const row = found.row;
    const uniqueCols = new Set<string | number>();
    for (const [key, val] of Object.entries(pendingRow)) {
      if (Array.isArray(row.raw)) {
        row.raw[Number(key)] = val as any;
      } else {
        row.raw[key] = val as any;
      }
      this.updateValidationForCell(rowId, key, val);
      const col = this.schema.columns.find((c) => String(c.key) === String(key));
      if (col?.unique) uniqueCols.add(col.key);
      this.clearDiagnosticsForCell(rowId, key);
    }
    this.pending.delete(rowId);
    for (const colKey of uniqueCols) this.recomputeUniqueValidationForColumn(colKey);
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
    this.recomputeValidationErrors();
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
    this.recomputeValidationErrors();
    this.notify();
    return { row: removed, index: found.index };
  }

  public getDisplayIndex(rowId: string) {
    return this.findRow(rowId)?.row.displayIndex;
  }

  public getRowIndex(rowId: string) {
    return this.findRow(rowId)?.index ?? -1;
  }

  public getColumnIndex(colKey: string | number) {
    return this.getColumns().findIndex((c) => String(c.key) === String(colKey));
  }

  public getColumnByIndex(colIndex: number) {
    return this.getColumns()[colIndex] ?? null;
  }

  public getRowByIndex(rowIndex: number) {
    return this.rows[rowIndex] ?? null;
  }

  private cellStyleKey(rowId: string, colKey: string | number) {
    return `${rowId}::${String(colKey)}`;
  }

  private clearDiagnosticsForCell(rowId: string, colKey: string | number) {
    const key = this.cellStyleKey(rowId, colKey);
    this.formulaDiagnostics.delete(key);
    this.conditionalDiagnostics.delete(key);
  }

  public getCellDiagnostic(rowId: string, colKey: string | number): CellDiagnostic | null {
    const key = this.cellStyleKey(rowId, colKey);
    const a = this.formulaDiagnostics.get(key) ?? null;
    const b = this.conditionalDiagnostics.get(key) ?? null;
    if (!a) return b;
    if (!b) return a;
    if (a.level === "error") return a;
    if (b.level === "error") return b;
    // Both warnings: prefer formula message (more likely to explain the value).
    return a;
  }

  public getDiagnostics() {
    const keys = new Set<string>();
    for (const k of this.formulaDiagnostics.keys()) keys.add(k);
    for (const k of this.conditionalDiagnostics.keys()) keys.add(k);
    return [...keys].map((key) => {
      const sep = key.indexOf("::");
      const rowId = sep >= 0 ? key.slice(0, sep) : key;
      const colKey = sep >= 0 ? key.slice(sep + 2) : "";
      return { rowId, colKey, diag: this.getCellDiagnostic(rowId, colKey) };
    });
  }

  private getRowObjectEffective(rowId: string): Record<string, unknown> | null {
    const found = this.findRow(rowId);
    if (!found) return null;
    const row = found.row;
    if (Array.isArray(row.raw)) return null;
    const pendingRow = this.pending.get(rowId);
    if (!pendingRow || Object.keys(pendingRow).length === 0) return row.raw as any;
    const merged: Record<string, unknown> = { ...(row.raw as any) };
    for (const [k, v] of Object.entries(pendingRow)) {
      merged[k] = v;
    }
    return merged;
  }

  public resolveCellValue(rowId: string, col: ColumnSchema): {
    value: unknown;
    textOverride?: string;
    diagnostic: CellDiagnostic | null;
  } {
    if (!col.formula) {
      return { value: this.getCell(rowId, col.key), diagnostic: null };
    }
    const version = this.getRowVersion(rowId);
    const key = this.cellStyleKey(rowId, col.key);
    const cached = this.computedCache.get(key);
    if (cached && cached.version === version && cached.formulaRef === col.formula) {
      if (cached.diagnostic) this.formulaDiagnostics.set(key, cached.diagnostic);
      return { value: cached.value, textOverride: cached.textOverride, diagnostic: cached.diagnostic };
    }
    const data = this.getRowObjectEffective(rowId);
    if (!data) {
      const value = this.getCell(rowId, col.key);
      const next = { version, formulaRef: col.formula, value, diagnostic: null as any };
      this.computedCache.set(key, next);
      return { value, diagnostic: null };
    }
    try {
      const out = col.formula(data) as any;
      if (Array.isArray(out) && out.length >= 2 && out[1] instanceof Error) {
        const diag: CellDiagnostic = {
          level: "warning",
          message: out[1].message,
          source: "formula",
        };
        const value = out[0];
        this.computedCache.set(key, { version, formulaRef: col.formula, value, diagnostic: diag });
        this.formulaDiagnostics.set(key, diag);
        return { value, diagnostic: diag };
      }
      const value = out;
      this.computedCache.set(key, { version, formulaRef: col.formula, value, diagnostic: null });
      this.formulaDiagnostics.delete(key);
      return { value, diagnostic: null };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const diag: CellDiagnostic = { level: "error", message, source: "formula" };
      this.computedCache.set(key, {
        version,
        formulaRef: col.formula,
        value: null,
        textOverride: "#ERROR",
        diagnostic: diag,
      });
      this.formulaDiagnostics.set(key, diag);
      return { value: null, textOverride: "#ERROR", diagnostic: diag };
    }
  }

  public setCellConditionalStyle(rowId: string, colKey: string | number, fn: ConditionalStyleFn | null) {
    const key = this.cellStyleKey(rowId, colKey);
    if (!fn) this.cellConditionalStyles.delete(key);
    else this.cellConditionalStyles.set(key, fn);
    this.conditionalCache.delete(key);
    this.clearDiagnosticsForCell(rowId, colKey);
    this.notify();
  }

  private evalConditionalStyleFn(
    fn: ConditionalStyleFn,
    data: Record<string, unknown>,
  ): { delta: StyleDelta | null; diagnostic: CellDiagnostic | null; forceErrorText: boolean } {
    try {
      const out = fn(data);
      if (out instanceof Error) {
        return {
          delta: null,
          diagnostic: { level: "warning", message: out.message, source: "conditionalStyle" },
          forceErrorText: false,
        };
      }
      return { delta: out ?? null, diagnostic: null, forceErrorText: false };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        delta: null,
        diagnostic: { level: "error", message, source: "conditionalStyle" },
        forceErrorText: true,
      };
    }
  }

  private resolveRowConditionalStyle(rowId: string): {
    delta: StyleDelta | null;
    diagnostic: CellDiagnostic | null;
    forceErrorText: boolean;
  } {
    const fn = this.getRowConditionalStyleFn();
    if (!fn) return { delta: null, diagnostic: null, forceErrorText: false };
    const version = this.getRowVersion(rowId);
    const cached = this.rowConditionalCache.get(rowId);
    if (cached && cached.version === version && cached.fnRef === fn) {
      return { delta: cached.delta, diagnostic: cached.diagnostic, forceErrorText: cached.forceErrorText };
    }
    const data = this.getRowObjectEffective(rowId);
    if (!data) {
      const next = { version, fnRef: fn, delta: null, diagnostic: null, forceErrorText: false };
      this.rowConditionalCache.set(rowId, next);
      return { delta: null, diagnostic: null, forceErrorText: false };
    }
    const res = this.evalConditionalStyleFn(fn, data);
    this.rowConditionalCache.set(rowId, { version, fnRef: fn, ...res });
    return res;
  }

  public resolveConditionalStyle(rowId: string, col: ColumnSchema): {
    delta: StyleDelta | null;
    diagnostic: CellDiagnostic | null;
    forceErrorText: boolean;
  } {
    const version = this.getRowVersion(rowId);
    const key = this.cellStyleKey(rowId, col.key);
    const data = this.getRowObjectEffective(rowId);
    const rowRes = this.resolveRowConditionalStyle(rowId);

    const applyDelta = (base: StyleDelta | null, next: StyleDelta | null) => {
      if (!next) return base;
      if (!base) return { ...next };
      return { ...base, ...next };
    };

    let delta: StyleDelta | null = null;
    let diagnostic: CellDiagnostic | null = null;
    let forceErrorText = false;

    // Lowest within the conditional layer: row-level.
    delta = applyDelta(delta, rowRes.delta);
    if (rowRes.diagnostic) diagnostic = rowRes.diagnostic;
    forceErrorText = forceErrorText || rowRes.forceErrorText;

    // Column-level conditional style.
    if (col.conditionalStyle && data) {
      const colCacheKey = `${rowId}::${String(col.key)}::col`;
      const cached = this.conditionalCache.get(colCacheKey);
      if (cached && cached.version === version && cached.fnRef === col.conditionalStyle) {
        delta = applyDelta(delta, cached.delta);
        if (cached.diagnostic && (diagnostic === null || diagnostic.level !== "error"))
          diagnostic = cached.diagnostic;
        forceErrorText = forceErrorText || cached.forceErrorText;
      } else {
        const res = this.evalConditionalStyleFn(col.conditionalStyle, data);
        this.conditionalCache.set(colCacheKey, { version, fnRef: col.conditionalStyle, ...res });
        delta = applyDelta(delta, res.delta);
        if (res.diagnostic && (diagnostic === null || diagnostic.level !== "error")) diagnostic = res.diagnostic;
        forceErrorText = forceErrorText || res.forceErrorText;
      }
    }

    // Highest within the conditional layer: cell-level.
    const cellFn = this.cellConditionalStyles.get(key);
    if (cellFn && data) {
      const cached = this.conditionalCache.get(key);
      if (cached && cached.version === version && cached.fnRef === cellFn) {
        delta = applyDelta(delta, cached.delta);
        if (cached.diagnostic && (diagnostic === null || diagnostic.level !== "error"))
          diagnostic = cached.diagnostic;
        forceErrorText = forceErrorText || cached.forceErrorText;
      } else {
        const res = this.evalConditionalStyleFn(cellFn, data);
        this.conditionalCache.set(key, { version, fnRef: cellFn, ...res });
        delta = applyDelta(delta, res.delta);
        if (res.diagnostic && (diagnostic === null || diagnostic.level !== "error")) diagnostic = res.diagnostic;
        forceErrorText = forceErrorText || res.forceErrorText;
      }
    }

    if (diagnostic) this.conditionalDiagnostics.set(key, diagnostic);
    else this.conditionalDiagnostics.delete(key);

    return { delta, diagnostic, forceErrorText };
  }

  public getValidationErrors() {
    const merged = new Map<string, { rowId: string; colKey: string | number; message: string }>();
    for (const [k, v] of this.baseValidationErrors.entries()) merged.set(k, { ...v });
    for (const [k, v] of this.uniqueValidationErrors.entries()) {
      const prev = merged.get(k);
      if (!prev) merged.set(k, { ...v });
      else merged.set(k, { ...prev, message: `${prev.message}\n${v.message}` });
    }
    const out = [...merged.values()];
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

  public getCellValidationMessage(rowId: string, colKey: string | number): string | null {
    const key = this.cellStyleKey(rowId, colKey);
    const a = this.baseValidationErrors.get(key)?.message ?? null;
    const b = this.uniqueValidationErrors.get(key)?.message ?? null;
    if (!a) return b;
    if (!b) return a;
    return `${a}\n${b}`;
  }

  public getCellMarker(rowId: string, colKey: string | number): { level: "warning" | "error"; message: string } | null {
    const diag = this.getCellDiagnostic(rowId, colKey);
    const validation = this.getCellValidationMessage(rowId, colKey);
    if (!diag && !validation) return null;
    const level: "warning" | "error" = validation ? "error" : (diag?.level ?? "warning");
    const message = [diag?.message ?? null, validation].filter(Boolean).join("\n");
    return { level, message };
  }

  private updateValidationForCell(rowId: string, colKey: string | number, value: unknown) {
    const col = this.schema.columns.find((c) => String(c.key) === String(colKey));
    if (!col) return;
    const msg = validateCellValue(value, col);
    const key = this.cellStyleKey(rowId, colKey);
    if (!msg) this.baseValidationErrors.delete(key);
    else this.baseValidationErrors.set(key, { rowId, colKey, message: msg });
  }

  private recomputeValidationErrors() {
    this.baseValidationErrors.clear();
    this.uniqueValidationErrors.clear();
    for (const row of this.rows) {
      for (const col of this.schema.columns) {
        const v = this.getCell(row.id, col.key);
        this.updateValidationForCell(row.id, col.key, v);
      }
    }
    for (const col of this.getColumns()) {
      if (!col.unique) continue;
      this.recomputeUniqueValidationForColumn(col.key);
    }
  }

  private normalizeUniqueValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "string") return value === "" ? null : value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value instanceof Date) return String(value.getTime());
    if (typeof value === "object") {
      const anyV = value as any;
      if (anyV.kind === "enum" && typeof anyV.value === "string") return anyV.value === "" ? null : anyV.value;
      if (anyV.kind === "tags" && Array.isArray(anyV.values)) {
        const joined = anyV.values.join(",");
        return joined === "" ? null : joined;
      }
    }
    return String(value);
  }

  private recomputeUniqueValidationForColumn(colKey: string | number) {
    const colKeyStr = String(colKey);
    for (const k of Array.from(this.uniqueValidationErrors.keys())) {
      const sep = k.indexOf("::");
      const existingCol = sep >= 0 ? k.slice(sep + 2) : "";
      if (existingCol === colKeyStr) this.uniqueValidationErrors.delete(k);
    }
    const valueToRows = new Map<string, string[]>();
    for (const row of this.rows) {
      const v = this.getCell(row.id, colKey);
      const norm = this.normalizeUniqueValue(v);
      if (!norm) continue;
      const list = valueToRows.get(norm) ?? [];
      list.push(row.id);
      valueToRows.set(norm, list);
    }
    for (const rowIds of valueToRows.values()) {
      if (rowIds.length < 2) continue;
      const display = rowIds
        .map((rowId) => this.getDisplayIndex(rowId))
        .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
        .sort((a, b) => a - b);
      const rowList = display.length ? display.join(", ") : rowIds.join(", ");
      for (const rowId of rowIds) {
        const key = this.cellStyleKey(rowId, colKey);
        this.uniqueValidationErrors.set(key, {
          rowId,
          colKey,
          message: `Duplicate value\nRows: ${rowList}`,
        });
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
    const col = this.schema.columns.find((c) => String(c.key) === String(colKey));
    if (!col) return;
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
