# Conditional Style

Learn how to apply conditional styling to cells based on their values.

## Interactive Demo

This demo shows tables with conditional style applied.

<ClientOnly>
  <ConditionalStyleDemo />
</ClientOnly>

::: info Demo UI Note
This demo includes **Search**, **Undo**, and **Redo** buttons above the table. In a real application, these operations are typically triggered via keyboard shortcuts (Ctrl/Cmd+F for Search, Ctrl/Cmd+Z for Undo, Ctrl/Cmd+Shift+Z for Redo). The buttons are provided here as an alternative way to interact with the demo without keyboard shortcuts.
:::

## What You're Seeing

✅ **Value-Based Coloring** - Cell colors based on values  
✅ **Status Indicators** - Visual status with colors  
✅ **Range Highlighting** - Different colors for value ranges  
✅ **Text Styling** - Text color and weight changes  
✅ **Error Highlighting** - Red for invalid data

## Schema Definition

The demo above uses the following schema with conditional style:

```typescript
import { defineSchema } from "@extable/core";

interface Performance {
  id: string;
  employee: string;
  department: string;
  score: number;
  attendance: number;
  projects: number;
  status: string;
}

const tableSchema = defineSchema<Performance>({
  columns: [
    { key: "id", header: "Employee ID", type: "string", readonly: true, width: 120 },
    { key: "employee", header: "Employee Name", type: "string", width: 150 },
    { key: "department", header: "Department", type: "string", width: 140 },
    {
      key: "score",
      header: "Performance Score",
      type: "number",
      number: { precision: 5, scale: 1 },
      width: 160,
      style: { align: "center" },
      conditionalStyle: (row) => {
        if (row.score >= 90) return { backgroundColor: "#d1fae5", textColor: "#065f46" };
        if (row.score >= 70) return { backgroundColor: "#fef3c7", textColor: "#78350f" };
        return { backgroundColor: "#fee2e2", textColor: "#7f1d1d" };
      },
    },
    {
      key: "attendance",
      header: "Attendance (%)",
      type: "number",
      number: { precision: 5, scale: 1 },
      width: 140,
      style: { align: "center" },
      conditionalStyle: (row) => {
        if (row.attendance >= 95) return { backgroundColor: "#dcfce7", textColor: "#166534" };
        if (row.attendance >= 85) return { backgroundColor: "#fef08a", textColor: "#713f12" };
        return { backgroundColor: "#fecaca", textColor: "#991b1b" };
      },
    },
    {
      key: "projects",
      header: "Projects Completed",
      type: "number",
      number: { precision: 3, scale: 0 },
      width: 160,
      style: { align: "center" },
      conditionalStyle: (row) => {
        if (row.projects >= 15) return { backgroundColor: "#bfdbfe", textColor: "#1e40af" };
        if (row.projects >= 8) return { backgroundColor: "#e0e7ff", textColor: "#3730a3" };
        return null;
      },
    },
    {
      key: "status",
      header: "Status",
      type: "string",
      readonly: true,
      width: 130,
      style: { align: "center" },
      conditionalStyle: (row) => {
        if (row.status === "Active") return { backgroundColor: "#ccfbf1", textColor: "#134e4a" };
        if (row.status === "On Leave") return { backgroundColor: "#fed7aa", textColor: "#92400e" };
        if (row.status === "Inactive") return { backgroundColor: "#f3f4f6", textColor: "#374151" };
        return null;
      },
    },
  ],
});
```

## How Conditional Style Works

Conditional style applies styling rules to cells based on their values. Use `conditionalStyle` to return a style object (or `null`) given the row.

**Important:** The `conditionalStyle` function receives the row data with resolved formula values (type `RData`), not the raw input data (type `TData`). When you use `defineSchema<TData, RData>`, formulas transform `TData` → `RData`, and conditional style functions operate on `RData`. This allows conditional styling to depend on computed values from formulas.

### Basic Example

```typescript
{
  key: "score",
  type: "number",
  conditionalStyle: (row) => {
    if (row.score >= 90) return { backgroundColor: "#d1fae5", textColor: "#065f46" };
    if (row.score >= 70) return { backgroundColor: "#fef3c7", textColor: "#78350f" };
    return null;
  },
}
```

Return the style you want for each condition; `null` means “no special styling.”

### Styling Properties

- **`background`** - Cell background color
- **`textColor`** - Text color
- **`bold`**, **`italic`**, **`underline`**, **`strike`** - Text decorations

## Use Cases

- **Status Indicators** - Color code status values
- **Performance Highlighting** - Visual representation of performance ranges
- **Attendance Tracking** - Quick visual assessment of attendance rates
- **Alert Conditions** - Highlight exceptions or anomalies
- **Data Validation** - Highlight invalid or out-of-range values
