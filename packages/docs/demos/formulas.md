# Formulas

Learn how to use formulas to compute derived values from other cells.

## Interactive Demo

This demo shows tables with computed formula columns.

<ClientOnly>
  <FormulasDemo />
</ClientOnly>

::: info Demo UI Note
This demo includes **Search**, **Undo**, and **Redo** buttons above the table. In a real application, these operations are typically triggered via keyboard shortcuts (Ctrl/Cmd+F for Search, Ctrl/Cmd+Z for Undo, Ctrl/Cmd+Shift+Z for Redo). The buttons are provided here as an alternative way to interact with the demo without keyboard shortcuts.
:::

## What You're Seeing

✅ **Computed Values** - Formulas calculate from other columns  
✅ **Read-Only Results** - Formula results cannot be edited  
✅ **Dynamic Updates** - Formulas recalculate when dependencies change  
✅ **Multiple Formulas** - Multiple formula columns in one table

## Schema Definition

The demo above uses the following schema to define formulas:

```typescript
import { defineSchema } from "@extable/core";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  total: number;
}

const tableSchema = defineSchema<InvoiceItem>({
  columns: [
    { key: "id", header: "Item ID", type: "string", readonly: true, width: 100 },
    { key: "description", header: "Description", type: "string", width: 180 },
    {
      key: "quantity",
      header: "Qty",
      type: "number",
      number: { precision: 6, scale: 0 },
      width: 80,
      style: { align: "center" },
    },
    {
      key: "unitPrice",
      header: "Unit Price ($)",
      type: "number",
      number: { precision: 8, scale: 2 },
      width: 130,
      style: { align: "right" },
    },
    {
      key: "discountPercent",
      header: "Discount (%)",
      type: "number",
      number: { precision: 5, scale: 1 },
      width: 120,
      style: { align: "center" },
    },
    {
      key: "total",
      header: "Total ($)",
      type: "number",
      number: { precision: 10, scale: 2 },
      readonly: true,
      formula: (row) => row.quantity * row.unitPrice * (1 - row.discountPercent / 100),
      width: 130,
      style: { align: "right", backgroundColor: "#f0fdf4" },
    },
  ],
});
```

## How Formulas Work

Formulas are JavaScript functions that compute values based on other cells in the row. The function receives a `row` object containing all column values and returns the computed result.

### Basic Formula

```typescript
const schema = defineSchema<MyRow>({
  columns: [
    {
      key: "total",
      header: "Total",
      type: "number",
      readonly: true,
      formula: (row) => row.quantity * row.unitPrice,  // row is strongly typed!
    },
  ],
});
```

### Dependent Formulas

**Important Constraint:** Formulas cannot reference other formula columns. This prevents circular dependencies and infinite loops. Each formula must compute directly from editable (non-formula) columns:

```typescript
// ❌ Not allowed - references another formula column
{
  key: "tax",
  header: "Tax",
  type: "number",
  readonly: true,
  formula: (row) => row.total * 0.1,  // Error: 'total' is a formula column
}

// ✅ Allowed - references only editable columns
{
  key: "total",
  header: "Total",
  type: "number",
  readonly: true,
  formula: (row) => row.quantity * row.unitPrice * (1 - row.discountPercent / 100),
}
```

### Formula Features

- **JavaScript Functions** - Define formulas as arrow functions receiving the `row` object
- **Read-Only Output** - Formula results are automatically marked as readonly
- **Dynamic Recalculation** - Updates whenever referenced cells change
- **Type-Safe** - Access row properties with full TypeScript support
- **Error Handling** - Return tuple `[value, Error]` to show warnings or throw for critical errors

## Use Cases

- **Totals** - Multiply or sum editable columns: `(row) => row.quantity * row.unitPrice`
- **Percentages** - Calculate percentages: `(row) => row.amount / row.subtotal * 100`
- **Discounts** - Apply discounts: `(row) => row.subtotal * (1 - row.discountPercent / 100)`
- **Unit Conversion** - Convert between units: `(row) => row.priceFt * row.lengthFt`
- **Metrics** - Display derived metrics and calculations
- **Validation** - Return error states: `(row) => row.value < 0 ? [0, new Error('Must be positive')] : row.value`
