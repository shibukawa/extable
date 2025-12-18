# Async Data Loading

Learn how to load data asynchronously and update the table dynamically.

## Interactive Demo

This demo loads data on demand with a loading indicator.

<ClientOnly>
  <AsyncDataLoadingDemo />
</ClientOnly>

::: info Demo UI Note
This demo includes **Search**, **Undo**, and **Redo** buttons above the table. In a real application, these operations are typically triggered via keyboard shortcuts (Ctrl/Cmd+F for Search, Ctrl/Cmd+Z for Undo, Ctrl/Cmd+Shift+Z for Redo). The buttons are provided here as an alternative way to interact with the demo without keyboard shortcuts.
:::

## What You're Seeing

✅ **Lazy Loading** - Data loads when component mounts  
✅ **Loading State** - UI indicates data is loading  
✅ **Dynamic Updates** - Table updates after data arrives  

## How to Use

:::tabs

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

// Initialize table with null -> loading spinner appears
const core = new ExtableCore(container, {
  data: null,
  schema: tableSchema,
});

const res = await fetch("/api/users");
const users = await res.json();

core.setData(users.map(user => {
  ...user,
  joinDate: Date(user),
}))
```

== React

```tsx
import useSWR from "swr";
import { useEffect, useState } from "react";
import { ExtableReact } from "@extable/react";
import type { Schema } from "@extable/core";

async function fetcher(url: string) {
  const res = await fetch("/api/users");
  const users = await res.json();

  return users.map(user => {
  ...user,
  joinDate: Date(user),
  })
}

export function AsyncDataLoadingDemo() {
  // data is undefined until server responded
  // -> Spinner appears
  const { data } = useSWR("/api/users/", fetcher)

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
    <div>
      <ExtableReact defaultData={data} schema={tableSchema} />
    </div>
  );
}
```

== Vue

```vue
<template>
  <div>
    <ExtableVue :defaultData="tableData" :schema="tableSchema" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ExtableVue } from "@extable/vue";
import type { Schema } from "@extable/core";

const tableSchema: Schema = {
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "role", header: "Role", type: "enum", options: ["Admin", "User", "Guest"], width: 120 },
    { key: "department", header: "Department", type: "string", width: 120 },
    { key: "joinDate", header: "Join Date", type: "date", width: 120 },
  ],
};

interface User {
  id: string
  name: string
  role: "Admin"|"User"|"Guest"
  department: string
  joinDate: Date
}

// tableData is null until server responded
//  -> loading spinner appears
const tableData = ref<User[]|null>(null);

onMounted(async () => {
  const res = await fetch("/api/users");
  const users = await res.json();
  
  tableData.value = users.map(user => {
    ...user,
    joinDate: Date(user),
  })
});
</script>
```

:::

## Key Points

- `setData()` method passes loaded data manually.
- `defaultData` props of React/Vue components accepts temporality `null`/`undefined` and shows loading spinner.
