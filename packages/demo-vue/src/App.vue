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
            <label class="flex items-center gap-2">
              <input v-model="editMode" name="edit-mode" type="radio" value="readonly" />
              <span>Readonly</span>
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
              type="button"
              class="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"
              :disabled="!tableState?.undoRedo?.canUndo"
              @click="undo"
            >
              Undo
            </button>
            <button
              type="button"
              class="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"
              :disabled="!tableState?.undoRedo?.canRedo"
              @click="redo"
            >
              Redo
            </button>
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
        <!-- Style controls removed (user-applied styling API removed) -->
      </section>

      <section class="min-h-0 flex-1 overflow-hidden">
        <div class="grid h-full min-h-0 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_380px]">
          <div class="min-h-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col overflow-hidden">
            <h2 class="mb-3 text-sm font-semibold text-slate-700">Table</h2>
            <div class="min-h-0 flex-1 overflow-visible p-5">
              <Extable
                ref="tableRef"
                :key="tableInstanceKey"
                :schema="currentConfig.schema"
                :defaultData="defaultData"
                :defaultView="currentConfig.view"
                :options="options"
                class="min-h-0 h-full w-full"
                @tableState="handleTableState"
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
            <h2 class="mt-4 mb-2 text-sm font-semibold text-slate-700">Undo history</h2>
            <ul class="mb-3 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800">
              <li v-if="!history.undo.length" class="py-1 text-slate-500">—</li>
              <li
                v-for="(step, idx) in history.undo"
                :key="`${step.batchId ?? 'no-batch'}-${idx}`"
                class="py-1"
              >
                {{ step.label }}<span v-if="step.batchId"> [{{ step.batchId }}]</span>
              </li>
            </ul>
            <h2 class="mb-2 text-sm font-semibold text-slate-700">Redo history</h2>
            <ul class="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800">
              <li v-if="!history.redo.length" class="py-1 text-slate-500">—</li>
              <li
                v-for="(step, idx) in history.redo"
                :key="`${step.batchId ?? 'no-batch'}-${idx}`"
                class="py-1"
              >
                {{ step.label }}<span v-if="step.batchId"> [{{ step.batchId }}]</span>
              </li>
            </ul>
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
  NullableData,
  Schema,
  ServerAdapter,
  UserInfo,
  UndoRedoHistory,
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
  numbersRows,
  numbersSchema,
  numbersView,
  demoRows,
  demoSchema,
  demoView,
  filterSortRows,
  filterSortSchema,
  filterSortView,
  formulaRows,
  formulaSchema,
  formulaView,
  makePerformanceDemoRows,
  uniqueCheckRows,
  uniqueCheckSchema,
  uniqueCheckView,
} from "./data/fixtures";

type RenderMode = "auto" | "html" | "canvas";
type EditMode = "direct" | "commit" | "readonly";
type LockMode = "none" | "row";
type DataMode =
  | "standard"
  | "data-format"
  | "numbers"
  | "formula"
  | "conditional-style"
  | "unique-check"
  | "filter-sort"
  | "loading-async"
  | "performance-10k";

const user: UserInfo = { id: "demo-user", name: "Demo User" };

const renderMode = ref<RenderMode>("auto");
const editMode = ref<EditMode>("direct");
const lockMode = ref<LockMode>("none");
const dataMode = ref<DataMode>("standard");
const dataModes = [
  { key: "standard", label: "Standard" },
  { key: "data-format", label: "Data Format" },
  { key: "numbers", label: "Numbers" },
  { key: "formula", label: "Formula" },
  { key: "conditional-style", label: "Conditional Style" },
  { key: "unique-check", label: "Unique Check" },
  { key: "filter-sort", label: "Filter / Sort" },
  { key: "loading-async", label: "Loading async data" },
  { key: "performance-10k", label: "Performance (10k rows)" },
] as const;

const tableRef = ref<ExtableVueHandle | null>(null);
const tableInstanceKey = ref(0);
const tableState = ref<any>(null);
const history = ref<UndoRedoHistory>({ undo: [], redo: [] });
const asyncData = ref<NullableData<any>>(null);
const perfRows = ref<any[] | null>(null);
let loadGeneration = 0;
let firstRenderMode = true;
let asyncTimer: number | null = null;

const serverStub: ServerAdapter = {
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
  if (mode === "loading-async") {
    return {
      data: null as NullableData<any>,
      schema: demoSchema as Schema,
      view: { ...demoView },
    };
  }
  if (mode === "performance-10k") {
    if (!perfRows.value) perfRows.value = makePerformanceDemoRows(10000);
    return {
      data: perfRows.value,
      schema: demoSchema as Schema,
      view: { ...demoView },
    };
  }
  if (mode === "data-format") {
    return {
      data: dataFormatRows.map((r) => ({ ...r })),
      schema: dataFormatSchema as Schema,
      view: { ...dataFormatView },
    };
  }
  if (mode === "numbers") {
    return {
      data: numbersRows.map((r) => ({ ...r })),
      schema: numbersSchema as Schema,
      view: { ...numbersView },
    };
  }
  if (mode === "formula") {
    return {
      data: formulaRows.map((r) => ({ ...r })),
      schema: formulaSchema as Schema,
      view: { ...formulaView },
    };
  }
  if (mode === "conditional-style") {
    return {
      data: conditionalStyleRows.map((r) => ({ ...r })),
      schema: conditionalStyleSchema as Schema,
      view: { ...conditionalStyleView },
    };
  }
  if (mode === "unique-check") {
    return {
      data: uniqueCheckRows.map((r) => ({ ...r })),
      schema: uniqueCheckSchema as Schema,
      view: { ...uniqueCheckView },
    };
  }
  if (mode === "filter-sort") {
    return {
      data: filterSortRows.map((r) => ({ ...r })),
      schema: filterSortSchema as Schema,
      view: { ...filterSortView },
    };
  }
  return {
    data: demoRows.map((r) => ({ ...r })),
    schema: demoSchema as Schema,
    view: { ...demoView },
  };
};

const currentConfig = computed(() => cloneConfig(dataMode.value));
const defaultData = computed(() =>
  dataMode.value === "loading-async" ? asyncData.value : currentConfig.value.data,
);

watch(
  () => renderMode.value,
  () => {
    if (firstRenderMode) {
      firstRenderMode = false;
      return;
    }
    loadGeneration += 1;
    if (asyncTimer !== null) {
      window.clearTimeout(asyncTimer);
      asyncTimer = null;
    }
    tableInstanceKey.value += 1;
    if (dataMode.value === "loading-async") {
      asyncData.value = null;
      const gen = loadGeneration;
      asyncTimer = window.setTimeout(() => {
        if (gen !== loadGeneration) return;
        asyncData.value = demoRows.map((r) => ({ ...r }));
      }, 3000);
    }
  },
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
  () => dataMode.value,
  (next, _prev, onInvalidate) => {
    loadGeneration += 1;
    if (asyncTimer !== null) {
      window.clearTimeout(asyncTimer);
      asyncTimer = null;
    }
    if (next !== "loading-async") {
      asyncData.value = null;
      return;
    }
    asyncData.value = null;
    tableInstanceKey.value += 1;
    const gen = loadGeneration;
    asyncTimer = window.setTimeout(() => {
      if (gen !== loadGeneration) return;
      asyncData.value = demoRows.map((r) => ({ ...r }));
    }, 3000);
    onInvalidate(() => {
      if (asyncTimer !== null) {
        window.clearTimeout(asyncTimer);
        asyncTimer = null;
      }
    });
  },
  { immediate: true },
);
watch(
  () => currentConfig.value,
  () => {
    // Remount to apply new schema/view/data combinations.
    tableInstanceKey.value += 1;
  },
  { deep: true },
);

const commit = () => {
  void tableRef.value?.commit();
};

const undo = () => tableRef.value?.undo();
const redo = () => tableRef.value?.redo();

// Style controls removed (user-applied styling API removed).
onMounted(() => {
  const onKey = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    const isMod = e.metaKey || e.ctrlKey;
    // eslint-disable-next-line no-console
    console.debug("[demo-vue] keydown", {
      key: e.key,
      ctrl: e.ctrlKey,
      meta: e.metaKey,
      shift: e.shiftKey,
      alt: e.altKey,
      target: (e.target as HTMLElement | null)?.tagName ?? "unknown",
    });
    if (!isMod) return;

    // Undo: Ctrl/Cmd+Z
    if (key === "z") {
      if (!tableRef.value) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        tableRef.value.redo(); // Ctrl/Cmd+Shift+Z
      } else {
        tableRef.value.undo(); // Ctrl/Cmd+Z
      }
    }
  };
  document.addEventListener("keydown", onKey, true);
  onBeforeUnmount(() => {
    document.removeEventListener("keydown", onKey, true);
  });
});
const handleTableState = (next: any) => {
  tableState.value = next;
  if (tableRef.value) {
    (window as unknown as Record<string, unknown>).__extableCore = tableRef.value;
    history.value = tableRef.value.getUndoRedoHistory();
  } else {
    history.value = { undo: [], redo: [] };
  }
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
  if (schema.row?.conditionalStyle) {
    lines.push("Row conditionalStyle:");
    lines.push(safeFnSource(schema.row.conditionalStyle) ?? "");
    lines.push("");
  }
  const cols = schema.columns;
  const formulaCols = cols.filter((c) =>
    Boolean((c as unknown as Record<string, unknown>).formula),
  );
  const condCols = cols.filter((c) =>
    Boolean((c as unknown as Record<string, unknown>).conditionalStyle),
  );
  const uniqueCols = cols.filter((c) => Boolean((c as unknown as Record<string, unknown>).unique));
  if (formulaCols.length) {
    lines.push("Computed columns (formula):");
    for (const c of formulaCols) {
      const _c = c as unknown as Record<string, unknown>;
      lines.push(`- ${String(_c.key)} (${String(_c.type)}):`);
      lines.push(safeFnSource(_c.formula) ?? "");
    }
    lines.push("");
  }
  if (condCols.length) {
    lines.push("Conditional styles (conditionalStyle):");
    for (const c of condCols) {
      const _c = c as unknown as Record<string, unknown>;
      lines.push(`- ${String(_c.key)} (${String(_c.type)}):`);
      lines.push(safeFnSource(_c.conditionalStyle) ?? "");
    }
    lines.push("");
  }
  if (uniqueCols.length) {
    lines.push("Unique columns (unique: true):");
    for (const c of uniqueCols) {
      const _c = c as unknown as Record<string, unknown>;
      lines.push(`- ${String(_c.key)} (${String(_c.type)}): duplicates -> validation errors`);
    }
    lines.push("");
  }
  if (!lines.length) return "No formula/conditionalStyle/unique rules in this dataset.";
  return lines.join("\n");
};

const dataNote = computed(() => {
  const cfg = currentConfig.value;
  const headerLines = [
    `dataMode: ${dataMode.value}`,
    "",
    "Notes:",
    "- formula: (row) => value | [value, Error] (warning) | throw (error)",
    "- conditionalStyle: (row) => StyleDelta | null | Error (warning) | throw (error)",
    "- Warning/Error is shown as a corner marker with hover message.",
  ];
  if (dataMode.value === "unique-bool") {
    headerLines.push(
      "- commit mode: unique-boolean changes show red (current) and gray (previous) dots.",
    );
  }
  headerLines.push("", "Sources:", "");
  return headerLines.join("\n") + dataNoteForSchema(cfg.schema);
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
