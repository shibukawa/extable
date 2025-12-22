# Unit Testing

extable provides two complementary testing strategies: light unit tests with Vitest for logic, and E2E tests with Playwright for DOM interactions.

## Testing Strategy

### Unit Tests (Vitest + jsdom)

Use for:
- Data model logic, formulas, validation
- Command queue and undo/redo
- Lock manager state transitions
- View filters and sort order

Setup:
```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- core.test.ts

# Watch mode
npm test -- --watch
```

### E2E Tests (Playwright)

Use for:
- DOM rendering in HTML mode
- Cell selection, editing, and fill handle
- User interactions (clicking, typing, copy/paste)
- Multi-user scenarios with server sync
- Visual regression testing

Setup:
```bash
# Install browsers (one-time)
npx playwright install

# Run E2E tests
npx playwright test

# Run specific test file
npx playwright test playwright/demo.spec.ts

# Debug mode (opens inspector)
npx playwright test --debug

# Show browser UI during test
npx playwright test --headed
```

See [Playwright Documentation](https://playwright.dev/docs/intro) for comprehensive API reference.

---

## E2E Testing with Playwright

### HTML Mode Rendering

extable switches to HTML mode automatically when running in jsdom. To explicitly trigger HTML mode in tests:

```typescript
import { test, expect } from "@playwright/test";

test("verify HTML table rendering", async ({ page }) => {
  await page.goto("http://localhost:5173/demo");
  
  // Wait for root container
  const root = page.locator(".extable-root");  // or custom class
  await expect(root).toBeVisible();
  
  // Wait for table element
  const table = page.locator("table");
  await expect(table).toBeVisible();
  
  // Verify table is in HTML mode
  const htmlMode = await table.getAttribute("data-extable-renderer");
  expect(htmlMode).toBe("html");
});
```

**Table Root Element Classes**

The root container receives these classes:

| Class | Condition |
|-------|-----------|
| `extable-root` | Base root element (recommended selector) |
| `extable-readonly-all` | Entire table is readonly mode |
| `extable-loading` | Table data is loading |
| `extable-filter-sort-open` | Filter/sort panel is open |
| Custom classes | From `defaultClass` option |

### Automatic HTML Mode for Playwright (Recommended)

`ExtableCore` automatically selects the HTML renderer when the User-Agent contains bot-like strings. During Playwright execution, you can add `"PlaywrightBot"` to the UA without switching render modes via UI, enabling E2E testing in HTML mode. No special global injection to `window` is performed.

```ts
// playwright.config.ts (excerpt)
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: 'http://127.0.0.1:5173',
    userAgent: `${devices['Desktop Chrome'].userAgent} PlaywrightBot`,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        userAgent: `${devices['Desktop Chrome'].userAgent} PlaywrightBot`,
        launchOptions: { args: ['--headless=old'] },
      },
    },
    // firefox / webkit should also have UA appended as needed
  ],
});
```

Example to verify HTML mode is active in tests:

```ts
await expect(page.locator('#commit-state')).toContainText('mode=html');
// or check the data-extable-renderer attribute:
await expect(page.locator('table')).toHaveAttribute('data-extable-renderer', 'html');
```

This approach eliminates the need for render mode UI interactions and enables stable E2E execution with the highly accessible HTML renderer.

### Row and Column Identification

#### By Cell Value

Find a cell containing specific text and locate its row/column:

```typescript
// Get root container
const root = page.locator(".extable-root");

// Find a cell with value "Alice"
const cell = root.locator("td:has-text('Alice')");

// Get the row (tr) containing this cell
const row = cell.locator("xpath=ancestor::tr");

// Get all cells in this row
const rowCells = row.locator("td");

// Get the column index
const cellIndex = await cell.locator("xpath=parent::tr/td[contains(., 'Alice')]/preceding-sibling::td").count();
```

#### By Row Index

Access a specific row by position (0-indexed):

```typescript
const root = page.locator(".extable-root");

// Get the 3rd data row (skipping header)
const row = root.locator("table tbody tr").nth(2);

// Get all cells in that row
const cells = row.locator("td");

// Access a specific cell in the row
const nameCell = row.locator("td").nth(1);  // Column index 1
```

#### By Column Index

Access all cells in a specific column:

```typescript
const root = page.locator(".extable-root");

// Get all cells in column 2 (excluding header)
const columnCells = root.locator("table tbody tr td:nth-child(3)");

// Get specific cell: row 1, column 2
const cell = root.locator("table tbody tr").nth(1).locator("td").nth(2);
```

#### By Column Key (Schema Attribute)

If columns have data attributes (recommended):

```typescript
const root = page.locator(".extable-root");

// Assume table renders <td data-colkey="name">
const nameColumn = root.locator("td[data-colkey='name']");

// Get first cell in name column
const firstNameCell = root.locator("table tbody tr").nth(0).locator("td[data-colkey='name']");

// Get all name cells in column
const allNameCells = root.locator("table tbody td[data-colkey='name']");
```

#### By Row ID (If Available)

If rows have data attributes for row IDs:

```typescript
const root = page.locator(".extable-root");

// Assume table renders <tr data-rowid="row123">
const row = root.locator("tr[data-rowid='row123']");

// Get cells in this row
const cells = row.locator("td");
```

### Data Retrieval

#### Get Cell Value

```typescript
const root = page.locator(".extable-root");
const cell = root.locator("table tbody tr").nth(0).locator("td").nth(1);

// Get text content of a cell
const cellValue = await cell.textContent();
console.log(cellValue);  // "Alice"

// Get inner HTML (includes formatting)
const cellHTML = await cell.innerHTML();

// Get input element value (if cell is in edit mode)
const inputValue = await cell.locator("input").inputValue();
```

#### Get Row Data

```typescript
const root = page.locator(".extable-root");

// Get all cell values from a row as array
const row = root.locator("table tbody tr").nth(0);
const cellValues = await row.locator("td").allTextContents();
// Returns: ["1", "Alice", "30"]
```

#### Get Column Data

```typescript
const root = page.locator(".extable-root");

// Get all values from a column
const nameColumn = root.locator("table tbody td[data-colkey='name']");
const nameValues = await nameColumn.allTextContents();
// Returns: ["Alice", "Bob", "Charlie"]
```

#### Get Entire Table Data

```typescript
const root = page.locator(".extable-root");

// Get all table data as 2D array
const rows = root.locator("table tbody tr");
const rowCount = await rows.count();
const tableData = [];

for (let i = 0; i < rowCount; i++) {
  const cells = rows.nth(i).locator("td");
  const rowData = await cells.allTextContents();
  tableData.push(rowData);
}

console.log(tableData);
// [
//   ["1", "Alice", "30"],
//   ["2", "Bob", "25"],
//   ["3", "Charlie", "28"]
// ]
```

### Cell Editing

#### Single Cell Edit

```typescript
const root = page.locator(".extable-root");

// Locate and edit a cell
const cell = root.locator("td[data-colkey='name']").nth(0);

// Click to enter edit mode
await cell.click();

// Type new value
await cell.locator("input").fill("NewName");

// Confirm edit (press Enter or Tab)
await cell.locator("input").press("Enter");

// Verify the new value
const newValue = await cell.textContent();
await expect(newValue).toBe("NewName");
```

#### Bulk Edit via Fill Handle

```typescript
const root = page.locator(".extable-root");

// Simulate drag-to-fill in a single cell
const startCell = root.locator("td[data-colkey='value']").nth(0);

// Click cell
await startCell.click();

// Type value
await startCell.locator("input").fill("100");

// Confirm
await startCell.locator("input").press("Enter");

// Verify
const value = await startCell.textContent();
await expect(value).toBe("100");
```

#### Multiple Cell Edits

```typescript
const root = page.locator(".extable-root");

// Edit multiple cells sequentially
const cells = [
  { row: 0, col: 1, value: "Alice" },
  { row: 1, col: 1, value: "Bob" },
  { row: 2, col: 2, value: "35" }
];

for (const edit of cells) {
  const cell = root.locator("table tbody tr").nth(edit.row).locator("td").nth(edit.col);
  await cell.click();
  await cell.locator("input").fill(edit.value);
  await cell.locator("input").press("Enter");
}
```

### Style Classes and Attributes

#### Get Style Classes

```typescript
const root = page.locator(".extable-root");
const cell = root.locator("td[data-colkey='name']").nth(0);

// Get all classes on a cell
const classList = await cell.getAttribute("class");
console.log(classList);  // "ext-cell ext-readonly ext-error"

// Check if cell has specific class
const isReadonly = await cell.evaluate(el => el.classList.contains("ext-readonly"));
const isError = await cell.evaluate(el => el.classList.contains("ext-error"));
```

#### Get Computed Styles

```typescript
const root = page.locator(".extable-root");
const cell = root.locator("td[data-colkey='value']").nth(0);

// Get computed CSS property
const bgColor = await cell.evaluate(el => window.getComputedStyle(el).backgroundColor);
const textColor = await cell.evaluate(el => window.getComputedStyle(el).color);

console.log({ bgColor, textColor });  // { bgColor: "rgb(255, 0, 0)", textColor: "rgb(0, 0, 0)" }
```

#### Check Style Conditions

```typescript
const root = page.locator(".extable-root");
const cell = root.locator("td[data-colkey='status']").nth(0);

// Verify cell is highlighted (error state)
await expect(cell).toHaveClass(/ext-error/);

// Verify cell is readonly
await expect(cell).toHaveClass(/ext-readonly/);

// Verify background color (conditional formatting)
const hasRedBg = await cell.evaluate(el => {
  const style = window.getComputedStyle(el);
  return style.backgroundColor.includes("rgb(255"); // Red-ish
});
await expect(hasRedBg).toBe(true);
```

### Available Style Classes

extable applies these CSS classes to cells:

#### State Classes

| Class | Condition | Usage |
|-------|-----------|-------|
| `ext-selected` | Cell is selected | Highlight during interaction |
| `ext-editing` | Cell is in edit mode | Show input field |
| `ext-readonly` | Cell is readonly | Disable input |
| `ext-error` | Formula/validation error | Red outline |
| `ext-warning` | Formula warning (e.g., `[value, Error]`) | Yellow triangle or warning icon |

#### Column Type Classes

| Class | Condition |
|-------|-----------|
| `ext-type-string` | Column type is "string" |
| `ext-type-number` | Column type is "number" |
| `ext-type-boolean` | Column type is "boolean" |
| `ext-type-date` | Column type is "date" |
| `ext-type-datetime` | Column type is "datetime" |
| `ext-type-enum` | Column type is "enum" |
| `ext-type-tag` | Column type is "tag" |

#### Formatting Classes

| Class | Condition |
|-------|-----------|
| `ext-align-left` | Column alignment left |
| `ext-align-right` | Column alignment right |
| `ext-align-center` | Column alignment center |
| `ext-strikethrough` | Strikethrough style applied |
| `ext-underline` | Underline style applied |
| `ext-bold` | Bold style applied |
| `ext-italic` | Italic style applied |

#### Row State Classes

| Class | Condition |
|-------|-----------|
| `ext-row-locked` | Row is locked (multi-user) |
| `ext-row-readonly` | Row is readonly |
| `ext-row-pending` | Row has pending edits (commit mode) |

### Testing Examples

#### Test 1: Verify Cell Display

```typescript
test("display cell value correctly", async ({ page }) => {
  await page.goto("http://localhost:5173/demo");
  
  const root = page.locator(".extable-root");
  
  // Wait for table
  await expect(root).toBeVisible();
  
  // Get first name cell
  const nameCell = root.locator("table tbody tr").nth(0).locator("td").nth(1);
  
  // Verify value
  await expect(nameCell).toHaveText("Alice");
});
```

#### Test 2: Edit Cell and Verify

```typescript
test("edit cell and persist value", async ({ page }) => {
  await page.goto("http://localhost:5173/demo");
  
  const root = page.locator(".extable-root");
  const cell = root.locator("table tbody tr").nth(0).locator("td").nth(1);
  
  // Edit
  await cell.click();
  await cell.locator("input").fill("UpdatedName");
  await cell.locator("input").press("Enter");
  
  // Verify new value
  await expect(cell).toHaveText("UpdatedName");
});
```

#### Test 3: Verify Readonly Cell

```typescript
test("readonly cell prevents editing", async ({ page }) => {
  await page.goto("http://localhost:5173/demo");
  
  const root = page.locator(".extable-root");
  const readonlyCell = root.locator("td[data-colkey='id']").nth(0);
  
  // Verify class
  await expect(readonlyCell).toHaveClass(/ext-readonly/);
  
  // Attempt to edit should fail
  await readonlyCell.click();
  
  // Verify input is not present (or disabled)
  const input = readonlyCell.locator("input");
  await expect(input).not.toBeVisible();
});
```

#### Test 4: Verify Error Styling

```typescript
test("invalid formula shows error state", async ({ page }) => {
  await page.goto("http://localhost:5173/demo");
  
  const root = page.locator(".extable-root");
  const cell = root.locator("td[data-colkey='computed']").nth(0);
  
  // Verify error class
  await expect(cell).toHaveClass(/ext-error/);
  
  // Verify red outline or similar styling
  const hasBorder = await cell.evaluate(el => {
    const style = window.getComputedStyle(el);
    return style.borderColor.includes("rgb(255, 0, 0)"); // Red
  });
  
  await expect(hasBorder).toBe(true);
});
```

#### Test 5: Get Column Data

```typescript
test("retrieve all values from column", async ({ page }) => {
  await page.goto("http://localhost:5173/demo");
  
  const root = page.locator(".extable-root");
  const ageColumn = root.locator("table tbody td[data-colkey='age']");
  const ages = await ageColumn.allTextContents();
  
  await expect(ages).toEqual(["30", "25", "28"]);
});
```

#### Test 6: Verify Conditional Formatting

```typescript
test("apply conditional formatting based on value", async ({ page }) => {
  await page.goto("http://localhost:5173/demo");
  
  const root = page.locator(".extable-root");
  const ageCell = root.locator("table tbody tr").nth(0).locator("td[data-colkey='age']");
  
  // If age > 25, background should be green
  const bgColor = await ageCell.evaluate(el => {
    return window.getComputedStyle(el).backgroundColor;
  });
  
  await expect(bgColor).toMatch(/rgb\(0, 255, 0\)/);  // Green
});
```

---

## Unit Testing with Vitest

### Basic Test Structure

```typescript
// core.test.ts
import { describe, it, expect } from "vitest";
import { ExtableCore } from "../src/index";

describe("Table", () => {
  it("initializes with data", () => {
    const data = {
      rows: [
        { id: "1", name: "Alice", age: 30 },
        { id: "2", name: "Bob", age: 25 }
      ]
    };
    
    const table = new ExtableCore({
      root: document.createElement("div"),
      defaultData: data,
      defaultView: {},
      schema: {
        columns: [{ key: "name", header: "Name", type: "string" }]
      }
    });
    
    expect(table.getAllRows()).toHaveLength(2);
  });
});
```

### Testing Data Model

```typescript
describe("DataModel", () => {
  it("sets and retrieves cell values", () => {
    const table = new ExtableCore({ root, defaultData, defaultView, schema, options: { editMode: "direct" } });
    
    // Set a cell value
    table.setCellValue("row1", "name", "NewValue");
    
    // Verify value
    const value = table.getCell("row1", "name");
    expect(value).toBe("NewValue");
  });
});
```

### Testing Formulas

```typescript
describe("Formulas", () => {
  it("computes cell value from formula", () => {
    const schema = {
      columns: [
        { key: "qty", type: "number" },
        { key: "price", type: "number" },
        {
          key: "total",
          type: "number",
          formula: (row) => row.qty * row.price
        }
      ]
    };
    
    const data = [{ id: "1", qty: 5, price: 10 }];
    
    const table = new ExtableCore({
      root: document.createElement("div"),
      defaultData: data,
      defaultView: {},
      schema
    });
    
    const rowId = table.getAllRows()[0].id;
    const total = table.getCell(rowId, "total");
    expect(total).toBe(50);
  });
});
```

### Testing Undo/Redo

```typescript
describe("Undo/Redo in Commit Mode", () => {
  it("undoes a cell edit", async () => {
    const table = new ExtableCore({
      root: document.createElement("div"),
      defaultData: [{ id: "1", name: "Alice" }],
      defaultView: {},
      schema: { columns: [{ key: "name", type: "string" }] },
      options: { editMode: "commit" }
    });
    
    const rowId = table.getAllRows()[0].id;

    // Edit a cell
    table.setCellValue(rowId, "name", "Bob");
    expect(table.canUndo()).toBe(true);
    
    // Undo
    table.undo();
    const value = table.getCell(rowId, "name");
    expect(value).toBe("Alice");
  });
  
  it("clears history after commit", async () => {
    const table = new ExtableCore({
      root: document.createElement("div"),
      defaultData: [{ id: "1", name: "Alice" }],
      defaultView: {},
      schema: { columns: [{ key: "name", type: "string" }] },
      options: {
        editMode: "commit",
        server: mockServer,
        user: { id: "user1", name: "User One" }
      }
    });
    
    const rowId = table.getAllRows()[0].id;

    // Edit and commit
    table.setCellValue(rowId, "name", "Bob");
    await table.commit();
    
    // History should be cleared
    expect(table.canUndo()).toBe(false);
  });
});
```

---

## Best Practices

1. **Prefer HTML Mode**: Use HTML mode for E2E tests to ensure DOM accessibility
2. **Explicit Waits**: Wait for selectors before interacting
3. **Data Attributes**: Add `data-colkey` and `data-rowid` to table cells for reliable selection
4. **Isolated Tests**: Each test should be independent and not rely on test order
5. **Mock Server**: Mock server responses in E2E tests to control behavior
6. **Test Critical Paths**: Focus on user workflows (edit, commit, error handling)
7. **Accessibility**: Verify semantic HTML and ARIA attributes where applicable

## See Also

- [Playwright Docs](https://playwright.dev)
- [Vitest Docs](https://vitest.dev)
- [HTML Mode Guide](/guides/unit-testing)
- [Edit Modes](/guides/editmode)
