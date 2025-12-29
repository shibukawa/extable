import { generateId } from "./utils";
import type {
  CellDiagnostic,
  ColumnSchema,
  ColumnDiagnosticFilter,
  ColumnType,
  ConditionalStyleFn,
  InternalRow,
  RowObject,
  Schema,
  StyleDelta,
  ViewFilterValues,
  ViewSort,
  View,
} from "./types";
import { validateCellValue } from "./validation";

type AnyFilter = { key?: unknown; kind?: unknown };

export class DataModel {
  private schema: Schema<any>;
  private view: View;
  private rows: InternalRow[] = [];
  private baseIndexById = new Map<string, number>();
  private dataVersion = 0;
  private visibleRowsCache: {
    version: number;
    key: string;
    rows: InternalRow[];
    indexById: Map<string, number>;
  } | null = null;
  private distinctValueCache = new Map<
    string,
    {
      version: number;
      values: Array<{ value: unknown; label: string }>;
      hasBlanks: boolean;
      total: number;
    }
  >();
  private pending: Map<string, Record<string, unknown>> = new Map();
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
  private baseValidationErrors = new Map<
    string,
    { rowId: string; colKey: string; message: string }
  >();
  private uniqueValidationErrors = new Map<
    string,
    { rowId: string; colKey: string; message: string }
  >();
  private notifySuspended = false;
  private notifyDirty = false;

  constructor(dataset: RowObject[] | undefined, schema: Schema<any>, view: View) {
    this.schema = schema;
    this.view = view;
    this.setData(dataset ?? []);
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.visibleRowsCache = null;
    this.distinctValueCache.clear();
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

  public setData(dataset: RowObject[] | undefined) {
    this.dataVersion += 1;
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
    this.rows = (dataset ?? []).map((row, idx) => {
      const id = generateId();
      this.rowVersion.set(id, 0);
      return {
        id,
        raw: row,
        displayIndex: idx + 1,
      };
    });
    this.rebuildBaseIndex();
    this.recomputeValidationErrors();
    this.notify();
  }

  public setSchema(schema: Schema<any>) {
    this.dataVersion += 1;
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
    this.dataVersion += 1;
    // MVP constraint: allow `sorts` as array, but enforce at most one sort.
    if (Array.isArray(view.sorts) && view.sorts.length > 1) {
      this.view = { ...view, sorts: view.sorts.slice(0, 1) };
    } else {
      this.view = view;
    }
    this.notify();
  }

  public getSchema(): Schema<any> {
    return { ...this.schema, columns: this.getColumns() } as Schema<any>;
  }

  public getColumns(): ColumnSchema<any>[] {
    return this.schema.columns;
  }

  public getRowConditionalStyleFn(): ConditionalStyleFn | null {
    return this.schema.row?.conditionalStyle ?? null;
  }

  public getView() {
    return this.view;
  }

  public getDataVersion() {
    return this.dataVersion;
  }

  public getFullSchema(): Schema<any> {
    return this.schema;
  }

  public listRows(): InternalRow[] {
    return this.computeVisibleRows().rows;
  }

  public listAllRows(): InternalRow[] {
    return this.rows;
  }

  public getAllRowCount() {
    return this.rows.length;
  }

  private findRow(rowId: string): { row: InternalRow; index: number } | null {
    const index = this.baseIndexById.get(rowId);
    if (index === undefined) return null;
    const row = this.rows[index];
    if (row && row.id === rowId) return { row, index };
    // Defensive fallback for unexpected external mutation of `rows`.
    const slowIndex = this.rows.findIndex((r) => r.id === rowId);
    if (slowIndex < 0) return null;
    const slowRow = this.rows[slowIndex];
    if (!slowRow) return null;
    this.rebuildBaseIndex();
    return { row: slowRow, index: slowIndex };
  }

  public getRowHeight(rowId: string) {
    return this.view.rowHeights?.[rowId];
  }

  public setRowHeight(rowId: string, height: number) {
    if (!this.view.rowHeights) this.view.rowHeights = {};
    const prev = this.view.rowHeights[rowId];
    if (prev === height) return;
    this.view.rowHeights[rowId] = height;
    this.notify();
  }

  public setRowHeightsBulk(next: Record<string, number>) {
    const entries = Object.entries(next);
    if (entries.length === 0) return;
    if (!this.view.rowHeights) this.view.rowHeights = {};
    let changed = false;
    for (const [rowId, height] of entries) {
      if (this.view.rowHeights[rowId] === height) continue;
      this.view.rowHeights[rowId] = height;
      changed = true;
    }
    if (changed) this.notify();
  }

  public getCell(rowId: string, key: string) {
    const found = this.findRow(rowId);
    if (!found) return undefined;
    const row = found.row;
    const pendingRow = this.pending.get(rowId);
    if (pendingRow && key in pendingRow) return pendingRow[key];
    return row.raw[key];
  }

  public getRawCell(rowId: string, key: string) {
    const found = this.findRow(rowId);
    if (!found) return undefined;
    const row = found.row;
    return row.raw[key];
  }

  public isRowReadonly(rowId: string) {
    const found = this.findRow(rowId);
    if (!found) return false;
    const row = found.row;
    return Boolean((row.raw as Record<string, unknown>)._readonly);
  }

  private isActionType(colType: ColumnType | undefined) {
    return colType === "button" || colType === "link";
  }

  private supportsConditionalReadonly(colType: ColumnType | undefined) {
    return (
      colType === "boolean" ||
      colType === "number" ||
      colType === "date" ||
      colType === "time" ||
      colType === "datetime" ||
      colType === "string" ||
      colType === "enum" ||
      colType === "tags"
    );
  }

  public isColumnReadonly(colKey: string) {
    const col = this.schema.columns.find((c) => c.key === colKey);
    if (this.isActionType(col?.type)) return true;
    return Boolean(col?.readonly || col?.formula);
  }

  public getCellInteraction(rowId: string, colKey: string) {
    const col = this.schema.columns.find((c) => String(c.key) === String(colKey));
    if (!col) return { readonly: false, disabled: false, muted: false };
    const baseReadonly = this.isRowReadonly(rowId) || this.isColumnReadonly(colKey);
    const delta = this.resolveConditionalStyle(rowId, col).delta;
    const cellStyle = this.getCellStyle(rowId, colKey);
    const readonlyAllowed = this.supportsConditionalReadonly(col.type);
    const readonlyFromStyle =
      readonlyAllowed && Boolean(col.style?.readonly || delta?.readonly || cellStyle?.readonly);
    const disabledAllowed = this.isActionType(col.type);
    const disabled =
      disabledAllowed && Boolean(col.style?.disabled || delta?.disabled || cellStyle?.disabled);
    const readonly = baseReadonly || readonlyFromStyle || disabled;
    const isFormulaCol = Boolean(col.formula);
    const muted = disabled || (readonly && !disabledAllowed && !isFormulaCol);
    return { readonly, disabled, muted };
  }

  public isReadonly(rowId: string, colKey: string) {
    return this.getCellInteraction(rowId, colKey).readonly;
  }

  public setCell(rowId: string, key: string, value: unknown, committed: boolean) {
    this.dataVersion += 1;
    const found = this.findRow(rowId);
    if (!found) return;
    const row = found.row;
    const bumpVersion = () => {
      const prev = this.rowVersion.get(rowId) ?? 0;
      this.rowVersion.set(rowId, prev + 1);
    };
    if (committed) {
      row.raw[key] = value;
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
    const col = this.schema.columns.find((c) => c.key === key);
    if (col?.unique) this.recomputeUniqueValidationForColumn(key);
    // Invalidate computed/conditional caches for the row by version mismatch; clear diagnostics eagerly.
    this.clearDiagnosticsForCell(rowId, key);
    this.notify();
  }

  public applyPending(rowId: string) {
    this.dataVersion += 1;
    const pendingRow = this.pending.get(rowId);
    if (!pendingRow) return;
    const found = this.findRow(rowId);
    if (!found) return;
    const row = found.row;
    const uniqueCols = new Set<string>();
    for (const [key, val] of Object.entries(pendingRow)) {
      row.raw[key] = val;
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
    this.dataVersion += 1;
    this.pending.delete(rowId);
    this.notify();
  }

  public getPending() {
    return this.pending;
  }

  public hasPending(rowId: string, key: string) {
    const p = this.pending.get(rowId);
    if (!p) return false;
    return key in p;
  }

  public insertRow(rowData: InternalRow["raw"]) {
    return this.insertRowAt(rowData, this.rows.length);
  }

  public insertRowAt(rowData: InternalRow["raw"], index: number, forcedId?: string) {
    this.dataVersion += 1;
    const id = forcedId ?? generateId();
    const clamped = Math.max(0, Math.min(index, this.rows.length));
    this.rows.splice(clamped, 0, { id, raw: rowData, displayIndex: 0 });
    this.reindexRows();
    this.rowVersion.set(id, 0);
    this.rebuildBaseIndex();
    this.recomputeValidationErrors();
    this.notify();
    return id;
  }

  public removeRow(rowId: string): { row: InternalRow; index: number } | null {
    this.dataVersion += 1;
    const found = this.findRow(rowId);
    if (!found) return null;
    const removed = this.rows.splice(found.index, 1)[0];
    if (!removed) return null;
    this.pending.delete(rowId);
    this.rowVersion.delete(rowId);
    this.reindexRows();
    this.rebuildBaseIndex();
    this.recomputeValidationErrors();
    this.notify();
    return { row: removed, index: found.index };
  }

  public getDisplayIndex(rowId: string) {
    return this.findRow(rowId)?.row.displayIndex ?? null;
  }

  public getRowIndex(rowId: string) {
    return this.computeVisibleRows().indexById.get(rowId) ?? -1;
  }

  public getBaseRowIndex(rowId: string) {
    return this.baseIndexById.get(rowId) ?? -1;
  }

  public getColumnIndex(colKey: string) {
    return this.getColumns().findIndex((c) => c.key === colKey);
  }

  public getColumnByIndex(colIndex: number) {
    return this.getColumns()[colIndex] ?? null;
  }

  public getRowByIndex(rowIndex: number) {
    return this.listRows()[rowIndex] ?? null;
  }

  private rebuildBaseIndex() {
    this.baseIndexById.clear();
    for (let i = 0; i < this.rows.length; i += 1) {
      const r = this.rows[i];
      if (r) this.baseIndexById.set(r.id, i);
    }
  }

  private getFilterSortKey(options?: {
    excludeColumnKey?: string;
    includeSort?: boolean;
  }) {
    const exclude = options?.excludeColumnKey;
    const includeSort = options?.includeSort ?? true;
    const view = this.view;
    const filters = (view.filters ?? [])
      .filter((f) => {
        if (exclude === undefined) return true;
        const key = (f as AnyFilter | null | undefined)?.key;
        return String(key) !== String(exclude);
      })
      .map((f) => {
        const kind = (f as AnyFilter | null | undefined)?.kind;
        if (kind === "values") {
          const vf = f as ViewFilterValues;
          return {
            kind: "values" as const,
            key: String(vf.key),
            includeBlanks: Boolean(vf.includeBlanks),
            values: (vf.values ?? []).map((v) => this.stableValueKey(v)),
          };
        }
        // Unknown filter kind (or legacy op filter) => keep a stable representation for caching.
        const opf = f as Record<string, unknown>;
        return {
          kind: "op" as const,
          key: String(opf.key),
          op: String(opf.op ?? ""),
          value: this.stableValueKey(opf.value),
        };
      })
      .sort((a, b) => (a.key === b.key ? (a.kind < b.kind ? -1 : 1) : a.key < b.key ? -1 : 1));

    const columnDiagnosticsEntries = Object.entries(view.columnDiagnostics ?? {})
      .filter(([k]) => (exclude !== undefined ? String(k) !== String(exclude) : true))
      .map(([k, v]) => ({
        key: String(k),
        errors: Boolean((v as ColumnDiagnosticFilter | undefined)?.errors),
        warnings: Boolean((v as ColumnDiagnosticFilter | undefined)?.warnings),
      }))
      .filter((x) => x.errors || x.warnings)
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

    const sorts = includeSort
      ? (view.sorts ?? []).slice(0, 1).map((s) => ({ key: String(s.key), dir: s.dir }))
      : [];

    return JSON.stringify({ filters, columnDiagnosticsEntries, sorts });
  }

  private stableValueKey(value: unknown) {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (value instanceof Date) return `date:${value.getTime()}`;
    if (typeof value === "string") return `s:${value}`;
    if (typeof value === "number") return `n:${Number.isNaN(value) ? "NaN" : String(value)}`;
    if (typeof value === "boolean") return `b:${value ? "1" : "0"}`;
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const kind = obj.kind;
      if (kind === "enum" && typeof obj.value === "string") return `enum:${obj.value}`;
      if (kind === "tags" && Array.isArray(obj.values)) {
        return `tags:${obj.values.filter((x) => typeof x === "string").join("|")}`;
      }
    }
    try {
      return `json:${JSON.stringify(value)}`;
    } catch {
      return `str:${String(value)}`;
    }
  }

  private isBlankValue(value: unknown) {
    return value === null || value === undefined || value === "";
  }

  private resolveFilterColumnKey(key: string) {
    const cols = this.getColumns();
    const found = cols.find((c) => String(c.key) === String(key));
    return found?.key ?? key;
  }

  private getFilterCellValue(rowId: string, colKey: string) {
    const col = this.getColumns().find((c) => String(c.key) === String(colKey));
    if (!col) return this.getCell(rowId, colKey);
    return this.resolveCellValue(rowId, col).value;
  }

  private valuesFilterMatches(rowId: string, filter: ViewFilterValues) {
    const colKey = this.resolveFilterColumnKey(filter.key);
    const value = this.getFilterCellValue(rowId, colKey);
    if (this.isBlankValue(value)) return Boolean(filter.includeBlanks);
    if (!filter.values || filter.values.length === 0) return false;
    const valueKey = this.stableValueKey(value);
    for (const v of filter.values) {
      if (this.stableValueKey(v) === valueKey) return true;
    }
    return false;
  }

  private rowPassesColumnDiagnostics(
    rowId: string,
    colKeyStr: string,
    diag: ColumnDiagnosticFilter,
  ) {
    const errors = Boolean(diag.errors);
    const warnings = Boolean(diag.warnings);
    if (!errors && !warnings) return true;
    const colKey = this.resolveFilterColumnKey(colKeyStr);
    // Ensure diagnostics are computed for this cell before filtering by diagnostics.
    const col = this.getColumns().find((c) => String(c.key) === String(colKey));
    if (col) {
      this.resolveCellValue(rowId, col);
      this.resolveConditionalStyle(rowId, col);
    }
    const marker = this.getCellMarker(rowId, colKey);
    if (!marker) return false;
    if (marker.level === "error") return errors;
    return warnings;
  }

  private computeRowsAfterFilter(options?: {
    excludeColumnKey?: string;
    includeSort?: boolean;
  }) {
    const exclude = options?.excludeColumnKey;
    const includeSort = options?.includeSort ?? true;
    const view = this.view;
    const schema = this.getSchema();

    const filters = (view.filters ?? []).filter((f) => {
      if (exclude === undefined) return true;
      const key = (f as AnyFilter | null | undefined)?.key;
      return String(key) !== String(exclude);
    });
    const diagEntries = Object.entries(view.columnDiagnostics ?? {}).filter(([k]) =>
      exclude !== undefined ? String(k) !== String(exclude) : true,
    );

    const filtered: InternalRow[] = [];
    for (const row of this.rows) {
      let ok = true;
      for (const f of filters) {
        const kind = (f as AnyFilter | null | undefined)?.kind;
        if (kind === "values") {
          if (!this.valuesFilterMatches(row.id, f as ViewFilterValues)) {
            ok = false;
            break;
          }
          // matched values filter
        }
        // Unknown filter kind (or legacy op filter) => ignore in MVP.
      }
      if (!ok) continue;
      for (const [k, diag] of diagEntries) {
        if (!this.rowPassesColumnDiagnostics(row.id, k, diag as ColumnDiagnosticFilter)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      filtered.push(row);
    }

    if (!includeSort) return filtered;

    const sort = (view.sorts ?? []).slice(0, 1)[0] as ViewSort | undefined;
    if (!sort) return filtered;
    const sortCol = schema.columns.find((c) => String(c.key) === String(sort.key));
    if (!sortCol) return filtered;

    const dir = sort.dir === "desc" ? -1 : 1;
    const withKeys = filtered.map((row) => {
      const v = this.getFilterCellValue(row.id, sortCol.key);
      const blank = this.isBlankValue(v);
      const baseIndex = this.baseIndexById.get(row.id) ?? 0;
      return { row, v, blank, baseIndex };
    });

    const compare = (a: unknown, b: unknown) => {
      if (a === b) return 0;
      if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
      if (typeof a === "number" && typeof b === "number") return a - b;
      if (typeof a === "boolean" && typeof b === "boolean") return a === b ? 0 : a ? 1 : -1;
      const as = a instanceof Date ? a.toISOString() : typeof a === "string" ? a : String(a);
      const bs = b instanceof Date ? b.toISOString() : typeof b === "string" ? b : String(b);
      if (as === bs) return 0;
      return as < bs ? -1 : 1;
    };

    withKeys.sort((a, b) => {
      if (a.blank && b.blank) return a.baseIndex - b.baseIndex;
      if (a.blank) return 1;
      if (b.blank) return -1;
      const c = compare(a.v, b.v);
      if (c !== 0) return c * dir;
      return a.baseIndex - b.baseIndex;
    });

    return withKeys.map((x) => x.row);
  }

  private computeVisibleRows() {
    const key = this.getFilterSortKey();
    const cached = this.visibleRowsCache;
    if (cached && cached.version === this.dataVersion && cached.key === key) return cached;

    const base = this.computeRowsAfterFilter({ includeSort: true });
    // Keep `displayIndex` stable (pre-filter) and only change the visible ordering.
    const rows = base;
    const indexById = new Map<string, number>();
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i];
      if (r) indexById.set(r.id, i);
    }
    const next = { version: this.dataVersion, key, rows, indexById };
    this.visibleRowsCache = next;
    return next;
  }

  public getDistinctValuesForColumn(colKey: string) {
    const cacheKey = `${String(colKey)}|${this.getFilterSortKey({ excludeColumnKey: colKey, includeSort: false })}`;
    const cached = this.distinctValueCache.get(cacheKey);
    if (cached && cached.version === this.dataVersion) return cached;

    const rows = this.computeRowsAfterFilter({ excludeColumnKey: colKey, includeSort: false });
    const col = this.getSchema().columns.find((c) => String(c.key) === String(colKey));
    if (!col) {
      const empty = { version: this.dataVersion, values: [], hasBlanks: false, total: 0 };
      this.distinctValueCache.set(cacheKey, empty);
      return empty;
    }

    const map = new Map<string, { value: unknown; label: string }>();
    let hasBlanks = false;
    for (const row of rows) {
      const v = this.getFilterCellValue(row.id, col.key);
      if (this.isBlankValue(v)) {
        hasBlanks = true;
        continue;
      }
      const k = this.stableValueKey(v);
      if (map.has(k)) continue;
      const label = (() => {
        if (v instanceof Date) return v.toISOString();
        if (typeof v === "string") return v;
        if (typeof v === "number" || typeof v === "boolean") return String(v);
        if (typeof v === "object" && v) {
          const obj = v as Record<string, unknown>;
          const kind = obj.kind;
          if (kind === "enum" && typeof obj.value === "string") return obj.value;
          if (kind === "tags" && Array.isArray(obj.values)) {
            return obj.values.filter((x) => typeof x === "string").join(", ");
          }
        }
        return String(v);
      })();
      map.set(k, { value: v, label });
    }

    const values = [...map.values()].sort((a, b) =>
      a.label < b.label ? -1 : a.label > b.label ? 1 : 0,
    );
    const next = {
      version: this.dataVersion,
      values,
      hasBlanks,
      total: values.length + (hasBlanks ? 1 : 0),
    };
    this.distinctValueCache.set(cacheKey, next);
    return next;
  }

  private cellStyleKey(rowId: string, colKey: string) {
    return `${rowId}::${String(colKey)}`;
  }

  private clearDiagnosticsForCell(rowId: string, colKey: string) {
    const key = this.cellStyleKey(rowId, colKey);
    this.formulaDiagnostics.delete(key);
    this.conditionalDiagnostics.delete(key);
  }

  public getCellDiagnostic(rowId: string, colKey: string): CellDiagnostic | null {
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
    const pendingRow = this.pending.get(rowId);
    if (!pendingRow || Object.keys(pendingRow).length === 0)
      return row.raw as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...(row.raw as Record<string, unknown>) };
    for (const [k, v] of Object.entries(pendingRow)) {
      merged[k] = v;
    }
    return merged;
  }

  public resolveCellValue(
    rowId: string,
    col: ColumnSchema,
  ): {
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
      return {
        value: cached.value,
        textOverride: cached.textOverride,
        diagnostic: cached.diagnostic,
      };
    }
    const data = this.getRowObjectEffective(rowId);
    if (!data) {
      const value = this.getCell(rowId, col.key);
      const next = {
        version,
        formulaRef: col.formula,
        value,
        diagnostic: null as CellDiagnostic | null,
      };
      this.computedCache.set(key, next);
      return { value, diagnostic: null };
    }
    try {
      const out: unknown = col.formula(data);
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

  public setCellConditionalStyle(rowId: string, colKey: string, fn: ConditionalStyleFn | null) {
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
      return {
        delta: cached.delta,
        diagnostic: cached.diagnostic,
        forceErrorText: cached.forceErrorText,
      };
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

  public resolveConditionalStyle(
    rowId: string,
    col: ColumnSchema,
  ): {
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
        if (res.diagnostic && (diagnostic === null || diagnostic.level !== "error"))
          diagnostic = res.diagnostic;
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
        if (res.diagnostic && (diagnostic === null || diagnostic.level !== "error"))
          diagnostic = res.diagnostic;
        forceErrorText = forceErrorText || res.forceErrorText;
      }
    }

    if (diagnostic) this.conditionalDiagnostics.set(key, diagnostic);
    else this.conditionalDiagnostics.delete(key);

    return { delta, diagnostic, forceErrorText };
  }

  public getValidationErrors() {
    const merged = new Map<string, { rowId: string; colKey: string; message: string }>();
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

  public getCellValidationMessage(rowId: string, colKey: string): string | null {
    const key = this.cellStyleKey(rowId, colKey);
    const a = this.baseValidationErrors.get(key)?.message ?? null;
    const b = this.uniqueValidationErrors.get(key)?.message ?? null;
    if (!a) return b;
    if (!b) return a;
    return `${a}\n${b}`;
  }

  public getCellMarker(
    rowId: string,
    colKey: string,
  ): { level: "warning" | "error"; message: string } | null {
    const diag = this.getCellDiagnostic(rowId, colKey);
    const validation = this.getCellValidationMessage(rowId, colKey);
    if (!diag && !validation) return null;
    const level: "warning" | "error" = validation ? "error" : (diag?.level ?? "warning");
    const message = [diag?.message ?? null, validation].filter(Boolean).join("\n");
    return { level, message };
  }

  private updateValidationForCell(rowId: string, colKey: string, value: unknown) {
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
      const obj = value as Record<string, unknown>;
      const kind = obj.kind;
      if (kind === "enum" && typeof obj.value === "string") {
        return obj.value === "" ? null : obj.value;
      }
      if (kind === "tags" && Array.isArray(obj.values)) {
        const joined = obj.values.filter((x) => typeof x === "string").join(",");
        return joined === "" ? null : joined;
      }
    }
    return String(value);
  }

  private recomputeUniqueValidationForColumn(colKey: string) {
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

  public getCellStyle(rowId: string, colKey: string): StyleDelta | null {
    return this.cellStyles.get(this.cellStyleKey(rowId, colKey)) ?? null;
  }

  public setCellStyle(rowId: string, colKey: string, style: StyleDelta | null) {
    const key = this.cellStyleKey(rowId, colKey);
    if (!style || Object.keys(style).length === 0) this.cellStyles.delete(key);
    else this.cellStyles.set(key, style);
    this.notify();
  }

  public updateColumnStyle(
    colKey: string,
    updater:
      | ColumnSchema["style"]
      | ((oldValue: ColumnSchema["style"] | undefined) => ColumnSchema["style"] | undefined),
  ) {
    const col = this.schema.columns.find((c) => String(c.key) === String(colKey));
    if (!col) return;
    const next = typeof updater === "function" ? updater(col.style) : updater;
    col.style = next;
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
