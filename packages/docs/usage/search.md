# Search & Find-Replace Guide

Extable provides built-in Search and Find-Replace functionality via keyboard shortcuts or sidebar UI. Search is case-insensitive and supports regular expressions.

## Opening Search

### Keyboard Shortcut

Press **Ctrl+F** (Windows/Linux) or **Cmd+F** (Mac) to open the Search sidebar:

```
┌─────────────────────────────────────┐
│ Extable Table                       │
├─────────────────────────────────────┤
│ Search Panel (toggles on Ctrl+F)    │
│ ┌─────────────────────────────────┐ │
│ │ Find:     [      search box    ]│ │
│ │ Replace:  [      replace box   ]│ │
│ │                                 │ │
│ │ ☐ Match Case                    │ │
│ │ ☐ Regular Expression            │ │
│ │ [Replace] [Replace All]         │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Name      │ Email           │       │
├─────────────────────────────────────┤
│ Alice     │ alice@test.com  │ ← Highlighted matches
│ Bob       │ bob@test.com    │
└─────────────────────────────────────┘
```

### Manual UI

Click the search icon in the toolbar (if visible) to toggle the search sidebar.

## Basic Search

### Find Text

1. Open search panel (Ctrl+F)
2. Type search term in "Find" box
3. Matches are highlighted in the table
4. Navigate matches with arrow buttons or Enter key

**Example:**

```
Find: "alice"
Result:
- Highlights "alice" in Name cell
- Highlights "alice@test.com" in Email cell
- Match count displayed: "1 of 2 matches"
```

### Case Sensitivity

By default, search is **case-insensitive**:

```
Find: "ALICE" → Matches "alice", "Alice", "ALICE"
```

Enable "Match Case" for case-sensitive search:

```
Find: "Alice"  (with Match Case) → Matches only "Alice"
```

### Regular Expressions

Enable "Regular Expression" to use regex patterns:

```
Patterns:
- "^alice" → Matches "alice" at start of cell
- "test\.com$" → Matches "test.com" at end (escaped dot)
- "a.*n" → Matches "alice", "amazon", "aviation"
- "(alice|bob)" → Matches "alice" or "bob"
```

**Important:** In regex mode, dots (`.`) must be escaped as `\.` for literal matching.

## Find & Replace

### Replace One Match

1. Find text (see "Basic Search" above)
2. Navigate to desired match
3. Click "Replace" button
4. Match is replaced with text from "Replace" box

**Example:**

```
Find:    "bob"
Replace: "Bob"

Before: [bob, bob@test.com]
After:  [Bob, bob@test.com]  ← Only first match replaced
```

### Replace All Matches

Click "Replace All" to replace all matches at once:

```
Find:       "bob"
Replace:    "Bob"

Before:
[bob@test.com, bob, bob1234]

After:
[Bob@test.com, Bob, Bob1234]  ← All matches replaced
```

**Undo Support:**
- Replace operations are added to undo/redo history
- Press Ctrl+Z to undo replacements
- Press Ctrl+Shift+Z to redo

### Replace with Regex Groups

When using regex, reference captured groups with `$1`, `$2`, etc:

```
Find:    "(\w+)@(\w+\.com)"
Replace: "$1 [$2]"

Before: [alice@test.com, bob@company.com]
After:  [alice [test.com], bob [company.com]]
```

## Navigation

### Find Next / Previous

- **Enter key** or **Down arrow** → Next match
- **Shift+Enter** or **Up arrow** → Previous match
- **Match counter** shows current position: "1 of 5 matches"

### Quick Navigation

When search is open:
- Type in "Find" box → Automatically jumps to first match
- Press Enter → Jump to next match
- Shift+Enter → Jump to previous match

## Search Scope

Search operates on **all visible cells** in the table:

- Searches filtered data (if filters applied)
- Ignores hidden columns
- Respects current sort order (but search order is top-to-bottom)

### Column Selection (Optional)

Some implementations allow searching specific columns:

```
Search in: [All Columns ▼]
           - All Columns
           - Name
           - Email
           - Department
```

(Feature availability depends on configuration)

## Tips & Tricks

### Search for Empty Cells

```
Find: ^$
Enable: Regular Expression
Result: Finds all empty cells (null, undefined, empty string)
```

### Search for Numbers

```
Find: ^\d{3}-\d{4}$
Enable: Regular Expression
Result: Finds phone numbers in format "123-4567"
```

### Search for Special Characters

Escape special regex characters with backslash:

```
Find: \$100
Enable: Regular Expression
Result: Finds "$100" literally ($ is normally end-of-line in regex)
```

### Case-Insensitive Regex

Use `(?i)` flag in regex for case-insensitive matching:

```
Find: (?i)alice
Enable: Regular Expression
Result: Matches "alice", "Alice", "ALICE"
```

## Search Performance

- Search is performed on visible data (filtered data)
- Large tables (>10k rows) may take a moment
- Search results are highlighted in real-time
- Closing search sidebar stops highlighting

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl/Cmd+F** | Open/close search sidebar |
| **Enter** | Find next match |
| **Shift+Enter** | Find previous match |
| **Escape** | Close search sidebar |
| **Tab** | Move focus between Find/Replace boxes |

## Search State

Search state is **not** persisted with the view:

- Closing the sidebar clears search highlighting
- Navigating away loses search state
- Refresh the page → search is cleared

For persistent filtering, use [Filter & Sort](./sort-filter.md) instead.

## Limitations

- **Single Search:** Only one find pattern at a time
- **No Word Boundaries:** Use `\b` in regex for word boundaries
- **No Whole Word Match:** Use regex `\b` or anchor patterns
- **No Advanced Options:** Row/column scope limited

For more advanced filtering, use the [Filter & Sort](./sort-filter.md) sidebar.
