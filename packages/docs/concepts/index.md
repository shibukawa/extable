# Extable Design Concepts

Extable is an Excel-like HTML table component designed to simplify data management in web applications. Rather than building spreadsheet-like functionality from scratch, Extable provides a focused, opinionated set of features that developers can leverage immediately.

## Design Philosophy

### 1. Excel Familiarity

Users who are comfortable with Excel expect certain behaviors from data tables:

- **Direct Cell Editing** - Click cells and edit values inline, just like Excel
- **Fill Handle** - Drag cells to auto-fill values and patterns across multiple rows
- **Copy & Paste** - Full keyboard support for standard copy (Cmd/Ctrl+C) and paste (Cmd/Ctrl+V) operations
- **Built-in Filtering & Sorting** - Click column headers to open filter menus (including distinct value filters, error filters, and sort options)

This familiarity dramatically reduces the learning curve and increases user adoption.

### 2. Performance via Canvas

For tables with hundreds or thousands of rows, rendering to the DOM becomes a performance bottleneck. Extable can render using HTML5 Canvas for speed, while maintaining HTML table mode for:

- **Testing** - HTML table cells are directly accessible via standard DOM selectors, making end-to-end tests straightforward
- **Accessibility** - Semantic HTML provides better accessibility support
- **Debugging** - Developers can inspect the rendered table directly in the browser

The rendering mode is configurable per deployment, allowing teams to optimize for their use case (Canvas for performance-critical dashboards, HTML for test-heavy development).

### 3. Specialized Use-Case Support

Rather than trying to be "everything to everyone," Extable is built for specific data management patterns:

- **View-Only Mode** - Display read-only data with built-in filters and sorts
- **Direct Edit Mode** - Immediate value updates for data entry applications
- **Commit Mode** - Batch editing with explicit commit/rollback for data safety and transaction-like semantics

Each mode is optimized with minimal setup, so you don't have to wire up complex state management or validation logic.

### 4. Schema-Driven Design

Configuration is centralized in a schema object that declares:

- Column definitions (key, type, readonly, formatting)
- Validation rules (unique constraints, custom formulas)
- Conditional styling based on values
- Formula columns that compute derived values from editable columns

This schema-first approach makes table behavior predictable and easy to reason about.

**Fixed Column Schema** - Unlike spreadsheets where users can arbitrarily add/remove/reorder columns, Extable enforces a fixed schema. This is intentional: in business applications where tables serve as data entry forms (e.g., importing from Excel into a system), managing arbitrary columns places significant burden on backend systems. By fixing the schema upfront, both frontend and backend can assume consistent data structure, simplifying validation, storage, and auditing.

### 5. Multi-User Collaboration (Future)

While not yet fully tested in production, Extable is architected to support collaborative editing in the future:

- Row-level locking to prevent concurrent edits
- Command-stream architecture for change transmission
- Pluggable transport layer (WebSocket, fetch+SSE, polling) to adapt to your infrastructure
- Server-driven lock timeouts for resilience

This foundation allows teams to incrementally add real-time collaboration without major refactoring.

## Why Extable?

The landscape of web table libraries is large, but most focus on either:

1. **Lightweight display** - Limited editing, filtering, or interactivity
2. **Full spreadsheet emulation** - Massive bundle size and API complexity
3. **Low-level building blocks** - Requiring significant custom work to achieve common patterns

Extable bridges this gap by providing **opinionated, ready-to-use data management** that feels natural to users familiar with Excel, supports high-performance rendering, and specializes in common use cases (direct edit, commit-based workflows, and collaborative editing) without sacrificing simplicity.

## Key Tradeoffs

- **Not a full spreadsheet** - Extable omits advanced spreadsheet features (macros, array formulas across rows, etc.) to stay focused and performant
- **Schema-centric** - Configuration happens at the schema level, not via UI; this ensures predictability and testability
- **No automatic persistence** - You control how and when data is saved; Extable provides the hooks, not the backend
- **Opt-in features** - Multi-user support, formulas, and conditional styling are optional; start simple and add complexity as needed
