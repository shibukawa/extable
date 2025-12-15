export type CellPrimitive = string | number | boolean | null;

export type CellValue =
  | CellPrimitive
  | Date
  | { kind: 'enum'; value: string }
  | { kind: 'tags'; values: string[] };

export type ColumnType = 'string' | 'number' | 'boolean' | 'datetime' | 'date' | 'time' | 'enum' | 'tags';

// A1 notation typing (MVP: single cell only)
// NOTE: Using per-digit unions here can explode the type space and break `tsc --emitDeclarationOnly`.
// Keep the type reasonably permissive and enforce bounds (e.g. <= 100000) at runtime in the resolver.
export type ExcelRow = `${number}`;

export type Col1 =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y'
  | 'Z';
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

export interface ColumnSchema {
  key: string | number; // object key or array index
  type: ColumnType;
  header?: string;
  readonly?: boolean;
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
  booleanDisplay?: 'checkbox' | string | [string, string]; // arbitrary label set; default checkbox when absent
  dateFormat?: string;
  timeFormat?: string;
  dateTimeFormat?: string;
  width?: number; // px
  wrapText?: boolean; // allow per-column wrapping
  format?: {
    textColor?: string;
    background?: string;
    align?: 'left' | 'right' | 'center';
    decorations?: { strike?: boolean; underline?: boolean; bold?: boolean; italic?: boolean };
  };
  conditionalFormat?: { expr: string; engine?: 'cel' };
  formula?: string;
}

export interface Schema {
  columns: ColumnSchema[];
}

export type RowObject = { _readonly?: boolean } & Record<string, CellValue>;
export type RowArray = CellValue[];

export interface DataSet {
  rows: Array<RowObject | RowArray>;
}

export interface ViewFilter {
  key: string | number;
  op: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'contains';
  value: unknown;
}

export interface ViewSort {
  key: string | number;
  dir: 'asc' | 'desc';
}

export interface View {
  hiddenColumns?: Array<string | number>;
  filters?: ViewFilter[];
  sorts?: ViewSort[];
  userId?: string; // personalization
  columnWidths?: Record<string, number>; // key -> px
  rowHeights?: Record<string, number>;
  wrapText?: Record<string, boolean>; // view override per column
}

export type RenderMode = 'html' | 'canvas' | 'auto';
export type EditMode = 'direct' | 'commit';
export type LockMode = 'none' | 'row';

export interface Command {
  kind: 'edit' | 'deleteRow' | 'insertRow' | 'updateView' | 'lock' | 'unlock';
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

export type ServerEvent = { type: 'update'; commands: Command[]; user: UserInfo };

export interface CoreOptions {
  renderMode?: RenderMode;
  editMode?: EditMode;
  lockMode?: LockMode;
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
     * When true, always intercept `Ctrl/Cmd+F` and `Ctrl/Cmd+R` and show extable's search sidebar.
     * Use this when the table is the primary focus of the page and browser Find/Reload should be overridden.
     * Default: true (always intercept).
     */
    enableSearch?: boolean;
  };
}

export interface TableConfig {
  data: DataSet;
  view: View;
  schema: Schema;
}

export interface InternalRow {
  id: string;
  raw: RowObject | RowArray;
  displayIndex: number;
}

export type SelectionKind = 'cells' | 'rows';

export interface SelectionRange {
  kind: SelectionKind;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export type ResolvedCellStyle = {
  background?: string;
  textColor?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
};

export type StyleDelta = Partial<ResolvedCellStyle>;

export type ToggleState = 'on' | 'off' | 'mixed' | 'disabled';
export type ColorState = string | 'mixed' | null | 'disabled';

export type TableError = {
  scope: 'validation' | 'commit' | 'render' | 'unknown';
  message: string;
  target?: { rowId?: string; colKey?: string | number };
};

export type TableState = {
  canCommit: boolean;
  pendingCommandCount: number;
  pendingCellCount?: number;
  undoRedo: { canUndo: boolean; canRedo: boolean };
  renderMode: 'html' | 'canvas';
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

export type SelectionChangeReason = 'selection' | 'edit' | 'style' | 'schema' | 'view' | 'data' | 'unknown';
export type SelectionListener = (
  next: SelectionSnapshot,
  prev: SelectionSnapshot | null,
  reason: SelectionChangeReason,
) => void;
