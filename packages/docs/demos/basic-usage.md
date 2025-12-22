# Basic Usage

Learn how to use Extable with a simple, performance-focused example.

## Interactive Demo

This embedded demo loads **10,000 rows** to showcase baseline rendering performance.

<ClientOnly>
  <BasicUsageDemo />
</ClientOnly>

::: info Demo UI Note
This demo includes **Undo** and **Redo** buttons above the table. In a real application, these operations are typically triggered via keyboard shortcuts (Ctrl/Cmd+Z for Undo, Ctrl/Cmd+Shift+Z for Redo). The buttons are provided here as an alternative way to interact with the demo without keyboard shortcuts.
:::

## What You're Seeing

### Features Demonstrated

✅ **Virtual Scrolling and Performance** - Only renders visible cells  
✅ **Type Safety** - Enums, tags, dates, numbers with formatting  
✅ **Keyboard Navigation** - Arrow keys, Tab, Enter  
✅ **Inline Editing** - Double-click or start typing to edit  
✅ **Selection** - Click to select, Shift+click for ranges  
✅ **Copy/Paste** - Ctrl/Cmd+C/V support  
✅ **Sort & Filter** - column-level filtering and sorting

## How to Use

:::tabs
== Vanilla
#### Installation

```bash
npm install @extable/core
```

#### Schema

Table schema definition of this sample is the following:

```ts
import type { Schema } from "@extable/core";

const schema = {
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "active", header: "Active", type: "boolean", format: "checkbox", width: 100 },
    {
      key: "score",
      header: "Score",
      type: "number",
      format: { precision: 6, scale: 2 },
      style: { align: "right" },
      width: 120,
    },
    {
      key: "role",
      header: "Role",
      type: "enum",
      enum: { options: ["viewer", "editor", "owner"] },
      width: 130,
    },
    {
      key: "tags",
      header: "Tags",
      type: "tags",
      tags: { options: ["alpha", "beta", "priority"] },
      width: 140,
    },
    {
      key: "notes",
      header: "Notes",
      type: "string",
      wrapText: true,
      width: 260,
    },
  ],
} satisfies Schema;

```

#### Integration

```typescript
import { ExtableCore } from "@extable/core";

const data = [
  {
    id: "row-1",
    name: "User 1",
    active: false,
    score: 51,
    role: "editor",
    tags: ["beta"]
    notes: "beta	Longer text can describe context, data source, and formatting guidance for analysts.",
  },
  {
    id: "row-2",
    name: "User 2",
    active: true,
    score: 52,
    role: "viewer",
    tags: ["beta"]
    notes: "WrapText mode ensures the UI accommodates verbose annotations (manual entry encouraged).",
  },
];

const table = new ExtableCore<Row>({
  root: document.getElementById("table-root"),
  schema,
  defaultData
});
```

== React
#### Installation

```bash
npm install @extable/core @extable/react
```

#### Schema

Table schema definition of this sample is the following:

```ts
import type { Schema } from "@extable/core";

const schema = {
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "active", header: "Active", type: "boolean", format: "checkbox", width: 100 },
    {
      key: "score",
      header: "Score",
      type: "number",
      format: { precision: 6, scale: 2 },
      style: { align: "right" },
      width: 120,
    },
    {
      key: "role",
      header: "Role",
      type: "enum",
      enum: { options: ["viewer", "editor", "owner"] },
      width: 130,
    },
    {
      key: "tags",
      header: "Tags",
      type: "tags",
      tags: { options: ["alpha", "beta", "priority"] },
      width: 140,
    },
    {
      key: "notes",
      header: "Notes",
      type: "string",
      wrapText: true,
      width: 260,
    },
  ],
} satisfies Schema;
```

#### Integration

```typescript
import { useRef } from import { Extable, type ExtableHandle } from "@extable/react";
import "@extable/core/style.css";

const data = [
  {
    id: "row-1",
    name: "User 1",
    active: false,
    score: 51,
    role: "editor",
    tags: ["beta"]
    notes: "beta	Longer text can describe context, data source, and formatting guidance for analysts.",
  },
  {
    id: "row-2",
    name: "User 2",
    active: true,
    score: 52,
    role: "viewer",
    tags: ["beta"]
    notes: "WrapText mode ensures the UI accommodates verbose annotations (manual entry encouraged).",
  },
];

export function Page() {
  const tableRef = useRef<ExtableHandle>(null);

  return <Extable
    ref={tableRef}
    schema={schema}
    defaultData={data}
  />;
}
```

== Vue
#### Installation

```bash
npm install @extable/core @extable/vue
```

#### Schema

Table schema definition of this sample is the following:

```ts
import type { Schema } from "@extable/core";

const schema = {
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "active", header: "Active", type: "boolean", format: "checkbox", width: 100 },
    {
      key: "score",
      header: "Score",
      type: "number",
      format: { precision: 6, scale: 2 },
      style: { align: "right" },
      width: 120,
    },
    {
      key: "role",
      header: "Role",
      type: "enum",
      enum: { options: ["viewer", "editor", "owner"] },
      width: 130,
    },
    {
      key: "tags",
      header: "Tags",
      type: "tags",
      tags: { options: ["alpha", "beta", "priority"] },
      width: 140,
    },
    {
      key: "notes",
      header: "Notes",
      type: "string",
      wrapText: true,
      width: 260,
    },
  ],
} satisfies Schema;
```

#### Integration

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ExtableCore } from "@extable/core";
import { Extable, type ExtableVueHandle } from "@extable/vue";
import "@extable/core/style.css";

const tableRef = ref<ExtableVueHandle | null>(null);

const data = [
  {
    id: "row-1",
    name: "User 1",
    active: false,
    score: 51,
    role: "editor",
    tags: ["beta"]
    notes: "beta	Longer text can describe context, data source, and formatting guidance for analysts.",
  },
  {
    id: "row-2",
    name: "User 2",
    active: true,
    score: 52,
    role: "viewer",
    tags: ["beta"]
    notes: "WrapText mode ensures the UI accommodates verbose annotations (manual entry encouraged).",
  },
];
</script>

<template>
  <Extable
    ref="tableRef"
    :schema="schema"
    :defaultData="data"
    class="min-h-0 h-full w-full"
  />
</template>
```

:::

## Next Steps

- **[Data Format Guide](/guides/data-format)** - Learn about column types and constraints
- **[Edit Modes Guide](/guides/editmode)** - Understand direct vs commit editing
- **[Formulas Guide](/guides/formulas)** - Add computed columns and validation
- **[Conditional Style](/guides/conditional-style)** - Visualize data patterns
