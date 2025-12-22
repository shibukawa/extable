# Unique Constraint

Learn how to enforce unique values in columns to prevent duplicates.

## Interactive Demo

This demo shows table with unique value constraints.

<ClientOnly>
  <UniqueConstraintDemo />
</ClientOnly>

::: info Demo UI Note
This demo includes **Undo** and **Redo** buttons above the table. In a real application, these operations are typically triggered via keyboard shortcuts (Ctrl/Cmd+Z for Undo, Ctrl/Cmd+Shift+Z for Redo). The buttons are provided here as an alternative way to interact with the demo without keyboard shortcuts.
:::

## What You're Seeing

✅ **Unique Validation** - Prevents duplicate values in constrained columns  
✅ **Error Indication** - Invalid cells marked with red border  
✅ **Edit Rejection** - Can't commit duplicate values  
✅ **Visual Feedback** - Error messages on invalid data

## How to Use

:::tabs
== Vue

```vue
<template>
  <ExtableVue :data="tableData" :schema="tableSchema" edit-mode="commit" />
</template>

<script setup lang="ts">
import { ExtableVue } from "@extable/vue";
import type { Schema } from "@extable/core";

const tableData = [
  {
    id: "EMP0001",
    name: "Alice Johnson",
    role: "Admin",
    department: "Engineering",
    joinDate: new Date(2020, 0, 15),
    email: "alice@company.com",
  },
  // ... more rows
];

const tableSchema: Schema = {
  columns: [
    {
      key: "id",
      header: "ID",
      type: "string",
      readonly: true,
      width: 80,
      unique: true,
    },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "role", header: "Role", type: "enum", options: ["Admin", "User", "Guest"], width: 120 },
    { key: "department", header: "Department", type: "string", width: 120 },
    { key: "joinDate", header: "Join Date", type: "date", width: 120 },
    {
      key: "email",
      header: "Email",
      type: "string",
      width: 150,
      unique: true,
    },
  ],
};
</script>
```

== React

```tsx
import { ExtableReact } from "@extable/react";
import type { Schema } from "@extable/core";

export function UniqueConstraintDemo() {
  const tableData = [
    {
      id: "EMP0001",
      name: "Alice Johnson",
      role: "Admin",
      department: "Engineering",
      joinDate: new Date(2020, 0, 15),
      email: "alice@company.com",
    },
    // ... more rows
  ];

  const tableSchema: Schema = {
    columns: [
      {
        key: "id",
        header: "ID",
        type: "string",
        readonly: true,
        width: 80,
        unique: true,
      },
      { key: "name", header: "Name", type: "string", width: 150 },
      { key: "role", header: "Role", type: "enum", options: ["Admin", "User", "Guest"], width: 120 },
      { key: "department", header: "Department", type: "string", width: 120 },
      { key: "joinDate", header: "Join Date", type: "date", width: 120 },
      {
        key: "email",
        header: "Email",
        type: "string",
        width: 150,
        unique: true,
      },
    ],
  };

  return <ExtableReact data={tableData} schema={tableSchema} editMode="commit" />;
}
```

== Vanilla

```ts
import { ExtableCore } from "@extable/core";
import type { Schema } from "@extable/core";

const container = document.getElementById("table-container");

const tableSchema: Schema = {
  columns: [
    {
      key: "id",
      header: "ID",
      type: "string",
      readonly: true,
      width: 80,
      unique: true,
    },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "role", header: "Role", type: "enum", options: ["Admin", "User", "Guest"], width: 120 },
    { key: "department", header: "Department", type: "string", width: 120 },
    { key: "joinDate", header: "Join Date", type: "date", width: 120 },
    {
      key: "email",
      header: "Email",
      type: "string",
      width: 150,
      unique: true,
    },
  ],
};

const core = new ExtableCore(container, {
  data: tableData,
  schema: tableSchema,
  editMode: "commit",
});

// Listen for validation errors
core.subscribeTableState((state) => {
  const errors = state.activeErrors.filter((e) => e.scope === "unique");
  if (errors.length > 0) {
    console.warn("Unique constraint violations:", errors);
  }
});
```

:::

## Schema Options

### Column-Level Unique Constraint

```ts
{
  key: "email",
  type: "string",
  unique: true,  // Enforces uniqueness
}
```

### Combined with Validation

```ts
{
  key: "email",
  type: "string",
  unique: true,  // Enforces uniqueness
}
```

## Validation Rules

- **Unique Check** - Scans all rows in table for duplicates
- **Case Sensitive** - String comparisons are case-sensitive
- **Null Handling** - Multiple null values allowed (nulls are not compared)
- **Edit Validation** - Checked when editing cell or committing
- **Error Display** - Invalid cells show red border and error message

## Finding Duplicate Values

When a unique constraint is violated, cells display a red border to indicate errors. To quickly locate all duplicate values:

1. **Click the column header** of a column with `unique: true` (e.g., Email, Username, or ID)
2. **Select "Error"** from the filter options that appear
3. Only rows with duplicate values in that column will be displayed

This makes it easy to audit and fix duplicate data issues in large tables.

## Use Cases

- **Email/Username** - Prevent duplicate user accounts
- **ID Fields** - Ensure each row has unique identifier
- **Social Security Numbers** - Prevent duplicate SSNs
- **Product SKUs** - Ensure unique product codes
- **Username Fields** - Unique usernames in user tables

## Notes

- Validation happens in commit mode by default
- In direct mode, validation prevents the edit immediately
- Use with `editMode: "commit"` for user confirmation
- Error messages appear when:
  - Attempting to edit a cell to a duplicate value
  - Attempting to commit with duplicates present
