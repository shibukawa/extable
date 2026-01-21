export interface DemoRow {
  id: number;
  name: string;
  active: boolean;
  date: Date;
  time: Date;
  datetime: Date;
  role: 'viewer' | 'editor' | 'owner';
  tags: string[];
  score: number;
  description: string;
  longNote: string;
  longNoWrap: string;
}

export const demoRows: DemoRow[] = [
];

for (let i = 1; i <= 100; i += 1) {
  const isLong = i % 5 === 0;
  const hasNewlines = i % 7 === 0;
  const base = new Date(2024, 10, 1, 9, 30, 0); // local time
  demoRows.push({
    id: i,
    name: `User ${i}`,
    active: i % 2 === 0,
    date: new Date(base.getFullYear(), base.getMonth(), base.getDate()),
    time: new Date(1970, 0, 1, base.getHours(), base.getMinutes(), base.getSeconds()),
    datetime: new Date(base.getTime()),
    role: i % 3 === 0 ? 'owner' : i % 3 === 1 ? 'editor' : 'viewer',
    tags: i % 4 === 0 ? ['priority'] : i % 3 === 0 ? ['alpha'] : ['beta'],
    score: Math.round((50 + (i % 50)) * 100) / 100,
    description: hasNewlines
      ? 'Line one of description\nLine two with more words\nLine three to force height growth'
      : isLong
        ? 'This is a longer description that should wrap into multiple lines to test variable row heights.'
        : 'Short text',
    longNote:
      'This is an extremely long single-line note intended to verify ellipsis when wrapping is disabled. ' +
      'It should exceed the column width significantly without containing newline characters.',
    longNoWrap:
      'A very very long text that should stay single-line and demonstrate ellipsis behavior when wrap is off for this column.'
  });
}

export function makePerformanceDemoRows(count = 10000): DemoRow[] {
  const rows: DemoRow[] = [];
  const base = new Date(2024, 10, 1, 9, 30, 0); // local time
  const shortDescription = 'Short text';
  const longNote =
    'This is an extremely long single-line note intended to verify ellipsis when wrapping is disabled.';
  const longNoWrap = 'A very very long text that should stay single-line and demonstrate ellipsis.';
  for (let i = 1; i <= count; i += 1) {
    rows.push({
      id: i,
      name: `User ${i}`,
      active: i % 2 === 0,
      date: new Date(base.getFullYear(), base.getMonth(), base.getDate()),
      time: new Date(1970, 0, 1, base.getHours(), base.getMinutes(), base.getSeconds()),
      datetime: new Date(base.getTime() + i * 60_000),
      role: i % 3 === 0 ? 'owner' : i % 3 === 1 ? 'editor' : 'viewer',
      tags: i % 4 === 0 ? ['priority'] : i % 3 === 0 ? ['alpha'] : ['beta'],
      score: Math.round((50 + (i % 50)) * 100) / 100,
      description: shortDescription,
      longNote,
      longNoWrap
    });
  }
  return rows;
}

export const demoSchema = {
  columns: [
    { key: 'id', header: 'ID', type: 'number', readonly: true, width: 60 },
    { key: 'name', header: 'Name', type: 'string', width: 140 },
    { key: 'active', header: 'Active', type: 'boolean', format: 'checkbox', width: 80 },
    { key: 'date', header: 'Date', type: 'date', width: 120 },
    { key: 'time', header: 'Time', type: 'time', width: 100 },
    { key: 'datetime', header: 'DateTime', type: 'datetime', width: 180 },
    { key: 'role', header: 'Role', type: 'string', edit: { lookup: { async fetchCandidates({ query }) { const options = ['viewer', 'editor', 'owner']; const filtered = options.filter(o => o.toLowerCase().includes(query.toLowerCase())); return filtered.map(value => ({ label: value, value })); } } }, width: 120 },
    { key: 'tags', header: 'Tags', type: 'tags', tags: { options: ['alpha', 'beta', 'priority'] }, width: 140 },
    { key: 'score', header: 'Score', type: 'number', format: { precision: 6, scale: 2 }, style: { align: 'right' }, width: 100 },
    { key: 'description', header: 'Description', type: 'string', width: 260, wrapText: true },
    { key: 'longNote', header: 'Long Note (wrap)', type: 'string', width: 260, wrapText: true },
    { key: 'longNoWrap', header: 'Long Note (ellipsis)', type: 'string', width: 240 }
  ]
};

export const demoView = {
  hiddenColumns: [],
  filters: [],
  sorts: []
};

export interface DataFormatRow {
  id: number;
  boolCheck: boolean;
  boolTrueFalse: boolean;
  boolTrueFalseJp: boolean;
  dateIso: Date;
  dateSlash: Date;
  time24s: Date;
  time12: Date;
  datetimeIso: Date;
  datetimeSlash: Date;
}

export const dataFormatRows: DataFormatRow[] = [];

for (let i = 1; i <= 40; i += 1) {
  const month = (i % 12) + 1;
  const day = (i % 28) + 1;
  const hour = i % 24;
  const minute = i % 60;
  const second = (i * 2) % 60;
  const d = new Date(2025, 11, day, 0, 0, 0);
  const dt = new Date(2025, 11, day, hour, minute, 0);
  dataFormatRows.push({
    id: i,
    boolCheck: i % 2 === 0,
    boolTrueFalse: i % 3 === 0,
    boolTrueFalseJp: i % 5 === 0,
    dateIso: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    dateSlash: new Date(2025, month - 1, day),
    time24s: new Date(1970, 0, 1, hour, minute, second),
    time12: new Date(1970, 0, 1, hour, (i * 3) % 60, 0),
    datetimeIso: new Date(dt.getTime()),
    datetimeSlash: new Date(2025, month - 1, day, hour, second, 0),
  });
}

export const dataFormatSchema = {
  columns: [
    { key: 'id', header: '#', type: 'number', readonly: true, width: 50 },
    { key: 'boolCheck', header: 'Bool Checkbox', type: 'boolean', format: 'checkbox', width: 120 },
    { key: 'boolTrueFalse', header: 'Bool TRUE/FALSE', type: 'boolean', format: ['TRUE', 'FALSE'], width: 130 },
    { key: 'boolTrueFalseJp', header: 'Bool 真/偽', type: 'boolean', format: ['真', '偽'], width: 110 },
    { key: 'dateIso', header: 'Date ISO', type: 'date', format: 'yyyy-MM-dd', width: 130 },
    { key: 'dateSlash', header: 'Date Slash', type: 'date', format: 'yyyy/MM/dd', width: 130 },
    { key: 'time24s', header: 'Time 24s', type: 'time', format: 'HH:mm:ss', width: 120 },
    { key: 'time12', header: 'Time 12h', type: 'time', format: 'hh:mm a', width: 120 },
    { key: 'datetimeIso', header: 'DateTime ISO', type: 'datetime', format: "yyyy-MM-dd'T'HH:mm:ss'Z'", width: 200 },
    { key: 'datetimeSlash', header: 'DateTime Slash', type: 'datetime', format: 'yyyy/MM/dd HH:mm', width: 180 }
  ]
};

export const dataFormatView = {
  hiddenColumns: [],
  filters: [],
  sorts: []
};

export interface NumbersRow {
  id: number;
  dec2: number;
  decGrouped0: number;
  sci6: number;
  intDec: number;
  intHex: number;
  intOct: number;
  intBin: number;
  uintHex: number;
  note: string;
}

export const numbersRows: NumbersRow[] = [];

for (let i = 1; i <= 40; i += 1) {
  const negative = i % 5 === 0;
  const sign = negative ? -1 : 1;
  const base = i * 123;
  const intVal = sign * (base + (i % 7));
  const sciVal = sign * (i * 12_345.678);
  const uintVal = i * 16 + (i % 16);
  numbersRows.push({
    id: i,
    dec2: sign * (i * 10.25 + (i % 3) * 0.1),
    decGrouped0: sign * (i * 12345),
    sci6: sciVal,
    intDec: intVal,
    intHex: intVal,
    intOct: intVal,
    intBin: intVal,
    uintHex: uintVal,
    note: negative ? "negative" : "",
  });
}

export const numbersSchema = {
  columns: [
    { key: 'id', header: '#', type: 'uint', readonly: true, width: 50 },
    {
      key: 'dec2',
      header: 'Decimal (2dp)',
      type: 'number',
      format: { format: 'decimal', scale: 2, thousandSeparator: true, negativeRed: true },
      width: 140,
      style: { align: 'right' }
    },
    {
      key: 'decGrouped0',
      header: 'Decimal (grouped)',
      type: 'number',
      format: { format: 'decimal', scale: 0, thousandSeparator: true, negativeRed: true },
      width: 160,
      style: { align: 'right' }
    },
    {
      key: 'sci6',
      header: 'Scientific (p=6)',
      type: 'number',
      format: { format: 'scientific', precision: 6, negativeRed: true },
      width: 160,
      style: { align: 'right' }
    },
    { key: 'intDec', header: 'Int (decimal)', type: 'int', format: { thousandSeparator: true }, width: 140, style: { align: 'right' } },
    { key: 'intHex', header: 'Int (hex)', type: 'int', format: { format: 'hex' }, width: 120, style: { align: 'right' } },
    { key: 'intOct', header: 'Int (octal)', type: 'int', format: { format: 'octal' }, width: 130, style: { align: 'right' } },
    { key: 'intBin', header: 'Int (binary)', type: 'int', format: { format: 'binary' }, width: 160, style: { align: 'right' } },
    { key: 'uintHex', header: 'UInt (hex)', type: 'uint', format: { format: 'hex' }, width: 130, style: { align: 'right' } },
    { key: 'note', header: 'Note', type: 'string', width: 120 }
  ]
};

export const numbersView = {
  hiddenColumns: [],
  filters: [],
  sorts: []
};

export interface FormulaConditionalRow {
  id: number;
  item: string;
  price: number;
  qty: number;
  discountRate: number;
  note: string;
}

export const formulaRows: FormulaConditionalRow[] = [
  { id: 1, item: 'Apple', price: 120, qty: 2, discountRate: 0, note: '' },
  { id: 2, item: 'Banana', price: 80, qty: 5, discountRate: 0.1, note: 'promo' },
  { id: 3, item: 'Orange', price: 150, qty: 1, discountRate: 0, note: '' },
  { id: 4, item: 'Grape', price: 200, qty: 0, discountRate: 0.05, note: 'qty=0 (warn)' },
  { id: 5, item: 'Mango', price: -50, qty: 3, discountRate: 0, note: 'negative price (error style)' }
];

export const formulaSchema = {
  columns: [
    { key: 'id', header: '#', type: 'number', readonly: true, width: 50 },
    { key: 'item', header: 'Item', type: 'string', width: 140 },
    { key: 'price', header: 'Price', type: 'number', style: { align: 'right' }, width: 90 },
    { key: 'qty', header: 'Qty', type: 'number', style: { align: 'right' }, width: 70 },
    {
      key: 'subtotal',
      header: 'Subtotal',
      type: 'number',
      formula: (row: FormulaConditionalRow) => row.price * row.qty,
      style: { align: 'right' },
      width: 110
    },
    {
      key: 'total',
      header: 'Total',
      type: 'number',
      formula: (row: FormulaConditionalRow) => {
        if (row.qty === 0) return [0, new Error('qty is 0')] as const;
        const subtotal = row.price * row.qty;
        return subtotal * (1 - row.discountRate);
      },
      style: { align: 'right' },
      width: 120
    },
    {
      key: 'status',
      header: 'Status (formula)',
      type: 'string',
      formula: (row: FormulaConditionalRow) => {
        if (row.price < 0) throw new Error('price must be >= 0');
        if (row.qty === 0) return ['warning', new Error('out of stock')] as const;
        return row.discountRate > 0 ? 'discount' : 'ok';
      },
      width: 150
    },
    {
      key: 'note',
      header: 'Note',
      type: 'string',
      width: 180
    }
  ]
};

export const formulaView = {
  hiddenColumns: [],
  filters: [],
  sorts: []
};

export interface ConditionalStyleRow {
  id: string;
  employee: string;
  department: string;
  score: number;
  attendance: number;
  projects: number;
  status: string;
}

function makeConditionalStyleRows(): ConditionalStyleRow[] {
  const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'];
  const statuses = ['Active', 'On Leave', 'Inactive'];
  const rows: ConditionalStyleRow[] = [];

  for (let i = 1; i <= 40; i += 1) {
    const score = Math.round((Math.random() * 40 + 60) * 10) / 10;
    const attendance = Math.round((Math.random() * 30 + 70) * 10) / 10;
    const projects = Math.floor(Math.random() * 20);

    rows.push({
      id: `EMP-${String(i).padStart(5, '0')}`,
      employee: `Employee ${i}`,
      department: departments[i % departments.length],
      score,
      attendance,
      projects,
      status: statuses[i % statuses.length]
    });
  }

  return rows;
}

export const conditionalStyleRows = makeConditionalStyleRows();

export const conditionalStyleSchema = {
  columns: [
    { key: 'id', header: 'Employee ID', type: 'string', readonly: true, width: 120 },
    { key: 'employee', header: 'Employee Name', type: 'string', width: 150 },
    { key: 'department', header: 'Department', type: 'string', width: 140 },
    {
      key: 'score',
      header: 'Performance Score',
      type: 'number',
      format: { precision: 5, scale: 1 },
      width: 160,
      style: { align: 'center' },
      conditionalStyle: (row: ConditionalStyleRow) => {
        if (row.score >= 90) return { backgroundColor: '#d1fae5', textColor: '#065f46' };
        if (row.score >= 70) return { backgroundColor: '#fef3c7', textColor: '#78350f' };
        return { backgroundColor: '#fee2e2', textColor: '#7f1d1d' };
      }
    },
    {
      key: 'attendance',
      header: 'Attendance (%)',
      type: 'number',
      format: { precision: 5, scale: 1 },
      width: 140,
      style: { align: 'center' },
      conditionalStyle: (row: ConditionalStyleRow) => {
        if (row.attendance >= 95) return { backgroundColor: '#dcfce7', textColor: '#166534' };
        if (row.attendance >= 85) return { backgroundColor: '#fef08a', textColor: '#713f12' };
        return { backgroundColor: '#fecaca', textColor: '#991b1b' };
      }
    },
    {
      key: 'projects',
      header: 'Projects Completed',
      type: 'number',
      format: { precision: 3, scale: 0 },
      width: 160,
      style: { align: 'center' },
      conditionalStyle: (row: ConditionalStyleRow) => {
        if (row.projects >= 15) return { backgroundColor: '#bfdbfe', textColor: '#1e40af' };
        if (row.projects >= 8) return { backgroundColor: '#e0e7ff', textColor: '#3730a3' };
        return null;
      }
    },
    {
      key: 'status',
      header: 'Status',
      type: 'string',
      readonly: true,
      width: 130,
      style: { align: 'center' },
      conditionalStyle: (row: ConditionalStyleRow) => {
        if (row.status === 'Active') return { backgroundColor: '#ccfbf1', textColor: '#134e4a' };
        if (row.status === 'On Leave') return { backgroundColor: '#fed7aa', textColor: '#92400e' };
        if (row.status === 'Inactive') return { backgroundColor: '#f3f4f6', textColor: '#374151' };
        return null;
      }
    }
  ]
};

export const conditionalStyleView = {
  hiddenColumns: [],
  filters: [],
  sorts: []
};

export interface UniqueCheckRow {
  id: number;
  email: string;
  code: string;
  note: string;
}

export const uniqueCheckRows: UniqueCheckRow[] = [
  { id: 1, email: 'alice@example.com', code: 'A-001', note: '' },
  { id: 2, email: 'bob@example.com', code: 'B-002', note: '' },
  { id: 3, email: 'alice@example.com', code: 'C-003', note: 'duplicate email' },
  { id: 4, email: 'carol@example.com', code: 'B-002', note: 'duplicate code' },
  { id: 5, email: '', code: '', note: 'empty values are ignored' }
];

export const uniqueCheckSchema = {
  columns: [
    { key: 'id', header: '#', type: 'number', readonly: true, width: 50 },
    { key: 'email', header: 'Email (unique)', type: 'string', unique: true, width: 220 },
    { key: 'code', header: 'Code (unique)', type: 'string', unique: true, width: 140 },
    { key: 'note', header: 'Note', type: 'string', width: 240 }
  ]
};

export const uniqueCheckView = {
  hiddenColumns: [],
  filters: [],
  sorts: []
};

export interface UniqueBoolRow {
  id: number;
  name: string;
  primary: boolean;
}

export const uniqueBoolRows: UniqueBoolRow[] = [
  { id: 1, name: 'Alpha', primary: false },
  { id: 2, name: 'Bravo', primary: true },
  { id: 3, name: 'Charlie', primary: false },
  { id: 4, name: 'Delta', primary: false },
];

export const uniqueBoolSchema = {
  columns: [
    { key: 'id', header: '#', type: 'number', readonly: true, width: 60 },
    { key: 'name', header: 'Name', type: 'string', width: 200 },
    { key: 'primary', header: 'Primary', type: 'boolean', unique: true, width: 100 },
  ]
};

export const uniqueBoolView = {
  hiddenColumns: [],
  filters: [],
  sorts: []
};

export interface FilterSortRow {
  id: number;
  group: 'A' | 'B' | 'C';
  amount: number | null;
  note: string;
}

export const filterSortRows: FilterSortRow[] = [
  { id: 1, group: 'A', amount: 120, note: 'ok' },
  { id: 2, group: 'B', amount: 80, note: 'warn' },
  { id: 3, group: 'A', amount: 150, note: 'ok' },
  { id: 4, group: 'C', amount: null, note: 'blank amount' },
  { id: 5, group: 'B', amount: -50, note: 'error' },
  { id: 6, group: 'C', amount: 200, note: 'ok' },
  { id: 7, group: 'A', amount: 0, note: 'warn' },
  { id: 8, group: 'B', amount: 60, note: 'ok' }
];

export const filterSortSchema = {
  columns: [
    { key: 'id', header: '#', type: 'number', readonly: true, width: 50 },
    { key: 'group', header: 'Group', type: 'enum', enum: { options: ['A', 'B', 'C'] }, width: 100 },
    { key: 'amount', header: 'Amount', type: 'number', style: { align: 'right' }, width: 110 },
    {
      key: 'status',
      header: 'Status',
      type: 'string',
      formula: (row: FilterSortRow) => {
        if (row.amount === null) return '';
        if (row.amount < 0) throw new Error('amount must be >= 0');
        if (row.note === 'warn') return ['warning', new Error('check this row')] as const;
        return 'ok';
      },
      width: 160
    },
    { key: 'note', header: 'Note', type: 'string', width: 220 }
  ]
};

export const filterSortView = {
  hiddenColumns: [],
  filters: [],
  sorts: []
};
