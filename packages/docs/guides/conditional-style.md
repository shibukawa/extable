# Conditional Formatting Guide

Conditional formatting allows you to apply dynamic styling to cells based on their values or the state of the entire row. Unlike static column-level formatting, conditional formatting evaluates functions at render time to determine styles.

## Cell-Level Conditional Formatting

Apply dynamic styling to individual cells using the `conditionalStyle` function in your column definition:

```typescript
{
  key: 'score',
  header: 'Score',
  type: 'number',
  conditionalStyle: (row) => {
    if (row.score >= 90) {
      return { backgroundColor: '#c8e6c9', bold: true };     // Green + bold
    }
    if (row.score < 50) {
      return { backgroundColor: '#ffcdd2', textColor: '#c62828' };  // Red
    }
    if (row.score < 70) {
      return { backgroundColor: '#ffe0b2' };                 // Orange
    }
    return null;  // Default styling
  }
}
```

### conditionalStyle Contract

- **Input:** `row` object containing all cell values for the current row
- **Return:** `StyleObject | null`
  - `StyleObject`: Apply this styling (same properties as static `format`)
  - `null`: Use default column formatting

## Row-Level Conditional Formatting

Apply styling to an entire row via the schema `row` slot. See [Row-Level Styling](/guides/style#row-level-styling) for details.

```typescript
{
  row: {
    conditionalStyle: (row) => {
      if (row.status === 'archived') return { backgroundColor: '#f5f5f5', italic: true };
      if (row.status === 'active') return { backgroundColor: '#e8f5e9' };
      return null;
    }
  }
}
```

## Use Cases

### Performance Status Dashboard

Color-code by availability thresholds:

```typescript
{
  key: 'uptime',
  header: 'Uptime %',
  type: 'number',
  format: { scale: 2 },
  conditionalStyle: (row) => {
    if (row.uptime >= 99.9) return { backgroundColor: '#c8e6c9', bold: true };
    if (row.uptime >= 99) return { backgroundColor: '#e8f5e9' };
    if (row.uptime >= 95) return { backgroundColor: '#fff9c4' };
    return { backgroundColor: '#ffccbc', textColor: '#d84315' };
  }
}
```

### Risk-Based Highlighting

Map enumerated risk levels to color schemes:

```typescript
{
  key: 'riskLevel',
  header: 'Risk Level',
  type: 'enum',
  enum: ['Low', 'Medium', 'High', 'Critical'],
  conditionalStyle: (row) => {
    const colors = {
      'Low': '#c8e6c9',
      'Medium': '#fff9c4',
      'High': '#ffe0b2',
      'Critical': '#ffcdd2'
    };
    return { backgroundColor: colors[row.riskLevel] || null };
  }
}
```

### Multi-Column Conditional Logic

Highlight based on relationships between multiple columns:

```typescript
{
  key: 'variance',
  header: 'Budget Variance',
  type: 'number',
  format: { scale: 2 },
  conditionalStyle: (row) => {
    const diff = row.actual - row.budgeted;
    const percentVariance = (diff / row.budgeted) * 100;
    
    if (percentVariance > 10) {
      return { backgroundColor: '#ffcdd2', textColor: '#c62828', bold: true };
    }
    if (percentVariance < -10) {
      return { backgroundColor: '#c8e6c9' };
    }
    return null;
  }
}
```

### Time-Based Urgency

Highlight approaching deadlines:

```typescript
{
  key: 'dueDate',
  header: 'Due Date',
  type: 'date',
  conditionalStyle: (row) => {
    const today = new Date();
    const dueDate = new Date(row.dueDate);
    const daysUntilDue = (dueDate - today) / (1000 * 60 * 60 * 24);
    
    if (daysUntilDue < 0) return { backgroundColor: '#ffcdd2', textColor: '#c62828' };  // Overdue
    if (daysUntilDue < 3) return { backgroundColor: '#ffe0b2' };                         // Urgent
    if (daysUntilDue < 7) return { backgroundColor: '#fff9c4' };                         // Soon
    return null;
  }
}
```

### Data Quality Validation

Highlight missing or invalid data:

```typescript
{
  key: 'email',
  header: 'Email',
  type: 'string',
  conditionalStyle: (row) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!row.email || !emailRegex.test(row.email)) {
      return { backgroundColor: '#ffcdd2', textColor: '#c62828', bold: true };
    }
    return null;
  }
}
```

### Status-Based Row Highlighting

Use `schema.row` to highlight entire rows by status:

```typescript
{
  row: {
    conditionalStyle: (row) => {
      if (row.status === 'pending') return { backgroundColor: '#fff9c4' };      // Yellow
      if (row.status === 'approved') return { backgroundColor: '#c8e6c9' };     // Green
      if (row.status === 'rejected') return { backgroundColor: '#ffcdd2' };     // Red
      return null;
    }
  }
}
```

### Alternating Row Colors (Striping)

Improve readability with zebra striping:

```typescript
{
  row: {
    conditionalStyle: (row) => (row.id % 2 === 0 ? { backgroundColor: '#fafafa' } : null)
  }
}
```

## Performance Considerations

### Execution Model

- `conditionalStyle` functions execute **once per visible row on each render**
- Called for:
  - Initial data load and view render
  - Data changes (edit, paste, undo/redo)
  - Column resizing or scrolling (may trigger re-render)
  - View changes (filtering, sorting)

### Optimization Best Practices

**DO:**
- Use simple conditionals and comparisons
- Compute derived values in your data layer (before passing to Extable)
- Cache lookup tables if needed (`const statusColors = { ... }`)
- Return `null` for default styling (skip unnecessary object creation)

**DON'T:**
- Perform expensive calculations inside the function
- Make API calls or database queries
- Access global state or external data
- Create new object instances on every call
- Use regex patterns that compile on each execution

### Example: Optimized Pattern

```typescript
// ❌ Inefficient - recompiles regex on every render
conditionalStyle: (row) => {
  if (!new RegExp(row.pattern).test(row.value)) {
    return { backgroundColor: '#ffcdd2' };
  }
  return null;
}

// ✅ Efficient - pre-compiled pattern
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// ... in column definition:
conditionalStyle: (row) => {
  if (!emailRegex.test(row.email)) {
    return { backgroundColor: '#ffcdd2' };
  }
  return null;
}
```

## Styling Priority

When multiple styling sources apply to a cell, Extable follows this priority (highest wins):

1. **Base UI CSS** (`styles.css` defaults)
2. **Column-level format** (static `format` property)
3. **Row-level conditionalStyle** (`schema.row`)
4. **Cell-level conditionalStyle** (column's `conditionalStyle` function)
5. **Cell state** (selection highlight, edit mode background)
6. **Error state** (red outline for invalid values)

## Styling Options

All style properties available in `conditionalStyle` return values:

| Property | Type | Example |
|----------|------|---------|
| `textColor` | string (hex) | `'#d32f2f'` |
| `background` | string (hex) | `'#c8e6c9'` |
| `bold` | boolean | `true` |
| `italic` | boolean | `false` |
| `align` | string | `'center'` \| `'left'` \| `'right'` |
| `decorations.underline` | boolean | `true` |
| `decorations.strikethrough` | boolean | `false` |

## Error Handling

### Returning Error Objects

Handle errors in conditional formatting by returning an `Error` object:

```typescript
{
  key: 'email',
  header: 'Email',
  type: 'string',
  conditionalStyle: (row) => {
    // Return an Error to mark the cell with a validation warning
    if (!row.email || !row.email.includes('@')) {
      return new Error('Invalid email format');
    }
    return null;
  }
}
```

### Throwing Errors

Alternatively, throw an error from the function:

```typescript
{
  key: 'age',
  header: 'Age',
  type: 'number',
  conditionalStyle: (row) => {
    if (row.age < 0) {
      throw new Error('Age cannot be negative');
    }
    if (row.age > 150) {
      throw new Error('Age seems unrealistic');
    }
    return null;
  }
}
```

### Visual Indicators

When errors occur, Extable displays visual indicators in the top-right corner of the cell:

- **Returned Error object**: Yellow triangle indicator
  - Message is shown on hover
  - Formula or conditional style can complete but signals a warning
  
- **Thrown Error / Exception**: Red triangle indicator
  - Critical error that prevented styling evaluation
  - Message shown on hover

### Error Display Examples

```typescript
{
  key: 'discount',
  header: 'Discount %',
  type: 'number',
  conditionalStyle: (row) => {
    // Yellow warning - discount exceeds maximum
    if (row.discount > 50) {
      return new Error('Discount exceeds 50% limit');
    }
    
    // Red error - missing required field
    if (!row.originalPrice) {
      throw new Error('Missing original price for calculation');
    }
    
    // Normal styling
    if (row.discount > 30) return { backgroundColor: '#fff9c4' };
    if (row.discount > 10) return { backgroundColor: '#ffe0b2' };
    return null;
  }
}
```

## Accessibility Notes

- **Don't rely on color alone** to convey meaning; use additional visual indicators
- **Contrast:** Ensure text color meets WCAG AA standards against background
- **Icon + color:** Combine semantic icons with color for clarity
- **Test:** Verify styling with screen readers and accessibility tools

## Next Steps

- Learn [static column formatting](/guides/style) for `format` property
- Explore [data types and validation](/guides/data-format)
- Understand [formulas for computed values](/guides/formulas)
