# Events & Callback Payloads

This reference documents the payloads and return values for Extable event callbacks.

## Table State

### `subscribeTableState(listener)`

**Signature**:
```ts
(listener: TableStateListener) => () => void
```

**Listener**:
```ts
(next: TableState, prev: TableState | null) => void
```

**Return value**:
- An unsubscribe function. Call it to stop receiving updates.
- The listener return value is ignored.

**TableState fields**:
- `canCommit: boolean`
- `pendingCommandCount: number`
- `pendingCellCount?: number`
- `undoRedo: { canUndo: boolean; canRedo: boolean }`
- `renderMode: "html" | "canvas"`
- `activeErrors: TableError[]`

**TableError**:
- `scope: "validation" | "commit" | "render" | "formula" | "conditionalStyle" | "unknown"`
- `message: string`
- `target?: { rowId?: string; colKey?: string }`

## Selection / Cell Events

### `subscribeSelection(listener)`

**Signature**:
```ts
(listener: SelectionListener) => () => void
```

**Listener**:
```ts
(next: SelectionSnapshot, prev: SelectionSnapshot | null, reason: SelectionChangeReason) => void
```

**Return value**:
- An unsubscribe function.
- The listener return value is ignored.

**SelectionSnapshot fields**:
- `ranges: SelectionRange[]`
- `activeRowIndex: number | null`
- `activeRowKey: string | null`
- `activeColumnIndex: number | null`
- `activeColumnKey: string | null`
- `activeValueRaw: unknown`
- `activeValueDisplay: string`
- `activeValueType: ColumnType | null`
- `diagnostic: CellDiagnostic | null`
- `action?: CellAction | null` (only when `reason === "action"`)
- `styles: { columnStyle: Partial<ResolvedCellStyle>; cellStyle: Partial<ResolvedCellStyle>; resolved: Partial<ResolvedCellStyle> }`

**SelectionChangeReason**:
- `selection`
- `edit`
- `action`
- `style`
- `schema`
- `view`
- `data`
- `unknown`

**CellAction**:
- `kind: "button"`
- `rowId: string`
- `colKey: string`
- `value: ButtonActionValue`

**ButtonActionValue**:
- `{ label: string }`
- `{ label: string; command: string; commandfor: string }`

**Notes**:
- `reason === "action"` fires only for button clicks or Space on a button cell.
- Link cells navigate to `href` and do not emit `action`.

## Row State (Core Only)

### `subscribeRowState(listener)`

**Signature**:
```ts
(listener: RowStateListener<T, R>) => () => void
```

**Listener**:
```ts
(rowId: string, next: RowStateSnapshot<T, R> | null, prev: RowStateSnapshot<T, R> | null, reason: RowChangeReason) => void
```

**Return value**:
- An unsubscribe function.
- The listener return value is ignored.

**RowStateSnapshot fields**:
- `rowId: string`
- `rowIndex: number`
- `data: R`
- `pending?: Partial<T>`
- `diagnostics?: TableError[]`

**RowChangeReason**:
- `new`
- `edit`
- `delete`

## Wrapper Callbacks

### React

```ts
onTableState?: (next: TableState, prev: TableState | null) => void
onCellEvent?: (next: SelectionSnapshot, prev: SelectionSnapshot | null, reason: SelectionChangeReason) => void
```

### Vue

```ts
@tableState="(next, prev) => {}"
@cellEvent="(next, prev, reason) => {}"
```

Wrapper callbacks are fire-and-forget; return values are ignored.

## Related Docs

- [Callbacks Guide](/guides/callbacks)
- [Core API Reference](/reference/core)
- [Data Access Guide](/guides/data-access)
