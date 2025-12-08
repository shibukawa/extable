export type CellPrimitive = string | number | boolean | null;

export type CellValue =
  | CellPrimitive
  | Date
  | { kind: 'enum'; value: string }
  | { kind: 'tags'; values: string[] };

export type ColumnType = 'string' | 'number' | 'boolean' | 'datetime' | 'date' | 'time' | 'enum' | 'tags';

export interface ColumnSchema {
  key: string | number; // object key or array index
  type: ColumnType;
  header?: string;
  readonly?: boolean;
  nullable?: boolean;
  string?: { maxLength?: number; regex?: string };
  number?: { precision?: number; scale?: number; signed?: boolean };
  enum?: { options: string[] };
  tags?: { options: string[] };
  booleanDisplay?: 'checkbox' | string; // arbitrary label; default checkbox if absent
  width?: number; // px
   wrapText?: boolean; // allow per-column wrapping
  format?: {
    textColor?: string;
    background?: string;
    align?: 'left' | 'right';
    decorations?: { strike?: boolean; underline?: boolean };
  };
  conditionalFormat?: { expr: string; engine?: 'cel' };
  formula?: string;
}

export interface Schema {
  columns: ColumnSchema[];
}

export type RowObject = Record<string, CellValue>;
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
}

export interface TableConfig {
  data: DataSet;
  view: View;
  schema: Schema;
}

export interface InternalRow {
  id: string;
  raw: RowObject | RowArray;
}
