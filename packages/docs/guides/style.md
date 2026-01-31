# Styling Guide

Extable provides multiple levels of styling control: column-level formatting defined in your schema, dynamic conditional formatting based on row data, and base UI styling through the core CSS.

## Base UI Styling

The core library includes `@extable/core/styles.css` with default theming for:

- Table borders and grid lines
- Header styling (background, font weight, alignment)
- Cell backgrounds (normal, selected, editing states)
- Text colors and typography
- Input field styling during cell editing
- Scrollbar and resize handle styling

Import the CSS in your application:

```typescript
import '@extable/core/styles.css';
```

Override CSS variables to customize the theme:

```css
:root {
  --extable-header-bg: #f5f5f5;
  --extable-header-text: #333;
  --extable-border-color: #e0e0e0;
  --extable-cell-selected-bg: #e3f2fd;
  --extable-cell-edited-bg: #fff9c4;
  --extable-error-outline: #d32f2f;
}
```

## Column-Level Formatting

Define static formatting in your schema using the `format` property:

```typescript
{
  key: 'salary',
  header: 'Annual Salary',
  type: 'number',
  style: {
    align: 'right',                    // 'left' | 'center' | 'right'
    textColor: '#1976d2',              // Hex color
    backgroundColor: '#e3f2fd',             // Hex background color
    bold: true,                        // Text weight
    italic: false,                     // Italic style
    decorations: {
      underline: false,
      strikethrough: false
    }
  }
}
```

### Format Properties

| Property | Type | Options | Purpose |
|----------|------|---------|---------|
| `align` | string | 'left' \| 'center' \| 'right' | Horizontal text alignment |
| `textColor` | string | Hex color (#RRGGBB) | Font color |
| `backgroundColor` | string | Hex color (#RRGGBB) | Cell background color |
| `bold` | boolean | true \| false | Bold text weight |
| `italic` | boolean | true \| false | Italic style |
| `decorations.underline` | boolean | true \| false | Underline text |
| `decorations.strikethrough` | boolean | true \| false | Strikethrough text |

### Examples

Right-aligned monetary values with thousand separators:

```typescript
{
  key: 'revenue',
  header: 'Revenue',
  type: 'number',
  format: { scale: 2, thousandSeparator: true },
  style: { align: 'right', textColor: '#2e7d32' }  // Green
}
```

Center-aligned status badges with backgroundColor:

```typescript
{
  key: 'status',
  header: 'Status',
  type: 'enum',
  enum: ['Active', 'Inactive', 'Pending'],
  style: {
    align: 'center',
    backgroundColor: '#f0f4c3',
    bold: true
  }
}
```

Readonly ID column with lighter styling:

```typescript
{
  key: 'id',
  header: 'ID',
  type: 'number',
  readonly: true,
  style: {
    align: 'center',
    textColor: '#999',
    italic: true
  }
}
```

## Conditional Formatting

Apply dynamic styling to cells based on row data. See [Conditional Style Guide](/guides/conditional-style) for comprehensive examples and performance optimization tips.

```typescript
{
  key: 'score',
  header: 'Score',
  type: 'number',
  conditionalStyle: (row) => {
    if (row.score >= 90) return { backgroundColor: '#c8e6c9', bold: true };
    if (row.score < 50) return { backgroundColor: '#ffcdd2' };
    return null;
  }
}
```

## Performance Considerations

- Column-level `format` is static and applied once during column setup
- `conditionalStyle` functions execute once per visible row on render
- Keep conditional functions fast; avoid expensive computations

## Row-Level Styling

Apply styling to an entire row using the dedicated `row` slot in your schema:

```typescript
{
  row: {
    conditionalStyle: (row) => {
      if (row.status === 'archived') return { backgroundColor: '#f5f5f5', italic: true };
      if (row.isSelected) return { backgroundColor: '#e3f2fd', bold: true };
      return null;
    }
  },
  columns: [
    // Regular columns...
    { key: 'id', header: '#', type: 'number' },
    { key: 'name', header: 'Name', type: 'string' }
  ]
}
```

**Key Points:**
- `schema.row` holds row-level styling logic (not a rendered column)
- The `conditionalStyle` function receives the full row object
- Returned styles apply to all cells in that row simultaneously
- Overrides column-level `conditionalStyle` if both are defined

See [Conditional Style Guide](/guides/conditional-style#row-level-conditional-formatting) for row-level styling examples.

## Row-Level Readonly

Mark entire rows as read-only using the `_readonly` property in your data:

```typescript
const data = {
  rows: [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com', _readonly: true },  // Entire row readonly
    { id: 3, name: 'Charlie', email: 'charlie@example.com' }
  ]
};
```

**Behavior:**
- All cells in a `_readonly: true` row cannot be edited
- Clicking cells in readonly rows selects them but doesn't open edit mode
- Column-level `readonly` applies independently (readonly column is readonly regardless of row flag)

### Use Cases

**Locked Historical Records:**

```typescript
const data = {
  rows: [
    { id: 1, date: '2025-01-01', amount: 1000, _readonly: false },    // Editable
    { id: 2, date: '2024-12-01', amount: 5000, _readonly: true },     // Locked (past month)
    { id: 3, date: '2024-11-01', amount: 3000, _readonly: true }      // Locked (past month)
  ]
};
```

**Mixed Permissions by Role:**

```typescript
const data = {
  rows: userRecords.map(user => ({
    ...user,
    _readonly: currentUser.role !== 'admin'  // Only admins can edit
  }))
};
```

**Combine with Row-Level Styling:**

```typescript
{
  row: {
    conditionalStyle: (row) => {
      if (row._readonly) {
        return { backgroundColor: '#f5f5f5', textColor: '#999' };  // Visual cue
      }
      return null;
    }
  },
  columns: [
    // ... other columns
  ]
}
```

## Styling Priority Order

Extable applies styles in this order (highest priority last):

1. **Base UI CSS** (`styles.css` defaults)
2. **Column-level format** (applied to all cells in column)
3. **Row-level conditionalStyle** (`schema.row`)
4. **Cell-level conditionalStyle** (individual column conditionalStyle)
5. **Cell state** (selection highlight, edit mode background)
6. **Error state** (red outline for invalid values)

## Accessibility Notes

- Use color + additional visual indicators (bold, strikethrough, icons)
- Don't rely on color alone to convey meaning
- Ensure text color contrasts meet WCAG AA standards (#fff vs #999 may be insufficient)
- Test styling with screen readers to ensure semantic meaning is preserved

## Next Steps

- Learn [conditional style](/guides/conditional-style) for dynamic cell and row styling
- Explore [data types and formatting](/guides/data-format)
- Understand [formulas for computed values](/guides/formulas)


