<script setup lang="ts">
import { computed, ref } from "vue";
import {
  defineSchema,
  type CoreOptions,
  type ExternalEditResult,
  type LookupCandidate,
  type UserInfo,
} from "@extable/core";
import { Extable, type ExtableVueHandle } from "@extable/vue";
import "@extable/core/style.css";

interface DemoRow {
  id: string;
  color: string;
  assignee: { label: string; value: string } | "";
  tags: string;
  details: { label: string; value: string } | "";
}

const tableRef = ref<ExtableVueHandle<DemoRow> | null>(null);

const user: UserInfo = { id: "demo-user", name: "Demo User" };
const options = computed<CoreOptions>(() => ({ renderMode: "auto", editMode: "direct", user }));

const rows: DemoRow[] = [
  { id: "row-1", color: "", assignee: "", tags: "", details: "" },
  { id: "row-2", color: "", assignee: "", tags: "", details: "" },
  { id: "row-3", color: "", assignee: "", tags: "", details: "" },
];

const allUsers: Array<{ id: string; name: string }> = [
  { id: "u1", name: "Alice" },
  { id: "u2", name: "Bob" },
  { id: "u3", name: "Charlie" },
  { id: "u4", name: "Diana" },
];

function delayOrAbort(ms: number, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    const t = window.setTimeout(() => resolve(true), ms);
    const onAbort = () => {
      window.clearTimeout(t);
      resolve(false);
    };
    if (!signal) return;
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function fetchCandidates({ query, signal }: { query: string; signal?: AbortSignal }): Promise<
  LookupCandidate[]
> {
  const ok = await delayOrAbort(250, signal);
  if (!ok) return [];
  const q = query.trim().toLowerCase();
  return allUsers
    .filter((u) => !q || u.name.toLowerCase().includes(q) || u.id.toLowerCase().includes(q))
    .slice(0, 8)
    .map((u) => ({ label: u.name, value: u.id }));
}

const colors = ["red", "green", "blue"] as const;

async function fetchColorCandidates({ query, signal }: { query: string; signal?: AbortSignal }): Promise<
  LookupCandidate[]
> {
  const ok = await delayOrAbort(120, signal);
  if (!ok) return [];
  const q = query.trim().toLowerCase();
  return colors
    .filter((c) => !q || c.includes(q))
    .slice(0, 8)
    .map((c) => ({ label: c, value: c }));
}

// Suggested tags for the free-input demo
const suggestedTags = ["bug", "feature", "documentation", "refactor", "performance"] as const;

async function fetchTagCandidates({ query, signal }: { query: string; signal?: AbortSignal }): Promise<
  LookupCandidate[]
> {
  const ok = await delayOrAbort(100, signal);
  if (!ok) return [];
  const q = query.trim().toLowerCase();
  return suggestedTags
    .filter((t) => !q || t.includes(q))
    .slice(0, 5)
    .map((t) => ({ label: t, value: t }));
}

const externalEditorVisible = ref(false);
const externalEditorTitle = ref<string>("");
const externalEditorValue = ref<string>("");
let externalResolve: ((res: ExternalEditResult) => void) | null = null;
let externalReject: ((err: unknown) => void) | null = null;

function closeExternalEditor() {
  externalEditorVisible.value = false;
  externalEditorTitle.value = "";
}

function resolveExternal(res: ExternalEditResult) {
  const fn = externalResolve;
  externalResolve = null;
  externalReject = null;
  closeExternalEditor();
  fn?.(res);
}

function rejectExternal(err: unknown) {
  const fn = externalReject;
  externalResolve = null;
  externalReject = null;
  closeExternalEditor();
  fn?.(err);
}

async function openExternalEditor({
  rowId,
  colKey,
  currentValue,
}: {
  rowId: string;
  colKey: string;
  currentValue: unknown;
}): Promise<ExternalEditResult> {
  externalEditorTitle.value = `External editor: ${rowId}.${colKey}`;
  externalEditorValue.value = (() => {
    if (typeof currentValue === "string") return currentValue;
    if (currentValue && typeof currentValue === "object") {
      const obj = currentValue as any;
      if (typeof obj.value === "string") return obj.value;
    }
    return currentValue == null ? "" : String(currentValue);
  })();
  externalEditorVisible.value = true;

  return new Promise<ExternalEditResult>((resolve, reject) => {
    externalResolve = resolve;
    externalReject = reject;
  });
}

const schema = defineSchema<DemoRow>({
  columns: [
    {
      key: "id",
      header: "ID",
      type: "string",
      readonly: true,
      width: 110,
      tooltip: {
        getText: async ({ value, signal }) => {
          const ok = await delayOrAbort(150, signal);
          if (!ok) return null;
          return `Row ID: ${String(value ?? "")}`;
        },
      },
    },
    {
      key: "color",
      header: "Color (Lookup value-only)",
      type: "string",
      width: 180,
      edit: {
        lookup: {
          candidates: fetchColorCandidates,
          // value-only lookup: store the primitive value directly
          toStoredValue: (c) => c.value,
        },
      },
      tooltip: {
        getText: async ({ value, signal }) => {
          const ok = await delayOrAbort(120, signal);
          if (!ok) return null;
          if (!value) return "Type to search: red/green/blue";
          return `Stored: ${String(value)}`;
        },
      },
    },
    {
      key: "assignee",
      header: "Assignee (Lookup)",
      type: "labeled",
      width: 220,
      edit: {
        lookup: {
          candidates: fetchCandidates,
        },
      },
      tooltip: {
        getText: async ({ value, signal }) => {
          const ok = await delayOrAbort(200, signal);
          if (!ok) return null;
          if (!value) return "Type to search users (async tooltip)";
          if (typeof value === "object") {
            const obj = value as any;
            if (typeof obj.label === "string" && typeof obj.value === "string") {
              return `Stored: {label:${obj.label}, value:${obj.value}}`;
            }
          }
          return `Stored: ${String(value)}`;
        },
      },
    },
    {
      key: "tags",
      header: "Tags (Free Input)",
      type: "tags",
      tags: [...suggestedTags],
      width: 200,
      edit: {
        lookup: {
          candidates: fetchTagCandidates,
          allowFreeInput: true,  // Allow free text input
          toStoredValue: (c) => c.value,  // Store the value directly
        },
      },
      tooltip: {
        getText: async ({ value, signal }) => {
          const ok = await delayOrAbort(100, signal);
          if (!ok) return null;
          if (!value) return "Type any tag (or select from suggestions)";
          return `Stored: ${String(value)}`;
        },
      },
    },
    {
      key: "details",
      header: "Details (External Editor)",
      type: "labeled",
      width: 340,
      wrapText: false,
      edit: {
        externalEditor: openExternalEditor,
      },
    },
  ],
});

const view = { hiddenColumns: [], filters: [], sorts: [] };
</script>

<template>
  <div class="demo-container">
    <div class="demo-note">
      <strong>Try it:</strong>
      <ul>
        <li>Click the <strong>Assignee</strong> cell and type <code>al</code>, <code>bo</code>, etc.</li>
        <li>Click the <strong>Tags</strong> cell and type any text (or select from suggestions).</li>
        <li>Use <code>↑/↓</code> and <code>Enter</code> to select from the dropdown.</li>
        <li>Double-click <strong>Details</strong> to open the external editor modal.</li>
        <li>Hover cells to see async tooltips.</li>
      </ul>
    </div>

    <div class="demo-table" style="height: 260px; border: 1px solid #d0d7de; overflow: auto">
      <Extable
        ref="tableRef"
        :schema="schema"
        :defaultData="rows"
        :defaultView="view"
        :options="options"
        style="height: 100%"
      />
    </div>

    <div v-if="externalEditorVisible" class="modal-backdrop" @click.self="resolveExternal({ kind: 'cancel' })">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">{{ externalEditorTitle }}</div>
        </div>
        <textarea v-model="externalEditorValue" class="modal-textarea" rows="8" />
        <div class="modal-actions">
          <button @click="resolveExternal({ kind: 'cancel' })">Cancel</button>
          <button @click="rejectExternal(new Error('Demo error'))">Error</button>
          <button
            class="primary"
            @click="
              resolveExternal({
                kind: 'commit',
                value: {
                  label:
                    (externalEditorValue || '').length > 24
                      ? (externalEditorValue || '').slice(0, 24) + '…'
                      : (externalEditorValue || ''),
                  value: externalEditorValue,
                },
              })
            "
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 20px 0;
}

.demo-note {
  font-size: 13px;
  padding: 12px;
  background-color: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  color: #24292f;
}

.demo-note ul {
  margin: 8px 0 0;
  padding-left: 18px;
}

.demo-table {
  border-radius: 6px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  width: min(720px, 92vw);
  background: white;
  border-radius: 10px;
  border: 1px solid #d0d7de;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  font-weight: 600;
  font-size: 14px;
}

.modal-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

button {
  padding: 6px 10px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background-color: white;
  cursor: pointer;
  font-size: 13px;
}

button:hover {
  background-color: #f6f8fa;
}

button.primary {
  background-color: #0969da;
  border-color: #0969da;
  color: white;
}

button.primary:hover {
  background-color: #0757b8;
}
</style>
