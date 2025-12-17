<template>
  <main class="h-screen overflow-hidden bg-slate-50 text-slate-900">
    <div class="mx-auto flex h-full w-full max-w-none flex-col gap-4 p-6 overflow-hidden">
      <header class="flex items-baseline justify-between gap-4">
        <h1 class="text-2xl font-semibold">Extable Demo (Vue)</h1>
        <div class="text-sm text-slate-600">Tailwind (Preflight enabled)</div>
      </header>

      <section class="flex flex-wrap gap-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="min-w-[220px]">
          <h2 class="mb-2 text-sm font-semibold text-slate-700">Render Mode</h2>
          <div class="flex flex-col gap-2">
            <label class="flex items-center gap-2">
              <input v-model="renderMode" name="mode" type="radio" value="auto" />
              <span>Auto</span>
            </label>
            <label class="flex items-center gap-2">
              <input v-model="renderMode" name="mode" type="radio" value="html" />
              <span>HTML</span>
            </label>
            <label class="flex items-center gap-2">
              <input v-model="renderMode" name="mode" type="radio" value="canvas" />
              <span>Canvas</span>
            </label>
          </div>
        </div>
        <div class="min-w-[220px]">
          <h2 class="mb-2 text-sm font-semibold text-slate-700">Edit Mode</h2>
          <div class="flex flex-col gap-2">
            <label class="flex items-center gap-2">
              <input v-model="editMode" name="edit-mode" type="radio" value="direct" />
              <span>Direct</span>
            </label>
            <label class="flex items-center gap-2">
              <input v-model="editMode" name="edit-mode" type="radio" value="commit" />
              <span>Commit</span>
            </label>
          </div>
        </div>
        <div class="min-w-[220px]">
          <h2 class="mb-2 text-sm font-semibold text-slate-700">Lock Mode</h2>
          <div class="flex flex-col gap-2">
            <label class="flex items-center gap-2">
              <input v-model="lockMode" name="lock-mode" type="radio" value="none" />
              <span>None</span>
            </label>
            <label class="flex items-center gap-2">
              <input v-model="lockMode" name="lock-mode" type="radio" value="row" />
              <span>Row Lock</span>
            </label>
          </div>
        </div>
        <div class="min-w-[280px]">
          <h2 class="mb-2 text-sm font-semibold text-slate-700">Data Set</h2>
          <div class="grid grid-cols-2 gap-x-4 gap-y-2">
            <label v-for="item in dataModes" :key="item.key" class="flex items-center gap-2">
              <input v-model="dataMode" name="data-mode" type="radio" :value="item.key" />
              <span class="text-sm">{{ item.label }}</span>
            </label>
          </div>
        </div>
        <div class="min-w-[260px]">
          <h2 class="mb-2 text-sm font-semibold text-slate-700">Actions</h2>
          <div class="flex items-center gap-3">
            <button
              v-if="editMode === 'commit'"
              type="button"
              class="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              :disabled="!tableState?.canCommit"
              @click="commit"
            >
              Commit Pending
            </button>
            <div v-else class="text-sm text-slate-500">Commit mode required</div>
            <div class="text-xs text-slate-600">
              {{
                tableState
                  ? `pending=${tableState.pendingCommandCount} cells=${tableState.pendingCellCount} undo=${
                      tableState.undoRedo?.canUndo ? '1' : '0'
                    } redo=${tableState.undoRedo?.canRedo ? '1' : '0'} mode=${tableState.renderMode}`
                  : '—'
              }}
            </div>
          </div>
        </div>
        <div class="min-w-[340px]">
          <h2 class="mb-2 text-sm font-semibold text-slate-700">Style</h2>
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
              :class="selection?.styleState?.bold === 'on' ? 'ring-2 ring-slate-900' : ''"
              :disabled="!selection?.canStyle"
              @click="toggleFromSelection('bold')"
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              class="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
              :class="selection?.styleState?.italic === 'on' ? 'ring-2 ring-slate-900' : ''"
              :disabled="!selection?.canStyle"
              @click="toggleFromSelection('italic')"
            >
              <em>I</em>
            </button>
            <button
              type="button"
              class="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
              :class="selection?.styleState?.underline === 'on' ? 'ring-2 ring-slate-900' : ''"
              :disabled="!selection?.canStyle"
              @click="toggleFromSelection('underline')"
            >
              <span class="underline">U</span>
            </button>
            <button
              type="button"
              class="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
              :class="selection?.styleState?.strike === 'on' ? 'ring-2 ring-slate-900' : ''"
              :disabled="!selection?.canStyle"
              @click="toggleFromSelection('strike')"
            >
              <span class="line-through">S</span>
            </button>

            <div class="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
              <span class="text-xs text-slate-500">Text</span>
              <button
                type="button"
                class="rounded border border-slate-200 px-2 py-1 text-xs"
                :disabled="!selection?.canStyle"
                @click="applyTextColor(lastTextColor)"
              >
                Apply
              </button>
              <input
                class="h-6 w-8 cursor-pointer"
                type="color"
                v-model="lastTextColor"
                :disabled="!selection?.canStyle"
                aria-label="Pick text color"
              />
            </div>

            <div class="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
              <span class="text-xs text-slate-500">Bg</span>
              <button
                type="button"
                class="rounded border border-slate-200 px-2 py-1 text-xs"
                :disabled="!selection?.canStyle"
                @click="applyBgColor(lastBgColor)"
              >
                Apply
              </button>
              <input
                class="h-6 w-8 cursor-pointer"
                type="color"
                v-model="lastBgColor"
                :disabled="!selection?.canStyle"
                aria-label="Pick background color"
              />
            </div>

            <button
              type="button"
              class="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
              :disabled="!selection?.canStyle"
              @click="clearStyle"
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      <section class="min-h-0 flex-1 overflow-hidden">
        <div class="grid h-full min-h-0 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_380px]">
          <div class="min-h-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col overflow-hidden">
            <h2 class="mb-3 text-sm font-semibold text-slate-700">Table</h2>
            <div class="min-h-0 flex-1 overflow-visible p-5">
              <Extable
                ref="tableRef"
                :schema="currentConfig.schema"
                :defaultData="currentConfig.data"
                :defaultView="currentConfig.view"
                :options="options"
                class="min-h-0 h-full w-full"
                @tableState="handleTableState"
                @cellEvent="handleCellEvent"
              />
            </div>
          </div>
          <div class="min-h-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden flex flex-col">
            <h2 class="mb-3 text-sm font-semibold text-slate-700">State Preview</h2>
            <pre class="mb-4 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{{
              statePreview
            }}</pre>
            <h2 class="mb-3 text-sm font-semibold text-slate-700">Data Note</h2>
            <pre class="max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{{ dataNote }}</pre>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>

<script setup lang="ts">
import type {
  Command,
  CoreOptions,
  DataSet,
  Schema,
  ServerAdapter,
  UserInfo,
  View,
} from "@extable/core";
import { computed, ref, watch, onMounted, onBeforeUnmount } from "vue";
import { Extable, type ExtableVueHandle } from "@extable/vue";
import {
  conditionalStyleRows,
  conditionalStyleSchema,
  conditionalStyleView,
  dataFormatRows,
  dataFormatSchema,
  dataFormatView,
  demoRows,
  demoSchema,
  demoView,
  filterSortRows,
  filterSortSchema,
  filterSortView,
  formulaRows,
  formulaSchema,
  formulaView,
  uniqueCheckRows,
  uniqueCheckSchema,
  uniqueCheckView,
} from "./data/fixtures";

type RenderMode = "auto" | "html" | "canvas";
type EditMode = "direct" | "commit";
type LockMode = "none" | "row";
type DataMode =
  | "standard"
  | "data-format"
  | "formula"
  | "conditional-style"
  | "unique-check"
  | "filter-sort";

const user: UserInfo = { id: "demo-user", name: "Demo User" };

const renderMode = ref<RenderMode>("auto");
const editMode = ref<EditMode>("direct");
const lockMode = ref<LockMode>("none");
const dataMode = ref<DataMode>("standard");
const dataModes = [
  { key: "standard", label: "Standard" },
  { key: "data-format", label: "Data Format" },
  { key: "formula", label: "Formula" },
  { key: "conditional-style", label: "Conditional Style" },
  { key: "unique-check", label: "Unique Check" },
  { key: "filter-sort", label: "Filter / Sort" },
] as const;

const tableRef = ref<ExtableVueHandle | null>(null);
const tableState = ref<any>(null);
const selection = ref<any>(null);
const lastTextColor = ref("#000000");
const lastBgColor = ref("#ffffff");

const currentConfigRef = ref<{ data: DataSet; view: View; schema: Schema }>({
  data: { rows: demoRows.map((r) => ({ ...r })) } as DataSet,
  view: { ...demoView } as View,
  schema: demoSchema as Schema,
});

const serverStub: ServerAdapter = {
  async fetchInitial() {
    return { ...currentConfigRef.value, user };
  },
  async lockRow(rowId) {
    console.log("lockRow", rowId);
  },
  async unlockRows(rowIds) {
    console.log("unlockRows", rowIds);
  },
  async commit(commands: Command[]) {
    console.log("commit", commands);
  },
  subscribe(onEvent) {
    return () => {
      console.log("unsubscribe", onEvent);
    };
  },
};

const options = computed<CoreOptions>(() => ({
  renderMode: renderMode.value,
  editMode: editMode.value,
  lockMode: lockMode.value,
  server: serverStub,
  user,
}));

const cloneConfig = (mode: DataMode) => {
  if (mode === "data-format") {
    return {
      data: { rows: dataFormatRows.map((r) => ({ ...r })) },
      schema: dataFormatSchema as Schema,
      view: { ...dataFormatView },
    };
  }
  if (mode === "formula") {
    return {
      data: { rows: formulaRows.map((r) => ({ ...r })) },
      schema: formulaSchema as Schema,
      view: { ...formulaView },
    };
  }
  if (mode === "conditional-style") {
    return {
      data: { rows: conditionalStyleRows.map((r) => ({ ...r })) },
      schema: conditionalStyleSchema as Schema,
      view: { ...conditionalStyleView },
    };
  }
  if (mode === "unique-check") {
    return {
      data: { rows: uniqueCheckRows.map((r) => ({ ...r })) },
      schema: uniqueCheckSchema as Schema,
      view: { ...uniqueCheckView },
    };
  }
  if (mode === "filter-sort") {
    return {
      data: { rows: filterSortRows.map((r) => ({ ...r })) },
      schema: filterSortSchema as Schema,
      view: { ...filterSortView },
    };
  }
  return {
    data: { rows: demoRows.map((r) => ({ ...r })) },
    schema: demoSchema as Schema,
    view: { ...demoView },
  };
};

const currentConfig = computed(() => cloneConfig(dataMode.value));
watch(
  () => currentConfig.value,
  (next) => {
    currentConfigRef.value = next;
  },
  { deep: true, immediate: true },
);

watch(
  () => renderMode.value,
  (next) => tableRef.value?.setRenderMode(next),
  { immediate: true },
);
watch(
  () => editMode.value,
  (next) => tableRef.value?.setEditMode(next),
  { immediate: true },
);
watch(
  () => lockMode.value,
  (next) => tableRef.value?.setLockMode(next),
  { immediate: true },
);
watch(
  () => currentConfig.value,
  (cfg) => {
    const handle = tableRef.value;
    if (!handle) return;
    handle.setSchema(cfg.schema);
    handle.setView({ ...cfg.view });
    handle.setData(cfg.data);
  },
  { deep: true },
);

const commit = () => {
  const core = tableRef.value?.getCore();
  void core?.commit();
};

const toggleFromSelection = (prop: "bold" | "italic" | "underline" | "strike") => {
  const core = tableRef.value?.getCore();
  const snap = selection.value;
  if (!core || !snap) return;
  const current = snap.styleState?.[prop];
  const nextVal = current === "on" ? false : true;
  core.applyStyleToSelection({ [prop]: nextVal } as any);
};

const applyTextColor = (color: string) =>
  tableRef.value?.getCore()?.applyStyleToSelection({ textColor: color } as any);
const applyBgColor = (color: string) =>
  tableRef.value?.getCore()?.applyStyleToSelection({ background: color } as any);
onMounted(() => {
  const onKey = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    const isMod = e.metaKey || e.ctrlKey;
    if (!isMod || key !== "f") return;
    const core = tableRef.value?.getCore();
    if (!core) return;
    e.preventDefault();
    e.stopPropagation();
    core.toggleSearchPanel("find");
  };
  document.addEventListener("keydown", onKey, true);
  onBeforeUnmount(() => {
    document.removeEventListener("keydown", onKey, true);
  });
});
const clearStyle = () => tableRef.value?.getCore()?.applyStyleToSelection(() => ({}));

const handleTableState = (next: any) => {
  tableState.value = next;
  const core = tableRef.value?.getCore?.();
  if (core) (window as any).__extableCore = core;
};
const handleCellEvent = (next: any) => {
  selection.value = next;
};

const safeFnSource = (fn: unknown) => {
  if (typeof fn !== "function") return null;
  try {
    return String(fn);
  } catch {
    return "[unavailable]";
  }
};
const dataNoteForSchema = (schema: Schema) => {
  const lines: string[] = [];
  const metaRow = schema.columns.find((c: any) => String(c.key) === "__row__");
  if ((metaRow as any)?.conditionalStyle) {
    lines.push("Row conditionalStyle (__row__):");
    lines.push(safeFnSource((metaRow as any).conditionalStyle) ?? "");
    lines.push("");
  }
  const cols = schema.columns.filter((c: any) => String(c.key) !== "__row__");
  const formulaCols = cols.filter((c: any) => Boolean((c as any).formula));
  const condCols = cols.filter((c: any) => Boolean((c as any).conditionalStyle));
  const uniqueCols = cols.filter((c: any) => Boolean((c as any).unique));
  if (formulaCols.length) {
    lines.push("Computed columns (formula):");
    for (const c of formulaCols) {
      lines.push(`- ${String((c as any).key)} (${String((c as any).type)}):`);
      lines.push(safeFnSource((c as any).formula) ?? "");
    }
    lines.push("");
  }
  if (condCols.length) {
    lines.push("Conditional styles (conditionalStyle):");
    for (const c of condCols) {
      lines.push(`- ${String((c as any).key)} (${String((c as any).type)}):`);
      lines.push(safeFnSource((c as any).conditionalStyle) ?? "");
    }
    lines.push("");
  }
  if (uniqueCols.length) {
    lines.push("Unique columns (unique: true):");
    for (const c of uniqueCols) {
      lines.push(
        `- ${String((c as any).key)} (${String((c as any).type)}): duplicates -> validation errors`,
      );
    }
    lines.push("");
  }
  if (!lines.length) return "No formula/conditionalStyle/unique rules in this dataset.";
  return lines.join("\n");
};

const dataNote = computed(() => {
  const cfg = currentConfig.value;
  const header = [
    `dataMode: ${dataMode.value}`,
    "",
    "Notes:",
    "- formula: (row) => value | [value, Error] (warning) | throw (error)",
    "- conditionalStyle: (row) => StyleDelta | null | Error (warning) | throw (error)",
    "- Warning/Error is shown as a corner marker with hover message.",
    "",
    "Sources:",
    "",
  ].join("\n");
  return header + dataNoteForSchema(cfg.schema);
});

const statePreview = computed(() =>
  JSON.stringify(
    {
      renderMode: renderMode.value,
      editMode: editMode.value,
      lockMode: lockMode.value,
      dataMode: dataMode.value,
    },
    null,
    2,
  ),
);
</script>
