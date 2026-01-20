# Data Format Guide

Extable supports a variety of data types, each with specific validation rules, style options, and display behaviors. This guide covers schema column definition and how to work with each type.

## Column Definition Structure

Every column in your schema requires:

```typescript
{
  key: 'columnName',           // Unique identifier for this column
  header: 'Display Label',     // User-visible header text
  type: 'string' | 'number' | 'int' | 'uint' | 'boolean' | 'date' | 'time' | 'datetime' | 'enum' | 'tags' | 'labeled' | 'button' | 'link',
  width?: number,              // Optional: column width in pixels
  readonly?: boolean,          // Optional: prevent user edits
  nullable?: boolean,          // Optional: allow empty/null values
  wrapText?: boolean,          // Optional: enable text wrapping
  style?: { /* type-specific */ },
  conditionalStyle?: (row) => StyleObject | null,  // Optional: dynamic styling
  formula?: (row) => value | [value, Error],       // Optional: computed column
  // ... type-specific properties
}
```

### Type-safe schemas with `defineSchema`

Use `defineSchema<T>()` to ensure `row` in `formula`/`conditionalStyle` is typed as your row model `T`.

```typescript
import { defineSchema } from '@extable/core';

type Row = {
  id: number;
  quantity: number;
  unitPrice: number;
};

const schema = defineSchema<Row>({
  columns: [
    { key: 'id', header: 'ID', type: 'number', readonly: true },
    { key: 'quantity', header: 'Qty', type: 'number' },
    {
      key: 'unitPrice',
      header: 'Unit Price',
      type: 'number'
    },
    {
      key: 'total',
      header: 'Total',
      type: 'number',
      formula: (row) => row.quantity * row.unitPrice, // row is Row
      conditionalStyle: (row) =>
        row.quantity * row.unitPrice > 1000 ? { backgroundColor: '#fff3cd' } : null
    }
  ],
  row: {
    conditionalStyle: (row) => (row.quantity === 0 ? { textColor: '#999' } : null)
  }
});
```

`defineSchema<Row>(...)` gives safe autocomplete for `row.quantity`, `row.unitPrice`, etc.

## Data Types

### String

Plain text values with optional length and pattern validation.

```typescript
{
  key: 'email',
  header: 'Email Address',
  type: 'string',
  nullable: false,
  // Optional string-specific properties:
  string: {
    length?: { min: 0, max: 255 },      // Character count limits
    pattern?: /^[a-z0-9]+@[a-z]+\.[a-z]+$/,  // Regex validation
    allowMultiline?: false               // Default: single-line
  }
}
```

**Characteristics:**
- Default display: plain text
- Text wrapping: controlled by `wrapText` property
- Validation: length and regex patterns
- Null handling: renders as empty cell if `nullable: true`

### Number

Floating-point numbers with optional precision/scale and display options.

See also: **[Numeric Formats demo →](/demos/number-formats)**

```typescript
{
  key: 'salary',
  header: 'Annual Salary',
  type: 'number',
  format: {
    precision?: 10,           // Significant digits (used for scientific display)
    scale?: 2,                // Fixed decimal places (decimal display)
    signed?: true,            // When false, negative values are invalid
    thousandSeparator?: true, // Show comma separators (1,234.56)
    negativeRed?: true,       // Red color for negative values
    format?: 'decimal' | 'scientific'
  },
  style: { align: 'right' }  // Right-align numbers
}
```

**Display Examples:**
- `1234` with `thousandSeparator: true` → `1,234`
- `-50` with `negativeRed: true` → red text color
- `123.456` with `scale: 2` → `123.46` (rounded)
- `1234` with `format: 'scientific', precision: 4` → `1.234e+3`

### Integer (`int` / `uint`)

Safe integers (within JavaScript `Number.MAX_SAFE_INTEGER`).

See also: **[Numeric Formats demo →](/demos/number-formats)**

- `int`: signed safe integer
- `uint`: non-negative safe integer

```typescript
{
  key: 'flags',
  header: 'Flags',
  type: 'uint',
  format: {
    format: 'hex',            // 'decimal' | 'binary' | 'octal' | 'hex'
    negativeRed: false
  },
  style: { align: 'right' }
}
```

### Boolean

True/false values with customizable display format.

```typescript
{
  key: 'active',
  header: 'Active Status',
  type: 'boolean',
  // Display variants:
  format: 'checkbox'           // ☑️ / ☐
  // OR
  format: ['TRUE', 'FALSE']    // Text display
  // OR
  format: ['Yes', 'No']        // Localized text
  // OR
  format: ['真', '偽']         // Non-English
}
```

**User Interaction:**
- Checkbox mode: Click to toggle, Space bar to toggle
- Text mode: Click cell to toggle

### Date

Calendar dates without time component. Allowed tokens: `yyyy`, `MM`, `dd` (and literals).

**Presets (format):**

| Preset | Pattern        | Note                |
| ------ | -------------- | ------------------- |
| iso    | `yyyy-MM-dd`   | Default (ISO)       |
| us     | `MM/dd/yyyy`   | US style            |
| eu     | `dd.MM.yyyy`   | EU style            |

Examples: `iso`, `us`, `eu`, or a custom pattern using allowed tokens.

```typescript
{
  key: 'joinDate',
  header: 'Join Date',
  type: 'date',
  format?: 'yyyy-MM-dd'  // ISO standard (default)
  // Other common formats:
  // 'yyyy/MM/dd'             // Slash format
  // 'MM/dd/yyyy'             // US format
  // 'dd.MM.yyyy'             // European format
}
```

**Storage:**
- Internally stored as JavaScript `Date` objects
- Input/output: ISO 8601 format (`YYYY-MM-DD`)
- Null handling: empty string renders as blank cell
- Formatting engine: lightweight built-in formatter (not date-fns). Supported tokens: `yyyy`, `MM`, `dd`, `HH`, `hh`, `mm`, `ss`, `a`, and single-quoted literals. Example: `yyyy-MM-dd`, `HH:mm:ss`, `hh:mm a`, `yyyy/MM/dd HH:mm`.

### Time

Time-of-day values without date component. Allowed tokens: `HH`, `hh`, `mm`, `ss`, `a` (and literals).

**Presets (format):**

| Preset | Pattern      | Note                 |
| ------ | ------------ | -------------------- |
| iso    | `HH:mm:ss`   | Default (24h + sec)  |
| 24h    | `HH:mm`      | 24h, seconds hidden  |
| 12h    | `hh:mm a`    | 12h, AM/PM           |

```typescript
{
  key: 'startTime',
  header: 'Start Time',
  type: 'time',
  format?: 'HH:mm:ss'    // 24-hour with seconds (default)
  // Other common formats:
  // 'HH:mm'                  // 24-hour without seconds
  // 'hh:mm a'                // 12-hour with AM/PM
  // 'HH:mm:ss'               // 24-hour with seconds
}
```

**Storage:**
- Internally stored as JavaScript `Date` objects (date part ignored)
- Input/output: ISO 8601 time format (`HH:mm:ss`)
- Formatting engine: same lightweight formatter as Date. Use tokens above (e.g., `HH:mm`, `HH:mm:ss`, `hh:mm a`).

### DateTime

Combined date and time values. Allowed tokens are the union of Date+Time tokens.

**Presets (format):**

| Preset   | Pattern                          | Note                                  |
| -------- | -------------------------------- | ------------------------------------- |
| iso      | `yyyy-MM-dd'T'HH:mm:ss'Z'`       | Default (ISO 24h)                     |
| iso-24h  | `yyyy-MM-dd'T'HH:mm:ss'Z'`       | Alias of `iso`                        |
| iso-12h  | `yyyy-MM-dd hh:mm a`             | ISO date + 12h                        |
| us       | `MM/dd/yyyy HH:mm`               | US date + 24h                         |
| us-24h   | `MM/dd/yyyy HH:mm`               | Alias of `us`                         |
| us-12h   | `MM/dd/yyyy hh:mm a`             | US date + 12h                         |
| eu       | `dd.MM.yyyy HH:mm`               | EU date + 24h                         |
| eu-24h   | `dd.MM.yyyy HH:mm`               | Alias of `eu`                         |
| eu-12h   | `dd.MM.yyyy hh:mm a`             | EU date + 12h                         |

```typescript
{
  key: 'createdAt',
  header: 'Created At',
  type: 'datetime',
  format?: "yyyy-MM-dd'T'HH:mm:ss'Z'"  // ISO 8601 (default)
  // Other common formats:
  // 'yyyy/MM/dd HH:mm'       // Date and time, no seconds
  // 'MM/dd/yyyy hh:mm a'     // US format with AM/PM
}
```

**Storage:**
- Internally stored as JavaScript `Date` objects
- Input/output: ISO 8601 format (`YYYY-MM-DDTHH:mm:ssZ`)
- Timezone: typically handled as local or UTC; validate with your backend
- Formatting engine: same lightweight formatter; sample defaults `yyyy-MM-dd'T'HH:mm:ss'Z'` or `yyyy/MM/dd HH:mm`.

### Enum

Single-select from a predefined list of options.

```typescript
{
  key: 'department',
  header: 'Department',
  type: 'enum',
  enum: {
    options: ['Engineering', 'Sales', 'Marketing', 'HR']
  }
}
```

**User Interaction:**
- Click cell to open a dropdown select
- Only values in `options` are valid
- Empty cell allowed if `nullable: true`

**Validation:**
- Values not in `options` are flagged as errors
- Case-sensitive matching

### Labeled

A pair of `label` (display text) and `value` (stored value). Useful when you need to display user-friendly names while storing technical identifiers.

```typescript
{
  key: 'assignee',
  header: 'Assignee',
  type: 'labeled',
  edit: {
    lookup: {
      fetchCandidates: async ({ query, rowId, colKey, signal }) => [
        { label: 'Alice Smith', value: 'user_123' },
        { label: 'Bob Jones', value: 'user_456' },
        { label: 'Carol White', value: 'user_789' }
      ]
    }
  }
}
```

**Storage:**
- Internally stored as `{ label: string; value: unknown }`
- Example: `{ label: 'Alice Smith', value: 'user_123' }`
- Display: only the `label` is shown to the user

**User Interaction:**
- Click cell to view and select from candidates
- Displays both label and value in dropdown (label as display)
- User sees the label; value is stored internally

### Tags (Tag List)

Multi-select from a predefined list of tag options.

```typescript
{
  key: 'labels',
  header: 'Labels',
  type: 'tags',
  tags: {
    options: ['urgent', 'review', 'approved', 'archived'],
    allowCustom?: false  // Prevent user-defined tags (recommended)
  }
}
```

**Storage:**
- Internally stored as array of strings: `['urgent', 'approved']`
- Display: comma-separated or as individual tag pills

**User Interaction:**
- Click cell to open multi-select dialog
- Check/uncheck tags
- If `allowCustom: true`, users can add new tags (not recommended for data integrity)

### Button

Interactive action cell. Buttons are **always readonly** and never editable.

```typescript
{
  key: 'action',
  header: 'Action',
  type: 'button',
  style: { align: 'center' }
}
```

**Value shapes:**
- `string` → label (e.g. `"Open"`)
- `{ label: string; command: string; commandfor: string }` → action payload

`command` and `commandfor` must be provided together.

**Behavior:**
- Click or press **Space** on the button to emit a cell action event
- Use `style.disabled` or `conditionalStyle` → `{ disabled: true }` to disable (button only)

### Link

Interactive link cell. Links are **always readonly** and never editable.

```typescript
{
  key: 'docs',
  header: 'Docs',
  type: 'link'
}
```

**Value shapes:**
- `string` → URL (label + href)
- `{ label: string; href: string; target?: string }` → link with label

`target` defaults to `_self`.

**Behavior:**
- Click or press **Space** to navigate
- Use `style.disabled` or `conditionalStyle` → `{ disabled: true }` to disable (link only)

## Shared Properties

### readonly

Prevent user edits. Commonly used for ID columns and computed fields:

```typescript
{
  key: 'employeeId',
  header: 'Employee ID',
  type: 'string',
  // Static boolean or dynamic predicate:
  // - `true` prevents edits for all rows
  // - `(row) => boolean` evaluates per-row to decide readonly state
  readonly: true  // Users cannot edit
}
```

You may supply a predicate function to compute `readonly` per-row. The predicate receives the row object and should return a boolean. Example: make `notes` readonly when a `locked` boolean field is true:

```typescript
{
  key: 'notes',
  header: 'Notes',
  type: 'string',
  readonly: (row) => !!row.locked
}
```

Semantics and runtime notes:
- The predicate is evaluated with the current row object; implementations may cache results keyed by row version to avoid repeated evaluation.
- If a predicate throws an error, implementations SHOULD record a diagnostic/warning and treat the result as `false` (editable) to avoid blocking users.
- Predicates are evaluated at interaction time (editing, focus) and when row data changes; ensure your data updates increment the row version to invalidate caches.

### nullable

Allow empty/null values:

```typescript
{
  key: 'middleName',
  header: 'Middle Name (optional)',
  type: 'string',
  nullable: true  // Empty cell is valid
}
```

### wrapText

Enable text wrapping for long content:

```typescript
{
  key: 'description',
  header: 'Description',
  type: 'string',
  wrapText: true  // Text wraps to multiple lines
}
```

### format

Apply visual formatting to columns. See [Styling Guide](/guides/style) for detailed formatting options and examples:

```typescript
{
  key: 'status',
  header: 'Status',
  type: 'string',
  style: {
    align: 'center',                    // 'left' | 'right' | 'center'
    textColor?: '#d32f2f',
    background?: '#fff3e0'
  }
}
```

### conditionalStyle

Apply dynamic styling based on row data. See [Conditional Style](/guides/conditional-style) for detailed examples:

```typescript
{
  key: 'score',
  header: 'Score',
  type: 'number',
  conditionalStyle: (row) => {
    if (row.score >= 90) return { backgroundColor: '#c8e6c9' };      // Green
    if (row.score < 50) return { backgroundColor: '#ffcdd2' };       // Red
    return null;  // Default styling
  }
}
```

### formula

Define computed columns using JavaScript functions. See [Formulas Guide](/guides/formulas) for detailed examples and error handling:

```typescript
{
  key: 'total',
  header: 'Total',
  type: 'number',
  readonly: true,
  formula: (row) => row.price * row.quantity  // Computed value
}
```

## Edit Hooks

Edit hooks configure how cells are edited. They can be applied to any column type to enable dynamic candidate selection (Lookup) or delegate editing to external interfaces (External Editor).

### Lookup

Enable dynamic candidate selection from asynchronously fetched options. Powers autocomplete, remote API lookups, and multi-user scenarios. Lookup can be applied to **any** column type.

```typescript
{
  key: 'assignee',
  header: 'Assignee',
  type: 'string',  // Lookup works with any type
  edit: {
    lookup: {
      fetchCandidates: async ({ query, rowId, colKey, signal }) => {
        // Fetch from remote API, database, or in-memory list
        const res = await fetch(
          `/api/users?search=${encodeURIComponent(query)}`,
          { signal }
        );
        return res.json();
        // Expected: { label: string; value: unknown; meta?: any }[]
      },
      debounceMs?: 250,           // Delay before fetching (default: 250ms)
      recentLookup?: true,         // Show recently selected items first (default: true)
      allowFreeInput?: false,      // Allow freetext input without matching candidate (default: false)
      toStoredValue?: (candidate) => stored_value  // Transform candidate before storing
    }
  }
}
```

**Options:**

- `fetchCandidates(ctx)` - **Required**. Async function to fetch candidates for the user query.
  - `ctx.query` - Current input text (empty string for initial display)
  - `ctx.rowId`, `ctx.colKey` - Current cell coordinates
  - `ctx.signal` - AbortSignal for cancellation
  - Should return `{ label: string; value: unknown; meta?: any }[]`
  - **Important**: When `query` is empty, return all candidates (for initial dropdown display)

- `debounceMs` - Delay in milliseconds before fetching after user stops typing (default: `250`)
  - Helps prevent excessive API calls during rapid input

- `recentLookup` - Boolean flag (default: `true`)
  - When enabled, the most recently selected candidate for this column is moved to the top of the list and labeled with `[recent]` in the dropdown
  - If the candidate appears multiple times, the most recent is prioritized
  - The `[recent]` label is display-only and does not affect the stored value

- `allowFreeInput` - Boolean flag (default: `false`)
  - When enabled, users can enter values that don't match any candidate
  - Disables auto-commit behavior (candidates narrowed to 1 won't auto-select)
  - Useful for flexible input scenarios (tags, custom values)

- `toStoredValue` - Optional transform function to convert candidate to stored value
  - Receives the selected `LookupCandidate`
  - If not provided, uses default storage format based on column type

**User Interaction:**
- Click cell to open candidates dropdown (in selection mode or inline edit)
- Type to filter candidates (with debounce delay)
- Arrow keys to navigate; Enter to select; Escape to close
- If `allowFreeInput` is enabled:
  - Can press Enter without selecting a candidate to commit free text
  - No auto-commit when narrowed to 1 candidate
- Auto-commits when candidates narrow from multiple to exactly one match

**Auto-commit Logic:**
- If user narrows results to exactly 1 candidate, it is automatically committed
- Useful for fast data entry: user types enough to uniquely identify → auto-commits
- Respects `debounceMs`: waits before checking candidate count

### External Editor

Delegate cell editing to a custom modal, form, or external interface. Useful for complex editing (rich text, multi-field forms, code editor, etc.). Can be applied to any column type.

```typescript
{
  key: 'description',
  header: 'Description',
  type: 'string',
  edit: {
    externalEditor: {
      open: async ({ rowId, colKey, currentValue, signal }) => {
        // Open custom UI (modal, dialog, external window, etc.)
        const newValue = await showCustomEditor({
          title: 'Edit Description',
          initialValue: currentValue,
          signal
        });
        // Return result
        return {
          kind: 'commit',  // or 'cancel'
          value: newValue
        };
      }
    }
  }
}
```

**Behavior:**
- Cell click does **not** open inline editor; instead triggers `open()` function
- Function receives current value and should return `{ kind, value }`
- `kind: 'commit'` → writes `value` to cell
- `kind: 'cancel'` → discards changes, keeps original value
- External UI remains in selection mode; user returns to normal navigation after

**Use Cases:**
- **Rich text editor**: Open WYSIWYG editor (e.g., Quill, TipTap) for HTML content
- **Multi-field form**: Edit a complex object across multiple fields
- **Code editor**: Edit JSON, SQL, or custom code
- **File/image picker**: Upload or select media
- **Custom workflow**: Date picker with additional options, address geocoding, etc.

## Complete Example

```typescript
const schema = {
  columns: [
    // ID column - readonly
    {
      key: 'id',
      header: '#',
      type: 'number',
      readonly: true,
      width: 50
    },
    // Name - required string with wrap
    {
      key: 'name',
      header: 'Employee Name',
      type: 'string',
      nullable: false,
      wrapText: true,
      width: 180
    },
    // Email - with pattern validation
    {
      key: 'email',
      header: 'Email',
      type: 'string',
      string: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      width: 200
    },
    // Department - enum
    {
      key: 'department',
      header: 'Department',
      type: 'enum',
      enum: { options: ['Engineering', 'Sales', 'Marketing', 'HR'] },
      width: 140
    },
    // Salary - formatted number
    {
      key: 'salary',
      header: 'Salary',
      type: 'number',
      format: { scale: 2, thousandSeparator: true, negativeRed: true },
      style: { align: 'right' },
      width: 120
    },
    // Active - boolean checkbox
    {
      key: 'active',
      header: 'Active',
      type: 'boolean',
      format: 'checkbox',
      width: 80
    },
    // Join Date - formatted date
    {
      key: 'joinDate',
      header: 'Join Date',
      type: 'date',
      format: 'yyyy/MM/dd',
      width: 130
    },
    // Skills - tag list
    {
      key: 'skills',
      header: 'Skills',
      type: 'tags',
      tags: { options: ['JavaScript', 'TypeScript', 'React', 'Python', 'SQL'] },
      width: 160
    },
    // Annual Compensation - computed readonly
    {
      key: 'annualComp',
      header: 'Annual Comp',
      type: 'number',
      readonly: true,
      format: { scale: 0, thousandSeparator: true },
      style: { align: 'right' },
      formula: (row) => row.salary * 1.25,  // Salary + 25% benefits
      width: 140
    },
    // Notes - plain column
    {
      key: 'notes',
      header: 'Notes',
      type: 'string',
      wrapText: true,
      nullable: true,
      width: 220
    }
  ]
};
```

## Validation and Error Handling

When data doesn't match schema constraints, Extable displays error indicators:

- **Red cell outline**: Invalid data (wrong type, failed regex, enum mismatch)
- **Warning icon**: Non-critical issue (formula error with fallback value)
- **Error icon**: Critical issue (formula threw error)

Example error cases:
- Number column receives `'abc'` → error
- String with `pattern: /^\d+$/` receives `'abc'` → error
- Enum column receives value not in `options` list → error
- Formula throws `new Error()` → shows warning/error state

## Next Steps

- Learn [styling and conditional formatting](/guides/style) for column formatting and dynamic styles
- Explore [formulas and computed columns](/guides/formulas) for advanced calculations
- Understand [edit modes and readonly columns](/guides/editmode)
- Explore [data, schema, and view separation](/concepts/data-schema-view)
