# Formulas Guide

Formulas allow you to define computed columns that automatically calculate values based on other cells in the row. Unlike spreadsheet formulas (which are text expressions), Extable formulas are JavaScript functions evaluated at render time.

## Basic Concepts

### Formula vs Spreadsheet Formulas

**Extable Formulas:**
- JavaScript functions defined by developers
- Evaluated per-row on each render
- Type-safe with TypeScript support
- Can access entire row data
- Errors are displayable warnings, not breaking

**Spreadsheet Formulas (Excel, Sheets):**
- Text expressions (e.g., `=A1*B1`)
- User-editable formula input
- Cell references change when columns move
- Not suitable for Extable's fixed schema model

### Formula Definition

Add a `formula` property to any column in your schema:

```typescript
{
  key: 'total',
  header: 'Total',
  type: 'number',
  readonly: true,  // Usually readonly - computed by formula
  formula: (row) => row.price * row.quantity
}
```

**Properties:**
- `readonly: true`: Usually set to prevent user edits of computed values
- `formula`: Function receiving `row` object, returns value or error tuple

## Return Types

### Simple Value Return

Return the computed value directly:

```typescript
formula: (row) => row.price * row.quantity
```

### Value with Error/Warning

Return a tuple `[value, Error]` to display both computed value and an error state:

```typescript
formula: (row) => {
  if (row.quantity <= 0) {
    return [0, new Error('Quantity must be positive')] as const;
  }
  return row.price * row.quantity;
}
```

The value displays normally, but Extable shows a warning icon indicating validation issues.

### Error State

Throw an error or return an Error to show error state (no value displayed):

```typescript
formula: (row) => {
  if (!row.price || !row.quantity) {
    throw new Error('Missing price or quantity');
  }
  return row.price * row.quantity;
}
```

## Use Cases

### Basic Arithmetic

Calculate totals, subtotals, or per-unit costs:

```typescript
{
  key: 'lineTotal',
  header: 'Line Total',
  type: 'number',
  readonly: true,
  number: { scale: 2, thousandSeparator: true },
  style: { align: 'right' },
  formula: (row) => row.unitPrice * row.quantity
}
```

### Conditional Calculations

Apply different logic based on row state:

```typescript
{
  key: 'discount',
  header: 'Discount Amount',
  type: 'number',
  readonly: true,
  number: { scale: 2 },
  formula: (row) => {
    if (row.customerType === 'VIP') {
      return row.subtotal * 0.20;  // 20% discount for VIP
    }
    if (row.quantity >= 100) {
      return row.subtotal * 0.10;  // 10% for bulk orders
    }
    return 0;
  }
}
```

### String Concatenation

Combine multiple fields into a display value:

```typescript
{
  key: 'fullName',
  header: 'Full Name',
  type: 'string',
  readonly: true,
  formula: (row) => `${row.firstName} ${row.lastName}`.trim()
}
```

### Boolean Derivation

Compute boolean states from other columns:

```typescript
{
  key: 'isOverdue',
  header: 'Overdue?',
  type: 'boolean',
  readonly: true,
  booleanDisplay: 'checkbox',
  formula: (row) => {
    const dueDate = new Date(row.dueDate);
    return dueDate < new Date();
  }
}
```

### Formatted Date/Time Output

Display formatted dates based on row conditions:

```typescript
{
  key: 'formattedDeadline',
  header: 'Deadline',
  type: 'string',
  readonly: true,
  formula: (row) => {
    const date = new Date(row.deadline);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  }
}
```

### Status Derivation with Validation

Compute status from multiple conditions with error checking:

```typescript
{
  key: 'fulfillmentStatus',
  header: 'Status',
  type: 'enum',
  readonly: true,
  enum: { options: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Error'] },
  formula: (row) => {
    if (!row.orderId) {
      return ['Error', new Error('Missing order ID')] as const;
    }
    if (row.shipped && row.delivered) return 'Delivered';
    if (row.shipped) return 'Shipped';
    if (row.packed) return 'Processing';
    return 'Pending';
  }
}
```

### Multi-Row Context (Custom Calculations)

Access all row properties to perform complex calculations:

```typescript
{
  key: 'percentage',
  header: '% of Total',
  type: 'number',
  readonly: true,
  number: { scale: 1 },
  formula: (row) => {
    // Note: To calculate percentage of total across all rows,
    // pre-compute the sum in your data layer and pass it as a derived property
    if (row.grandTotal === 0) {
      return [0, new Error('Division by zero')] as const;
    }
    return (row.amount / row.grandTotal) * 100;
  }
}
```

## Error Handling and Display

Formulas support three error handling patterns, each with distinct visual indicators:

### 1. Value + Warning (Yellow Indicator)

Return a tuple `[value, Error]` to display both a computed value and a warning:

```typescript
{
  key: 'discount',
  header: 'Discount Amount',
  type: 'number',
  readonly: true,
  formula: (row) => {
    if (row.discount > row.subtotal) {
      // Display the subtotal but mark as warning
      return [row.subtotal, new Error('Discount exceeds subtotal')] as const;
    }
    return row.subtotal - row.discount;
  }
}
```

**Visual Result:**
- Cell displays computed value (e.g., `1000`)
- Yellow triangle appears in top-right corner
- Hover shows warning message: "Discount exceeds subtotal"
- Useful for non-blocking validation issues

### 2. Error State (Red Indicator)

Throw an error to display an error state without a value:

```typescript
{
  key: 'total',
  header: 'Total',
  type: 'number',
  readonly: true,
  formula: (row) => {
    if (!row.vendorId) {
      throw new Error('Vendor not assigned');
    }
    return calculateCost(row.vendorId);
  }
}
```

**Visual Result:**
- Cell displays `#ERROR` text
- Red triangle appears in top-right corner
- Hover shows error message: "Vendor not assigned"
- Useful for critical validation failures

### 3. Normal Return (No Indicator)

Return a value directly for normal operation:

```typescript
{
  key: 'total',
  header: 'Total',
  type: 'number',
  readonly: true,
  formula: (row) => row.price * row.quantity
}
```

**Visual Result:**
- Cell displays computed value
- No error indicator
- Normal styling applied

### Error Comparison Table

| Pattern | Code | Display | Indicator | Use Case |
|---------|------|---------|-----------|----------|
| **Normal** | `return value` | Value | None | Standard calculation |
| **Warning** | `return [value, Error]` | Value | Yellow triangle | Non-blocking validation |
| **Error** | `throw Error` | `#ERROR` | Red triangle | Critical failure |

### Complete Error Handling Example

```typescript
{
  key: 'netPrice',
  header: 'Net Price',
  type: 'number',
  readonly: true,
  number: { scale: 2, thousandSeparator: true },
  formula: (row) => {
    // Critical validation - must throw
    if (!row.basePrice || !row.quantity) {
      throw new Error('Missing basePrice or quantity');
    }

    // Non-critical validation - return warning + value
    if (row.discountPercent > 100) {
      const netPrice = row.basePrice * row.quantity;
      return [netPrice, new Error('Discount exceeds 100%')] as const;
    }

    if (row.discountPercent < 0) {
      const netPrice = row.basePrice * row.quantity;
      return [netPrice, new Error('Discount cannot be negative')] as const;
    }

    // Normal calculation
    const subtotal = row.basePrice * row.quantity;
    const discount = (row.discountPercent / 100) * subtotal;
    return subtotal - discount;
  }
}
```

### Error Message Best Practices

- **Be specific:** "Discount exceeds 100%" is better than "Invalid discount"
- **Include context:** "Missing unitPrice for row 5" vs "Missing price"
- **Suggest fixes:** "Date must be after 2024-01-01" vs "Invalid date"
- **Keep brief:** Users read on hover; keep messages under 100 characters

### Catching Errors with Try-Catch

Explicitly catch and handle errors:

```typescript
{
  key: 'calculated',
  header: 'Calculated Value',
  type: 'number',
  readonly: true,
  formula: (row) => {
    try {
      const result = expensiveCalculation(row.data);
      if (result < 0) {
        return [result, new Error('Unexpected negative value')] as const;
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Calculation failed: ${message}`);
    }
  }
}
```

### Error Visibility Options

Errors are visible when:
- **diagErrors: true** in table options (shows error indicators by default)
- **diagWarnings: true** in table options (shows warning indicators by default)

Both can be toggled on/off during table initialization to control error visibility UI-wide.

## Performance Considerations

### Formula Execution Timing

- Formulas execute **once per visible row on each render**
- Triggered by:
  - Initial data load
  - Data changes (edit, paste, undo/redo)
  - Column resizing or scrolling (may cause re-render)
  - View changes (filtering, sorting)

### Best Practices

**DO:**
- Use simple, fast operations (arithmetic, string manipulation, conditionals)
- Access only fields in the current `row` object
- Cache expensive lookups in your data layer (e.g., pre-compute totals server-side)
- Return consistent types (always return number for number columns)

**DON'T:**
- Make API calls inside formulas
- Perform heavy computations (parsing, regex on large strings)
- Access global state or external data structures
- Mutate the `row` object or other state

### Example: Pre-Computed Aggregates

Instead of calculating sum across rows inside each formula:

```typescript
// ❌ Inefficient - recalculates on every row
formula: (row) => {
  const sum = this.data.reduce((a, b) => a + b.amount, 0);
  return row.amount / sum * 100;
}

// ✅ Efficient - pre-computed
const data = rows.map(r => ({
  ...r,
  grandTotal: rows.reduce((a, b) => a + b.amount, 0)
}));

// Then in schema:
formula: (row) => row.amount / row.grandTotal * 100
```

## Type Safety

When using TypeScript, define your data shape for better IDE support:

```typescript
interface OrderRow {
  id: number;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
}

const schema = {
  columns: [
    {
      key: 'total',
      header: 'Total',
      type: 'number',
      readonly: true,
      formula: (row: OrderRow) => {
        const subtotal = row.quantity * row.unitPrice;
        const afterDiscount = subtotal * (1 - row.discountPercent / 100);
        return afterDiscount * (1 + row.taxRate / 100);
      }
    }
  ]
};
```

## Complex Example

A complete invoice row with multiple calculated fields:

```typescript
{
  key: 'lineItems',
  header: 'Line Items',
  columns: [
    {
      key: 'sku',
      header: 'SKU',
      type: 'string',
      readonly: true
    },
    {
      key: 'quantity',
      header: 'Qty',
      type: 'number',
      number: { precision: 10, scale: 2 }
    },
    {
      key: 'unitPrice',
      header: 'Unit Price',
      type: 'number',
      number: { scale: 2 }
    },
    {
      key: 'subtotal',
      header: 'Subtotal',
      type: 'number',
      readonly: true,
      number: { scale: 2 },
      style: { align: 'right' },
      formula: (row) => row.quantity * row.unitPrice
    },
    {
      key: 'discountAmount',
      header: 'Discount',
      type: 'number',
      readonly: true,
      number: { scale: 2 },
      formula: (row) => {
        if (!row.subtotal) return 0;
        const discountRate = row.discountPercent ? row.discountPercent / 100 : 0;
        return row.subtotal * discountRate;
      }
    },
    {
      key: 'taxableAmount',
      header: 'Taxable Amount',
      type: 'number',
      readonly: true,
      number: { scale: 2 },
      formula: (row) => (row.subtotal || 0) - (row.discountAmount || 0)
    },
    {
      key: 'tax',
      header: 'Tax',
      type: 'number',
      readonly: true,
      number: { scale: 2 },
      formula: (row) => {
        const taxableAmount = (row.subtotal || 0) - (row.discountAmount || 0);
        const taxRate = row.taxRate ? row.taxRate / 100 : 0;
        return taxableAmount * taxRate;
      }
    },
    {
      key: 'total',
      header: 'Total',
      type: 'number',
      readonly: true,
      number: { scale: 2, thousandSeparator: true },
      style: { align: 'right', bold: true },
      formula: (row) => {
        const subtotal = row.subtotal || 0;
        const discount = row.discountAmount || 0;
        const tax = row.tax || 0;
        return subtotal - discount + tax;
      }
    }
  ]
}
```

## Next Steps

- Learn [data format and types](/guides/data-format) for column definitions
- Explore [conditional style](/guides/conditional-style) to highlight formula results
- Understand [edit modes and readonly columns](/guides/editmode) for protecting computed data
