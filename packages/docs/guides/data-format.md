# Data Format Guide

Extable supports a variety of data types, each with specific validation rules, style options, and display behaviors. This guide covers schema column definition and how to work with each type.

## Column Definition Structure

Every column in your schema requires:

```typescript
{
  key: 'columnName',           // Unique identifier for this column
  header: 'Display Label',     // User-visible header text
  type: 'string' | 'number' | 'boolean' | 'date' | 'time' | 'datetime' | 'enum' | 'tags',
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

Numeric values with optional precision, scale, and sign constraints.

```typescript
{
  key: 'salary',
  header: 'Annual Salary',
  type: 'number',
  number: {
    precision?: 10,           // Total significant digits
    scale?: 2,                // Decimal places
    min?: 0,                  // Minimum value
    max?: 999999999,          // Maximum value
    thousandSeparator?: true, // Show comma separators (1,234.56)
    negativeRed?: true        // Red color for negative values
  },
  style: { align: 'right' }  // Right-align numbers
}
```

**Display Examples:**
- `1234` with `thousandSeparator: true` → `1,234`
- `-50` with `negativeRed: true` → red text color
- `123.456` with `scale: 2` → `123.46` (rounded)

### Boolean

True/false values with customizable display format.

```typescript
{
  key: 'active',
  header: 'Active Status',
  type: 'boolean',
  // Display variants:
  booleanDisplay: 'checkbox'           // ☑️ / ☐
  // OR
  booleanDisplay: ['TRUE', 'FALSE']    // Text display
  // OR
  booleanDisplay: ['Yes', 'No']        // Localized text
  // OR
  booleanDisplay: ['真', '偽']         // Non-English
}
```

**User Interaction:**
- Checkbox mode: Click to toggle, Space bar to toggle
- Text mode: Click cell to toggle

### Date

Calendar dates without time component.

```typescript
{
  key: 'joinDate',
  header: 'Join Date',
  type: 'date',
  dateFormat?: 'yyyy-MM-dd'  // ISO standard (default)
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

### Time

Time-of-day values without date component.

```typescript
{
  key: 'startTime',
  header: 'Start Time',
  type: 'time',
  timeFormat?: 'HH:mm:ss'    // 24-hour with seconds (default)
  // Other common formats:
  // 'HH:mm'                  // 24-hour without seconds
  // 'hh:mm a'                // 12-hour with AM/PM
  // 'HH:mm:ss'               // 24-hour with seconds
}
```

**Storage:**
- Internally stored as JavaScript `Date` objects (date part ignored)
- Input/output: ISO 8601 time format (`HH:mm:ss`)

### DateTime

Combined date and time values.

```typescript
{
  key: 'createdAt',
  header: 'Created At',
  type: 'datetime',
  dateTimeFormat?: "yyyy-MM-dd'T'HH:mm:ss'Z'"  // ISO 8601 (default)
  // Other common formats:
  // 'yyyy/MM/dd HH:mm'       // Date and time, no seconds
  // 'MM/dd/yyyy hh:mm a'     // US format with AM/PM
}
```

**Storage:**
- Internally stored as JavaScript `Date` objects
- Input/output: ISO 8601 format (`YYYY-MM-DDTHH:mm:ssZ`)
- Timezone: typically handled as local or UTC; validate with your backend

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

## Shared Properties

### readonly

Prevent user edits. Commonly used for ID columns and computed fields:

```typescript
{
  key: 'employeeId',
  header: 'Employee ID',
  type: 'string',
  readonly: true  // Users cannot edit
}
```

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
      number: { scale: 2, thousandSeparator: true, negativeRed: true },
      style: { align: 'right' },
      width: 120
    },
    // Active - boolean checkbox
    {
      key: 'active',
      header: 'Active',
      type: 'boolean',
      booleanDisplay: 'checkbox',
      width: 80
    },
    // Join Date - formatted date
    {
      key: 'joinDate',
      header: 'Join Date',
      type: 'date',
      dateFormat: 'yyyy/MM/dd',
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
      number: { scale: 0, thousandSeparator: true },
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
