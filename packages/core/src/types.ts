export type CellPrimitive = string | number | boolean | null;

export type CellValue =
  | CellPrimitive
  | Date
  | { kind: "enum"; value: string }
  | { kind: "tags"; values: string[] };

export type ColumnType =
  | "string"
  | "number"
  | "boolean"
  | "datetime"
  | "date"
  | "time"
  | "enum"
  | "tags";

export type ResolvedCellStyle = {
  background?: string;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
};

export type StyleDelta = Partial<ResolvedCellStyle>;

export type DiagnosticLevel = "warning" | "error";
export type CellDiagnostic = {
  level: DiagnosticLevel;
  message: string;
  source: "formula" | "conditionalStyle";
};

export type FormulaOk = string | boolean | number | Date;
export type FormulaWarn<T extends FormulaOk> = readonly [value: T, warning: Error];
export type FormulaReturn<T extends FormulaOk = FormulaOk> = T | FormulaWarn<T>;

export type ConditionalStyleFn<TData extends object = Record<string, unknown>> = (
  data: TData,
) => StyleDelta | null | Error;

export type Updater<T> = T | ((oldValue: T) => T);

export type CellAddress =
  | { rowId: string; colKey: string }
  | { rowIndex: number; colIndex: number }
  | { rowId: string; colIndex: number }
  | { rowIndex: number; colKey: string };

export type CellTarget = {
  rowId: string;
  colKey: string;
};

// Forward declaration for recursive type inference
export interface ColumnSchema<
  TData extends object = Record<string, unknown>,
  TType extends ColumnType = ColumnType,
  K extends string = string,
> {
  key: K;
  type: TType;
  header?: string;
  readonly?: boolean;
  /**
   * When true, enforce uniqueness within this column (per table).
   * Duplicate (non-empty) values mark all duplicated cells as invalid.
   */
  unique?: boolean;
  nullable?: boolean;
  string?: { maxLength?: number; regex?: string };
  number?: {
    precision?: number;
    scale?: number;
    signed?: boolean;
    thousandSeparator?: boolean;
    negativeRed?: boolean;
    format?: string; // optional custom formatter token
  };
  enum?: { options: string[]; allowCustom?: boolean };
  tags?: { options: string[]; allowCustom?: boolean };
  booleanDisplay?: "checkbox" | string | [string, string]; // arbitrary label set; default checkbox when absent
  dateFormat?: string;
  timeFormat?: string;
  dateTimeFormat?: string;
  width?: number; // px
  wrapText?: boolean; // allow per-column wrapping
  format?: {
    textColor?: string;
    background?: string;
    align?: "left" | "right" | "center";
    decorations?: { strike?: boolean; underline?: boolean; bold?: boolean; italic?: boolean };
  };
  conditionalFormat?: { expr: string; engine?: "cel" };
  formula?: (data: TData) => unknown;
  conditionalStyle?: ConditionalStyleFn<TData>;
}

// Infer row data type from schema columns
export type InferSchemaData<TColumns extends readonly ColumnSchema<any>[]> = {
  [I in keyof TColumns]: TColumns[I] extends ColumnSchema<infer TData, infer TType, infer K>
    ? K extends keyof TData
      ? TData[K]
      : never
    : never;
} extends (infer U)[]
  ? U extends Record<string, any>
    ? U
    : Record<string, unknown>
  : Record<string, unknown>;

export interface Schema<TData extends object = Record<string, unknown>> {
  columns: ColumnSchema<TData>[];
  row?: { conditionalStyle?: ConditionalStyleFn<TData> };
}

/**
 * Helper to lock schema generics so `formula`/`conditionalStyle` receive the correct row type.
 * Usage: `const schema = defineSchema<MyRow>({ columns: [...], row: {...} });`
 */
export const defineSchema = <TData extends object>(schema: Schema<TData>): Schema<TData> => schema;

export type RowObject<T extends object = Record<string, unknown>> = {
  _readonly?: boolean;
} & T;

// Public data is object-row arrays only. Use `null` or `undefined` for async loading.
export type NullableData<T extends object = Record<string, unknown>> = T[] | null | undefined;

export type ViewFilterOp = {
  kind: "op";
  key: string;
  op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "contains";
  value: unknown;
};

export type ViewFilterValues = {
  kind: "values";
  key: string;
  /** Allow-list of selected non-blank values. */
  values: unknown[];
  /** When true, blanks (null/undefined/"") are included. */
  includeBlanks?: boolean;
};

export type ViewFilter = ViewFilterOp | ViewFilterValues;

export type ColumnDiagnosticFilter = {
  errors?: boolean;
  warnings?: boolean;
};

export type ColumnDiagnosticFilterMap = Record<string, ColumnDiagnosticFilter>;

export interface ViewSort {
  key: string;
  dir: "asc" | "desc";
}

export interface View {
  hiddenColumns?: string[];
  filters?: ViewFilter[];
  sorts?: ViewSort[];
  /**
   * Column-scoped diagnostic quick filters.
   * Key is the column key (stringified).
   */
  columnDiagnostics?: ColumnDiagnosticFilterMap;
  userId?: string; // personalization
  columnWidths?: Record<string, number>; // key -> px
  rowHeights?: Record<string, number>;
  wrapText?: Record<string, boolean>; // view override per column
}

export type RenderMode = "html" | "canvas" | "auto";
export type EditMode = "direct" | "commit" | "readonly";
export type LockMode = "none" | "row";

export interface Command {
  kind: "edit" | "deleteRow" | "insertRow" | "updateView" | "lock" | "unlock";
  rowId?: string;
  colKey?: string;
  rowData?: RowObject;
  prev?: unknown;
  next?: unknown;
  payload?: unknown;
}

export interface UserInfo {
  id: string;
  name: string;
}

export interface ServerAdapter {
  fetchInitial?: () => Promise<{
    data: Record<string, unknown>[];
    view?: View;
    schema?: Schema;
    user: UserInfo;
  }>;
  lockRow: (rowId: string, user: UserInfo) => Promise<void>;
  unlockRows: (rowIds: string[], user: UserInfo) => Promise<void>;
  commit: (commands: Command[], user: UserInfo) => Promise<void>;
  subscribe: (onEvent: (event: ServerEvent) => void) => () => void;
}

export type ServerEvent = { type: "update"; commands: Command[]; user: UserInfo };

export interface CoreOptions {
  renderMode?: RenderMode;
  editMode?: EditMode;
  lockMode?: LockMode;
  /** Loading UI configuration used when `defaultData` is `null`. */
  loading?: {
    /** Enable built-in loading overlay/spinner. Default: true */
    enabled?: boolean;
  };
  defaultClass?: string | string[];
  defaultStyle?: Partial<CSSStyleDeclaration>;
  server?: ServerAdapter;
  user?: UserInfo;
  findReplace?: {
    /** Enable Find/Replace feature (engine + integrations). Default: true */
    enabled?: boolean;
    /**
     * Enable the default built-in UI and its shortcut bindings. Default: true
     * Note: legacy name is `dialog`; `sidebar` is the preferred name.
     */
    sidebar?: boolean;
    /** @deprecated Use `sidebar` instead. */
    dialog?: boolean;
    /**
     * When true, always intercept `Ctrl/Cmd+F` and show extable's search sidebar.
     * Use this when the table is the primary focus of the page and browser Find/Reload should be overridden.
     * Default: true (always intercept).
     */
    enableSearch?: boolean;
  };
}

export interface TableConfig<T extends object = Record<string, unknown>> {
  data: T[] | null;
  view: View;
  schema: Schema;
}

export type HistoryCommandKind = Command["kind"];

export type UndoRedoStep = {
  batchId: string | null;
  kinds: HistoryCommandKind[];
  commandCount: number;
  label: string;
};

export type UndoRedoHistory = {
  /** Top (index 0) is the next undo step. */
  undo: UndoRedoStep[];
  /** Top (index 0) is the next redo step. */
  redo: UndoRedoStep[];
};

export interface InternalRow {
  id: string;
  raw: RowObject;
  displayIndex: number;
}

export type SelectionKind = "cells" | "rows";

export interface SelectionRange {
  kind: SelectionKind;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export type ToggleState = "on" | "off" | "mixed" | "disabled";
export type ColorState = string | "mixed" | null | "disabled";

export type TableError = {
  scope: "validation" | "commit" | "render" | "formula" | "conditionalStyle" | "unknown";
  message: string;
  target?: { rowId?: string; colKey?: string };
};

export type TableState = {
  canCommit: boolean;
  pendingCommandCount: number;
  pendingCellCount?: number;
  undoRedo: { canUndo: boolean; canRedo: boolean };
  renderMode: "html" | "canvas";
  ui: { searchPanelOpen: boolean };
  activeErrors: TableError[];
};

export type TableStateListener = (next: TableState, prev: TableState | null) => void;

export type RowStateSnapshot<
  TInput extends object = Record<string, unknown>,
  TResult extends object = TInput,
> = {
  rowId: string;
  rowIndex: number;
  data: TResult;
  pending?: Partial<TInput>;
  diagnostics?: TableError[];
};

export type RowChangeReason = "new" | "edit" | "delete";
export type RowStateListener<
  TInput extends object = Record<string, unknown>,
  TResult extends object = TInput,
> = (
  rowId: string,
  next: RowStateSnapshot<TInput, TResult> | null,
  prev: RowStateSnapshot<TInput, TResult> | null,
  reason: RowChangeReason,
) => void;

export type SelectionSnapshot = {
  ranges: SelectionRange[];
  activeRowIndex: number | null;
  activeRowKey: string | null;
  activeColumnIndex: number | null;
  activeColumnKey: string | null;
  activeValueRaw: unknown;
  activeValueDisplay: string;
  activeValueType: ColumnType | null;
  diagnostic: CellDiagnostic | null;
  styles: {
    columnStyle: Partial<ResolvedCellStyle>;
    cellStyle: Partial<ResolvedCellStyle>;
    resolved: Partial<ResolvedCellStyle>;
  };
};

export type SelectionChangeReason =
  | "selection"
  | "edit"
  | "style"
  | "schema"
  | "view"
  | "data"
  | "unknown";
export type SelectionListener = (
  next: SelectionSnapshot,
  prev: SelectionSnapshot | null,
  reason: SelectionChangeReason,
) => void;
