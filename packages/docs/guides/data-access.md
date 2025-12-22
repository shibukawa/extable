# Data Access from API

Learn how to initialize, configure, and query data in Extable.

## Row Identification

When accessing rows in the API, you can use two identifiers:

- **Row ID** (`rowId: string`): A unique identifier for each row. This remains stable even when rows are filtered, sorted, or reordered. If your data has a unique key field (like `id`), it's often used as the row ID. If not provided, Extable generates a unique ID internally.
- **Row Index** (`index: number`): The zero-based position of the row in the current view. This changes when rows are filtered or sorted, but provides quick access by position.

```typescript
// By row ID (stable identifier)
const row = table.getRow("user-123");  // Use if you have the row's ID

// By index (position)
const row = table.getRow(0);  // First row in the current view
const row = table.getRow(5);  // Sixth row in the current view
```

Most data access methods accept either `rowId` or `index`, so choose based on what you have available.

## Accessing the API

The data access API depends on your framework choice:

:::tabs
== Vanilla

Access the API directly on the `ExtableCore` instance:

```typescript
import { ExtableCore } from "@extable/core";

const table = new ExtableCore({
  root: container,
  schema,
  defaultData,
  defaultView: {},
});

// All API methods available directly
const row = table.getRow("1");
const pending = table.getPending();
const data = table.getData();
```

== React

Access the API via a ref to the instance. Use `useRef` to hold the core instance:

```typescript
import { useRef } from "react";
import { Extable } from "@extable/react";

export function MyTable() {
  const tableRef = useRef<ExtableCore>(null);

  const handleExport = () => {
    // Access API through ref
    const data = tableRef.current?.getData();
    const pending = tableRef.current?.getPending();
  };

  return (
    <>
      <Extable ref={tableRef} schema={schema} defaultData={data} />
      <button onClick={handleExport}>Export</button>
    </>
  );
}
```

== Vue

Access the API via a template ref:

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Extable } from "@extable/vue";
import type { ExtableCore } from "@extable/core";

const tableRef = ref<ExtableCore | null>(null);

const handleExport = () => {
  // Access API through ref
  const data = tableRef.value?.getData();
  const pending = tableRef.value?.getPending();
};
</script>

<template>
  <div>
    <Extable ref="tableRef" :schema="schema" :default-data="data" />
    <button @click="handleExport">Export</button>
  </div>
</template>
```

:::

## Bulk Data Load

:::tabs
== Vanilla

### Passing Data to Constructor

Pass data to the table during initialization:

```typescript
import { ExtableCore } from "@extable/core";
import type { Schema } from "@extable/core";

interface UserRow {
  id: string;
  name: string;
  email: string;
  age: number;
}

const schema = {
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true },
    { key: "name", header: "Name", type: "string" },
    { key: "email", header: "Email", type: "string" },
    { key: "age", header: "Age", type: "number" },
  ],
} satisfies Schema;

const data: UserRow[] = [
  { id: "1", name: "Alice", email: "alice@example.com", age: 30 },
  { id: "2", name: "Bob", email: "bob@example.com", age: 28 },
];

const table = new ExtableCore({
  root: document.getElementById("table-root")!,
  schema,
  defaultData: data,
  defaultView: {},
});
```

### Fetching Data on Mount

For async data loading, pass `null` as `defaultData` initially. Extable shows loading spinner for ``null``/``undefined``. After getting data from server, call ``setData()`` to pass it.

```typescript
const table = new ExtableCore({
  root: document.getElementById("table-root")!,
  schema,
  defaultData: null,  // Shows loading state
  defaultView: {},
});

// After data is fetched, set it
const response = await fetch("/api/users");
const fetchedData = await response.json();
table.setData(fetchedData);
```

== React

### Passing Data to Constructor

Pass data to the table during initialization:


```typescript
import { Extable } from "@extable/react";

export function UserTable() {
  const data: UserRow[] = [
    { id: "1", name: "Alice", email: "alice@example.com", age: 30 },
    { id: "2", name: "Bob", email: "bob@example.com", age: 28 },
  ];

  return (
    <Extable
      schema={schema}
      defaultData={data}
      defaultView={{}}
    />
  );
}
```

### Fetching Data on Mount

For async data loading, pass `null` as `defaultData` initially. Extable shows loading spinner for ``null``/``undefined`` and React component tracks initial ``null``/``undefined`` → data transition automatically. This is better matching with declarative fetching library like [SWR](https://swr.vercel.app). 

```typescript
import useSWR from "swr";

export function UserTable() {
  // useSWR return undefined as data when loading
  const { data } = useSWR("/api/users", fetcher);

  return (
    <Extable
      schema={schema}
      defaultData={data}  // Shows loading while data is not prepared
      defaultView={{}}
    />
  );
}
```

This transition works only once. So you should call `setData()` manually for subsequent bulk loading.

```ts
  // Subsequent load: use setData() directly
  const handleRefresh = async () => {
    const response = await fetch("/api/users");
    const refreshedData = await response.json();
    tableRef.current?.setData(refreshedData);
  };
```

== Vue

### Passing Data to Constructor

Pass data to the table during initialization:

```vue
<script setup lang="ts">
const data = ref<UserRow[]>([
  { id: "1", name: "Alice", email: "alice@example.com", age: 30 },
  { id: "2", name: "Bob", email: "bob@example.com", age: 28 },
]);
</script>

<template>
  <Extable
    :schema="schema"
    :default-data="data"
    :default-view="{}"
  />
</template>
```

### Fetching Data on Mount

For async data loading, pass `null` as `defaultData` initially. Extable shows loading spinner for ``null``/``undefined`` and Vue component tracks initial ``null``/``undefined`` → data transition automatically.

```vue
<script setup lang="ts">
const data = ref<UserRow[] | null>(null);

onMounted(async () => {
  const response = await fetch("/api/users");
  data.value = await response.json();
});
</script>

<template>
  <Extable
    :schema="schema"
    :default-data="data"
    :default-view="{}"
  />
</template>
```

This transition works only once. So you should call `setData()` manually for subsequent bulk loading.

```ts
// Subsequent load: use setData() directly
const handleRefresh = async () => {
  const response = await fetch("/api/users");
  const refreshedData = await response.json();
  tableRef.value?.setData(refreshedData);
};
```

:::

## Updating Configuration

::: warning Schema is immutable
Schema is set during initialization and cannot be changed after creation. Plan your schema carefully before creating the table.
:::

After initialization, use the appropriate method to update data or view:

:::tabs
== Vanilla

```typescript
// Update data
table.setData(newData);

// Update view (column visibility, filters, sorts)
table.setView(newView);
```

== React

After initial mount, prop changes don't trigger updates. Call API methods directly via the ref:

```typescript
const tableRef = useRef<ExtableCore>(null);

// Update data
tableRef.current?.setData(newData);

// Update view
tableRef.current?.setView(newView);
```

== Vue

After initial mount, prop changes don't trigger updates. Call API methods directly via the ref:

```typescript
const tableRef = ref<ExtableCore | null>(null);

// Update data
tableRef.value?.setData(newData);

// Update view
tableRef.value?.setView(newView);
```

:::

## Row-Level Editing

### Get a Row

Retrieve a row by its ID or array index (returns data with formula results applied):

```typescript
// By row ID (string)
const row = table.getRow("1");

// By array index (number)
const rowAtIndex = table.getRow(0);

// Both return R with formula results; null if not found
```

### Edit a Row

After user edits cells, retrieve the current state:

```typescript
// Get pending edits for a specific row (returns only T values, no formulas)
const rowPending = table.getPendingForRow("1");  // or table.getPendingForRow(0)

// Get full current state (includes pending edits and formula results)
const currentRow = table.getRow("1");

// Example: compare original vs current
const originalRow = { id: "1", name: "Alice", email: "alice@example.com", age: 30 };
const delta = {
  original: originalRow,
  pending: rowPending,
  current: currentRow,
};
```

### Insert a Row

Add a new row to the table:

```typescript
// Insert at the end
const newRowId = table.insertRow({ id: "new-1", name: "Bob", email: "bob@example.com", age: 28 });

// Insert at a specific index (0 = beginning, -1 = end)
const newRowId = table.insertRow(
  { id: "new-2", name: "Charlie", email: "charlie@example.com", age: 35 },
  1  // Insert at index 1
);

// Returns the generated row ID, or null if insertion failed
if (newRowId) {
  console.log("Row inserted with ID:", newRowId);
}
```

In **direct mode**, the new row is immediately sent to the server.  
In **commit mode**, the insertion is queued and requires calling `commit()`.

### Delete a Row

Remove a row from the table:

```typescript
// Delete by row ID
const success = table.deleteRow("1");

// Delete by row index (from current view)
const rowId = table.getRow(0)?.id;  // Get ID of first row
if (rowId) {
  table.deleteRow(rowId);
}

// Returns true if deletion was successful, false if row not found
```

In **direct mode**, the deletion is immediately sent to the server.  
In **commit mode**, the deletion is queued and requires calling `commit()`.

## Cell-Level Editing

### Get a Cell Value

Retrieve individual cell values (includes pending edits and formula results):

```typescript
// Type-safe access with known column keys
const name = table.getCell("1", "name");  // string | undefined
const age = table.getCell("1", "age");    // number | undefined

// Get display value (formatted string representation)
const displayName = table.getDisplayValue("1", "name");

// Check if cell has pending changes
const isPending = table.getCellPending("1", "name");
```

### Set a Cell Value

Update a cell value programmatically:

```typescript
// Update by row ID (string) and column key
table.setCellValue("1", "name", "Alice");

// Update by row index (number) and column key
table.setCellValue(0, "name", "Alice");

// Use a function to compute new value based on current value
table.setCellValue("1", "age", (current) => (current ?? 0) + 1);
```

In **direct mode**, the change is applied immediately to the table and sent to the server.  
In **commit mode**, the change is queued as a pending edit and requires calling `commit()` to persist.

Readonly cells are silently ignored and not updated.

### Bulk Cell Queries

Get all values in a column:

```typescript
// Type-safe column access
const names = table.getColumnData("name");  // string[]
const ages = table.getColumnData("age");    // number[]
```

### Set Values in Selection Range

Update all cells in the current selection:

```typescript
// Set all selected cells to a specific value
table.setValueToSelection("example");

// Or use a function to compute per-cell
table.setValueToSelection((current) => (current ?? 0) + 10);
```

This respects readonly cells and edit mode (direct vs commit).

## Full Data Access

### Get All Data

Retrieve the entire table:

```typescript
// Current state with pending edits and formula results
const allData = table.getData();  // R[]

// Original input data without edits or formulas
const rawData = table.getRawData();  // T[]
```

### Get Pending Edits

In commit mode, retrieve all pending changes:

```typescript
// All pending changes (T values only, no formula results)
const pending = table.getPending();  // Map<string, Partial<T>>

// Get pending row IDs
const changedRowIds = table.getPendingRowIds();  // string[]

// Check if there are pending changes
const hasChanges = table.hasPendingChanges();    // boolean

// Count total pending cells
const cellCount = table.getPendingCellCount();   // number
```

### Commit Return Values

`commit()` resolves with `RowStateSnapshot<T, R>[]` for both overloads:

- `commit(): Promise<RowStateSnapshot<T, R>[]>`
- `commit(handler): Promise<RowStateSnapshot<T, R>[]>`

Each snapshot contains:
- `rowId`: row identifier
- `rowIndex`: current index in the view
- `data`: computed row data (`R`)
- `pending`: pending raw values (commit mode only)
- `diagnostics`: active validation/diagnostic errors for the row

The list includes rows touched by the pending command batch.

## Commit Mode Data Retrieval

### Before Commit

```typescript
const pending = table.getPending();        // Map<string, Partial<T>>
const raw = table.getRawData();            // T[]

if (pending.size > 0) {
  await table.commit();
}
```

### Commit with Async Handler

Use the async handler to validate or sync with a server before applying changes. If the handler throws, the commit is aborted and the error is propagated.

```typescript
const snapshots = await table.commit(async (changes) => {
  await sendToServer({
    user: changes.user,
    commands: changes.commands,
  });
});

// snapshots: RowStateSnapshot<T, R>[]
```

### After Commit

```typescript
const noLongerPending = table.getPending();  // Empty or minimal
const current = table.getData();             // Current table state
```

### Commit with Server Sync (Delta Updates)

```typescript
const snapshots = await table.commit(async (changes) => {
  await sendToServer({
    action: "bulk-update",
    commands: changes.commands,
    user: changes.user,
    timestamp: Date.now(),
  });
});

// snapshots is RowStateSnapshot<T, R>[] - list of changed rows
```

Example server integration:

```typescript
async function sendToServer(payload: any) {
  const response = await fetch("/api/table/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.statusText}`);
  }

  return response.json();
}
```

## Utility Methods

### Get Index from ID

Convert row/column IDs to array indices:

```typescript
const rowIndex = table.getRowIndex("1");        // number or -1 if not found
const colIndex = table.getColumnIndex("name");  // number or -1 if not found
```

### Get Table State

Retrieve the current table state snapshot:

```typescript
const state = table.getTableState();  // Includes pending count, edit mode, etc.
const selection = table.getSelectionSnapshot();  // Current cell selection
```

## Type Safety with Formulas

When you have both input and computed row types:

```typescript
interface UserRow {
  id: string;
  name: string;
  age: number;
}

interface UserRowResult extends UserRow {
  ageGroup: string;  // Computed via formula
}

const table = new ExtableCore<UserRow, UserRowResult>({
  root: container,
  defaultData: initialUsers,
  defaultView: {},
  schema: {
    columns: [
      { key: "name", type: "string" },
      { key: "age", type: "number" },
      { key: "ageGroup", type: "string", formula: "=IF(age<30, 'Young', 'Senior')" },
    ],
  },
});

// Type-safe access includes formula results
const row = table.getRow("1");  // UserRowResult with ageGroup
const ageGroup = table.getCell("1", "ageGroup");  // string | undefined
```

## Subscriptions

Monitor table changes in real-time by subscribing to events. Each subscription returns an unsubscribe function.

### Subscribe to Table State Changes

Listen for changes to pending edits, undo/redo state, errors, and render mode:

```typescript
const unsubscribe = table.subscribeTableState((current, previous) => {
  console.log("Pending changes:", current.pendingCellCount);
  console.log("Can undo:", current.undoRedo.canUndo);
  console.log("Can commit:", current.canCommit);
  console.log("Active errors:", current.activeErrors);
});

// Later
unsubscribe();
```

### Subscribe to Selection Changes

Listen for selection ranges and active cell state:

```typescript
const unsubscribe = table.subscribeSelection((current, previous, reason) => {
  console.log("Active row:", current.activeRowKey);
  console.log("Active column:", current.activeColumnKey);
  console.log("Change reason:", reason);  // 'selection', 'edit', 'action', 'data', etc.
  
  // Check the active cell value
  if (current.activeRowKey && current.activeColumnKey) {
    console.log("Active value:", current.activeValueDisplay);
  }

  // Button cell action payload (reason === "action")
  if (reason === "action" && current.action) {
    console.log("Button action:", current.action.value);
  }
});

// Later
unsubscribe();
```

When a button cell is activated (click or Space), `reason` is `"action"` and `current.action` contains the button payload. Link cells navigate and do not emit action payloads.

### Subscribe to Row State Changes

Listen for row-level events (insert, edit, delete):

```typescript
const unsubscribe = table.subscribeRowState((rowId, next, prev, reason) => {
  if (reason === "delete") {
    console.log(`Row ${rowId} was deleted`);
    return;
  }
  if (reason === "new") {
    console.log(`Row ${rowId} was inserted`, next?.data);
    return;
  }
  console.log(`Row ${rowId} was edited`, { prev: prev?.data, next: next?.data });
});

// Later
unsubscribe();
```

## Examples

### Detect Cell Edits

```typescript
table.subscribeTableState((current, previous) => {
  if (current.pendingCellCount > (previous?.pendingCellCount ?? 0)) {
    console.log("A cell was edited!");
  }
});

table.subscribeSelection((current, prev, reason) => {
  if (reason === "edit" && prev?.activeRowKey && prev.activeColumnKey) {
    const newValue = table.getCell(prev.activeRowKey, prev.activeColumnKey);
    console.log("Edit confirmed:", newValue);
  }
});
```

### Export Modified Data

```typescript
function exportChanges() {
  const pending = table.getPending();
  const csv = [];

  for (const [rowId, changes] of pending) {
    const row = table.getRow(rowId);
    csv.push({
      rowId,
      changes,
      currentState: row,
    });
  }

  return JSON.stringify(csv, null, 2);
}
```
