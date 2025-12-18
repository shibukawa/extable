# Style

Learn how to style cell values with currency, numbers, dates, and custom styling.

## Interactive Demo

This demo shows various column style options.

<ClientOnly>
  <StyleDemo />
</ClientOnly>

::: info Demo UI Note
This demo includes **Search**, **Undo**, and **Redo** buttons above the table. In a real application, these operations are typically triggered via keyboard shortcuts (Ctrl/Cmd+F for Search, Ctrl/Cmd+Z for Undo, Ctrl/Cmd+Shift+Z for Redo). The buttons are provided here as an alternative way to interact with the demo without keyboard shortcuts.
:::

## What You're Seeing

✅ **Currency Style** - Numbers displayed as currency  
✅ **Date Style** - Dates with localized display  
✅ **Number Precision** - Control decimal places  
✅ **Text Alignment** - Left, center, right alignment  
✅ **Cell Styling** - Text color, background color

## Schema Definition

The demo above uses the following schema to define style:

```typescript
import { defineSchema } from "@extable/core";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: string;
  revenue: number;
}

const tableSchema = defineSchema<Product>({
  columns: [
    { key: "id", header: "Product ID", type: "string", readonly: true, width: 110 },
    {
      key: "name",
      header: "Product Name",
      type: "string",
      width: 150,
      style: {
        textColor: "#24292f",
        backgroundColor: "#f6f8fa",
        decorations: {
          bold: true,
        },
      },
    },
    {
      key: "category",
      header: "Category",
      type: "string",
      width: 120,
    },
    {
      key: "price",
      header: "Price ($)",
      type: "number",
      number: { precision: 8, scale: 2 },
      width: 120,
      style: {
        align: "right",
        textColor: "#0969da",
      },
    },
    {
      key: "stock",
      header: "Stock",
      type: "number",
      number: { precision: 6, scale: 0 },
      width: 100,
      style: {
        align: "center",
      },
    },
    {
      key: "status",
      header: "Status",
      type: "enum",
      enum: { options: ["available", "discontinued", "low-stock"] },
      width: 130,
      style: {
        backgroundColor: "#fffbcc",
        textColor: "#7f4e00",
      },
    },
    {
      key: "revenue",
      header: "Revenue ($)",
      type: "number",
      number: { precision: 12, scale: 2 },
      width: 140,
      style: {
        align: "right",
        textColor: "#28a745",
        backgroundColor: "#f0fdf4",
      },
    },
  ],
});
```

## Style Options

### Text Color & Background

Apply custom colors to cells via the `style` property:

```typescript
{
  key: "price",
  header: "Price",
  type: "number",
  style: {
    textColor: "#0969da",           // Text color
    backgroundColor: "#f6f8fa",     // Background color
  },
}
```

### Text Alignment

Control horizontal alignment within cells:

```typescript
{
  key: "amount",
  header: "Amount",
  type: "number",
  style: {
    align: "right",  // "left" | "center" | "right"
  },
}
```

### Number Precision

Define decimal places for number columns:

```typescript
{
  key: "price",
  header: "Price",
  type: "number",
  number: {
    precision: 10,   // Total digits
    scale: 2,        // Decimal places
    signed: false,   // Allow negative
  },
}
```

### Decorations

Add visual decorations to cell text:

```typescript
{
  key: "notes",
  header: "Notes",
  type: "string",
  style: {
    decorations: {
      strike: false,
      underline: false,
      bold: false,
      italic: false,
    },
  },
}
```
