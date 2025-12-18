# Readonly Mode

Learn how to make tables read-only, useful for data viewing and display-only scenarios.

## Interactive Demo

This demo shows a table in read-only mode where no editing is allowed.

<ClientOnly>
  <ReadonlyModeDemo />
</ClientOnly>

::: info Demo UI Note
This demo includes **Search** button, while **Undo** and **Redo** buttons are disabled since the table is in read-only mode. In a real application, you would typically use keyboard shortcuts (Ctrl/Cmd+F for Search, etc.). The buttons are provided here as an alternative way to interact with the demo.
:::

## What You're Seeing

✅ **Read-Only Columns** - Specified columns cannot be edited  
✅ **Selection Still Works** - Users can select and copy data  
✅ **No Inline Editing** - Double-click doesn't open editor  
✅ **Copy Support** - Ctrl/Cmd+C still available

## How to Use

:::tabs
== Vue

```vue
<template>
  <ExtableVue :data="tableData" :schema="tableSchema" edit-mode="readonly" />
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
  },
  // ... more rows
];

const tableSchema: Schema = {
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "role", header: "Role", type: "enum", options: ["Admin", "User", "Guest"], width: 120 },
    { key: "department", header: "Department", type: "string", width: 120 },
    { key: "joinDate", header: "Join Date", type: "date", width: 120 },
  ],
};
</script>
```

== React

```tsx
import { ExtableReact } from "@extable/react";
import type { Schema } from "@extable/core";

export function ReadonlyModeDemo() {
  const tableData = [
    {
      id: "EMP0001",
      name: "Alice Johnson",
      role: "Admin",
      department: "Engineering",
      joinDate: new Date(2020, 0, 15),
    },
    // ... more rows
  ];

  const tableSchema: Schema = {
    columns: [
      { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
      { key: "name", header: "Name", type: "string", width: 150 },
      { key: "role", header: "Role", type: "enum", options: ["Admin", "User", "Guest"], width: 120 },
      { key: "department", header: "Department", type: "string", width: 120 },
      { key: "joinDate", header: "Join Date", type: "date", width: 120 },
    ],
  };

  return <ExtableReact data={tableData} schema={tableSchema} editMode="readonly" />;
}
```

== Vanilla

```ts
import { ExtableCore } from "@extable/core";
import type { Schema } from "@extable/core";

const container = document.getElementById("table-container");

const tableSchema: Schema = {
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "role", header: "Role", type: "enum", options: ["Admin", "User", "Guest"], width: 120 },
    { key: "department", header: "Department", type: "string", width: 120 },
    { key: "joinDate", header: "Join Date", type: "date", width: 120 },
  ],
};

const core = new ExtableCore(container, {
  data: tableData,
  schema: tableSchema,
  editMode: "readonly",
});
```

:::

## Use Cases

- **Data Viewing** - Display data without editing capability
- **Reports** - Show report tables to non-editors
- **Audit Trail** - Display historical/archived data
- **API Results** - Show query results that shouldn't be modified

## Readonly vs Column-Level Readonly

- `editMode: "readonly"` - Entire table is read-only
- `column.readonly: true` - Individual columns are read-only (allows editing other columns)
