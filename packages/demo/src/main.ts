import "./style.css";
import "@extable/core/style.css";
import { ExtableCore } from "@extable/core";
import type {
  Command,
  CoreOptions,
  NullableData,
  Schema,
  ServerAdapter,
  UserInfo,
  View,
} from "@extable/core";
import {
  demoRows,
  demoSchema,
  demoView,
  dataFormatRows,
  dataFormatSchema,
  dataFormatView,
  formulaRows,
  formulaSchema,
  formulaView,
  conditionalStyleRows,
  conditionalStyleSchema,
  conditionalStyleView,
  uniqueCheckRows,
  uniqueCheckSchema,
  uniqueCheckView,
  filterSortRows,
  filterSortSchema,
  filterSortView,
  makePerformanceDemoRows,
} from "./data/fixtures";

type Mode = "html" | "canvas" | "auto";
type EditMode = "direct" | "commit" | "readonly";
type LockMode = "none" | "row";
type DataMode =
  | "standard"
  | "data-format"
  | "formula"
  | "conditional-style"
  | "unique-check"
  | "filter-sort"
  | "loading-async"
  | "performance-10k";

const app = document.querySelector<HTMLDivElement>("#app");
const tableRootId = "table-root";

const user: UserInfo = { id: "demo-user", name: "Demo User" };

let currentConfig: { data: NullableData; view: View; schema: Schema } = {
  data: demoRows.map((r) => ({ ...r })),
  view: { ...demoView },
  schema: demoSchema,
};

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

function renderShell() {
  if (!app) return;
  app.innerHTML = `
    <main>
      <h1>Extable Demo</h1>
      <section class="controls">
        <div>
      <h2>Render Mode</h2>
      <label><input type="radio" name="render-mode" value="auto" checked /> Auto</label>
      <label><input type="radio" name="render-mode" value="html" /> HTML</label>
      <label><input type="radio" name="render-mode" value="canvas" /> Canvas</label>
    </div>
        <div>
          <h2>Edit Mode</h2>
          <label><input type="radio" name="edit-mode" value="direct" checked /> Direct</label>
      <label><input type="radio" name="edit-mode" value="commit" /> Commit</label>
      <label><input type="radio" name="edit-mode" value="readonly" /> Readonly</label>
    </div>
    <div>
      <h2>Lock Mode</h2>
      <label><input type="radio" name="lock-mode" value="none" checked /> None</label>
      <label><input type="radio" name="lock-mode" value="row" /> Row Lock</label>
    </div>
    <div>
      <h2>Data Set</h2>
      <label><input type="radio" name="data-mode" value="standard" checked /> Standard</label>
      <label><input type="radio" name="data-mode" value="data-format" /> Data Format</label>
      <label><input type="radio" name="data-mode" value="formula" /> Formula</label>
      <label><input type="radio" name="data-mode" value="conditional-style" /> Conditional Style</label>
      <label><input type="radio" name="data-mode" value="unique-check" /> Unique Check</label>
      <label><input type="radio" name="data-mode" value="filter-sort" /> Filter / Sort</label>
      <label><input type="radio" name="data-mode" value="loading-async" /> Loading async data</label>
      <label><input type="radio" name="data-mode" value="performance-10k" /> Performance (10k rows)</label>
    </div>
    <div>
      <h2>Actions</h2>
      <button id="commit-btn" style="display:none;" disabled>Commit Pending</button>
      <button id="undo-btn" disabled>Undo</button>
      <button id="redo-btn" disabled>Redo</button>
      <div id="commit-state" class="commit-state"></div>
    </div>
  </section>
      <section class="layout">
        <div class="table-panel">
          <h2>Table</h2>
          <div class="table-container">
            <div id="${tableRootId}" class="table-root"></div>
          </div>
        </div>
        <div class="state-panel">
          <h2>State Preview</h2>
          <pre id="state"></pre>
          <h2>Data Note</h2>
          <pre id="data-note"></pre>
          <h2>Undo history</h2>
          <ul id="undo-history"></ul>
          <h2>Redo history</h2>
          <ul id="redo-history"></ul>
        </div>
      </section>
    </main>
  `;
}

function cloneConfig(dataMode: DataMode) {
  if (dataMode === "loading-async") {
    return {
      data: null,
      schema: demoSchema,
      view: { ...demoView },
    };
  }
  if (dataMode === "performance-10k") {
    (cloneConfig as unknown as Record<string, unknown>)._perfRows ??=
      makePerformanceDemoRows(10000);
    return {
      data: (cloneConfig as unknown as Record<string, unknown>)._perfRows as any[],
      schema: demoSchema,
      view: { ...demoView },
    };
  }
  if (dataMode === "data-format") {
    return {
      data: dataFormatRows.map((r) => ({ ...r })),
      schema: dataFormatSchema,
      view: { ...dataFormatView },
    };
  }
  if (dataMode === "formula") {
    return {
      data: formulaRows.map((r) => ({ ...r })),
      schema: formulaSchema,
      view: { ...formulaView },
    };
  }
  if (dataMode === "conditional-style") {
    return {
      data: conditionalStyleRows.map((r) => ({ ...r })),
      schema: conditionalStyleSchema,
      view: { ...conditionalStyleView },
    };
  }
  if (dataMode === "unique-check") {
    return {
      data: uniqueCheckRows.map((r) => ({ ...r })),
      schema: uniqueCheckSchema,
      view: { ...uniqueCheckView },
    };
  }
  if (dataMode === "filter-sort") {
    return {
      data: filterSortRows.map((r) => ({ ...r })),
      schema: filterSortSchema,
      view: { ...filterSortView },
    };
  }
  return {
    data: demoRows.map((r) => ({ ...r })),
    schema: demoSchema,
    view: { ...demoView },
  };
}

function main() {
  if (!app) return;
  renderShell();
  const tableRoot = document.getElementById(tableRootId)!;

  const options: CoreOptions = {
    renderMode: "auto",
    editMode: "direct",
    lockMode: "none",
    server: serverStub,
    user,
  };

  let core: ExtableCore | null = null;
  let dataMode: DataMode = "standard";
  let unsubscribeTable: (() => void) | null = null;
  let loadGeneration = 0;
  let loadTimer: number | null = null;

  const stateEl = document.getElementById("state");
  const dataNoteEl = document.getElementById("data-note");
  const undoBtn = document.getElementById("undo-btn") as HTMLButtonElement | null;
  const redoBtn = document.getElementById("redo-btn") as HTMLButtonElement | null;
  const undoHistoryEl = document.getElementById("undo-history") as HTMLUListElement | null;
  const redoHistoryEl = document.getElementById("redo-history") as HTMLUListElement | null;

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
    const metaRow = schema.columns.find((c) => String(c.key) === "__row__");
    if ((metaRow as unknown as Record<string, unknown>)?.conditionalStyle) {
      lines.push("Row conditionalStyle (__row__):");
      lines.push(
        safeFnSource((metaRow as unknown as Record<string, unknown>).conditionalStyle) ?? "",
      );
      lines.push("");
    }

    const cols = schema.columns.filter((c) => String(c.key) !== "__row__");
    const formulaCols = cols.filter((c) =>
      Boolean((c as unknown as Record<string, unknown>).formula),
    );
    const condCols = cols.filter((c) =>
      Boolean((c as unknown as Record<string, unknown>).conditionalStyle),
    );
    const uniqueCols = cols.filter((c) =>
      Boolean((c as unknown as Record<string, unknown>).unique),
    );

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

  const updateDataNote = () => {
    if (!dataNoteEl) return;
    const cfg = currentConfig;
    const header = [
      `dataMode: ${dataMode}`,
      "",
      "Notes:",
      "- formula: (row) => value | [value, Error] (warning) | throw (error)",
      "- conditionalStyle: (row) => StyleDelta | null | Error (warning) | throw (error)",
      "- Warning/Error is shown as a corner marker with hover message.",
      "",
      "Sources:",
      "",
    ].join("\n");
    dataNoteEl.textContent = header + dataNoteForSchema(cfg.schema);
  };

  const updateState = () => {
    if (!stateEl) return;
    stateEl.textContent = JSON.stringify(
      {
        renderMode: options.renderMode,
        editMode: options.editMode,
        lockMode: options.lockMode,
        dataMode,
      },
      null,
      2,
    );
    updateDataNote();
  };

  const rebuildCore = () => {
    loadGeneration += 1;
    if (loadTimer !== null) {
      window.clearTimeout(loadTimer);
      loadTimer = null;
    }
    core?.destroy();
    unsubscribeTable?.();
    unsubscribeTable = null;
    const config = cloneConfig(dataMode);
    currentConfig = config;
    updateDataNote();
    core = new ExtableCore({
      root: tableRoot,
      defaultData: config.data,
      defaultView: { ...config.view, wrapText: config.view.wrapText ?? {} },
      schema: config.schema,
      options: { ...options },
    });
    if (dataMode === "loading-async") {
      const gen = loadGeneration;
      loadTimer = window.setTimeout(() => {
        if (gen !== loadGeneration) return;
        if (dataMode !== "loading-async") return;
        core?.setData(demoRows.map((r) => ({ ...r })));
      }, 3000);
    }
    // Expose the latest core instance for demos/e2e.
    (window as unknown as Record<string, unknown>).__extableCore = core;
    const commitBtn = document.getElementById("commit-btn");
    if (commitBtn) {
      commitBtn.style.display = options.editMode === "commit" ? "inline-block" : "none";
    }

    const commitState = document.getElementById("commit-state");
    unsubscribeTable = core.subscribeTableState((next) => {
      if (commitBtn) {
        commitBtn.toggleAttribute("disabled", !next.canCommit);
        if (options.editMode !== "commit") commitBtn.setAttribute("disabled", "true");
      }
      if (undoBtn) undoBtn.toggleAttribute("disabled", !next.undoRedo.canUndo);
      if (redoBtn) redoBtn.toggleAttribute("disabled", !next.undoRedo.canRedo);
      if (commitState) {
        commitState.textContent = `pending=${next.pendingCommandCount} cells=${next.pendingCellCount} undo=${next.undoRedo.canUndo ? "1" : "0"} redo=${next.undoRedo.canRedo ? "1" : "0"} mode=${next.renderMode}`;
      }

      const renderHistoryList = (
        el: HTMLUListElement | null,
        items: { label: string; batchId: string | null; commandCount: number }[],
      ) => {
        if (!el) return;
        el.innerHTML = "";
        if (!items.length) {
          const li = document.createElement("li");
          li.textContent = "—";
          el.appendChild(li);
          return;
        }
        for (const item of items) {
          const li = document.createElement("li");
          const batch = item.batchId ? ` [${item.batchId}]` : "";
          li.textContent = `${item.label}${batch}`;
          el.appendChild(li);
        }
      };

      const history = core?.getUndoRedoHistory();
      if (history) {
        renderHistoryList(undoHistoryEl, history.undo);
        renderHistoryList(redoHistoryEl, history.redo);
      } else {
        renderHistoryList(undoHistoryEl, []);
        renderHistoryList(redoHistoryEl, []);
      }
    });

    updateState();
  };

  rebuildCore();

  undoBtn?.addEventListener("click", () => core?.undo());
  redoBtn?.addEventListener("click", () => core?.redo());

  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="render-mode"]')) {
    input.addEventListener("change", () => {
      options.renderMode = input.value as Mode;
      rebuildCore();
    });
  }

  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="edit-mode"]')) {
    input.addEventListener("change", () => {
      options.editMode = input.value as EditMode;
      rebuildCore();
    });
  }

  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="lock-mode"]')) {
    input.addEventListener("change", () => {
      options.lockMode = input.value as LockMode;
      rebuildCore();
    });
  }

  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="data-mode"]')) {
    input.addEventListener("change", () => {
      dataMode = input.value as DataMode;
      rebuildCore();
    });
  }

  const commitBtn = document.getElementById("commit-btn");
  commitBtn?.addEventListener("click", () => {
    void core?.commit();
  });

  const onKey = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    const isMod = e.metaKey || e.ctrlKey;
    if (!isMod || key !== "f") return;
    if (!core) return;
    e.preventDefault();
    e.stopPropagation();
    core.toggleSearchPanel("find");
  };
  document.addEventListener("keydown", onKey, { capture: true });
  window.addEventListener("beforeunload", () => {
    document.removeEventListener("keydown", onKey, { capture: true });
  });
}

main();
