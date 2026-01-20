export type CellPrimitive = string | number | boolean | null;

export type ButtonValue = string | { label: string; command: string; commandfor: string };
export type LinkValue = string | { label: string; href: string; target?: string };

export type LookupCellValue = {
  kind: "lookup";
  label: string;
  value: string;
  meta?: unknown;
};

export type LookupCandidate = {
  label: string;
  value: string;
  meta?: unknown;
  isRecent?: boolean;  // Internal flag: candidate is from recentLookup history
};

export type LabeledValue = {
  label: string;
  value: unknown;
};

export type TooltipText = string | null;
export type TooltipTextResult = TooltipText | Promise<TooltipText>;

export type ExternalEditResult = { kind: "commit"; value: unknown } | { kind: "cancel" };

export type LookupQueryContext = {
  query: string;
  rowId: string;
  colKey: string;
  signal: AbortSignal;
};

export type ExternalEditorContext = {
  rowId: string;
  colKey: string;
  currentValue: unknown;
};

export type TooltipContext = {
  rowId: string;
  colKey: string;
  value: unknown;
  signal: AbortSignal;
};

export type ColumnEditHooks = {
  lookup?: {
    fetchCandidates(ctx: LookupQueryContext): Promise<readonly LookupCandidate[]>;
    toStoredValue?(candidate: LookupCandidate): unknown;
    debounceMs?: number;
    recentLookup?: boolean;  // Default: true. Show recently selected items first.
    allowFreeInput?: boolean;  // Default: false. Allow freetext input even without matching candidate.
  };

  externalEditor?: {
    open(ctx: ExternalEditorContext): Promise<ExternalEditResult>;
  };
};

export type ColumnTooltipHook = {
  getText(ctx: TooltipContext): TooltipTextResult;
};

export type CellValue =
  | CellPrimitive
  | Date
  | { kind: "enum"; value: string }
  | { kind: "tags"; values: string[] }
  | LookupCellValue
  | LabeledValue
  | ButtonValue
  | LinkValue;

export type ColumnType =
  | "string"
  | "labeled"
  | "number"
  | "int"
  | "uint"
  | "boolean"
  | "datetime"
  | "date"
  | "time"
  | "enum"
  | "tags"
  | "button"
  | "link";

export type StringFormat = {
  maxLength?: number;
  regex?: string;
};

export type NumberFormat = {
  precision?: number;
  scale?: number;
  signed?: boolean;
  thousandSeparator?: boolean;
  negativeRed?: boolean;
  /**
   * Format token for number display.
   * - "decimal": normal decimal formatting (default)
   * - "scientific": scientific notation
   * - other strings are reserved for future/custom formatters
   */
  format?: string;
};

export type IntegerFormat = {
  thousandSeparator?: boolean;
  negativeRed?: boolean;
  /**
   * Format token for integer display.
   * - "decimal": normal decimal formatting (default)
   * - "binary" | "octal" | "hex": prefixed base literals
   * - other strings are reserved for future/custom formatters
   */
  format?: string;
};

export type BooleanFormat = "checkbox" | string | [string, string];
export type DateFormat = string;
export type TimeFormat = string;
export type DateTimeFormat = string;

export type ColumnFormat<TType extends ColumnType> = TType extends "string"
  ? StringFormat
  : TType extends "labeled"
    ? StringFormat
  : TType extends "number"
    ? NumberFormat
    : TType extends "int" | "uint"
      ? IntegerFormat
    : TType extends "boolean"
      ? BooleanFormat
      : TType extends "date"
        ? DateFormat
        : TType extends "time"
          ? TimeFormat
          : TType extends "datetime"
            ? DateTimeFormat
            : never;

export type ResolvedCellStyle = {
  backgroundColor?: string;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  readonly?: boolean;
  disabled?: boolean;
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

export type ConditionalStyleFn<TData extends object = object> = (
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
  TData extends object = object,
  RData extends object = TData,
  TType extends ColumnType = ColumnType,
  K extends string = string,
> {
  key: K;
  type: TType;
  header?: string;
  /**
   * `readonly` may be a static boolean or a predicate evaluated per-row.
   * - `true` prevents edits for all rows
   * - `(row) => boolean` returns per-row readonly state
   */
  readonly?: boolean | ((row: RData) => boolean);
  edit?: ColumnEditHooks;
  tooltip?: ColumnTooltipHook;
  /**
   * When true, enforce uniqueness within this column (per table).
   * Duplicate (non-empty) values mark all duplicated cells as invalid.
   */
  unique?: boolean;
  nullable?: boolean;
  format?: ColumnFormat<TType>;
  enum?: { options: string[]; allowCustom?: boolean };
  tags?: { options: string[]; allowCustom?: boolean };
  width?: number; // px
  wrapText?: boolean; // allow per-column wrapping
  style?: {
    textColor?: string;
    backgroundColor?: string;
    align?: "left" | "right" | "center";
    decorations?: { strike?: boolean; underline?: boolean; bold?: boolean; italic?: boolean };
    readonly?: boolean;
    disabled?: boolean;
  };
  formula?: (data: TData) => unknown;
  conditionalStyle?: ConditionalStyleFn<RData>;
}

// Infer row data type from schema columns
export type InferSchemaData<TColumns extends readonly ColumnSchema<any>[]> = {
  [I in keyof TColumns]: TColumns[I] extends ColumnSchema<infer TData, any, infer TType, infer K>
    ? K extends keyof TData
      ? TData[K]
      : never
    : never;
} extends (infer U)[]
  ? U extends object
    ? U
    : Record<string, unknown>
  : Record<string, unknown>;

export interface Schema<TData extends object = object, RData extends object = TData> {
  columns: ColumnSchema<TData, RData>[];
  row?: { conditionalStyle?: ConditionalStyleFn<RData> };
}

/**
 * Helper to lock schema generics so `formula`/`conditionalStyle` receive the correct row type.
 * Usage: `const schema = defineSchema<MyRow>({ columns: [...], row: {...} });`
 */
export const defineSchema = <TData extends object, RData extends object = TData>(
  schema: Schema<TData, RData>,
): Schema<TData, RData> => schema;

export type RowObject<T extends object = Record<string, unknown>> = {
  _readonly?: boolean;
  /** Optional externally-provided row id. If present and a string, it will be used as the internal row id. */
  id?: string;
} & T &
  Record<string, unknown>;

// Public data is object-row arrays only. Use `null` or `undefined` for async loading.
export type NullableData<T extends object = object> = T[] | null | undefined;

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

export type CommitChanges = {
  commands: Command[];
  user?: UserInfo;
};

export type CommitHandler = (changes: CommitChanges) => Promise<void>;

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
  /** Preferred languages for auto-fill sequence matching (e.g. ["ja", "en"]). */
  langs?: string[];
  defaultClass?: string | string[];
  defaultStyle?: Partial<CSSStyleDeclaration>;
  server?: ServerAdapter;
  user?: UserInfo;
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

export type ButtonActionValue =
  | { label: string; command?: undefined; commandfor?: undefined }
  | { label: string; command: string; commandfor: string };

export type CellAction = {
  kind: "button";
  rowId: string;
  colKey: string;
  value: ButtonActionValue;
};

export type TableState = {
  canCommit: boolean;
  pendingCommandCount: number;
  pendingCellCount?: number;
  undoRedo: { canUndo: boolean; canRedo: boolean };
  renderMode: "html" | "canvas";
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
  action?: CellAction | null;
  styles: {
    columnStyle: Partial<ResolvedCellStyle>;
    cellStyle: Partial<ResolvedCellStyle>;
    resolved: Partial<ResolvedCellStyle>;
  };
};

export type SelectionChangeReason =
  | "selection"
  | "edit"
  | "action"
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
