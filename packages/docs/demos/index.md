# Demos

## Interactive Examples

### Basic Usage (Embedded)

Get started with Extable using a minimal demo that loads **10,000 rows** to showcase baseline performance.

👉 **[Basic Usage Demo →](/demos/basic-usage)**

- 10,000-row dataset
- Real render time

## Feature Demonstrations

Explore individual features with focused demos:

### Data & Performance

- **[Async Data Loading →](/demos/async-data-loading)** - Load data dynamically with loading indicators

### Extra Editing Modes

- **[Readonly Mode →](/demos/readonly-mode)** - Display-only tables with no editing
- **[Commit Mode →](/demos/commit-mode)** - Stage edits before submission

### Display & Formatting & Validation

- **[Formatting →](/demos/formatting)** - Currency, dates, numbers, alignment, and styling
- **[Formulas →](/demos/formulas)** - Computed columns with formulas
- **[Conditional Style →](/demos/conditional-style)** - Apply colors and styles based on cell values
- **[Unique Constraint →](/demos/unique-constraint)** - Enforce unique values and validation
- **[Auto-fill Sequences →](/demos/auto-fill-sequence)** - Drag-fill numbers, strings, and list sequences

### Usage Sample Features

- **[Filter/Sort Sample →](/demos/filter-support)** - Column filtering and sorting

## External Demos

### Full Feature Demonstrations

For comprehensive examples including multi-user editing, server sync, and advanced features, visit the GitHub repositories:

| Framework | Repository | Features |
| --- | --- | --- |
| **Vanilla** | [packages/demo](https://github.com/shibukawa/extable/tree/main/packages/demo) | Core library, all data types, formulas, validation, multi-user sync |
| **React** | [packages/demo-react](https://github.com/shibukawa/extable/tree/main/packages/demo-react) | React hooks, uncontrolled component, state management patterns |
| **Vue** | [packages/demo-vue](https://github.com/shibukawa/extable/tree/main/packages/demo-vue) | Vue 3 setup, ref integration, reactive data patterns |

## Run Locally

To run the full demos in your development environment:

```bash
# Install dependencies
npm install

# Run Vanilla (Core) demo
npm run dev:demo

# Run React demo
npm run dev:demo-react

# Run Vue demo
npm run dev:demo-vue
```

Access at:
- Vanilla: `http://localhost:5173`
- React: `http://localhost:5174`
- Vue: `http://localhost:5175`

## Demo Features

Each demo includes:

✅ **Multiple Data Types** - strings, numbers, dates, booleans, enums, tags  
✅ **Formula & Validation** - computed columns, custom validation, error display  
✅ **Conditional Formatting** - dynamic styling based on cell values  
✅ **Unique Constraints** - prevent duplicate values  
✅ **Multi-user Editing** - concurrent edits with row-level locking  
✅ **Sort & Filter** - column-level filtering and sorting  
✅ **Performance** - test with 1K to 10K rows  

## Learning Path

1. **Start here**: [Basic Usage](/demos/basic-usage) - Understand core concepts
2. **Learn features**: [Guides](/guides/integration) - Deep dives into each capability
3. **Explore examples**: [GitHub Demos](https://github.com/shibukawa/extable) - See full implementations
4. **Reference**: [API Docs](/reference/core) - Complete API reference
