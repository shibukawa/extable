# Integration Guide

This guide covers the essentials for integrating Extable into your application.

## Integration

### Getting Started

Start with the [Basic Usage Demo](../demos/basic-usage.md) to understand initialization and basic setup.

See also:
- [Data Format Guide](./data-format.md) - Schema definition and supported types
- [Data Access from API](./data-access.md) - Async data fetching patterns
- [Init Options Reference](../reference/init-options.md) - Table initialization options

### Server-side Rendering (SSR)

`@extable/core/ssr` generates static HTML for initial render. The HTML is **not hydrated** by the React wrapper; client-side rendering will re-create the table. Treat SSR as a fast, SEO-friendly snapshot, and let the client mount replace it.

#### Next.js (pages router) example

```tsx
import { renderTableHTML } from "@extable/core/ssr";

export async function getServerSideProps() {
  const result = renderTableHTML({
    data,
    schema,
    cssMode: "both",
    wrapWithRoot: true,
    defaultClass: "extable",
    includeStyles: true,
  });

  return {
    props: {
      ssrHtml: result.html,
      ssrCss: result.css ?? "",
    },
  };
}

export default function Page({ ssrHtml, ssrCss }) {
  return (
    <>
      {ssrCss && <style dangerouslySetInnerHTML={{ __html: ssrCss }} />}
      <div dangerouslySetInnerHTML={{ __html: ssrHtml }} />
      {/* Client render: use Extable (React wrapper) or ExtableCore in a separate container */}
    </>
  );
}
```

#### Client re-render note

When you mount the client table, it will build its own DOM. To avoid showing two tables, either:

- Replace the SSR container on mount (clear its innerHTML and mount the client table there), or
- Keep SSR HTML in a separate container and hide/remove it after the client table mounts.

If you need true DOM hydration, a dedicated hydration API would be required (out of scope for the current SSR MVP).

### Shortcut Key Registration

Register keyboard shortcuts for Undo/Redo operations.

:::tabs
== Vanilla

```typescript
import { ExtableCore } from "@extable/core";

const table = new ExtableCore({
  root: container,
  schema,
  defaultData,
  defaultView: {},
});

// Register keyboard handler for Ctrl+Z / Ctrl+Shift+Z (undo/redo)
const onKey = (e: KeyboardEvent) => {
  const key = e.key.toLowerCase();
  const isMod = e.metaKey || e.ctrlKey;
  if (!isMod) return;

  // Undo: Ctrl/Cmd+Z
  if (key === "z") {
    if (!table) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) {
      table.redo();  // Ctrl/Cmd+Shift+Z
    } else {
      table.undo();  // Ctrl/Cmd+Z
    }
  }
};
document.addEventListener("keydown", onKey, { capture: true });
window.addEventListener("beforeunload", () => {
  document.removeEventListener("keydown", onKey, { capture: true });
});
```

== React

```typescript
import { Extable } from "@extable/react";
import { useRef, useEffect } from "react";

export function MyTable() {
  const tableRef = useRef<ExtableCore>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      // Undo: Ctrl/Cmd+Z
      if (key === "z") {
        if (!tableRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          tableRef.current.redo();  // Ctrl/Cmd+Shift+Z
        } else {
          tableRef.current.undo();  // Ctrl/Cmd+Z
        }
      }
    };

    document.addEventListener("keydown", onKey, { capture: true });
    return () => {
      document.removeEventListener("keydown", onKey, { capture: true });
    };
  }, []);

  return <Extable ref={tableRef} schema={schema} defaultData={data} defaultView={{}} />;
}
```

== Vue

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { Extable } from "@extable/vue";
import type { ExtableCore } from "@extable/core";

const tableRef = ref<ExtableCore | null>(null);

const onKey = (e: KeyboardEvent) => {
  const key = e.key.toLowerCase();
  const isMod = e.metaKey || e.ctrlKey;
  if (!isMod) return;

  // Undo: Ctrl/Cmd+Z
  if (key === "z") {
    if (!tableRef.value) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) {
      tableRef.value.redo();  // Ctrl/Cmd+Shift+Z
    } else {
      tableRef.value.undo();  // Ctrl/Cmd+Z
    }
  }
};

onMounted(() => {
  document.addEventListener("keydown", onKey, { capture: true });
});

onUnmounted(() => {
  document.removeEventListener("keydown", onKey, { capture: true });
});
</script>

<template>
  <Extable ref="tableRef" :schema="schema" :default-data="data" :default-view="{}" />
</template>
```

:::

**Keyboard Shortcuts:**
- **Ctrl/Cmd+Z** - Undo last change
- **Ctrl/Cmd+Shift+Z** - Redo last undone change

See [Data Access API](./data-access.md#undo--redo) for undo/redo details.

### Layout & Responsive Design

The table container must have explicit dimensions. Below are patterns for each framework with HTML, class/style configurations, and corresponding CSS or Tailwind utilities.

:::tabs
== Vanilla

The table displays to fill its container (`#table-root`). Set explicit dimensions on the container and parent using flexbox:

```html
<div class="app">
  <aside class="sidebar"><!-- Menu --></aside>
  <div class="main">
    <div class="toolbar"><!-- Controls --></div>
    <div id="table-root"></div>
  </div>
</div>
```

```typescript
const core = new ExtableCore({
  root: document.getElementById("table-root")!,
  defaultData: data,
  schema: schema,
  options: {
    // Optional: apply default classes/styles
    defaultClass: "table-container",
    defaultStyle: { border: "1px solid #e0e0e0" },
  },
});
```

CSS:

```css
.app {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 250px;
  border-right: 1px solid #e0e0e0;
  overflow-y: auto;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.toolbar {
  padding: 8px 12px;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}

#table-root {
  flex: 1;
  min-height: 0;
}

.table-container {
  /* Applied via options.defaultClass */
}
```

== React

Using React wrapper (`@extable/react/Extable`) with Tailwind:

```tsx
import { useRef } from "react";
import { Extable, type ExtableHandle } from "@extable/react";
import type { Schema } from "@extable/core";

export function TableView({ data, schema }: { data: any[]; schema: Schema }) {
  const tableRef = useRef<ExtableHandle>(null);

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r overflow-y-auto">
        {/* Sidebar content */}
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b px-3 py-2">
          {/* Toolbar content */}
        </div>
        <div className="min-h-0 flex-1 overflow-visible p-5">
          <Extable
            ref={tableRef}
            schema={schema}
            defaultData={data}
            defaultView={{}}
            options={{}}
            className="min-h-0 h-full w-full"
          />
        </div>
      </div>
    </div>
  );
}
```

Both `className` and `style` props are supported:

```tsx
// Using className (Tailwind classes)
<Extable className="min-h-0 h-full w-full" />

// Using inline style
<Extable style={{ height: "100%", width: "100%" }} />

// Combining with other HTMLAttributes
<Extable
  className="my-table"
  style={{ backgroundColor: "#f5f5f5" }}
  data-testid="extable-demo"
/>
```

== Vue

Vue components accept `class` and `style` props like any other component:

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { Extable } from "@extable/vue";
import type { Schema } from "@extable/core";

defineProps<{ data: any[]; schema: Schema }>();

const tableRef = ref<InstanceType<typeof Extable> | null>(null);
</script>

<template>
  <div class="flex h-screen">
    <aside class="w-64 border-r overflow-y-auto">
      <!-- Sidebar content -->
    </aside>
    <div class="flex-1 flex flex-col min-w-0">
      <div class="border-b px-3 py-2">
        <!-- Toolbar content -->
      </div>
      <div class="min-h-0 flex-1 overflow-visible p-5">
        <Extable
          ref="tableRef"
          :schema="schema"
          :default-data="data"
          :default-view="{}"
          :options="{}"
          class="min-h-0 h-full w-full"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Scoped styles automatically apply to this component */
</style>
```

Both `class` and `style` are supported:

```vue
<!-- Using class (Tailwind) -->
<Extable class="min-h-0 h-full w-full" />

<!-- Using inline style -->
<Extable :style="{ height: '100%', width: '100%' }" />

<!-- Combining both -->
<Extable
  class="my-table"
  :style="{ backgroundColor: '#f5f5f5' }"
/>
```

:::

::: tip Container Requirements
- Explicit `width` and `height` (not `auto`)
- `min-width: 0` and `min-height: 0` in flex/grid layouts
- Table responds automatically to container size changes
:::

### Customization

- [Validation](./validation.md) - Schema-based constraints
- [Edit Modes](./editmode.md) - Protect specific cells/columns
- [Formulas](./formulas.md) - Add computed columns
- [Conditional Style](./conditional-style.md) - Style cells dynamically
- [Styling](./style.md) - Theme and appearance

## Interaction Design

Choose the interaction pattern based on your application's requirements.  
See [Data Access API](./data-access.md) for complete API reference.

### Read-only Mode

Users can view and search data, but cannot make edits.

```typescript
const table = new ExtableCore({
  root: container,
  schema,
  defaultData,
  defaultView: {},
  options: {
    editMode: "readonly",  // Disable all editing
  },
});
```

Use cases: Reports, dashboards, audit logs.

### Direct Mode

Edits are applied immediately and require no user confirmation. Changes are sent to server immediately (if configured).

```typescript
const table = new ExtableCore({
  root: container,
  schema,
  defaultData,
  defaultView: {},
  options: {
    editMode: "direct",  // Default: changes apply immediately
  },
});

// Listen for individual row changes
table.subscribeRowState((rowId, event) => {
  if (event === "edit") {
    console.log(`Row ${rowId} was edited - send to server`);
  } else if (event === "new") {
    console.log(`Row ${rowId} was inserted`);
  } else if (event === "delete") {
    console.log(`Row ${rowId} was deleted`);
  }
});
```

Use cases: Quick-edit forms, live dashboards, immediate feedback systems.

### Commit Mode

Edits are queued as pending changes. User must explicitly commit to confirm all changes at once.

```typescript
const table = new ExtableCore({
  root: container,
  schema,
  defaultData,
  defaultView: {},
  options: {
    editMode: "commit",  // Require explicit commit
  },
});

// Monitor pending changes to update UI
table.subscribeTableState((state) => {
  const saveButton = document.getElementById("save-btn");
  // Enable save button only when there are pending changes
  saveButton!.disabled = !state.canCommit;
  
  console.log(`${state.pendingCellCount} cells pending`);
});
```

When user clicks "Save" / "Submit" / "Confirm" button (implemented by your app):

```typescript
async function handleSave() {
  try {
    const changes = await table.commit();
    
    // Send delta to server
    const response = await fetch("/api/table/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes }),
    });

    if (response.ok) {
      console.log("Changes saved successfully");
    }
  } catch (error) {
    console.error("Save failed:", error);
  }
}
```

Use cases: Form workflows, bulk imports, transactional updates, audit trails.

## Testing

For unit tests and E2E testing strategies, see the [Unit Testing Guide](./unit-testing.md).
