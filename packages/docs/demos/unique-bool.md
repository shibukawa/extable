# Unique Boolean (Radio)

Interactive demo that shows a boolean column rendered as a radio group when `unique: true`.

<ClientOnly>
  <UniqueBoolDemo />
</ClientOnly>

::: info Demo UI Note
Selecting a radio marks that row as the single `true` row for the column and highlights the row.
:::

## How it works

- The column schema uses `type: "boolean"` with `unique: true`.
- HTML mode renders native `<input type="radio">` elements grouped by column.
- Canvas mode renders radio emoji (`◯` / `🔘`) and highlights the selected row.

## Vanilla usage

```ts
import { ExtableCore } from "@extable/core";

const schema = {
  columns: [
    { key: 'id', header: '#', type: 'number', readonly: true },
    { key: 'name', header: 'Name', type: 'string' },
    { key: 'primary', header: 'Primary', type: 'boolean', unique: true },
  ]
};

const data = [
  { id:1, name:'A', primary:false },
  { id:2, name:'B', primary:true },
];

new ExtableCore({ root: document.getElementById('app')!, defaultData: data, defaultView: { hiddenColumns: [], filters: [], sorts: [] }, schema });
```
