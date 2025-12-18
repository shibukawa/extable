# Uncontrolled-only Philosophy

## Why Uncontrolled?

Extable adopts **uncontrolled-only** integration to keep data lifecycle **explicit and predictable**.

### The Problem with Controlled Props

In a traditional controlled-component model, the parent component owns state and re-renders to sync the table. For a complex UI like a table:

- **State bloat**: selection, pending edits, undo/redo history, view filters/sorts — all become parent concerns.
- **Re-render overhead**: every keystroke, click, or scroll may trigger parent re-renders (expensive for large tables).
- **Implicit automation**: React/Vue frameworks auto-sync props, making it unclear when data actually changes at the server level.

### Extable's Approach: Explicit Responsibility

Extable inverts this: the **core library owns its own UI state** (selection, editing, view), and the **developer owns the data lifecycle**.

This keeps concerns separated:

| Concern | Owner | Responsibility |
|---------|-------|---|
| UI state (selection, edit mode, view filters) | Extable core | Internal, reactive, invisible to parent |
| Data lifecycle (fetch, cache, mutation, refresh) | Developer | Explicit, controllable, visible in code |

## Developer Responsibility: Two Steps

As an extable user, your responsibility is **minimal and explicit**:

1. **Initial load**: pass `defaultData` to the component
2. **After mutation**: call `setData()` with fresh data (after your API call)

That's it. No automatic syncing, no magic — just you deciding when to update.

## Code Patterns

:::tabs

== Vanilla

```javascript
const core = new ExtableCore({
  root: document.getElementById('table'),
  defaultData: initialData,
  defaultView: defaultView,
  schema: schema,
});

// Listen to table state changes (e.g., when user edits)
core.subscribeTableState((nextState, prevState, reason) => {
  console.log('Table changed:', reason);
  
  // Example: when the table detects edits, fetch and display current data
  if (reason === 'edit' || reason === 'commandExecuted') {
    handleTableChanged();
  }
});

async function handleTableChanged() {
  try {
    // Fetch fresh data from your API
    const response = await fetch('/api/table');
    const freshData = await response.json();
    
    // Explicitly update the table with new data
    core.setData(freshData);
  } catch (error) {
    console.error('Failed to refresh:', error);
  }
}

// When user clicks Save button
document.getElementById('saveBtn').addEventListener('click', async () => {
  // Get the current table data (if needed for submission)
  // In this example, we just refresh and let the server handle persistence
  await handleTableChanged();
});
```

== React

```tsx
import { useRef } from 'react';
import { Extable } from '@extable/react';

export function MyTable() {
  const tableRef = useRef(null);

  const handleTableStateChange = async (nextState, prevState, reason) => {
    console.log('Table state changed:', reason);
    
    // On edits or commands, refresh data
    if (reason === 'edit' || reason === 'commandExecuted') {
      await refreshTableData();
    }
  };

  const refreshTableData = async () => {
    try {
      const response = await fetch('/api/table');
      const freshData = await response.json();
      
      // Explicitly set the new data
      tableRef.current?.setData(freshData);
    } catch (error) {
      console.error('Failed to refresh:', error);
    }
  };

  const handleSaveClick = async () => {
    // Your save logic here
    // After successful save, refresh the table
    await refreshTableData();
  };

  return (
    <>
      <Extable
        ref={tableRef}
        schema={schema}
        defaultData={initialData}
        defaultView={defaultView}
        onTableState={handleTableStateChange}
      />
      <button onClick={handleSaveClick}>Save</button>
    </>
  );
}
```

== Vue

```vue
<template>
  <div>
    <ExtableVue
      ref="tableRef"
      :schema="schema"
      :defaultData="initialData"
      :defaultView="defaultView"
      @tableState="handleTableStateChange"
    />
    <button @click="handleSaveClick">Save</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import ExtableVue from '@extable/vue';

const tableRef = ref(null);
const schema = { /* ... */ };
const initialData = { /* ... */ };
const defaultView = { /* ... */ };

const handleTableStateChange = async (nextState, prevState, reason) => {
  console.log('Table state changed:', reason);
  
  // On edits or commands, refresh data
  if (reason === 'edit' || reason === 'commandExecuted') {
    await refreshTableData();
  }
};

const refreshTableData = async () => {
  try {
    const response = await fetch('/api/table');
    const freshData = await response.json();
    
    // Explicitly set the new data
    tableRef.value?.setData(freshData);
  } catch (error) {
    console.error('Failed to refresh:', error);
  }
};

const handleSaveClick = async () => {
  // Your save logic here
  // After successful save, refresh the table
  await refreshTableData();
};
</script>
```
:::

## Benefits

1. **Clarity**: No hidden re-fetches or caches. Your code controls when data updates.
2. **Flexibility**: Integrate with any fetch library (SWR, React Query, Apollo, etc.) or none at all.
3. **Predictability**: No magic props diffing. What you write is what happens.
4. **Testability**: Data mutations are explicit function calls, easy to mock and test.

## When to Update?

**Update** (call `setData()`) when:
- User clicks a Save/Sync button
- You receive a WebSocket push with fresh data
- You poll the server and get new data
- Multi-user sync completes

**Don't** call `setData()` automatically on:
- Every keystroke (the table handles edits internally)
- Navigation (unless you explicitly fetch new data)
- Prop changes from the parent (pass it once via `defaultData`)

## Next Steps

- See **Guides** → **Core quickstart** for a minimal example.
- See **Usage** → **Editing** for details on how edits work internally.
- See **Reference** for `setData()`, `subscribeTableState()`, and other imperative APIs.

