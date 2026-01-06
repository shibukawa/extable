# ExtableCore API Reference

ExtableCore is the framework-agnostic core library that powers Extable. All methods below are available uniformly across Vanilla, React, and Vue. See [Accessing the API](/guides/data-access.md#accessing-the-api) for framework-specific access patterns.

## Constructor

```typescript
new ExtableCore<T, R>(init: CoreInit<T>)
```

Initialize an Extable table with data, schema, and optional configuration.

**Parameters**:
- `root: HTMLElement` - Container element where the table will be mounted
- `schema: Schema<T, R>` - Column definitions, validation rules, and formatting
- `defaultData?: NullableData<T>` - Initial table data
- `defaultView?: View` - Initial filters, sorts, and column visibility
- `options?: CoreOptions` - Render mode, edit mode, lock mode, styling, and server integration

**Example**:
```typescript
const table = new ExtableCore({
  root: document.getElementById("table"),
  schema: mySchema,
  defaultData: rows,
  defaultView: { filters: [], sorts: [] },
  options: { renderMode: "html", editMode: "commit" },
});
```

---

## Lifecycle

### `destroy()`
Clean up and remove the table from the DOM. Unsubscribes all listeners and stops background processes.

### `remount(target: HTMLElement)`
Remount the table to a different DOM element. Useful for modal dialogs or dynamic layout changes.

---

## Data Management

### Data Retrieval

#### `getData(): R[]`
Get the current table data with all formulas resolved (type `R`).

#### `getRawData(): T[]`
Get the raw input data without formula evaluation (type `T`).

#### `getTableData(): R[]`
Get the displayed data after applying filters and sorts.

See [Filtering and Sorting](/demos/filter-support.md) for examples.

#### `getRow(rowIdOrIndex: string | number): R | null`
Get a single row by ID or index position.

#### `getCell(rowIdOrIndex: string | number, colKey: string): unknown`
Get the value of a specific cell by row and column.

### Data Updates

#### `setData(data: NullableData<T>)`
Replace all table data. Useful for async data loading or refresh.

#### `setCellValue(rowIdOrIndex: string | number, colKey: string, value: unknown): void`
Set the value of a single cell. Respects edit mode (direct vs commit).

#### `insertRow(rowData: T, position?: number | string): string | null`
Insert a new row at the specified position (or end if not specified).

**Parameters**:
- `rowData` - The new row data
- `position` - Row index or row ID after which to insert (optional)

#### `deleteRow(row: string | number): boolean`
Delete a row by ID or index. Returns `true` if successful.

---

## Schema & View Configuration

### Numeric formats (number / int / uint)

Formatting and parsing rules are configured on schema columns:

- `type: "number"` supports decimal or scientific display via `format: { format: "decimal" | "scientific", precision?, scale?, thousandSeparator? }`.
- `type: "int" | "uint"` supports base display via `format: { format: "decimal" | "binary" | "octal" | "hex" }`.

For examples (including `0b`/`0o`/`0x` input and scientific notation like `1e3`), see:

- [Data Format Guide](/guides/data-format#number)
- [Numeric Formats demo](/demos/number-formats)

#### `setSchema(schema: Schema<T, R>)`
Update the table schema dynamically. Triggers re-validation and re-render.

#### `getSchema(): Schema<T, R>`
Get the current schema.

#### `setView(view: View)`
Update filters, sorts, and column visibility.

#### `getView(): View`
Get the current view state (filters, sorts, hidden columns).

See [Filter Support](/demos/filter-support.md) for view configuration details.

### Readonly / Disabled Matrix

| Column Type | Schema `readonly` | Conditional `{ readonly: true }` | Schema `disabled` | Conditional `{ disabled: true }` | Notes |
| --- | --- | --- | --- | --- | --- |
| `button` | Always readonly (not configurable) | Not supported | Supported | Supported | Disabled uses readonly gray and blocks interaction. |
| `link` | Always readonly (not configurable) | Not supported | Supported | Supported | Disabled uses readonly gray and blocks interaction. |
| `formula` | Always readonly (not configurable) | Not supported | Not supported | Not supported | Conditional readonly/disabled ignored. |
| `boolean/number/date/time/datetime` | Supported | Supported | Not supported | Not supported | Readonly can be set in schema or conditionalStyle. |
| `string/enum/tags` | Supported | Supported | Not supported | Not supported | Readonly can be set in schema or conditionalStyle. |

`disabled` is configured via `style.disabled` or `conditionalStyle` for button/link only.

---

## Commit Mode API

In commit mode, edits are collected as pending changes until explicitly saved. These methods manage the pending state and commit workflow.

#### `getPending(): Map<string, Record<string, unknown>>`
Get all pending edits organized by row ID. Returns an empty map if no edits are pending.

#### `getPendingRowIds(): string[]`
Get IDs of all rows with pending changes.

#### `getPendingCellCount(): number`
Get the total number of pending cell edits across all rows.

#### `commit(): Promise<RowStateSnapshot<T, R>[]>`
Save all pending edits and return the committed rows. Only available in commit mode.

#### `commit(handler: (changes) => Promise<void>): Promise<RowStateSnapshot<T, R>[]>`
Run an async handler before applying the commit. If the handler resolves, the commit is applied.
If the handler throws, the commit is aborted and the error is propagated.

See [Commit Mode](/demos/commit-mode.md) for examples.

---

## Undo & Redo

#### `undo()`
Undo the last edit action.

#### `redo()`
Redo the last undone action.

#### `getUndoRedoHistory(): UndoRedoHistory`
Get information about available undo/redo actions.

---

## Selection & Cell Access

#### `getRowIndex(rowId: string): number`
Get the zero-based index of a row in the current view.

#### `getColumnIndex(colKey: string): number`
Get the zero-based index of a column in the schema.

#### `findRowById(rowId: string): InternalRow | null`
Get internal row object by ID.

#### `getAllRows(): InternalRow[]`
Get all internal row objects (including hidden/filtered).

#### `getSelectionSnapshot(): SelectionSnapshot`
Get current cell selection state.

#### `setValueToSelection(next: Updater<unknown>)`
Update the value of all selected cells.

---

## Styling & Appearance

#### `setRootClass(classNames: string | string[])`
Add or toggle CSS classes on the root element.

#### `setRootStyle(style: Partial<CSSStyleDeclaration>)`
Apply inline styles to the root element.

---

## User Interface

### Filter & Sort Panel

#### `showFilterSortPanel(colKey: string)`
Display the filter/sort panel for a specific column.

**Parameters**:
- `colKey` - The column key to filter or sort

#### `hideFilterSortPanel()`
Hide the filter/sort panel.

#### `toggleFilterSortPanel(colKey: string)`
Toggle visibility of the filter/sort panel for a specific column. If a different column's panel is open, it closes that one first.

**Parameters**:
- `colKey` - The column key to toggle

#### `isFilterSortPanelVisible(): boolean`
Check if the filter/sort panel is currently open.

See [Filtering and Sorting](/demos/filter-support.md) for examples.

---

## Subscriptions & Events

#### `subscribeTableState(listener: TableStateListener): () => void`
Subscribe to table state changes (data, view, errors, etc.). Returns an unsubscribe function.

**Listener signature**: `(next: TableState, prev: TableState | null) => void`

#### `subscribeSelection(listener: SelectionListener): () => void`
Subscribe to selection changes (active cell, selected ranges).

**Listener signature**: `(next: SelectionSnapshot, prev: SelectionSnapshot | null, reason: SelectionChangeReason) => void`

#### `subscribeRowState(listener: RowStateListener<T, R>): () => void`
Subscribe to changes for specific rows (useful for tracking edits to individual rows).

**Listener signature**: `(rowId: string, next: RowStateSnapshot<T, R> | null, prev: RowStateSnapshot<T, R> | null, reason: RowChangeReason) => void`

See [Callbacks](/guides/callbacks) for usage examples.

---

## Row Identification

When accessing rows, you can use either:

- **Row ID** (`string`) - Stable identifier that persists even when rows are filtered or sorted
- **Row Index** (`number`) - Zero-based position in the current view

Most methods accept either identifier. Choose based on what you have available. See [Data Access](/guides/data-access.md#row-identification) for more details.

---

## Framework Access

All methods above are available uniformly:

- **Vanilla JS**: Call methods directly on the `ExtableCore` instance
- **React**: Access via `ref` to `<Extable>` component
- **Vue**: Access via template ref to `<Extable>` component

See [Accessing the API](/guides/data-access.md#accessing-the-api) for framework-specific examples.
