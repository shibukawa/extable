# Data / Schema / View Model

Extable separates table configuration into **three distinct concerns**: Data, Schema, and View. This separation enables multi-user collaboration, predictable state management, and cleaner architecture.

## Key Design Principles

| Aspect | Data | Schema | View |
|--------|------|--------|------|
| **Who owns it?** | Application | Application | User |
| **Can it change?** | Yes (via `setData()`) | No (fixed at init) | Yes (filters, sorts, columns) |
| **Affects other users?** | Yes (all users see same data) | Yes (all users see same columns) | No (personal to each user) |
| **Persisted where?** | Backend database | App code | localStorage / URL query parameters / user session |
| **Example change** | New employee row added | Salary column renamed | User hides salary column |

## Data: The Source of Truth

**Data** is the actual content—a simple array of objects representing table rows:

```typescript
const data = [
  { id: 'emp-001', name: 'Alice', department: 'Engineering', salary: 95000, active: true },
  { id: 'emp-002', name: 'Bob', department: 'Sales', salary: 72000, active: true },
  { id: 'emp-003', name: 'Carol', department: 'Marketing', salary: 68000, active: false }
];
```

### Supported Data Types

Extable handles a variety of data types natively:

- **string**: Text values; supports custom length and regex validation
- **number**: Numeric values; supports precision, scale, and sign constraints
- **boolean**: True/false values; supports custom display (checkbox, yes/no, etc.)
- **date**: Calendar dates (YYYY-MM-DD format)
- **time**: Time values (HH:mm:ss format)
- **datetime**: Timestamp with date and time
- **enum**: Predefined list of allowed values
- **tags**: Multiple tags per cell from a predefined list
- **button**: Action cell that emits a button event
- **link**: Link cell that navigates to a URL

### Setting and Updating Data

Initialize data when creating the table:

```typescript
const table = new ExtableCore({
  root: document.getElementById('table'),
  defaultData: data,  // Initial data
  schema: schema,
  defaultView: view
});
```

Update data at any time using `setData()`:

```typescript
// Fetch fresh data from your API
const freshData = await fetch('/api/employees').then(r => r.json());

// Refresh the table
table.setData(freshData);
```

The `setData()` method completely replaces the data array, triggering a re-render:

```typescript
// Listen for data changes
table.onTableState(({ data, view, schema }) => {
  console.log('Data updated:', data);
});

// Update data
table.setData(newEmployeeList);
```

### Data Validation

Data is validated against the schema upon initialization or update. Invalid values are flagged with an error indicator (red cell outline, similar to Excel).

## Schema: Immutable Column Definitions

**Schema** defines the structure and behavior of your table columns. Unlike Excel, **schema is fixed at initialization** and cannot be changed by end users:

```typescript
const schema = {
  columns: [
    {
      key: 'id',
      type: 'string',
      header: 'Employee ID',
      readonly: true,  // Users cannot edit this column
    },
    {
      key: 'name',
      type: 'string',
      header: 'Full Name',
      nullable: false,  // Required field
    },
    {
      key: 'department',
      type: 'enum',
      header: 'Department',
      enum: ['Engineering', 'Sales', 'Marketing', 'HR'],
    },
    {
      key: 'salary',
      type: 'number',
      header: 'Salary (USD)',
      format: { precision: 2 },
      style: { align: 'right' },
      conditionalStyle: (row) => {
        if (row.salary > 90000) return { backgroundColor: '#d4edda' };  // Green for high salaries
        return null;
      }
    },
    {
      key: 'active',
      type: 'boolean',
      header: 'Active',
      format: 'checkbox'
    },
    {
      key: 'notes',
      type: 'string',
      header: 'Notes',
      wrapText: true  // Enable text wrapping in this column
    },
    {
      key: 'fullCompensation',
      type: 'number',
      header: 'Full Compensation',
      readonly: true,
      formula: (row) => row.salary * 1.25  // Computed column
    }
  ]
};
```

### Schema Features

- **Type Safety**: Ensure data conforms to expected types
- **Validation**: Length limits, regex patterns, min/max for numbers, nullable constraints
- **Formatting**: Number precision, date formats, boolean display variants
- **Styling**: Text color, background, bold/italic, decorations (underline, strikethrough)
- **Text Wrapping**: Per-column text wrapping (controlled by `wrapText` property)
- **Conditional Formatting**: Dynamic styles based on cell values (using function callbacks)
- **Readonly Columns**: Prevent user edits; useful for IDs and computed values
- **Computed Columns**: Formulas defined as JavaScript functions (not user-editable)

### Readonly / Disabled Matrix

| Column Type | Schema `readonly` | Conditional `{ readonly: true }` | Schema `disabled` | Conditional `{ disabled: true }` | Notes |
| --- | --- | --- | --- | --- | --- |
| `button` | Always readonly (not configurable) | Not supported | Supported | Supported | Disabled uses readonly gray and blocks interaction. |
| `link` | Always readonly (not configurable) | Not supported | Supported | Supported | Disabled uses readonly gray and blocks interaction. |
| `formula` | Always readonly (not configurable) | Not supported | Not supported | Not supported | Conditional readonly/disabled ignored. |
| `boolean/number/date/time/datetime` | Supported | Supported | Not supported | Not supported | Readonly can be set in schema or conditionalStyle. |
| `string/enum/tags` | Supported | Supported | Not supported | Not supported | Readonly can be set in schema or conditionalStyle. |

`disabled` is configured via `style.disabled` or `conditionalStyle` for button/link only.

### Why Fixed Schema?

- **Data Integrity**: Application enforces valid structure; no hidden surprises
- **Versioning**: Schema changes are deployed with your app, not scattered across user files
- **Collaboration**: All users see consistent column structure
- **Predictable API**: Developers control what columns exist and their constraints

For detailed schema examples and configuration options, see [Data Format Guide](/guides/data-format).

## View: Per-User Visibility and Organization

**View** is the personal workspace layer. Each user can have their own view state without affecting shared data:

```typescript
const view = {
  // Column visibility and order
  columnOrder: ['id', 'name', 'active', 'department'],  // Hide 'salary' and 'fullCompensation'
  
  // Sorting
  sortOrder: [
    { key: 'active', direction: 'desc' },  // Active employees first
    { key: 'name', direction: 'asc' }     // Then alphabetical
  ],
  
  // Filtering
  filters: {
    department: ['Engineering', 'Sales'],  // Show only these departments
    active: [true]                         // Show only active employees
  }
};
```

### View State Components

- **Column Order & Visibility**: Which columns to show, and in what order
- **Sort Order**: Primary and secondary sort keys with direction (ascending/descending)
- **Filters**: Row-level filters by column values (vertical filtering only; no pivots or transposals)

### User-Specific Persistence

View state is typically **local to each user's session**. To preserve user preferences across sessions, save view state to localStorage or your backend:

```typescript
// Save view state when it changes
table.onTableState(({ view }) => {
  localStorage.setItem('my-table-view', JSON.stringify(view));
});

// Restore on page load
const savedView = localStorage.getItem('my-table-view');
const restoredView = savedView ? JSON.parse(savedView) : defaultView;

const table = new ExtableCore({
  root: document.getElementById('table'),
  defaultData: data,
  schema: schema,
  defaultView: restoredView  // Use saved view
});
```

### Benefits of View Persistence

- **Maintain Sort State**: Users don't lose their sort order on page reload
- **Remember Filters**: Filtered views persist across sessions
- **Column Preferences**: Users can customize column visibility once and have it stick
- **Multi-Tab Consistency**: Different browser tabs can have different view states

## Next Steps

- Learn detailed [schema configuration and data types](/guides/data-format)
- Understand how [readonly and formula columns](/guides/editmode) work
- Explore [uncontrolled-only philosophy](/concepts/uncontrolled) for managing state outside the table
