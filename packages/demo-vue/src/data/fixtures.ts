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
    { key: 'active', header: 'Active', type: 'boolean', booleanDisplay: 'checkbox', width: 80 },
    { key: 'date', header: 'Date', type: 'date', width: 120 },
    { key: 'time', header: 'Time', type: 'time', width: 100 },
    { key: 'datetime', header: 'DateTime', type: 'datetime', width: 180 },
    { key: 'role', header: 'Role', type: 'enum', enum: { options: ['viewer', 'editor', 'owner'] }, width: 120 },
    { key: 'tags', header: 'Tags', type: 'tags', tags: { options: ['alpha', 'beta', 'priority'] }, width: 140 },
    { key: 'score', header: 'Score', type: 'number', number: { precision: 6, scale: 2 }, format: { align: 'right' }, width: 100 },
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
  intPlain: number;
  intGrouped: number;
  intGroupedRed: number;
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
  const negative = i % 4 === 0;
  const month = (i % 12) + 1;
  const day = (i % 28) + 1;
  const hour = i % 24;
  const minute = i % 60;
  const second = (i * 2) % 60;
  const d = new Date(2025, 11, day, 0, 0, 0);
  const dt = new Date(2025, 11, day, hour, minute, 0);
  dataFormatRows.push({
    id: i,
    intPlain: negative ? -i * 10 : i * 10,
    intGrouped: negative ? -i * 1234 : i * 1234,
    intGroupedRed: negative ? -i * 9876 : i * 9876,
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
    { key: 'intPlain', header: 'Int Plain', type: 'number', width: 100 },
    { key: 'intGrouped', header: 'Int Grouped', type: 'number', number: { thousandSeparator: true }, width: 120 },
    { key: 'intGroupedRed', header: 'Int Grouped Red', type: 'number', number: { thousandSeparator: true, negativeRed: true }, width: 140 },
    { key: 'boolCheck', header: 'Bool Checkbox', type: 'boolean', booleanDisplay: 'checkbox', width: 120 },
    { key: 'boolTrueFalse', header: 'Bool TRUE/FALSE', type: 'boolean', booleanDisplay: ['TRUE', 'FALSE'], width: 130 },
    { key: 'boolTrueFalseJp', header: 'Bool 真/偽', type: 'boolean', booleanDisplay: ['真', '偽'], width: 110 },
    { key: 'dateIso', header: 'Date ISO', type: 'date', dateFormat: 'yyyy-MM-dd', width: 130 },
    { key: 'dateSlash', header: 'Date Slash', type: 'date', dateFormat: 'yyyy/MM/dd', width: 130 },
    { key: 'time24s', header: 'Time 24s', type: 'time', timeFormat: 'HH:mm:ss', width: 120 },
    { key: 'time12', header: 'Time 12h', type: 'time', timeFormat: 'hh:mm a', width: 120 },
    { key: 'datetimeIso', header: 'DateTime ISO', type: 'datetime', dateTimeFormat: "yyyy-MM-dd'T'HH:mm:ss'Z'", width: 200 },
    { key: 'datetimeSlash', header: 'DateTime Slash', type: 'datetime', dateTimeFormat: 'yyyy/MM/dd HH:mm', width: 180 }
  ]
};

export const dataFormatView = {
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
    { key: 'price', header: 'Price', type: 'number', format: { align: 'right' }, width: 90 },
    { key: 'qty', header: 'Qty', type: 'number', format: { align: 'right' }, width: 70 },
    {
      key: 'subtotal',
      header: 'Subtotal',
      type: 'number',
      formula: (row: FormulaConditionalRow) => row.price * row.qty,
      format: { align: 'right' },
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
      format: { align: 'right' },
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
  id: number;
  group: 'A' | 'B';
  value: number;
  flag: boolean;
  note: string;
}

export const conditionalStyleRows: ConditionalStyleRow[] = [
  { id: 1, group: 'A', value: 10, flag: false, note: '' },
  { id: 2, group: 'A', value: 80, flag: true, note: 'warn from style fn' },
  { id: 3, group: 'B', value: 55, flag: false, note: '' },
  { id: 4, group: 'B', value: 5, flag: true, note: 'error from style fn' },
  { id: 5, group: 'A', value: 120, flag: false, note: 'highlight' }
];

export const conditionalStyleSchema = {
  row: {
    conditionalStyle: (row: ConditionalStyleRow) => (row.group === 'B' ? { background: '#f1f5f9' } : null)
  },
  columns: [
    { key: 'id', header: '#', type: 'number', readonly: true, width: 50 },
    { key: 'group', header: 'Group', type: 'string', width: 80 },
    {
      key: 'value',
      header: 'Value',
      type: 'number',
      format: { align: 'right' },
      conditionalStyle: (row: ConditionalStyleRow) => {
        if (row.id === 2) return new Error('conditional style warning (demo)');
        if (row.id === 4) throw new Error('conditional style error (demo)');
        if (row.value >= 100) return { background: '#dcfce7', bold: true };
        if (row.value < 20) return { textColor: '#b91c1c' };
        return null;
      },
      width: 110
    },
    {
      key: 'flag',
      header: 'Flag',
      type: 'boolean',
      booleanDisplay: 'checkbox',
      conditionalStyle: (row: ConditionalStyleRow) => (row.flag ? { underline: true } : null),
      width: 80
    },
    {
      key: 'note',
      header: 'Note',
      type: 'string',
      conditionalStyle: (row: ConditionalStyleRow) => (row.note ? { textColor: '#1d4ed8' } : null),
      width: 220
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
    { key: 'amount', header: 'Amount', type: 'number', format: { align: 'right' }, width: 110 },
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
