# Filter Support

Learn how to enable filtering and sort data by column values.

## Interactive Demo

This demo shows table with filter and sort capabilities enabled.

<ClientOnly>
  <FilterSupportDemo />
</ClientOnly>

::: info Demo UI Note
This demo includes **Search**, **Undo**, and **Redo** buttons above the table. In a real application, these operations are typically triggered via keyboard shortcuts (Ctrl/Cmd+F for Search, Ctrl/Cmd+Z for Undo, Ctrl/Cmd+Shift+Z for Redo). The buttons are provided here as an alternative way to interact with the demo without keyboard shortcuts.
:::

## What You're Seeing

✅ **Column Filtering** - Click column headers to filter  
✅ **Distinct Values** - Filter by available values in column  
✅ **Multiple Values** - Select multiple values (OR logic)  
✅ **Column Sorting** - Sort ascending or descending  
✅ **Clear Filters** - Reset filters and sorting

## How to Use

:::tabs
== Vue

```vue
<template>
  <ExtableVue
    :data="tableData"
    :schema="tableSchema"
    :view="view"
    @view-change="updateView"
  />
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ExtableVue } from "@extable/vue";
import type { Schema, View } from "@extable/core";

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

const view = ref<View>({
  filters: [],
  sorts: [],
});

const updateView = (newView: View) => {
  view.value = newView;
};
</script>
```

== React

```tsx
import { useState } from "react";
import { ExtableReact } from "@extable/react";
import type { Schema, View } from "@extable/core";

export function FilterSupportDemo() {
  const [view, setView] = useState<View>({ filters: [], sorts: [] });

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

  return (
    <ExtableReact
      data={tableData}
      schema={tableSchema}
      view={view}
      onViewChange={setView}
    />
  );
}
```

== Vanilla

```ts
import { ExtableCore } from "@extable/core";
import type { Schema, View } from "@extable/core";

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

const initialView: View = {
  filters: [],
  sorts: [],
};

const core = new ExtableCore(container, {
  data: tableData,
  schema: tableSchema,
  view: initialView,
});

// Listen for view changes
core.subscribeTableState((state) => {
  // View has changed via UI
  const updatedView = core.getView();
  console.log("View updated:", updatedView);
});
```

:::

## Filter Types

### Column Header Filter Menu

Click the **filter icon** (🔻 or funnel icon) next to any column header to open an Excel-like filter menu. The menu allows you to:

1. **Select/Deselect Values** - Check or uncheck values to include/exclude them from the table
2. **Include Blanks** - Toggle to show/hide rows with empty cells
3. **Sort Options** - Sort the column ascending or descending
4. **Search** - When there are many distinct values (>100), search to narrow down the list
5. **Error Filter** - For columns with validation errors (like unique constraint violations), select "Error" to show only rows with errors

Once you apply a filter, the column header will show a filter indicator. Click again to modify or clear the filter.

### Distinct Value Filter

Filter by values that appear in the column:

```ts
{
  kind: "values",
  key: "role",
  values: ["Admin", "User"],
  includeBlanks: false,
}
```

### Programmatic Filtering

```ts
core.setView({
  filters: [
    {
      kind: "values",
      key: "department",
      values: ["Engineering", "Sales"],
      includeBlanks: false,
    },
  ],
});
```

## Sorting

### Single Column Sort

```ts
core.setView({
  sorts: [
    {
      key: "name",
      dir: "asc", // or "desc"
    },
  ],
});
```

### Notes

- Only one column can be sorted at a time
- Click different column removes previous sort
- Click same column sort direction toggles
