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

export type ConditionalStyleFn<TData extends Record<string, unknown> = Record<string, unknown>> = (
  data: TData,
) => StyleDelta | null | Error;

// A1 notation typing (MVP: single cell only)
// NOTE: Using per-digit unions here can explode the type space and break `tsc --emitDeclarationOnly`.
// Keep the type reasonably permissive and enforce bounds (e.g. <= 100000) at runtime in the resolver.
export type ExcelRow = `${number}`;

export type Col1 =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y"
  | "Z";
export type Col2 = `${Col1}${Col1}`;
export type ExcelColumn = Col1 | Col2;
export type ExcelRef = `${ExcelColumn}${ExcelRow}`;

export type Updater<T> = T | ((oldValue: T) => T);

export type CellAddress =
  | { rowId: string; colKey: string | number }
  | { rowIndex: number; colIndex: number }
  | { rowId: string; colIndex: number }
  | { rowIndex: number; colKey: string | number }
  | ExcelRef;

export interface ColumnSchema<
  TData extends Record<string, unknown> = Record<string, unknown>,
  TType extends ColumnType = ColumnType,
> {
  key: string | number; // object key or array index
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
  formula?: (data: TData) => FormulaReturn;
  conditionalStyle?: ConditionalStyleFn<TData>;
}

export interface Schema<TData extends Record<string, unknown> = Record<string, unknown>> {
  columns: ColumnSchema<TData>[];
}

export type RowObject<T extends Record<string, unknown> = Record<string, unknown>> = {
  _readonly?: boolean;
} & T;
export type RowArray = CellValue[];

export interface DataSet<T extends Record<string, unknown> = Record<string, unknown>> {
  rows: Array<RowObject<T> | RowArray>;
}

export type NullableDataSet<T extends Record<string, unknown> = Record<string, unknown>> =
  DataSet<T> | null;

export type ViewFilterOp = {
  kind: "op";
  key: string | number;
  op: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "contains";
  value: unknown;
};

export type ViewFilterValues = {
  kind: "values";
  key: string | number;
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
  key: string | number;
  dir: "asc" | "desc";
}

export interface View {
  hiddenColumns?: Array<string | number>;
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
export type EditMode = "direct" | "commit";
export type LockMode = "none" | "row";

export interface Command {
  kind: "edit" | "deleteRow" | "insertRow" | "updateView" | "lock" | "unlock";
  rowId?: string;
  colKey?: string | number;
  rowData?: RowObject | RowArray;
  prev?: unknown;
  next?: unknown;
  payload?: unknown;
}

export interface UserInfo {
  id: string;
  name: string;
}

export interface ServerAdapter {
  fetchInitial?: () => Promise<{ data: DataSet; view?: View; schema?: Schema; user: UserInfo }>;
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
  /** When true, all cells are treated as read-only (without changing their visual styles). */
  readonly?: boolean;
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

export interface TableConfig<T extends Record<string, unknown> = Record<string, unknown>> {
  data: DataSet<T>;
  view: View;
  schema: Schema;
}

export interface InternalRow {
  id: string;
  raw: RowObject | RowArray;
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
  target?: { rowId?: string; colKey?: string | number };
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

export type SelectionSnapshot = {
  ranges: SelectionRange[];
  activeRowIndex: number | null;
  activeRowKey: string | null;
  activeColumnIndex: number | null;
  activeColumnKey: string | number | null;
  activeValueRaw: unknown;
  activeValueDisplay: string;
  activeValueType: ColumnType | null;
  diagnostic: CellDiagnostic | null;
  styles: {
    columnStyle: Partial<ResolvedCellStyle>;
    cellStyle: Partial<ResolvedCellStyle>;
    resolved: Partial<ResolvedCellStyle>;
  };
  canStyle: boolean;
  styleState: {
    bold: ToggleState;
    italic: ToggleState;
    underline: ToggleState;
    strike: ToggleState;
    textColor: ColorState;
    background: ColorState;
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
