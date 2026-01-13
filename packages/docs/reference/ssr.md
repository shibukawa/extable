# SSR API Reference

Server-side rendering uses `@extable/core/ssr` to generate static HTML for initial render. The output is not hydrated by the React/Vue wrappers; client-side rendering will rebuild the DOM.

## renderTableHTML

```typescript
import { renderTableHTML } from "@extable/core/ssr";
```

```typescript
renderTableHTML<T>(options: SSROptions<T>): SSRResult
```

Generate a static HTML table string from data, schema, and view configuration.

### Parameters

```typescript
export interface SSROptions<T extends Record<string, unknown> = Record<string, unknown>> {
  data: DataSet<T>;
  schema: Schema;
  cssMode?: "inline" | "external" | "both";
  wrapWithRoot?: boolean;
  defaultClass?: string | string[];
  defaultStyle?: Partial<CSSStyleDeclaration>;
}
```

**Notes**:
- `cssMode`:
  - `inline`: embed all styles directly on elements.
  - `external`: return base CSS in `result.css` and minimal HTML attributes.
  - `both`: inline critical styles and return base CSS.
- `wrapWithRoot` outputs the same root structure as client rendering (`extable-root`/`extable-shell`/`extable-viewport`).
- `defaultClass` and `defaultStyle` are applied to the outermost element (root wrapper when wrapped, table when not).

### Return value

```typescript
export interface SSRResult {
  html: string;
  css?: string;
  metadata: {
    rowCount: number;
    columnCount: number;
    hasFormulas: boolean;
    hasConditionalStyles: boolean;
    errors: Array<{ row: number; col: string; message: string }>;
  };
}
```

### Example

```typescript
const result = renderTableHTML({
  data: { rows: [{ id: 1, name: "Alice", score: 90 }] },
  schema: {
    columns: [
      { key: "id", type: "number", label: "ID" },
      { key: "name", type: "string", label: "Name" },
      {
        key: "score",
        type: "number",
        label: "Score",
        conditionalStyle: (row) => ({
          textColor: row.score >= 80 ? "#1f7a1f" : "#444444",
        }),
      },
    ],
  },
  cssMode: "both",
  wrapWithRoot: true,
  defaultClass: "extable",
});

console.log(result.html);
```

### SSR vs Client Render

- SSR output is static HTML for initial paint and SEO.
- Client rendering (ExtableCore / React / Vue) will rebuild the DOM.
- If you need true DOM hydration, a dedicated hydration API is required (not available yet).

## HTML structure and caveats

Extable has two related but different HTML outputs: the **SSR table HTML** and the **client-rendered DOM**.

### SSR output (renderTableHTML)

To match the client renderer styling, wrap the SSR output with the same root structure. You can do this by enabling `wrapWithRoot`.

```html
<div class="extable-root">
  <div class="extable-shell">
    <div class="extable-viewport">
      <table data-extable-renderer="html" data-extable-ssr="true">
        <thead>...</thead>
        <tbody>...</tbody>
      </table>
    </div>
    <div class="extable-overlay-layer"></div>
  </div>
</div>
```

Notes:
- The table needs the core stylesheet (`@extable/core/style.css`) to look correct.
- If you do **not** wrap the output in `extable-root`, the default Extable CSS will not fully apply and the layout can look broken.
- Host apps or doc sites may apply table styles (e.g. zebra striping). If so, override those styles for the SSR table.

If you explicitly want the bare table output, keep `wrapWithRoot` disabled:

```html
<table data-extable-renderer="html" data-extable-ssr="true">
  <thead>...</thead>
  <tbody>...</tbody>
</table>
```

### Client-rendered DOM (ExtableCore / React / Vue)

Client rendering creates a wrapper around the table. The structure below is simplified but representative:

```html
<div class="extable-root">
  <div class="extable-shell">
    <div class="extable-viewport">
      <table data-extable-renderer="html">...</table>
    </div>
    <div class="extable-overlay-layer"></div>
  </div>
</div>
```

Notes:
- The root element is your mount target; Extable adds the `extable-root` class.
- The `.extable-viewport` provides scrolling and sizing; the table lives inside it in HTML mode.
- Canvas mode uses a different internal structure, but the same root and shell elements.
