import "./style.css";
import "@extable/core/style.css";
import { Extable, type ExtableHandle } from "@extable/react";
import type {
  Command,
  CoreOptions,
  DataSet,
  Schema,
  ServerAdapter,
  UserInfo,
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

export function App() {
  const [renderMode, setRenderMode] = useState<RenderMode>("auto");
  const [editMode, setEditMode] = useState<EditMode>("direct");
  const [lockMode, setLockMode] = useState<LockMode>("none");
  const [dataMode, setDataMode] = useState<DataMode>("standard");
  const tableRef = useRef<ExtableHandle>(null);
  const [tableState, setTableState] = useState<any>(null);
  const [selection, setSelection] = useState<any>(null);
  const [lastTextColor, setLastTextColor] = useState("#000000");
  const [lastBgColor, setLastBgColor] = useState("#ffffff");

  const currentConfigRef = useRef<{ data: DataSet; view: View; schema: Schema }>({
    data: { rows: demoRows.map((r) => ({ ...r })) },
    view: { ...demoView },
    schema: demoSchema as Schema,
  });

  const serverStub = useMemo<ServerAdapter>(
    () => ({
      async fetchInitial() {
        return { ...currentConfigRef.current, user };
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

  const currentConfig = useMemo(() => cloneConfig(dataMode), [dataMode]);
  // Keep server stub fetchInitial in sync.
  currentConfigRef.current = currentConfig;

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
    const handle = tableRef.current;
    if (!handle) return;
    handle.setRenderMode(renderMode);
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
    handle.setData(next.data);
  }, [currentConfig]);

  const commit = () => {
    const core = tableRef.current?.getCore();
    void core?.commit();
  };

  const toggleFromSelection = (prop: "bold" | "italic" | "underline" | "strike") => {
    const core = tableRef.current?.getCore();
    if (!core || !selection) return;
    const current = selection.styleState?.[prop];
    const nextVal = current === "on" ? false : true;
    core.applyStyleToSelection({ [prop]: nextVal } as any);
  };

  const applyTextColor = (color: string) => {
    const core = tableRef.current?.getCore();
    if (!core) return;
    core.applyStyleToSelection({ textColor: color } as any);
  };
  const applyBgColor = (color: string) => {
    const core = tableRef.current?.getCore();
    if (!core) return;
    core.applyStyleToSelection({ background: color } as any);
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
          <div className="min-w-[340px]">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">Style</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`rounded-md border border-slate-200 bg-white px-2 py-1 text-sm ${
                  selection?.styleState?.bold === "on" ? "ring-2 ring-slate-900" : ""
                }`}
                onClick={() => toggleFromSelection("bold")}
                disabled={!selection?.canStyle}
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                className={`rounded-md border border-slate-200 bg-white px-2 py-1 text-sm ${
                  selection?.styleState?.italic === "on" ? "ring-2 ring-slate-900" : ""
                }`}
                onClick={() => toggleFromSelection("italic")}
                disabled={!selection?.canStyle}
              >
                <em>I</em>
              </button>
              <button
                type="button"
                className={`rounded-md border border-slate-200 bg-white px-2 py-1 text-sm ${
                  selection?.styleState?.underline === "on" ? "ring-2 ring-slate-900" : ""
                }`}
                onClick={() => toggleFromSelection("underline")}
                disabled={!selection?.canStyle}
              >
                <span className="underline">U</span>
              </button>
              <button
                type="button"
                className={`rounded-md border border-slate-200 bg-white px-2 py-1 text-sm ${
                  selection?.styleState?.strike === "on" ? "ring-2 ring-slate-900" : ""
                }`}
                onClick={() => toggleFromSelection("strike")}
                disabled={!selection?.canStyle}
              >
                <span className="line-through">S</span>
              </button>

              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
                <span className="text-xs text-slate-500">Text</span>
                <button
                  type="button"
                  className="rounded border border-slate-200 px-2 py-1 text-xs"
                  onClick={() => applyTextColor(lastTextColor)}
                  disabled={!selection?.canStyle}
                >
                  Apply
                </button>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    className="h-6 w-8 cursor-pointer"
                    type="color"
                    value={lastTextColor}
                    onChange={(e) => setLastTextColor(e.target.value)}
                    disabled={!selection?.canStyle}
                    aria-label="Pick text color"
                  />
                </label>
              </div>

              <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
                <span className="text-xs text-slate-500">Bg</span>
                <button
                  type="button"
                  className="rounded border border-slate-200 px-2 py-1 text-xs"
                  onClick={() => applyBgColor(lastBgColor)}
                  disabled={!selection?.canStyle}
                >
                  Apply
                </button>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    className="h-6 w-8 cursor-pointer"
                    type="color"
                    value={lastBgColor}
                    onChange={(e) => setLastBgColor(e.target.value)}
                    disabled={!selection?.canStyle}
                    aria-label="Pick background color"
                  />
                </label>
              </div>

              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
                onClick={() => tableRef.current?.getCore()?.applyStyleToSelection(() => ({}))}
                disabled={!selection?.canStyle}
              >
                Clear
              </button>
            </div>
          </div>
        </section>

        <section className="min-h-0 flex-1 overflow-visible">
          <div className="grid h-full min-h-0 grid-cols-1 gap-4 overflow-visible lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-h-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col overflow-visible">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Table</h2>
              <div className="min-h-0 flex-1 overflow-visible p-5">
                <Extable
                  ref={tableRef}
                  schema={currentConfig.schema}
                  defaultData={currentConfig.data}
                  defaultView={currentConfig.view}
                  options={options}
                  onTableState={(next) => {
                    setTableState(next);
                    const core = tableRef.current?.getCore();
                    if (core) (window as any).__extableCore = core;
                  }}
                  onCellEvent={(next) => setSelection(next)}
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
