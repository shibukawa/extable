# Rich Editing (Lookup / External Editor / Tooltip)

This demo showcases the schema hooks that enable “rich editing” integrations:

- **Remote lookup** (typeahead + label/value separation)
- **External editor delegation** (Promise-based commit/cancel)
- **Async tooltips** (sync or Promise)

## Interactive Demo

<ClientOnly>
  <RichEditingRemoteDemo />
</ClientOnly>

## How it works

### Remote lookup

Configure a column with `edit.lookup.fetchCandidates`. Extable displays the candidate `label`, but stores a structured value containing the stable `value`.

```ts
import type { LookupCandidate } from "@extable/core";

const fetchCandidates = async ({ query, signal }: { query: string; signal?: AbortSignal }): Promise<LookupCandidate[]> => {
  // Fetch from your API, respecting AbortSignal.
  // Return [{ label, value, meta? }, ...]
  // Note: Return all candidates even for empty query, so that candidates are displayed
  // when clicking a cell in selection mode.
  const q = query.trim().toLowerCase();
  const allUsers = [{ id: "u1", name: "Alice" }, ...];
  return allUsers
    .filter(u => !q || u.name.toLowerCase().includes(q))
    .map(u => ({ label: u.name, value: u.id }));
};

const schema = {
  columns: [
    {
      key: "assignee",
      type: "string",
      edit: {
        lookup: {
          fetchCandidates,
        },
      },
    },
  ],
};
```

### External editor delegation

Configure `edit.externalEditor.open`. When the user enters edit mode on that column, Extable calls your hook and waits for the Promise.

```ts
const schema = {
  columns: [
    {
      key: "details",
      type: "string",
      edit: {
        externalEditor: {
          open: async ({ rowId, colKey, currentValue }) => {
            // Open your modal / rich editor UI.
            // Return { kind: "commit", value } or { kind: "cancel" }.
            return { kind: "cancel" };
          },
        },
      },
    },
  ],
};
```

### Tooltip text (async)

Configure `tooltip.getText`. The hook may return `string | null` or `Promise<string | null>`.

```ts
const schema = {
  columns: [
    {
      key: "assignee",
      type: "string",
      tooltip: {
        getText: async ({ currentValue, signal }) => {
          // Fetch details for hover display.
          return currentValue ? String(currentValue) : null;
        },
      },
    },
  ],
};
```
