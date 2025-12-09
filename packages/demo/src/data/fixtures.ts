export interface DemoRow {
  id: number;
  name: string;
  active: boolean;
  date: string;
  time: string;
  datetime: string;
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
  demoRows.push({
    id: i,
    name: `User ${i}`,
    active: i % 2 === 0,
    date: '2024-11-01',
    time: '09:30',
    datetime: '2024-11-01T09:30:00Z',
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
  dateIso: string;
  dateSlash: string;
  time24s: string;
  time12: string;
  datetimeIso: string;
  datetimeSlash: string;
}

export const dataFormatRows: DataFormatRow[] = [];

for (let i = 1; i <= 40; i += 1) {
  const negative = i % 4 === 0;
  dataFormatRows.push({
    id: i,
    intPlain: negative ? -i * 10 : i * 10,
    intGrouped: negative ? -i * 1234 : i * 1234,
    intGroupedRed: negative ? -i * 9876 : i * 9876,
    boolCheck: i % 2 === 0,
    boolTrueFalse: i % 3 === 0,
    boolTrueFalseJp: i % 5 === 0,
    dateIso: `2025-12-${String((i % 28) + 1).padStart(2, '0')}`,
    dateSlash: `2025/${String((i % 12) + 1).padStart(2, '0')}/${String((i % 28) + 1).padStart(2, '0')}`,
    time24s: `0${i % 24}:${String(i % 60).padStart(2, '0')}:${String((i * 2) % 60).padStart(2, '0')}`,
    time12: `${String(((i % 12) || 12)).padStart(2, '0')}:${String((i * 3) % 60).padStart(2, '0')} ${i % 24 >= 12 ? 'PM' : 'AM'}`,
    datetimeIso: `2025-12-${String((i % 28) + 1).padStart(2, '0')}T0${i % 24}:${String(i % 60).padStart(2, '0')}:00Z`,
    datetimeSlash: `2025/${String((i % 12) + 1).padStart(2, '0')}/${String((i % 28) + 1).padStart(2, '0')} ${String(i % 24).padStart(2, '0')}:${String((i * 2) % 60).padStart(2, '0')}`
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
