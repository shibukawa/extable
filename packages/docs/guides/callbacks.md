# Callbacks

Extable exposes table-level state, selection (cell) updates, and row-level change hooks. Use these to synchronize UI, enable custom status bars, or integrate with external state.

## Table State

Use `subscribeTableState` to observe state that affects toolbars and status panels.

```ts
const unsubscribe = table.subscribeTableState((next, prev) => {
  console.log("canCommit", next.canCommit);
  console.log("pending", next.pendingCommandCount);
});

// Later
unsubscribe();
```

`TableState` includes:
- `canCommit`
- `pendingCommandCount`
- `pendingCellCount`
- `undoRedo`
- `renderMode`
- `activeErrors`

## Selection / Cell Events

Use `subscribeSelection` to track active cell changes and selection ranges.

```ts
const unsubscribe = table.subscribeSelection((next, prev, reason) => {
  console.log("active", next.activeRowKey, next.activeColumnKey);
  console.log("reason", reason);
});
```

`SelectionChangeReason` can be:
- `selection`
- `edit`
- `style`
- `schema`
- `view`
- `data`
- `unknown`

## Row State (Core Only)

Use `subscribeRowState` to observe per-row updates. This is available on `ExtableCore` and not yet exposed by the React/Vue wrappers.

```ts
const unsubscribe = table.subscribeRowState((rowId, next, prev, reason) => {
  if (reason === "delete") {
    console.log("row removed", rowId);
    return;
  }
  console.log("row updated", rowId, next?.data);
});
```

`RowChangeReason` can be `new`, `edit`, or `delete`.

## React

```tsx
<Extable
  schema={schema}
  defaultData={data}
  defaultView={view}
  onTableState={(next) => setCanCommit(next.canCommit)}
  onCellEvent={(next, prev, reason) => {
    console.log(reason, next.activeValueDisplay);
  }}
/>
```

## Vue

```vue
<template>
  <Extable
    :schema="schema"
    :defaultData="data"
    :defaultView="view"
    @tableState="handleTableState"
    @cellEvent="handleCellEvent"
  />
</template>
```

For method signatures and data structures, see the [Core API Reference](/reference/core).
