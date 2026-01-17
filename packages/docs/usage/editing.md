# Cell Editing Guide

Extable provides intuitive cell editing with keyboard shortcuts, mouse interactions, and clipboard support compatible with Excel and Google Sheets.

## Basic Cell Selection

### Click to Select

Click any cell to select it. The cell becomes highlighted with a blue border:

```
┌─────────────────────────────┐
│ Name      │ Email           │
├─────────────────────────────┤
│ Alice     │ alice@test.com  │  ← Click to select
│ Bob       │ bob@test.com    │
└─────────────────────────────┘
```

### Drag to Select Multiple Cells

Click and drag to select multiple cells. Release to complete the selection:

```
┌─────────────────────────────┐
│ Name      │ Email           │
├─────────────────────────────┤
│ Alice     │ alice@test.com  │  ← Click and drag
│ Bob       │ bob@test.com    │     to here
│ Charlie   │ charlie@test.com│  ← Release
└─────────────────────────────┘
```

**Selection Behavior:**
- Click-drag from any cell to select a rectangular range
- Selection includes all cells within the bounding box
- Drag beyond visible area to auto-scroll

### Shift+Click to Extend Selection

Hold Shift and click another cell to extend the selection from the active cell:

```typescript
// Active cell: A1
// Shift+Click on B2
// Result: Selects range A1:B2
```

## Editing Cells

### Click & Type to Edit

Click a cell once, then start typing to replace its contents immediately:

```
┌─────────────────────────────┐
│ Name      │ Email           │
├─────────────────────────────┤
│ Alice     │ alice@test.com  │  ← Click once
│ (typing)  │                 │     then type: "Bob"
│           │                 │     → Cell becomes "Bob"
└─────────────────────────────┘
```

**Key Points:**
- First keystroke replaces cell content
- Numeric, date, and enum cells support smart formatting
- Edit mode begins immediately on any printable key

### Double-Click to Edit

Double-click (or press F2) to enter edit mode without replacing content:

```
┌─────────────────────────────┐
│ Name      │ Email           │
├─────────────────────────────┤
│ Alice     │ alice@test.com  │  ← Double-click
│ Alice|    │                 │     (cursor appears, can edit text)
└─────────────────────────────┘
```

**Use Cases:**
- Correct or append to existing text
- Edit formulas or complex values
- Navigate with arrow keys within the cell

### Keyboard Shortcuts During Edit

| Shortcut | Action |
|----------|--------|
| **Escape** | Cancel edit, discard changes |
| **Enter** | Confirm edit, move down |
| **Shift+Enter** | Confirm edit, move up |
| **Tab** | Confirm edit, move right |
| **Shift+Tab** | Confirm edit, move left |
| **Ctrl+A** | Select all text in cell (edit mode only) |
| **Ctrl+Z** | Undo (during edit) |
| **Ctrl+C** | Copy selected text |
| **Ctrl+V** | Paste into edit cell |

## Rich Editing Integrations

Extable supports "rich editing" behaviors via schema hooks:

- **Remote lookup (typeahead):** show a dropdown while typing and store a structured value with a stable ID.
- **External editor delegation:** open your own modal/editor UI and commit/cancel via a Promise result.
- **Hover tooltips (async):** compute tooltip text on hover, synchronously or asynchronously.

See the interactive demo: [Rich Editing (Lookup / External Editor / Tooltip)](/demos/rich-editing-remote)

## Navigation Between Cells

### Arrow Keys

Move between cells using arrow keys:

```
┌─────────────────────────────┐
│ A1  │ B1  │ C1              │
├─────────────────────────────┤
│ A2  │ B2* │ C2              │  ← Active cell: B2
│ A3  │ B3  │ C3              │
└─────────────────────────────┘

↑ (Up)    → Move to B1
↓ (Down)  → Move to B3
← (Left)  → Move to A2
→ (Right) → Move to C2
```

**With Selection:**
- Arrow keys while in cell: Move active cell
- Shift+Arrow: Extend selection range

### Tab to Move Right

Press Tab to confirm edit and move to the next cell (right):

```
Edit A1 → Press Tab → Move to B1
```

Press Shift+Tab to move left:

```
Edit B1 → Press Shift+Tab → Move to A1
```

### Enter to Move Down

Press Enter to confirm edit and move down:

```
Edit A1 → Press Enter → Move to A2
```

Press Shift+Enter to move up:

```
Edit A2 → Press Shift+Enter → Move to A1
```

## Bulk Input with Fill Handle

The fill handle allows quick bulk input for contiguous cells in the vertical direction.

### Using Fill Handle

Click and drag the small square at the bottom-right of the active cell downward to fill multiple cells:

```
┌─────────────────────────────┐
│ Value   │ Description       │
├─────────────────────────────┤
│ 1       │ (active cell)     │  ← Drag from here
│ 1       │ (filled)          │
│ 1       │ (filled)          │
│ 1       │ (filled)          │
└─────────────────────────────┘
```

**Fill Behaviors:**

1. **Copy Current Value** (default)
   ```
   Select: A1 = "Apple"
   Fill down to A5 → All cells = "Apple"
   ```

2. **Auto-Fill Number Sequences** (if applicable)
   ```
   Select: A1 = 1, A2 = 2
   Fill down to A5 → Cells = 1, 2, 3, 4, 5
   ```

3. **Respect Column Type**
   - Enum cells: Cycle through allowed options
   - Boolean cells: Alternate true/false
   - Date cells: Increment by 1 day
   - String cells: Repeat current value

### Fill Handle Limitations

- **Vertical Only**: Fill handle works downward only (not left/right)
- **Contiguous Cells**: Fill applies to continuous range below active cell
- **Type Preservation**: Respects column schema validation

## Copy & Paste

Extable clipboard operations are compatible with Excel, Google Sheets, and other spreadsheet applications.

### Copy Selected Cells

Select one or more cells and press Ctrl+C (or Cmd+C on Mac) to copy:

```typescript
// Select cells A1:B3
// Press Ctrl+C
// Cells copied to clipboard as tab-separated values
```

**Clipboard Format:**
```
Alice	alice@test.com
Bob	bob@test.com
Charlie	charlie@test.com
```

### Paste from External Sources

Press Ctrl+V (or Cmd+V on Mac) to paste. Extable will:

1. Parse tab-separated or comma-separated values
2. Map columns by position
3. Apply type conversion and validation
4. Create new rows if pasting beyond table bounds

**Example: Paste from Excel**

```
Excel Selection:
Name      Email
Alice     alice@test.com
Bob       bob@test.com

Paste into Extable → Creates 2 rows with name/email columns
```

### Paste Behavior

| Scenario | Behavior |
|----------|----------|
| Single cell paste | Replaces cell value |
| Multi-cell paste | Fills rectangular range |
| Paste beyond rows | Creates new rows (in commit mode) |
| Type mismatch | Applies validation; invalid cells show errors |
| Enum/Tags column | Maps values to allowed options |

### Clipboard Data Types

Extable preserves data types during copy/paste:

```typescript
// Copy: Name (string), Age (number), Active (boolean)
// Pasted data maintains types
// Numbers: "42" → 42 (number)
// Booleans: "true" → true (boolean)
// Dates: "2024-01-15" → Date object
```

## Edit Modes

Edit behavior varies by mode:

### Direct Edit Mode (Immediate Save)

- Click & type: Cell updates immediately
- Undo/redo available
- No explicit "Save" button needed

```typescript
// User edits cell A1 → "Alice"
// Cell updates instantly
// Can undo if needed
```

### Commit Mode (Batch Operations)

- Edits are queued (not immediately saved)
- Changes shown with visual indicators
- Explicit commit() call sends to server

```typescript
// User edits cell A1, A2, A3
// Changes marked as "pending"
// User clicks "Commit" to send all changes
// Server processes batch
```

### Readonly Mode

- No edits allowed
- Cells not selectable for editing
- Copy-only (viewing data)

## Tips & Tricks

### Keyboard-Only Workflow

Navigate and edit using only keyboard:

```
1. Click cell A1 (or navigate with arrows)
2. Type value for A1
3. Press Tab → Move to B1
4. Type value for B1
5. Press Enter → Move to next row
6. Continue editing without mouse
```

### Copy Multiple Columns from External Source

When pasting data from Excel with multiple columns:

```
Excel:
Name     Email           Phone
Alice    alice@test.com  555-1234
Bob      bob@test.com    555-5678

Paste into Extable → Maps to Name, Email, Phone columns by position
```

### Undo Recent Edits

Press Ctrl+Z (or Cmd+Z on Mac) to undo:

- Single cell edit
- Bulk fill operation
- Paste operation
- Row insert/delete (if supported)

### Fill Handle for Quick Data Entry

Use fill handle to rapidly populate similar values:

```
1. Enter first value in column (e.g., "Pending")
2. Select cell
3. Drag fill handle down to N cells
4. All cells fill with same value
5. Edit individual cells if needed
```
