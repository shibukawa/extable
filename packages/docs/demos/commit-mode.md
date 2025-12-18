# Commit Mode

Learn how to use commit mode for explicit change management and multi-user scenarios.

## Interactive Demo

This demo shows commit mode where edits are staged before being submitted.

<ClientOnly>
  <CommitModeDemo />
</ClientOnly>

::: info Demo UI Note
This demo includes **Search**, **Undo**, **Redo**, and **Commit** buttons. The **Commit** button saves staged changes. In a real application, these operations are typically triggered via keyboard shortcuts and programmatic APIs. The buttons are provided here as an alternative way to interact with the demo.
:::

## What You're Seeing

✅ **Pending Changes** - Edits are staged, not immediate  
✅ **Commit Button** - Submit all pending changes at once  
✅ **Undo/Redo** - All edits can be undone before commit  
✅ **Change Tracking** - Visual indication of modified cells

## How to Use

:::tabs
== Vanilla

== Vue

```vue
<template>
  <div>
    <div class="controls">
      <button @click="handleCommit" :disabled="!hasPending">
        Commit {{ pendingCount }} changes
      </button>
    </div>
    <ExtableVue
      ref="tableRef"
      :data="tableData"
      :schema="tableSchema"
      edit-mode="commit"
      @table-state="updateTableState"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ExtableVue } from "@extable/vue";
import type { Schema, TableState } from "@extable/core";

const tableRef = ref();
const hasPending = ref(false);
const pendingCount = ref(0);

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

const updateTableState = (state: TableState) => {
  hasPending.value = state.canCommit;
  pendingCount.value = state.pendingCellCount;
};

const handleCommit = async () => {
  const core = tableRef.value?.getCore();
  if (core) {
    await core.commit();
    alert("Changes committed!");
  }
};
</script>

<style scoped>
.controls {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
</style>
```

== React

```tsx
import { useRef, useState } from "react";
import { ExtableReact } from "@extable/react";
import type { Schema, TableState } from "@extable/core";

export function CommitModeDemo() {
  const tableRef = useRef();
  const [hasPending, setHasPending] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

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

  const handleTableState = (state: TableState) => {
    setHasPending(state.canCommit);
    setPendingCount(state.pendingCellCount);
  };

  const handleCommit = async () => {
    const core = tableRef.current?.getCore();
    if (core) {
      await core.commit();
      alert("Changes committed!");
    }
  };

  const handleUndo = () => {
    tableRef.current?.getCore()?.undo();
  };

  const handleRedo = () => {
    tableRef.current?.getCore()?.redo();
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button onClick={handleCommit} disabled={!hasPending}>
          Commit {pendingCount} changes
        </button>
        <button onClick={handleUndo}>Undo</button>
        <button onClick={handleRedo}>Redo</button>
      </div>
      <ExtableReact
        ref={tableRef}
        data={tableData}
        schema={tableSchema}
        editMode="commit"
        onTableState={handleTableState}
      />
    </div>
  );
}
```

:::

## Key Features

- **Staged Changes** - Edits don't affect original data until commit
- **Batch Operations** - Submit multiple edits in one operation
- **Rollback** - Undo changes before committing
- **Change Tracking** - Know exactly how many cells are modified

## When to Use

- **Multi-step Forms** - Collect edits before submission
- **Multi-user Editing** - Prevent concurrent changes to same cell
- **Data Validation** - Validate all changes before commit
- **Transaction Support** - Commit related changes atomically
