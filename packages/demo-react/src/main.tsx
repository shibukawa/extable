import "./style.css";
import "@extable/core/style.css";
import { Extable, type ExtableHandle } from "@extable/react";
import type {
  Command,
  CoreOptions,
  DataSet,
  NullableDataSet,
  Schema,
  ServerAdapter,
  UserInfo,
  UndoRedoHistory,
  View,
} from "@extable/core";
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
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
  | "formula"
  | "conditional-style"
  | "unique-check"
  | "filter-sort"
  | "loading-async"
  | "performance-10k";

const user: UserInfo = { id: "demo-user", name: "Demo User" };

export function App() {
  const [renderMode, setRenderMode] = useState<RenderMode>("auto");
  const [editMode, setEditMode] = useState<EditMode>("direct");
  const [lockMode, setLockMode] = useState<LockMode>("none");
  const [dataMode, setDataMode] = useState<DataMode>("standard");
  const [tableInstanceKey, setTableInstanceKey] = useState(0);
  const tableRef = useRef<ExtableHandle>(null);
  const [tableState, setTableState] = useState<any>(null);
  const [history, setHistory] = useState<UndoRedoHistory>({ undo: [], redo: [] });
  const [asyncData, setAsyncData] = useState<NullableDataSet>(null);
  const loadGenerationRef = useRef(0);
  const loadTimerRef = useRef<number | null>(null);
  const renderModeFirstRef = useRef(true);

  const serverStub = useMemo<ServerAdapter>(
    () => ({
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
    }),
    [],
  );

  const options = useMemo<CoreOptions>(
    () => ({
      renderMode,
      editMode,
      lockMode,
      server: serverStub,
      user,
    }),
    [renderMode, editMode, lockMode, serverStub],
  );

  const perfRowsRef = useRef<any[] | null>(null);
  const cloneConfig = (mode: DataMode): { data: NullableDataSet; view: View; schema: Schema } => {
    if (mode === "loading-async") {
      return {
        data: null,
        schema: demoSchema as Schema,
        view: { ...demoView },
      };
    }
    if (mode === "performance-10k") {
      if (!perfRowsRef.current) perfRowsRef.current = makePerformanceDemoRows(10000);
      return {
        data: { rows: perfRowsRef.current } as DataSet,
        schema: demoSchema as Schema,
        view: { ...demoView },
      };
    }
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

  const currentConfig = useMemo(() => cloneConfig(dataMode), [dataMode]);
  const defaultData = dataMode === "loading-async" ? asyncData : currentConfig.data;

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

  const dataNote = (() => {
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
    return header + dataNoteForSchema(cfg.schema);
  })();

  useEffect(() => {
    const handle = tableRef.current;
    const core = handle?.getCore();
    if (!handle || !core) return;
    (window as any).__extableCore = core;
  }, []);

  useEffect(() => {
    if (renderModeFirstRef.current) {
      renderModeFirstRef.current = false;
      return;
    }
    loadGenerationRef.current += 1;
    if (loadTimerRef.current !== null) {
      window.clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    setTableInstanceKey((k) => k + 1);
    if (dataMode === "loading-async") {
      setAsyncData(null);
      const gen = loadGenerationRef.current;
      loadTimerRef.current = window.setTimeout(() => {
        if (gen !== loadGenerationRef.current) return;
        setAsyncData({ rows: demoRows.map((r) => ({ ...r })) } as DataSet);
      }, 3000);
    }
  }, [renderMode]);
  useEffect(() => {
    const handle = tableRef.current;
    if (!handle) return;
    handle.setEditMode(editMode);
  }, [editMode]);
  useEffect(() => {
    const handle = tableRef.current;
    if (!handle) return;
    handle.setLockMode(lockMode);
  }, [lockMode]);

  useEffect(() => {
    loadGenerationRef.current += 1;
    if (loadTimerRef.current !== null) {
      window.clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    if (dataMode !== "loading-async") {
      setAsyncData(null);
      return;
    }

    // Ensure the instance starts in loading state (defaultData=null).
    setAsyncData(null);
    setTableInstanceKey((k) => k + 1);

    const gen = loadGenerationRef.current;
    loadTimerRef.current = window.setTimeout(() => {
      if (gen !== loadGenerationRef.current) return;
      setAsyncData({ rows: demoRows.map((r) => ({ ...r })) } as DataSet);
    }, 3000);
    return () => {
      if (loadTimerRef.current !== null) {
        window.clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
      }
    };
  }, [dataMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod || key !== "f") return;
      const core = tableRef.current?.getCore();
      if (!core) return;
      e.preventDefault();
      e.stopPropagation();
      core.toggleSearchPanel("find");
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    const handle = tableRef.current;
    if (!handle) return;
    const next = currentConfig;
    handle.setSchema(next.schema);
    handle.setView({ ...next.view });
    handle.setData(defaultData);
  }, [currentConfig, defaultData]);

  useEffect(() => {
    const core = tableRef.current?.getCore();
    if (!core) {
      setHistory({ undo: [], redo: [] });
      return;
    }
    setHistory(core.getUndoRedoHistory());
  }, [tableState]);

  const commit = () => {
    const core = tableRef.current?.getCore();
    void core?.commit();
  };

  return (
    <main className="h-screen overflow-visible bg-slate-50 text-slate-900">
      <div className="mx-auto flex h-full w-full max-w-none flex-col gap-4 p-6 overflow-visible">
        <header className="flex items-baseline justify-between gap-4">
          <h1 className="text-2xl font-semibold">Extable Demo (React)</h1>
          <div className="text-sm text-slate-600">Tailwind (Preflight enabled)</div>
        </header>

        <section className="flex flex-wrap items-start gap-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="min-w-[220px]">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Render Mode</h2>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2">
                <input
                  checked={renderMode === "auto"}
                  name="mode"
                  type="radio"
                  value="auto"
                  onChange={() => setRenderMode("auto")}
                />
                <span>Auto</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  checked={renderMode === "html"}
                  name="mode"
                  type="radio"
                  value="html"
                  onChange={() => setRenderMode("html")}
                />
                <span>HTML</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  checked={renderMode === "canvas"}
                  name="mode"
                  type="radio"
                  value="canvas"
                  onChange={() => setRenderMode("canvas")}
                />
                <span>Canvas</span>
              </label>
            </div>
          </div>
          <div className="min-w-[220px]">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Edit Mode</h2>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2">
                <input
                  checked={editMode === "direct"}
                  name="edit-mode"
                  type="radio"
                  value="direct"
                  onChange={() => setEditMode("direct")}
                />
                <span>Direct</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  checked={editMode === "commit"}
                  name="edit-mode"
                  type="radio"
                  value="commit"
                  onChange={() => setEditMode("commit")}
                />
                <span>Commit</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  checked={editMode === "readonly"}
                  name="edit-mode"
                  type="radio"
                  value="readonly"
                  onChange={() => setEditMode("readonly")}
                />
                <span>Readonly</span>
              </label>
            </div>
          </div>
          <div className="min-w-[220px]">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Lock Mode</h2>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2">
                <input
                  checked={lockMode === "none"}
                  name="lock-mode"
                  type="radio"
                  value="none"
                  onChange={() => setLockMode("none")}
                />
                <span>None</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  checked={lockMode === "row"}
                  name="lock-mode"
                  type="radio"
                  value="row"
                  onChange={() => setLockMode("row")}
                />
                <span>Row Lock</span>
              </label>
            </div>
          </div>
          <div className="min-w-[280px]">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Data Set</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {(
                [
                  ["standard", "Standard"],
                  ["data-format", "Data Format"],
                  ["formula", "Formula"],
                  ["conditional-style", "Conditional Style"],
                  ["unique-check", "Unique Check"],
                  ["filter-sort", "Filter / Sort"],
                  ["loading-async", "Loading async data"],
                  ["performance-10k", "Performance (10k rows)"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    checked={dataMode === key}
                    name="data-mode"
                    type="radio"
                    value={key}
                    onChange={() => setDataMode(key)}
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="min-w-[260px]">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Actions</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"
                onClick={() => tableRef.current?.getCore()?.undo()}
                disabled={!tableState?.undoRedo?.canUndo}
              >
                Undo
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"
                onClick={() => tableRef.current?.getCore()?.redo()}
                disabled={!tableState?.undoRedo?.canRedo}
              >
                Redo
              </button>
              {editMode === "commit" ? (
                <button
                  type="button"
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  onClick={commit}
                  disabled={!tableState?.canCommit}
                >
                  Commit Pending
                </button>
              ) : (
                <div className="text-sm text-slate-500">Commit mode required</div>
              )}
              <div className="text-xs text-slate-600">
                {tableState
                  ? `pending=${tableState.pendingCommandCount} cells=${tableState.pendingCellCount} undo=${
                      tableState.undoRedo?.canUndo ? "1" : "0"
                    } redo=${tableState.undoRedo?.canRedo ? "1" : "0"} mode=${tableState.renderMode}`
                  : "—"}
              </div>
            </div>
          </div>
        </section>

        <section className="min-h-0 flex-1 overflow-visible">
          <div className="grid h-full min-h-0 grid-cols-1 gap-4 overflow-visible lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-h-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col overflow-visible">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Table</h2>
              <div className="min-h-0 flex-1 overflow-visible p-5">
                <Extable
                  key={tableInstanceKey}
                  ref={tableRef}
                  schema={currentConfig.schema}
                  defaultData={defaultData}
                  defaultView={currentConfig.view}
                  options={options}
                  onTableState={(next) => {
                    setTableState(next);
                    const core = tableRef.current?.getCore();
                    if (core) (window as any).__extableCore = core;
                  }}
                  className="min-h-0 h-full w-full"
                />
              </div>
            </div>
            <div className="min-h-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden flex flex-col">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">State Preview</h2>
              <pre className="mb-4 max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                {JSON.stringify(
                  {
                    renderMode,
                    editMode,
                    lockMode,
                    dataMode,
                  },
                  null,
                  2,
                )}
              </pre>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Data Note</h2>
              <pre className="max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                {dataNote}
              </pre>
              <h2 className="mt-4 mb-2 text-sm font-semibold text-slate-700">Undo history</h2>
              <ul className="mb-3 max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800">
                {history.undo.length ? (
                  history.undo.map((step, idx) => (
                    <li key={`${step.batchId ?? "no-batch"}-${idx}`} className="py-1">
                      {step.label}
                      {step.batchId ? ` [${step.batchId}]` : ""}
                    </li>
                  ))
                ) : (
                  <li className="py-1 text-slate-500">—</li>
                )}
              </ul>
              <h2 className="mb-2 text-sm font-semibold text-slate-700">Redo history</h2>
              <ul className="max-h-40 overflow-auto rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800">
                {history.redo.length ? (
                  history.redo.map((step, idx) => (
                    <li key={`${step.batchId ?? "no-batch"}-${idx}`} className="py-1">
                      {step.label}
                      {step.batchId ? ` [${step.batchId}]` : ""}
                    </li>
                  ))
                ) : (
                  <li className="py-1 text-slate-500">—</li>
                )}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

export default App;
