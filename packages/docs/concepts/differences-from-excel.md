# Differences from Excel

## Why Extable Exists

Excel is ubiquitous not because it is a spreadsheet application, but because it has become **the de facto tool for data editing and information exchange** on the web and in organizations. Beyond pure spreadsheet calculations, people use Excel as:

- A data entry and validation tool
- A structured data editor
- An information collection and submission interface
- A bulk data import/export mechanism

Extable exists to bring this **data editing and information handling experience to the web**, without requiring spreadsheet calculation capabilities.

## Excel-Like Features Extable Provides

Extable implements many of Excel's usability patterns that make it effective as a data editing tool:

- **Direct cell editing**: Click a cell to enter or modify values
- **Bulk operations**: Copy and paste multiple cells at once (array data, not just text)
- **Multi-column sorting and filtering**: Quickly organize and focus on relevant data
- **Conditional formatting**: Visual feedback based on cell values or conditions
- **Simple formula support**: Computed columns driven by formulas, not arbitrary user-defined logic
- **Column freezing**: Keep key identifier columns visible while scrolling horizontally

All of these features combine to create an intuitive, familiar interface for structured data manipulation.

## Where Extable Differs

However, Extable is **not a spreadsheet application** and makes deliberate trade-offs:

### Fixed Column Schema

Excel allows users to define any structure and formula they want. Extable adopts a **fixed column schema** approach instead:

```typescript
const schema = [
  { name: 'id', type: 'string', label: 'ID', readonly: true },
  { name: 'productName', type: 'string', label: 'Product' },
  { name: 'quantity', type: 'number', label: 'Qty', nullable: false },
  { name: 'unitPrice', type: 'number', label: 'Unit Price' },
  { name: 'total', type: 'number', label: 'Total', 
    formula: ({ quantity, unitPrice }) => quantity * unitPrice }
];
```

The **application developer** defines the columns, their types, validation rules, and any computed columns using JavaScript code. Formulas are not entered by users in cells with `=` syntax—they are written as code in the schema definition during development. This means:

- **Developer-defined functions are fully supported**: You can write any JavaScript logic as a formula function
- **Users cannot define formulas**: Spreadsheet end-users cannot add or modify formulas; they only work with the columns and behaviors you provide
- **Data integrity**: Only valid structures and types are accepted
- **Predictable behavior**: No unexpected formula errors or circular references
- **Simpler API**: Developers have clear control over data shape and validation
- **Better collaboration**: Schema changes are versioned and deployed, not hidden in user modifications

### Vertical-Only Filtering and Sorting

Excel allows filtering and sorting by any dimension. Extable restricts operations to the **vertical axis only**:

- Filter rows based on column values
- Sort rows by one or multiple columns
- Cannot transpose or pivot data horizontally

This reflects the most common web use case: users browse and filter a list of records, not reorganize data structure. It also simplifies state management and performance in multi-user environments.

### Data, Schema, View Separation

In Excel, the file is monolithic—data, formulas, and display settings are tightly coupled. Extable separates these concerns:

- **Data**: Array of objects/arrays representing the actual records
- **Schema**: Column definitions (name, type, validation, readonly, formulas, styling)
- **View**: Per-user state (visible columns, sort order, filters, selected cells)

```typescript
// Developer manages data lifecycle
const [data, setData] = useState(initialData);

// Schema is defined once and versioned with the app
const schema = [...];

// View state is local to each user's session
const [view, setView] = useState({ columnOrder: [...], filters: {} });
```

This design is especially important in **multi-user scenarios**:

- Multiple users can have different column visibility and filter settings without affecting the shared data
- Schema updates propagate consistently across all sessions
- User-specific view state doesn't interfere with data integrity

### Edit Mode and Commit Pattern

Excel saves changes immediately as you type. Extable supports a **staged edit and commit pattern** to handle collaborative scenarios more gracefully:

```typescript
// User edits multiple cells
table.editCell(rowIndex, colName, newValue);  // updates UI state
table.editCell(rowIndex, colName2, newValue2);

// When ready, commit all changes as a batch
table.commit().then(() => {
  // Send to server, update database, etc.
});
```

This allows:

- **Batch operations**: Group related changes and send them together
- **Validation**: Check all edits before committing; rollback if needed
- **Row-level locking**: In multi-user mode, lock is acquired at commit time and released once confirmed
- **Undo/redo within session**: Revert edits before committing
- **Data tool workflows**: "Edit multiple entries, review, then save"—common in data import/admin panels

## When to Use Extable

Extable is ideal for:

- ✅ **Structured data entry**: Fixed form-like tables with specific columns and types
- ✅ **Data import/export**: Bulk upload or download of records
- ✅ **Admin panels and dashboards**: CRUD operations on application data
- ✅ **Collaborative data editing**: Multiple users viewing and editing the same dataset
- ✅ **Search, filter, sort workflows**: Users need to quickly find and organize records

Extable is **not** a good fit for:

- ❌ **Free-form spreadsheets**: Users need to create arbitrary columns, formulas, and pivot tables
- ❌ **Heavy financial modeling**: Complex calculations, scenario planning, macros
- ❌ **Pivot tables and cross-tabs**: Data reorganization across dimensions
- ❌ **User-defined functions**: Extensible formula language required

## Next Steps

- Learn how to [define your schema and data format](/concepts/data-schema-view)
- Understand [uncontrolled-only philosophy](/concepts/uncontrolled) to integrate Extable with your app
- Explore [readonly and loading states](/guides/editmode) for various use cases
