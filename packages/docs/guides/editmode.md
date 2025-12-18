# Edit Modes

extable supports three distinct edit modes that control how users interact with the table and when changes are persisted. Each mode is optimized for different use cases: immediate updates, transaction-like workflows, and view-only access.

## Overview

Edit modes determine:
- **When changes apply**: Immediately or after explicit commit
- **Undo/Redo availability**: Always available (commit mode) or not applicable (readonly)
- **Data persistence**: Local only or synchronized with server
- **Lock management**: Row-level locks released on commit (commit mode) or never acquired (direct/readonly)

| Mode | Update Timing | Persistence | Lock Management | Undo/Redo | Use Case |
|------|---------------|-------------|-----------------|-----------|----------|
| `"direct"` | Immediate | On every edit | None | Not tracked | Excel-like editing, single-user |
| `"commit"` | On explicit call | Batch on commit | Released per row | Full history | Multi-user, transaction safety |
| `"readonly"` | N/A | Read-only | None | N/A | View-only, cell copying allowed |

## Direct Mode

The default mode (`editMode: "direct"`), direct mode delivers an Excel-like editing experience with immediate updates and no friction.

### Behavior

- **Immediate Application**: Each cell edit is applied directly to the data model and persisted immediately
- **No Pending State**: Changes become part of the permanent record immediately
- **No Explicit Commit**: There is no `commit()` operation; edits flow straight through
- **No Undo/Redo**: Changes are committed immediately, so undo/redo is not available
- **No Server Sync**: Suited for single-user or immediate-consistency scenarios; if a server is present, each edit triggers a separate commit notification

### Implementation

When a user edits a cell in direct mode:

```typescript
// User edits cell (row123, "name", "Alice")
table.handleEdit(
  { kind: "edit", rowId: "row123", colKey: "name", next: "Alice", prev: "Bob" },
  commitNow: true  // Direct mode always passes commitNow=true
);
```

The sequence is:
1. **Validation & Readonly Checks**: The edit is rejected if the cell is readonly (column or row level)
2. **Table Update**: `table.setCellValue(rowId, colKey, value)` immediately updates the raw row data
3. **Pending State Cleared**: No pending state is maintained; the change is final
4. **Render & Notify**: The view is re-rendered and table state is emitted to listeners
5. **Server Sync (if applicable)**: `sendCommit()` sends a single-cell command to the server

### Example

```typescript
// Create table in direct mode
const table = new ExtableCore({
  root: element,
  defaultData: {
    rows: [
      { id: "1", name: "Alice", age: 30 },
      { id: "2", name: "Bob", age: 25 }
    ]
  },
  defaultView: {},
  schema: {
    columns: [
      { key: "name", header: "Name", type: "string" },
      { key: "age", header: "Age", type: "number" }
    ]
  },
  options: { editMode: "direct" }  // Default; omit if preferred
});

// User types into a cell → immediately reflected
// No need to call commit()
```

## Commit Mode

Commit mode (`editMode: "commit"`) is designed for multi-user scenarios with transaction-like semantics. Changes accumulate in a pending buffer until an explicit `commit()` call persists them.

### Behavior

- **Pending Updates**: Cell edits are queued in the command queue but not applied to raw data
- **Staged Edits**: Edits are visible in the UI (via the pending map in data model) but not persisted
- **Explicit Commit**: The application calls `await table.commit()` to batch-persist all pending changes
- **Undo/Redo**: Full history is maintained; users can undo/redo edits before committing
- **Lock Management**: Row-level locks are acquired when a row is first edited and released on commit
- **Server Sync**: All pending changes are sent in a single batch to the server on commit

### Implementation

When a user edits a cell in commit mode:

```typescript
// User edits cell (row123, "name", "Alice")
table.handleEdit(
  { kind: "edit", rowId: "row123", colKey: "name", next: "Alice", prev: "Bob" },
  commitNow: false  // Commit mode always passes commitNow=false
);
```

The sequence is:
1. **Validation & Readonly Checks**: The edit is rejected if the cell is readonly
2. **Command Enqueue**: The edit is added to the command queue (grouped by batchId if present)
3. **Pending State**: `table.setCellValue(rowId, colKey, value)` stores the change in the pending map (commit mode)
4. **Render & Notify**: The view is re-rendered to show the staged value, but raw data is unchanged
5. **No Immediate Server Sync**: The server is not contacted; all changes wait for explicit commit

### Commit API

#### `async commit(): Promise<void>`

Executes a batch commit of all pending changes. This method:

1. **Collects Pending Commands**: Retrieves all accumulated edits from the command queue
2. **Applies to Raw Data**: Moves each pending change from the pending map to raw row data during `table.commit()`
3. **Sends to Server**: Calls `sendCommit(commands)` to transmit the batch to the server via the configured transport
4. **Lock Release**: Calls `lockManager.unlockOnCommit()` to release row-level locks for all rows except the last edited one (server policy allows keeping one row locked for convenience)
5. **Clears History**: Empties the command queue and clears all undo/redo history
6. **Updates View**: Re-renders the table and emits updated table state
7. **Error Handling**: If server commit fails, an error entry is added to `activeErrors` with scope "commit"

```typescript
// Batch-commit all pending edits
try {
  await table.commit();
  // All changes now persisted to server
  // Undo/redo history cleared
} catch (e) {
  console.error("Commit failed:", e);
  // Pending edits remain in buffer; user can retry
}
```

### Example

```typescript
// Create table in commit mode
const table = new ExtableCore({
  root: element,
  defaultData: {
    rows: [
      { id: "1", name: "Alice", age: 30 },
      { id: "2", name: "Bob", age: 25 }
    ]
  },
  defaultView: {},
  schema: {
    columns: [
      { key: "name", header: "Name", type: "string" },
      { key: "age", header: "Age", type: "number" }
    ]
  },
  options: {
    editMode: "commit",
    server: myTransport,  // WebSocket, fetch+SSE, or polling
    user: { id: "user1", name: "User One" }
  }
});

// User types in cells (A1, A2, B1) → changes staged in pending buffer
// Undo/redo available for any staged edit

// When ready, call commit
await table.commit();
// All three edits sent to server in one batch
// Pending cleared, history reset
```

### Pending State

While in commit mode, staged changes are visible to the application via the data model's pending map. You can inspect which cells are pending:

```typescript
// After editing a few cells but before commit
const pending = table.getPending();
// Returns: { "row1": { "name": "New Name" }, "row2": { "age": 35 } }
```

### Undo/Redo in Commit Mode

Because commit mode accumulates all edits in the command queue, full undo/redo history is available:

```typescript
// Edit cell A1, A2, B1 (3 separate edits)
if (table.canUndo()) table.undo();  // Reverts B1
if (table.canUndo()) table.undo();  // Reverts A2
if (table.canUndo()) table.undo();  // Reverts A1

// Can now redo
if (table.canRedo()) table.redo();  // Re-applies A1
```

#### History Lifecycle

The history lifecycle in commit mode follows a clear pattern:

| Phase | History Status | Behavior |
|-------|---|---|
| **Editing** | 📝 Active | Undo/redo available; edits accumulate in command queue |
| **Before commit()** | 📝 Active | User can undo/redo any staged edits |
| **During commit()** | 🔄 Clearing | Commands sent to server; row locks released |
| **After commit()** | 🗑️ Cleared | `commandQueue.clear()` empties all history; undo/redo disabled |

#### History Clearing on Commit

When `commit()` executes, it performs these steps:

1. **Collects pending commands** from the queue
2. **Persists all edits** to raw data
3. **Sends batch to server** (via `sendCommit(commands)`)
4. **Releases locks** for edited rows
5. **Clears all history**:
   ```typescript
   this.commandQueue.clear();  // Empties applied[] and undone[]
   ```
6. Re-renders and emits table state

This means **all undo/redo history is lost after commit**, which is intentional: once changes are persisted to the server, they become part of the permanent record and cannot be undone locally.

#### Practical Workflow

```typescript
// Commit mode: editing phase
const table = new ExtableCore({ root, defaultData, defaultView, schema, options: { editMode: "commit" } });

// User makes edits
// table.canUndo() → true
// table.canRedo() → true (if user has undone something)

// User reviews and commits
await table.commit();

// After commit, history is reset
// table.canUndo() → false
// table.canRedo() → false

// New edits start a fresh history
```

#### When History is NOT Cleared

History is **only** cleared on successful `commit()`. If commit fails:

```typescript
try {
  await table.commit();
} catch (e) {
  // Commit failed; history remains intact
  // User can still undo/redo and retry
  console.warn("Commit failed, please retry:", e);
}
```

In this case, all pending edits remain in the buffer and undo/redo is still available for the next attempt.

All undo/redo history is discarded once `commit()` is called successfully.

## Readonly Mode

Readonly mode (`editMode: "readonly"`) disables all direct cell editing but allows read operations and cell copying.

### Behavior

- **No Cell Editing**: Cell input is rejected; `handleEdit()` returns early
- **Cell Copying**: Users can still select and copy cell values
- **View-Only**: The table renders normally but cells are styled to indicate non-editable state
- **No Pending State**: The readonly flag prevents any command enqueueing
- **No Commit Needed**: There is no data to commit

### Readonly vs. Column/Row Level

Readonly mode is a global setting that disables editing for the entire table. For cell-level or row-level control, use:

- **Column-level readonly**: Set `readonly: true` in the column schema
  ```typescript
  schema: [
    { key: "id", label: "ID", readonly: true },  // ID never editable
    { key: "name", label: "Name" }                // Name always editable (unless row-readonly)
  ]
  ```

- **Row-level readonly**: Set `_readonly: true` on a row object
  ```typescript
  data: [
    { id: "1", name: "Alice", _readonly: true },  // Entire row 1 is readonly
    { id: "2", name: "Bob" }                       // Row 2 cells editable per column schema
  ]
  ```

- **Cell-level readonly via formulas**: Use a formula to compute readonly status per cell
  ```typescript
  schema: [
    { key: "name", label: "Name", readonly: (rowObj, colKey) => rowObj.locked === true }
  ]
  ```

When the table is in readonly mode (`editMode: "readonly"`), all cells are readonly regardless of column/row settings.

### Switching Out of Readonly

To allow editing again, call:

```typescript
table.setEditMode("direct");  // or "commit"
```

This re-renders the table and emits a table state update so listeners can update their UI (e.g., enable a save button).

### Example

```typescript
// Create table in readonly mode
const table = new ExtableCore({
  root: element,
  defaultData: {
    rows: [
      { id: "1", name: "Alice", age: 30 },
      { id: "2", name: "Bob", age: 25 }
    ]
  },
  defaultView: {},
  schema: {
    columns: [
      { key: "name", header: "Name", type: "string" },
      { key: "age", header: "Age", type: "number" }
    ]
  },
  options: { editMode: "readonly" }
});

// Users can view and copy but not edit
// "Select all (Ctrl+C)" works; "edit" does nothing

// Later, enable editing
table.setEditMode("commit");
// Table re-renders; cells become editable
```

## Switching Edit Modes

Use `setEditMode(mode)` to switch modes at runtime. This is useful for workflows like:

- Start in readonly (viewing), then enable commit mode (editing with undo), then commit
- Disable editing after commit to prevent stale edits

```typescript
table.setEditMode("readonly");   // Disable editing
table.setEditMode("commit");     // Enable batch editing
await table.commit();            // Persist all pending
table.setEditMode("readonly");   // Lock after commit
```

### Re-render & State Emission

Switching edit modes triggers:
- **Conditional re-render**: If switching between readonly and editable, the table is re-rendered (e.g., to update input enable state)
- **Table state emission**: `emitTableState()` notifies listeners of the mode change
- **Selection update**: The current selection context is emitted with a refresh signal

## Server Interaction

### In Direct Mode

Each edit immediately calls `sendCommit()` with a single-cell command. This is appropriate for:
- Single-user tables (no concurrency)
- Immediate consistency requirements
- Server-less workflows (sendCommit is a no-op)

### In Commit Mode

All pending edits are batched and sent on explicit `commit()`. This is appropriate for:
- Multi-user scenarios with lock-based concurrency control
- Transactional consistency (all-or-nothing semantics)
- Server-driven lock management (locks released per `unlockOnCommit`)
- Minimizing network traffic (one request per user action)

### Server Implementation

The server is provided as part of the table configuration:

```typescript
interface Extable {
  server?: {
    commit(commands: Command[], user: UserInfo): Promise<void>;
    unlockRows(rowIds: string[], user: UserInfo): Promise<void>;
    // ... other methods
  };
  user?: UserInfo;
}
```

When `commit()` is called in commit mode or each edit in direct mode, the table invokes:

```typescript
await this.server.commit(commands, this.user);
```

The server processes the commands (validating, persisting, publishing updates to other clients) and optionally sends back notifications via the `handleServerEvent` callback.

### Error Handling

If the server commit fails:

```typescript
try {
  await this.server.commit(commands, this.user);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  this.activeErrors = [
    ...this.activeErrors.filter((x) => x.scope !== "commit"),
    { scope: "commit", message: msg }
  ];
  this.emitTableState();
}
```

The error is stored in `activeErrors` (filtered by scope "commit" to avoid duplicates) and the table state is updated so the UI can display the error message.

## Choosing an Edit Mode

### Use **Direct** if:
- Single-user or no concurrency
- Immediate consistency acceptable
- No need for undo/redo before final save
- Excel-like feel desired

### Use **Commit** if:
- Multi-user editing with server sync
- Transactional semantics important
- Undo/redo before commit desired
- Row-level lock management needed
- Minimize server traffic

### Use **Readonly** if:
- Viewing or reporting (no editing)
- Temporarily disable editing (e.g., pending server response)
- Share-only tables (cell copying allowed)
- Enforce read-only access for compliance

## See Also

- [Data Access](/guides/data-access): Subscribe to changes, retrieve pending edits, handle commits
- [Readonly Columns](/guides/style#readonly-columns): Column-level and row-level readonly via schema
- [Formulas](/guides/formulas): Computed cells and error handling
- [Multi-User Editing](/concepts/uncontrolled): Sync and lock model
