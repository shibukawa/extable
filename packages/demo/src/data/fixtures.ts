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
