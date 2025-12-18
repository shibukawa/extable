import "./styles.css";
import { CommandQueue } from "./commandQueue";
import { DataModel } from "./dataModel";
import { resolveCellAddress } from "./address";
import { FindReplaceController, type FindReplaceMode } from "./findReplace";
import { LockManager } from "./lockManager";
import { CanvasRenderer, HTMLRenderer, type Renderer, type ViewportState } from "./renderers";
import { SelectionManager } from "./selectionManager";
import { resolveCellStyles } from "./styleResolver";
import { removeFromParent, toArray } from "./utils";
import type {
  CellTarget,
  Command,
  CoreOptions,
  HistoryCommandKind,
  InternalRow,
  NullableData,
  EditMode,
  LockMode,
  RenderMode,
  Schema,
  ServerAdapter,
  SelectionChangeReason,
  SelectionListener,
  SelectionRange,
  SelectionSnapshot,
  TableConfig,
  TableError,
  TableState,
  TableStateListener,
  UndoRedoHistory,
  UndoRedoStep,
  UserInfo,
  Updater,
  View,
  ViewFilterValues,
  RowObject,
  RowStateSnapshot,
  RowStateListener,
  RowChangeReason,
} from "./types";

export * from "./types";
export type {
  FindReplaceMatch,
  FindReplaceMode,
  FindReplaceOptions,
  FindReplaceState,
} from "./findReplace";
export { FindReplaceController } from "./findReplace";

export interface CoreInit<T extends object = Record<string, unknown>> {
  root: HTMLElement;
  defaultData: NullableData<T>;
  defaultView: View;
  schema: Schema<any>;
  options?: CoreOptions;
}

export class ExtableCore<T extends object = Record<string, unknown>, R extends object = T> {
  private root: HTMLElement;
  private shell: HTMLDivElement | null = null;
  private viewportEl: HTMLDivElement | null = null;
  private viewportResizeObserver: ResizeObserver | null = null;
  private dataModel: DataModel;
  private dataLoaded: boolean;
  private loadingEnabled: boolean;
  private commandQueue: CommandQueue;
  private lockManager: LockManager;
  private renderer: Renderer;
  private selectionManager: SelectionManager | null = null;
  private renderMode: RenderMode;
  private editMode: EditMode;
  private lockMode: LockMode;
  private server?: ServerAdapter;
  private user?: UserInfo;
  private unsubscribe?: () => void;
  private resizeHandler: (() => void) | null = null;
  private scrollHandler: (() => void) | null = null;
  private viewportState: ViewportState | null = null;
  private rafId: number | null = null;
  private contextMenu: HTMLDivElement | null = null;
  private contextMenuRowId: string | null = null;
  private handleGlobalPointer: ((ev: MouseEvent | PointerEvent) => void) | null = null;
  private toast: HTMLDivElement | null = null;
  private toastTimer: number | null = null;
  private findReplace: FindReplaceController | null = null;
  private findReplaceSidebar: HTMLElement | null = null;
  private findReplaceSidebarUnsub: (() => void) | null = null;
  private findReplaceEnabled = true;
  private findReplaceUiEnabled = true;
  private findReplaceEnableSearch = false;

  private mounted = false;

  private isCellReadonly(rowId: string, colKey: string) {
    return this.editMode === "readonly" || this.dataModel.isReadonly(rowId, colKey);
  }

  private resolveRowId(row: string | number): string | null {
    if (typeof row === "string") {
      return this.findRowById(row)?.id ?? null;
    }
    const found = this.dataModel.listAllRows()[row] ?? null;
    return found?.id ?? null;
  }

  private filterSortSidebar: HTMLElement | null = null;
  private filterSortSidebarUnsub: (() => void) | null = null;
  private filterSortKeydown: ((ev: KeyboardEvent) => void) | null = null;
  private filterSortClickCapture: ((ev: MouseEvent) => void) | null = null;
  private filterSortOpenEvent: ((ev: Event) => void) | null = null;
  private filterSortActiveColumnKey: string | null = null;
  private filterSortDraft: {
    colKey: string;
    values: Array<{ key: string; value: unknown; label: string }>;
    hasBlanks: boolean;
    selected: Set<string>;
    includeBlanks: boolean;
    diagErrors: boolean;
    diagWarnings: boolean;
    search: string;
  } | null = null;

  private tableStateListeners = new Set<TableStateListener>();
  private selectionListeners = new Set<SelectionListener>();
  private lastTableState: TableState | null = null;
  private lastSelectionSnapshot: SelectionSnapshot | null = null;
  private selectionRanges: SelectionRange[] = [];
  private activeCell: CellTarget | null = null;
  private activeErrors: TableError[] = [];
  private rowStateListeners = new Set<RowStateListener<T, R>>();
  private lastRowStates = new Map<string, RowStateSnapshot<T, R>>();

  private isSearchPanelVisible() {
    return this.root.classList.contains("extable-search-open");
  }

  private isFilterSortPanelVisible() {
    return this.root.classList.contains("extable-filter-sort-open");
  }

  private safeRender(state?: ViewportState) {
    try {
      this.renderer.render(state);
      const hadRenderError = this.activeErrors.some((e) => e.scope === "render");
      if (hadRenderError) {
        this.activeErrors = this.activeErrors.filter((e) => e.scope !== "render");
        this.emitTableState();
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.activeErrors = [
        ...this.activeErrors.filter((x) => x.scope !== "render"),
        { scope: "render", message },
      ];
      this.emitTableState();
    }
  }

  constructor(init: CoreInit<T>) {
    this.root = init.root;
    this.root.classList.add("extable-root");
    this.renderMode = init.options?.renderMode ?? "auto";
    this.editMode = init.options?.editMode ?? "direct";
    this.lockMode = init.options?.lockMode ?? "none";
    this.loadingEnabled = init.options?.loading?.enabled ?? true;
    this.findReplaceEnabled = init.options?.findReplace?.enabled ?? true;
    this.findReplaceUiEnabled =
      init.options?.findReplace?.sidebar ?? init.options?.findReplace?.dialog ?? true;
    this.findReplaceEnableSearch = init.options?.findReplace?.enableSearch ?? true;
    this.server = init.options?.server;
    this.user = init.options?.user;

    const defaultData = init.defaultData ?? null;
    const initialData = defaultData ?? [];
    this.dataLoaded = defaultData !== null && defaultData !== undefined;
    this.dataModel = new DataModel(
      initialData as unknown as RowObject[],
      init.schema,
      init.defaultView,
    );
    this.commandQueue = new CommandQueue();
    this.lockManager = new LockManager(this.lockMode, this.server, this.user);
    this.renderer = this.chooseRenderer(this.renderMode);
    this.applyRootDecor(init.options);
    this.applyReadonlyClass();
    void this.loadInitial();
  }

  private async loadInitial() {
    if (this.server?.fetchInitial) {
      try {
        const initial = await this.server.fetchInitial();
        this.dataModel.setData(initial.data);
        if (initial.schema) this.dataModel.setSchema(initial.schema);
        if (initial.view) this.dataModel.setView(initial.view);
        this.user = initial.user ?? this.user;
        this.lockManager.setUser(this.user);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("fetchInitial failed", e);
      }
    }
    this.mount();
  }

  private applyRootDecor(options?: CoreOptions) {
    const classes = toArray(options?.defaultClass);
    if (classes?.length) {
      this.root.classList.add(...classes);
    }
    if (options?.defaultStyle) {
      for (const [k, v] of Object.entries(options.defaultStyle)) {
        // @ts-expect-error CSSStyleDeclaration index
        this.root.style[k] = v ?? "";
      }
    }
  }

  private applyReadonlyClass() {
    this.root.classList.toggle("extable-readonly-all", this.editMode === "readonly");
  }

  private chooseRenderer(mode: RenderMode): Renderer {
    if (mode === "auto") {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      type UserAgentBrand = { brand?: string };
      type NavigatorWithUAData = Navigator & { userAgentData?: { brands?: UserAgentBrand[] } };
      const isBot =
        /bot|crawl|spider/i.test(ua) ||
        (typeof navigator !== "undefined" &&
          "userAgentData" in navigator &&
          (navigator as NavigatorWithUAData).userAgentData?.brands?.some((b) =>
            /bot/i.test(b.brand ?? ""),
          ));
      return isBot
        ? new HTMLRenderer(this.dataModel)
        : new CanvasRenderer(this.dataModel, () => this.editMode);
    }
    return mode === "html"
      ? new HTMLRenderer(this.dataModel)
      : new CanvasRenderer(this.dataModel, () => this.editMode);
  }

  private ensureShell() {
    if (this.shell && this.viewportEl && this.shell.parentElement === this.root) return;
    this.root.innerHTML = "";
    const shell = document.createElement("div");
    shell.className = "extable-shell";
    const viewport = document.createElement("div");
    viewport.className = "extable-viewport";
    shell.appendChild(viewport);
    this.root.appendChild(shell);
    this.shell = shell;
    this.viewportEl = viewport;

    this.viewportResizeObserver?.disconnect();
    const anyRO = globalThis.ResizeObserver as typeof ResizeObserver | undefined;
    if (typeof anyRO === "function") {
      this.viewportResizeObserver = new anyRO(() => {
        this.updateViewportFromRoot();
      });
      this.viewportResizeObserver.observe(viewport);
    } else {
      this.viewportResizeObserver = null;
    }
  }

  private getScrollHost() {
    return this.viewportEl ?? this.root;
  }

  private mount(force = false) {
    if (this.mounted && !force) return;
    this.ensureShell();
    const host = this.viewportEl ?? this.root;
    this.renderer.mount(host);
    this.ensureContextMenu();
    this.ensureToast();
    this.initViewportState();

    this.root.classList.toggle("extable-loading", !this.dataLoaded && this.loadingEnabled);
    if (!this.dataLoaded && this.loadingEnabled) {
      this.root.dataset.extable = "loading";
      this.bindViewport();
      this.ensureFindReplace();
      this.ensureFilterSort();
      this.emitTableState();
      this.emitSelection("data");
      return;
    }
    this.selectionManager = new SelectionManager(
      host,
      this.editMode,
      (cmd, commitNow) => this.handleEdit(cmd, commitNow),
      (rowId) => void this.lockManager.selectRow(rowId),
      (rowId) => void this.lockManager.unlockOnMove(rowId),
      (ev) => this.renderer.hitTest(ev),
      this.dataModel,
      (rowId, colKey) => this.isCellReadonly(rowId, colKey),
      (rowId, colKey) => {
        const target: CellTarget | null = rowId && colKey !== null ? { rowId, colKey } : null;
        if (target) this.renderer.setActiveCell(target.rowId, target.colKey);
        this.activeCell = target;
        this.emitSelection("selection");
      },
      (rowId, _colKey, x, y) => this.showContextMenu(rowId, x, y),
      (ranges) => {
        this.selectionRanges = ranges;
        this.renderer.setSelection(ranges);
        this.emitSelection("selection");
      },
      () => this.undo(),
      () => this.redo(),
    );
    this.root.dataset.extable = "ready";
    this.bindViewport();
    this.ensureFindReplace();
    this.ensureFilterSort();
    if (this.server) {
      this.unsubscribe = this.server.subscribe((event) => this.handleServerEvent(event));
    }
    this.emitTableState();
    this.emitSelection("selection");
    this.mounted = true;
  }

  destroy() {
    this.teardownFilterSort();
    this.teardownFindReplace();
    this.selectionManager?.destroy();
    this.renderer.destroy();
    this.unsubscribe?.();
    this.unbindViewport();
    this.viewportResizeObserver?.disconnect();
    this.viewportResizeObserver = null;
    this.mounted = false;
  }

  // editMode/lockMode are configured only at construction time for consistency.

  setRootClass(classNames: string | string[]) {
    this.root.className = "";
    this.root.classList.add(...(toArray(classNames) ?? []));
  }

  setRootStyle(style: Partial<CSSStyleDeclaration>) {
    for (const [k, v] of Object.entries(style)) {
      // @ts-expect-error CSSStyleDeclaration index
      this.root.style[k] = v ?? "";
    }
  }

  setData(data: NullableData<T>) {
    if (data == null) {
      // Allow loading only before the first successful data load.
      if (this.dataLoaded) return;
      this.dataLoaded = false;
      this.safeRender(this.viewportState ?? undefined);
      this.emitSelection("data");
      this.emitTableState();
      return;
    }
    const wasLoaded = this.dataLoaded;
    this.dataLoaded = true;
    this.dataModel.setData(data as unknown as RowObject[]);
    this.safeRender(this.viewportState ?? undefined);
    this.selectionManager?.syncAfterRowsChanged();
    this.emitSelection("data");
    this.emitTableState();

    if (!wasLoaded && this.loadingEnabled) {
      this.root.classList.remove("extable-loading");
      this.selectionManager?.destroy();
      this.selectionManager = null;
      this.mount();
    }
  }

  setView(view: View) {
    this.dataModel.setView(view);
    this.safeRender(this.viewportState ?? undefined);
    this.selectionManager?.syncAfterRowsChanged();
    this.emitSelection("view");
    this.emitTableState();
  }

  // Public API: configuration getters (mirror setters)
  getSchema(): Schema {
    return this.dataModel.getSchema();
  }

  getView(): View {
    return this.dataModel.getView();
  }

  /**
   * Returns the current table data (includes pending edits in commit mode and formula results).
   * Note: This is the full dataset (not affected by view filters/sorts). Use `listRows()` for the visible rows.
   */
  getData(): R[] {
    return this.getTableData();
  }

  /**
   * Returns the raw dataset without pending edits and without formula results.
   * Note: This is the full dataset (not affected by view filters/sorts). Use `listRows()` for the visible rows.
   */
  getRawData(): T[] {
    return this.dataModel.listAllRows().map((r) => ({ ...(r.raw as unknown as T) }));
  }

  // Public API: cell-level access
  getCell<K extends keyof R & string>(rowId: string, colKey: K): R[K] | undefined {
    return this.dataModel.getCell(rowId, colKey) as R[K] | undefined;
  }

  // Public API: row/column index utilities
  getRowIndex(rowId: string): number {
    return this.dataModel.getRowIndex(rowId);
  }

  getColumnIndex(colKey: string): number {
    return this.dataModel.getColumnIndex(colKey);
  }

  // Public API: row-level access
  findRowById(rowId: string): InternalRow | null {
    const idx = this.dataModel.getBaseRowIndex(rowId);
    if (idx < 0) return null;
    return this.dataModel.listAllRows()[idx] ?? null;
  }

  listRows(): InternalRow[] {
    return this.dataModel.listRows();
  }

  getAllRows(): InternalRow[] {
    return this.dataModel.listAllRows();
  }

  /**
   * Returns a single row as an object (includes pending edits in commit mode and formula results).
   * When a number is passed, it is interpreted as the base row index (not affected by view filters/sorts).
   */
  getRow(rowIdOrIndex: string | number): R | null {
    const rowId = this.resolveRowId(rowIdOrIndex);
    if (!rowId) return null;
    return this.buildRow(rowId);
  }

  private buildRow(rowId: string): R | null {
    const found = this.findRowById(rowId);
    if (!found) return null;
    const schema = this.dataModel.getSchema();
    const out: Record<string, unknown> = { ...(found.raw as Record<string, unknown>) };
    for (const col of schema.columns) {
      out[col.key] = this.dataModel.resolveCellValue(rowId, col).value;
    }
    return out as R;
  }

  // Public API: bulk data access
  getTableData(): R[] {
    const rows = this.dataModel.listAllRows();
    return rows.map((r) => this.buildRow(r.id)).filter(Boolean) as R[];
  }

  getColumnData<K extends keyof R & string>(colKey: K): R[K][] {
    const schema = this.dataModel.getSchema();
    const col = schema.columns.find((c) => c.key === colKey);
    if (!col) return [];
    const rows = this.dataModel.listAllRows();
    return rows.map((r) => this.dataModel.resolveCellValue(r.id, col).value as R[K]);
  }

  // Public API: commit-mode pending helpers
  getPending(): Map<string, Record<string, unknown>> {
    if (this.editMode !== "commit") return new Map();
    return new Map(this.dataModel.getPending());
  }

  getPendingRowIds(): string[] {
    return [...this.getPending().keys()];
  }

  hasPendingChanges(): boolean {
    return this.getPending().size > 0;
  }

  getPendingCellCount(): number {
    const pending = this.getPending();
    let count = 0;
    for (const row of pending.values()) count += Object.keys(row).length;
    return count;
  }

  getCellPending<K extends keyof R & string>(row: string | number, colKey: K): boolean {
    if (this.editMode !== "commit") return false;
    const rowId = this.resolveRowId(row);
    if (!rowId) return false;
    return this.dataModel.hasPending(rowId, colKey);
  }

  getDisplayValue<K extends keyof R & string>(row: string | number, colKey: K): string {
    const rowId = this.resolveRowId(row);
    if (!rowId) return "";
    const schema = this.dataModel.getSchema();
    const col = schema.columns.find((c) => String(c.key) === String(colKey));
    if (!col) return "";
    const res = this.dataModel.resolveCellValue(rowId, col);
    if (res.textOverride) return res.textOverride;
    const v = res.value;
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "object") {
      const vv = v as Record<string, unknown>;
      if (vv.kind === "enum" && typeof vv.value === "string") return vv.value;
      if (vv.kind === "tags" && Array.isArray(vv.values)) {
        const values = vv.values.filter((x): x is string => typeof x === "string");
        return values.join(", ");
      }
    }
    return String(v);
  }

  insertRow(rowData: T, position?: number | string): string | null {
    let insertAt: number | null = null;
    if (typeof position === "number" && Number.isFinite(position)) {
      insertAt = Math.max(0, Math.min(Math.floor(position), this.dataModel.getAllRowCount()));
    } else if (typeof position === "string") {
      const baseIdx = this.dataModel.getBaseRowIndex(position);
      if (baseIdx >= 0) insertAt = baseIdx;
    }
    if (insertAt === null) insertAt = this.dataModel.getAllRowCount();
    const newId = this.dataModel.insertRowAt(rowData as unknown as RowObject, insertAt);
    const cmd: Command = {
      kind: "insertRow",
      rowId: newId,
      rowData: rowData as unknown as RowObject,
      payload: { index: insertAt },
    };
    this.commandQueue.enqueue(cmd);
    this.emitRowState(newId, "new");
    this.safeRender(this.viewportState ?? undefined);
    this.selectionManager?.syncAfterRowsChanged();
    this.emitSelection("data");
    this.emitTableState();
    if (this.editMode === "direct") void this.sendCommit([cmd]);
    return newId;
  }

  deleteRow(row: string | number): boolean {
    const rowId = this.resolveRowId(row);
    if (!rowId) return false;
    const removed = this.dataModel.removeRow(rowId);
    if (!removed) return false;
    const cmd: Command = {
      kind: "deleteRow",
      rowId: removed.row.id,
      rowData: removed.row.raw,
      payload: { index: removed.index },
    };
    this.commandQueue.enqueue(cmd);
    this.emitRowState(rowId, "delete");
    this.safeRender(this.viewportState ?? undefined);
    this.selectionManager?.syncAfterRowsChanged();
    this.emitSelection("data");
    this.emitTableState();
    if (this.editMode === "direct") void this.sendCommit([cmd]);
    return true;
  }

  private handleEdit(cmd: Command, commitNow: boolean) {
    if (this.editMode === "readonly") return;
    if (!cmd.rowId || cmd.colKey === undefined) return;
    const prev = this.dataModel.getCell(cmd.rowId, cmd.colKey);
    this.commandQueue.enqueue({ ...cmd, prev });
    this.dataModel.setCell(cmd.rowId, cmd.colKey, cmd.next, commitNow);
    this.emitRowState(cmd.rowId, "edit");
    this.safeRender(this.viewportState ?? undefined);
    this.selectionManager?.syncAfterRowsChanged();
    this.emitTableState();
    this.emitSelection("edit");
    if (commitNow) {
      void this.sendCommit([cmd]);
    }
  }

  undo() {
    this.selectionManager?.cancelEditing();
    const cmds = this.commandQueue.undo();
    if (!cmds || !cmds.length) return;
    // Apply inverse operations in reverse order.
    for (let i = cmds.length - 1; i >= 0; i -= 1) {
      const cmd = cmds[i];
      if (!cmd) continue;
      this.applyInverse(cmd);
    }
    this.safeRender(this.viewportState ?? undefined);
    this.selectionManager?.syncAfterRowsChanged();
    this.emitTableState();
    this.emitSelection("edit");
  }

  redo() {
    this.selectionManager?.cancelEditing();
    const cmds = this.commandQueue.redo();
    if (!cmds || !cmds.length) return;
    for (const cmd of cmds) {
      this.applyForward(cmd);
    }
    this.safeRender(this.viewportState ?? undefined);
    this.selectionManager?.syncAfterRowsChanged();
    this.emitTableState();
    this.emitSelection("edit");
  }

  getUndoRedoHistory(): UndoRedoHistory {
    const toKinds = (cmds: Command[]): HistoryCommandKind[] => {
      const seen = new Set<HistoryCommandKind>();
      const kinds: HistoryCommandKind[] = [];
      for (const c of cmds) {
        if (seen.has(c.kind)) continue;
        seen.add(c.kind);
        kinds.push(c.kind);
      }
      return kinds;
    };

    const labelFor = (kinds: HistoryCommandKind[], commandCount: number) => {
      if (kinds.length === 1 && kinds[0] === "edit") {
        return `Edit ${commandCount} cell(s)`;
      }
      if (kinds.length === 1 && kinds[0] === "insertRow") {
        return commandCount === 1 ? "Insert row" : `Insert row (${commandCount})`;
      }
      if (kinds.length === 1 && kinds[0] === "deleteRow") {
        return commandCount === 1 ? "Delete row" : `Delete row (${commandCount})`;
      }
      if (kinds.length === 1 && kinds[0] === "updateView") {
        return "Update view";
      }
      return `Command: ${kinds.join(", ")} (${commandCount})`;
    };

    const toSteps = (groups: { batchId: string | null; commands: Command[] }[]): UndoRedoStep[] =>
      groups.map((g) => {
        const kinds = toKinds(g.commands);
        const commandCount = g.commands.length;
        return {
          batchId: g.batchId,
          kinds,
          commandCount,
          label: labelFor(kinds, commandCount),
        };
      });

    return {
      undo: toSteps(this.commandQueue.listUndoGroups()),
      redo: toSteps(this.commandQueue.listRedoGroups()),
    };
  }

  private applyInverse(cmd: Command) {
    switch (cmd.kind) {
      case "edit":
        if (cmd.rowId && cmd.colKey !== undefined) {
          this.dataModel.setCell(cmd.rowId, cmd.colKey, cmd.prev, this.editMode === "direct");
          this.emitRowState(cmd.rowId, "edit");
        }
        return;
      case "insertRow":
        if (cmd.rowId) this.dataModel.removeRow(cmd.rowId);
        if (cmd.rowId) this.emitRowState(cmd.rowId, "delete");
        return;
      case "deleteRow":
        if (cmd.rowId && cmd.rowData) {
          const idx = (cmd.payload as Record<string, unknown> | undefined)?.index;
          const index = typeof idx === "number" ? idx : this.dataModel.getAllRowCount();
          this.dataModel.insertRowAt(cmd.rowData, index, cmd.rowId);
          this.emitRowState(cmd.rowId, "new");
        }
        return;
      default:
        return;
    }
  }

  private applyForward(cmd: Command) {
    switch (cmd.kind) {
      case "edit":
        if (cmd.rowId && cmd.colKey !== undefined) {
          this.dataModel.setCell(cmd.rowId, cmd.colKey, cmd.next, this.editMode === "direct");
          this.emitRowState(cmd.rowId, "edit");
        }
        return;
      case "insertRow":
        if (cmd.rowData) {
          const idx = (cmd.payload as Record<string, unknown> | undefined)?.index;
          const index = typeof idx === "number" ? idx : this.dataModel.getAllRowCount();
          const forcedId = typeof cmd.rowId === "string" ? cmd.rowId : undefined;
          this.dataModel.insertRowAt(cmd.rowData, index, forcedId);
          if (forcedId) this.emitRowState(forcedId, "new");
        }
        return;
      case "deleteRow":
        if (cmd.rowId) {
          this.dataModel.removeRow(cmd.rowId);
          this.emitRowState(cmd.rowId, "delete");
        }
        return;
      default:
        return;
    }
  }

  async commit(): Promise<RowStateSnapshot<T, R>[]> {
    const pending = this.commandQueue.listApplied();
    if (!pending.length) return [];
    const touched = new Set<string>();
    for (const cmd of pending) {
      if (cmd.rowId) {
        this.dataModel.applyPending(cmd.rowId);
        touched.add(cmd.rowId);
      }
    }
    await this.sendCommit(pending);
    await this.lockManager.unlockOnCommit(this.commandQueue.listApplied().at(-1)?.rowId);
    this.commandQueue.clear();
    const snapshots: RowStateSnapshot<T, R>[] = [];
    for (const rowId of touched) {
      this.emitRowState(rowId, "edit");
      const snap = this.getRowStateSnapshot(rowId);
      if (snap) snapshots.push(snap);
    }
    this.safeRender(this.viewportState ?? undefined);
    this.selectionManager?.syncAfterRowsChanged();
    this.emitTableState();
    this.emitSelection("edit");
    return snapshots;
  }

  private async sendCommit(commands: Command[]) {
    if (this.server && this.user) {
      try {
        await this.server.commit(commands, this.user);
        this.activeErrors = this.activeErrors.filter((e) => e.scope !== "commit");
        this.emitTableState();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("commit failed", e);
        const msg = e instanceof Error ? e.message : String(e);
        this.activeErrors = [
          ...this.activeErrors.filter((x) => x.scope !== "commit"),
          { scope: "commit", message: msg },
        ];
        this.emitTableState();
      }
    }
  }

  private handleServerEvent(event: {
    type: "update";
    commands: Command[];
    user: UserInfo;
  }) {
    for (const cmd of event.commands) {
      this.applyCommand(cmd);
    }
    this.safeRender(this.viewportState ?? undefined);
    this.selectionManager?.syncAfterRowsChanged();
    this.emitSelection("data");
    this.emitTableState();
  }

  private applyCommand(cmd: Command) {
    switch (cmd.kind) {
      case "edit":
        if (cmd.rowId && cmd.colKey !== undefined) {
          this.dataModel.setCell(cmd.rowId, cmd.colKey, cmd.next, true);
          this.emitRowState(cmd.rowId, "edit");
        }
        break;
      case "insertRow":
        if (cmd.rowData) {
          const id = this.dataModel.insertRow(cmd.rowData);
          if (id) this.emitRowState(id, "new");
        }
        break;
      case "deleteRow":
        if (cmd.rowId) {
          this.dataModel.removeRow(cmd.rowId);
          this.emitRowState(cmd.rowId, "delete");
        }
        break;
      case "updateView":
        if (cmd.next && typeof cmd.next === "object") {
          this.dataModel.setView(cmd.next as View);
        }
        break;
      default:
        break;
    }
  }

  private ensureContextMenu() {
    if (this.contextMenu?.isConnected) return;
    this.contextMenu = null;
    const pop = document.createElement("div");
    pop.className = "extable-context-menu";
    pop.setAttribute("popover", "manual");
    pop.addEventListener("contextmenu", (e) => e.preventDefault());
    const readonlyMode = this.editMode === "readonly";
    const actions: Array<{ key: string; label?: string; kind?: "sep" }> = readonlyMode
      ? [{ key: "copy", label: "Copy" }]
      : [
          { key: "copy", label: "Copy" },
          { key: "paste", label: "Paste" },
          { key: "sep-top", kind: "sep" },
          { key: "undo", label: "Undo" },
          { key: "redo", label: "Redo" },
          { key: "sep-mid", kind: "sep" },
          { key: "insert-above", label: "Insert row above" },
          { key: "insert-below", label: "Insert row below" },
          { key: "delete-row", label: "Delete row" },
        ];
    const list = document.createElement("div");
    for (const act of actions) {
      if (act.kind === "sep") {
        const hr = document.createElement("hr");
        hr.className = "extable-context-sep";
        list.appendChild(hr);
        continue;
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.action = act.key;
      btn.textContent = act.label ?? "";
      btn.addEventListener("click", () => {
        this.handleContextAction(act.key);
        this.closeContextMenu();
      });
      list.appendChild(btn);
    }
    pop.appendChild(list);
    (this.viewportEl ?? this.root).appendChild(pop);
    this.contextMenu = pop;
  }

  private showContextMenu(rowId: string | null, clientX: number, clientY: number) {
    this.ensureContextMenu();
    if (!this.contextMenu) return;
    if (!this.contextMenu.isConnected) {
      // Host may have been rebuilt (e.g. renderer switch). Recreate.
      this.contextMenu = null;
      this.ensureContextMenu();
      if (!this.contextMenu) return;
    }
    this.contextMenuRowId = rowId;
    // Update enable/disable state for undo/redo.
    for (const btn of Array.from(
      this.contextMenu.querySelectorAll<HTMLButtonElement>("button[data-action]"),
    )) {
      const action = btn.dataset.action;
      if (action === "undo") btn.disabled = !this.commandQueue.canUndo();
      else if (action === "redo") btn.disabled = !this.commandQueue.canRedo();
    }
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rect = { width: 220, height: 160 };
    let left = clientX;
    let top = clientY;
    if (left + rect.width > viewportWidth) left = Math.max(0, viewportWidth - rect.width - 8);
    if (top + rect.height > viewportHeight) top = Math.max(0, viewportHeight - rect.height - 8);
    this.contextMenu.style.left = `${left}px`;
    this.contextMenu.style.top = `${top}px`;
    this.contextMenu.hidePopover?.();
    this.contextMenu.showPopover?.();
  }

  private handleContextAction(action: string) {
    if (action === "copy") {
      void this.selectionManager?.copySelection();
      return;
    }
    if (action === "paste") {
      void this.selectionManager?.pasteFromClipboard();
      return;
    }
    if (action === "undo") {
      this.undo();
      return;
    }
    if (action === "redo") {
      this.redo();
      return;
    }
    if (!this.contextMenuRowId) return;
    const idx = this.dataModel.getBaseRowIndex(this.contextMenuRowId);
    const targetIndex = idx >= 0 ? idx : this.dataModel.getAllRowCount();
    if (action === "insert-above" || action === "insert-below") {
      const insertAt = action === "insert-above" ? targetIndex : targetIndex + 1;
      const raw = this.createBlankRow();
      const newId = this.dataModel.insertRowAt(raw, insertAt);
      this.commandQueue.enqueue({
        kind: "insertRow",
        rowId: newId,
        rowData: raw,
        payload: { index: insertAt },
      });
      this.emitRowState(newId, "new");
      this.safeRender(this.viewportState ?? undefined);
      this.selectionManager?.syncAfterRowsChanged();
      this.showToast("Row inserted", "info");
      return;
    }
    if (action === "delete-row") {
      const removed = this.dataModel.removeRow(this.contextMenuRowId);
      if (!removed) return;
      this.commandQueue.enqueue({
        kind: "deleteRow",
        rowId: removed.row.id,
        rowData: removed.row.raw,
        payload: { index: removed.index },
      });
      this.emitRowState(removed.row.id, "delete");
      this.safeRender(this.viewportState ?? undefined);
      this.selectionManager?.syncAfterRowsChanged();
      this.showToast("Row deleted", "info");
      return;
    }
  }

  private createBlankRow(): RowObject {
    const schema = this.dataModel.getSchema();
    const obj: RowObject = {};
    for (const col of schema.columns) {
      obj[String(col.key)] = null;
    }
    return obj;
  }

  private closeContextMenu() {
    this.contextMenu?.hidePopover?.();
  }

  private ensureToast() {
    if (this.toast?.isConnected) return;
    this.toast = null;
    const toast = document.createElement("div");
    toast.className = "extable-toast";
    toast.setAttribute("popover", "manual");
    toast.style.right = "16px";
    toast.style.bottom = "16px";
    toast.style.position = "fixed";
    (this.viewportEl ?? this.root).appendChild(toast);
    this.toast = toast;
  }

  private showToast(message: string, variant: "info" | "error" = "info", durationMs = 2500) {
    this.ensureToast();
    if (!this.toast) return;
    this.toast.textContent = message;
    this.toast.dataset.variant = variant;
    this.toast.hidePopover?.();
    this.toast.showPopover?.();
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.toastTimer = window.setTimeout(() => {
      this.toast?.hidePopover?.();
    }, durationMs);
  }

  private bindViewport() {
    this.resizeHandler = () => this.updateViewportFromRoot();
    this.scrollHandler = () => this.updateViewportFromRoot();
    this.getScrollHost().addEventListener("scroll", this.scrollHandler, { passive: true });
    window.addEventListener("resize", this.resizeHandler);
    this.handleGlobalPointer = (ev: MouseEvent | PointerEvent) => {
      if (this.contextMenu && !this.contextMenu.contains(ev.target as Node)) {
        this.contextMenu.hidePopover?.();
      }
    };
    document.addEventListener("pointerdown", this.handleGlobalPointer, true);

  }

  private unbindViewport() {
    if (this.resizeHandler) window.removeEventListener("resize", this.resizeHandler);
    if (this.scrollHandler) this.getScrollHost().removeEventListener("scroll", this.scrollHandler);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.handleGlobalPointer) {
      document.removeEventListener("pointerdown", this.handleGlobalPointer, true);
      this.handleGlobalPointer = null;
    }
    if (this.contextMenu) {
      this.contextMenu.hidePopover?.();
      if (this.contextMenu.parentElement) removeFromParent(this.contextMenu);
      this.contextMenu = null;
    }
    if (this.toast) {
      this.toast.hidePopover?.();
      if (this.toast.parentElement) removeFromParent(this.toast);
      this.toast = null;
    }
  }

  remount(target: HTMLElement) {
    this.unbindViewport();
    this.teardownFilterSort();
    this.teardownFindReplace();
    this.selectionManager?.destroy();
    this.renderer.destroy();
    this.root = target;
    this.applyReadonlyClass();
    this.shell = null;
    this.viewportEl = null;
    this.viewportResizeObserver?.disconnect();
    this.viewportResizeObserver = null;
    this.renderer = this.chooseRenderer(this.renderMode);
    this.mounted = false;
    this.mount(true);
  }

  showSearchPanel(mode: FindReplaceMode = "find") {
    if (!this.findReplaceEnabled || !this.findReplaceUiEnabled) return;
    this.ensureFindReplace();
    if (!this.findReplace || !this.findReplaceSidebar) return;
    this.hideFilterSortPanel();
    this.findReplace.setMode(mode);
    this.root.classList.toggle("extable-search-open", true);
    this.updateViewportFromRoot();
    this.safeRender(this.viewportState ?? undefined);
    this.emitTableState();
    const input = this.findReplaceSidebar.querySelector<HTMLInputElement>(
      'input[data-extable-fr="query"]',
    );
    input?.focus({ preventScroll: true });
    input?.select();
  }

  hideSearchPanel() {
    if (!this.findReplaceSidebar) return;
    this.root.classList.toggle("extable-search-open", false);
    this.updateViewportFromRoot();
    this.safeRender(this.viewportState ?? undefined);
    this.emitTableState();
    // Restore focus to table selection.
    (
      this.getScrollHost().querySelector(
        'input[data-extable-selection="1"]',
      ) as HTMLInputElement | null
    )?.focus?.({
      preventScroll: true,
    });
  }

  // External toggle for host apps.
  toggleSearchPanel(mode: FindReplaceMode = "find") {
    if (this.isSearchPanelVisible()) this.hideSearchPanel();
    else this.showSearchPanel(mode);
  }

  private updateFindReplaceReadonlyUI() {
    if (!this.findReplaceSidebar) return;
    const aside = this.findReplaceSidebar;
    const toggleReplace = aside.querySelector<HTMLInputElement>('input[data-extable-fr="replace-toggle"]');
    if (!toggleReplace) return;
    const readonly = this.editMode === "readonly";
    aside.dataset.extableFrReadonly = readonly ? "1" : "0";
    if (readonly) {
      toggleReplace.checked = false;
      this.findReplace?.setMode("find");
      aside.dataset.extableFrMode = "find";
    } else {
      aside.dataset.extableFrMode = toggleReplace.checked ? "replace" : "find";
    }
  }

  // Public API: table-level state callbacks
  getTableState(): TableState {
    const effective = this.renderer instanceof HTMLRenderer ? "html" : "canvas";
    const applied = this.commandQueue.listApplied();
    const pendingCommands = this.editMode === "commit" ? applied : [];
    const pendingCommandCount = pendingCommands.length;
    const pendingCellCount = (() => {
      const keys = new Set<string>();
      for (const c of pendingCommands) {
        if (c.kind !== "edit") continue;
        if (!c.rowId || c.colKey === undefined) continue;
        keys.add(`${c.rowId}::${String(c.colKey)}`);
      }
      return keys.size;
    })();
    const validationErrors: TableError[] = this.dataModel.getValidationErrors().map((e) => ({
      scope: "validation",
      message: e.message,
      target: { rowId: e.rowId, colKey: e.colKey },
    }));
    const diagnosticErrors: TableError[] = this.dataModel
      .getDiagnostics()
      .map((x) => {
        if (!x.diag) return null;
        return {
          scope: x.diag.source,
          message: x.diag.message,
          target: { rowId: x.rowId, colKey: x.colKey },
        } as TableError;
      })
      .filter(Boolean) as TableError[];
    diagnosticErrors.sort((a, b) => {
      const ar = a.target?.rowId ? this.dataModel.getRowIndex(a.target.rowId) : -1;
      const br = b.target?.rowId ? this.dataModel.getRowIndex(b.target.rowId) : -1;
      if (ar !== br) return ar - br;
      const ac =
        a.target?.colKey !== undefined ? this.dataModel.getColumnIndex(a.target.colKey) : -1;
      const bc =
        b.target?.colKey !== undefined ? this.dataModel.getColumnIndex(b.target.colKey) : -1;
      if (ac !== bc) return ac - bc;
      if (a.scope !== b.scope) return a.scope < b.scope ? -1 : 1;
      return a.message < b.message ? -1 : a.message > b.message ? 1 : 0;
    });
    const activeErrors = [
      ...validationErrors,
      ...diagnosticErrors.slice(0, 200),
      ...this.activeErrors,
    ];
    return {
      canCommit: this.editMode === "commit" && pendingCommandCount > 0,
      pendingCommandCount,
      pendingCellCount,
      undoRedo: { canUndo: this.commandQueue.canUndo(), canRedo: this.commandQueue.canRedo() },
      renderMode: effective,
      ui: { searchPanelOpen: this.isSearchPanelVisible() },
      activeErrors,
    };
  }

  subscribeTableState(listener: TableStateListener) {
    this.tableStateListeners.add(listener);
    listener(this.getTableState(), null);
    return () => this.tableStateListeners.delete(listener);
  }

  private emitTableState() {
    const next = this.getTableState();
    const prev = this.lastTableState;
    const errorsEqual = (() => {
      if (!prev) return false;
      if (prev.activeErrors.length !== next.activeErrors.length) return false;
      for (let i = 0; i < next.activeErrors.length; i += 1) {
        const a = prev.activeErrors[i];
        const b = next.activeErrors[i];
        if (!a || !b) return false;
        if (a.scope !== b.scope) return false;
        if (a.message !== b.message) return false;
        const at = a.target;
        const bt = b.target;
        if (!at && !bt) continue;
        if (!at || !bt) return false;
        if ((at.rowId ?? null) !== (bt.rowId ?? null)) return false;
        if (String(at.colKey ?? "") !== String(bt.colKey ?? "")) return false;
      }
      return true;
    })();
    // Shallow equality shortcut.
    const same =
      prev &&
      prev.canCommit === next.canCommit &&
      prev.pendingCommandCount === next.pendingCommandCount &&
      prev.pendingCellCount === next.pendingCellCount &&
      prev.undoRedo.canUndo === next.undoRedo.canUndo &&
      prev.undoRedo.canRedo === next.undoRedo.canRedo &&
      prev.renderMode === next.renderMode &&
      prev.ui.searchPanelOpen === next.ui.searchPanelOpen &&
      errorsEqual;
    if (same) return;
    this.lastTableState = next;
    for (const l of this.tableStateListeners) l(next, prev);
  }

  // Public API: selection callbacks
  getSelectionSnapshot(): SelectionSnapshot {
    const ranges = this.selectionRanges;
    const schema = this.dataModel.getSchema();
    const active = this.activeCell;
    const activeRowId = active?.rowId ?? null;
    const activeColKey = active?.colKey ?? null;
    const activeRowIndex = activeRowId ? this.dataModel.getRowIndex(activeRowId) : null;
    const activeColIndex =
      activeColKey !== null
        ? schema.columns.findIndex((c) => String(c.key) === String(activeColKey))
        : null;
    const col =
      activeColIndex !== null && activeColIndex >= 0 ? schema.columns[activeColIndex] : null;

    const activeValueRes =
      activeRowId && col ? this.dataModel.resolveCellValue(activeRowId, col) : null;
    const activeCondRes =
      activeRowId && col ? this.dataModel.resolveConditionalStyle(activeRowId, col) : null;
    const activeTextOverride =
      activeValueRes?.textOverride ?? (activeCondRes?.forceErrorText ? "#ERROR" : undefined);
    const activeValueRaw = activeValueRes ? activeValueRes.value : null;
    const activeValueDisplay = (() => {
      if (activeTextOverride) return activeTextOverride;
      const v = activeValueRaw;
      if (v === null || v === undefined) return "";
      if (v instanceof Date) return v.toISOString();
      if (typeof v === "string") return v;
      if (typeof v === "number" || typeof v === "boolean") return String(v);
      if (typeof v === "object") {
        const obj = v as Record<string, unknown>;
        const kind = obj.kind;
        if (kind === "enum" && typeof obj.value === "string") return obj.value;
        if (kind === "tags" && Array.isArray(obj.values)) {
          return obj.values.filter((x) => typeof x === "string").join(", ");
        }
      }
      return String(v);
    })();
    const activeValueType = col?.type ?? null;
    const diagnostic =
      activeRowId && activeColKey !== null
        ? this.dataModel.getCellDiagnostic(activeRowId, activeColKey)
        : null;

    const activeStyles = (() => {
      if (!activeRowId || !col) {
        return { columnStyle: {}, cellStyle: {}, resolved: {} };
      }
      const { columnStyle, cellStyle, resolved } = resolveCellStyles(
        this.dataModel,
        activeRowId,
        col,
      );
      return { columnStyle, cellStyle, resolved };
    })();

    return {
      ranges: [...ranges],
      activeRowIndex: activeRowIndex !== null && activeRowIndex >= 0 ? activeRowIndex : null,
      activeRowKey: activeRowId,
      activeColumnIndex: activeColIndex !== null && activeColIndex >= 0 ? activeColIndex : null,
      activeColumnKey: activeColKey,
      activeValueRaw,
      activeValueDisplay,
      activeValueType,
      diagnostic,
      styles: activeStyles,
    };
  }

  subscribeSelection(listener: SelectionListener) {
    this.selectionListeners.add(listener);
    listener(this.getSelectionSnapshot(), null, "selection");
    return () => this.selectionListeners.delete(listener);
  }

  private emitSelection(reason: SelectionChangeReason) {
    const next = this.getSelectionSnapshot();
    const prev = this.lastSelectionSnapshot;
    this.lastSelectionSnapshot = next;
    for (const l of this.selectionListeners) l(next, prev, reason);
  }

  private getRowStateSnapshot(rowId: string): RowStateSnapshot<T, R> | null {
    const rowIndex = this.dataModel.getRowIndex(rowId);
    if (rowIndex < 0) return null;
    const data = this.buildRow(rowId);
    if (!data) return null;
    const pending =
      this.editMode === "commit"
        ? (this.dataModel.getPending().get(rowId) ?? undefined)
        : undefined;
    const diagnostics = this.getTableState().activeErrors.filter((e) => e.target?.rowId === rowId);
    return {
      rowId,
      rowIndex,
      data,
      pending: pending as Partial<T> | undefined,
      diagnostics: diagnostics.length ? diagnostics : undefined,
    };
  }

  subscribeRowState(listener: RowStateListener<T, R>) {
    this.rowStateListeners.add(listener);
    const rows = this.dataModel.listAllRows();
    for (const row of rows) {
      const snap = this.getRowStateSnapshot(row.id);
      if (!snap) continue;
      this.lastRowStates.set(row.id, snap);
      listener(row.id, snap, null, "new");
    }
    return () => this.rowStateListeners.delete(listener);
  }

  private emitRowState(rowId: string, reason: RowChangeReason) {
    const prev = this.lastRowStates.get(rowId) ?? null;
    if (reason === "delete") {
      this.lastRowStates.delete(rowId);
      for (const l of this.rowStateListeners) l(rowId, null, prev, reason);
      return;
    }
    const next = this.getRowStateSnapshot(rowId);
    if (!next) return;
    this.lastRowStates.set(rowId, next);
    for (const l of this.rowStateListeners) l(rowId, next, prev, reason);
  }

  // Public API: value updates
  setCellValue<K extends keyof T & string>(row: number | string, colKey: K, next: Updater<T[K]>) {
    const rowId = typeof row === "string" ? row : this.dataModel.listRows()[row]?.id;
    const resolved = rowId ? resolveCellAddress(this.dataModel, { rowId, colKey }) : null;
    if (!resolved) return;
    if (this.isCellReadonly(resolved.rowId, resolved.colKey)) return;
    const current = this.dataModel.getCell(resolved.rowId, resolved.colKey) as T[K];
    const computed = typeof next === "function" ? (next as (old: T[K]) => T[K])(current) : next;
    this.handleEdit(
      { kind: "edit", rowId: resolved.rowId, colKey: resolved.colKey, next: computed },
      this.editMode === "direct",
    );
  }

  setValueToSelection(next: Updater<unknown>) {
    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
    const unique = new Set<string>();
    for (const r of this.selectionRanges) {
      if (r.kind !== "cells") continue;
      const sr = Math.min(r.startRow, r.endRow);
      const er = Math.max(r.startRow, r.endRow);
      const sc = Math.min(r.startCol, r.endCol);
      const ec = Math.max(r.startCol, r.endCol);
      for (let rowIndex = sr; rowIndex <= er; rowIndex += 1) {
        const row = rows[rowIndex];
        if (!row) continue;
        for (let colIndex = sc; colIndex <= ec; colIndex += 1) {
          const col = schema.columns[colIndex];
          if (!col) continue;
          const key = `${row.id}::${String(col.key)}`;
          if (unique.has(key)) continue;
          unique.add(key);
          if (this.isCellReadonly(row.id, col.key)) continue;
          const current = this.dataModel.getCell(row.id, col.key);
          const computed = typeof next === "function" ? next(current) : next;
          this.handleEdit(
            { kind: "edit", rowId: row.id, colKey: col.key, next: computed },
            this.editMode === "direct",
          );
        }
      }
    }
  }

  // Backward compatible aliases.
  openFindReplaceDialog(mode: FindReplaceMode = "find") {
    this.showSearchPanel(mode);
  }

  closeFindReplaceDialog() {
    this.hideSearchPanel();
  }

  private ensureFindReplace() {
    if (!this.findReplaceEnabled) return;
    if (!this.findReplace) {
      this.findReplace = new FindReplaceController(
        this.dataModel,
        (rowId, colKey) => this.selectionManager?.navigateToCell(rowId, colKey),
        (rowId, colKey, next) =>
          this.handleEdit({ kind: "edit", rowId, colKey, next }, this.editMode === "direct"),
        (rowId, colKey) => !this.isCellReadonly(rowId, colKey),
      );
    }
    if (this.findReplaceUiEnabled) {
      this.ensureFindReplaceSidebar();
    }
  }

  private ensureFindReplaceSidebar() {
    if (this.findReplaceSidebar) {
      if (this.findReplaceSidebar.isConnected) return;
      // If detached (e.g., React dev tools/fast refresh), drop reference and recreate.
      this.findReplaceSidebar = null;
    }
    this.ensureShell();
    const shell = this.shell ?? this.root;

    const aside = document.createElement("aside");
    aside.className = "extable-search-sidebar";
    aside.innerHTML = `
      <div class="extable-search-header">
        <div class="extable-search-row">
          <label class="extable-search-label">
            <span class="extable-search-title">Find</span>
            <input data-extable-fr="query" type="text" />
          </label>
          <button type="button" data-extable-fr="close" class="extable-search-close">×</button>
        </div>
        <div class="extable-search-row">
          <label><input data-extable-fr="case" type="checkbox" /> <span>Case</span></label>
          <label><input data-extable-fr="regex" type="checkbox" /> <span>Regex</span></label>
          <label data-extable-fr="replace-toggle-row"><input data-extable-fr="replace-toggle" type="checkbox" /> <span>Replace</span></label>
        </div>
        <div class="extable-search-row extable-search-replace-row" data-extable-fr="replace-row">
          <label class="extable-search-label">
            <span class="extable-search-title">Replace</span>
            <input data-extable-fr="replace" type="text" />
          </label>
        </div>
        <div class="extable-search-row extable-search-status">
          <span data-extable-fr="status"></span>
          <span data-extable-fr="error" class="extable-search-error"></span>
        </div>
      </div>
      <div class="extable-search-body">
        <div class="extable-search-actions">
          <button type="button" data-extable-fr="prev">Prev</button>
          <button type="button" data-extable-fr="next">Next</button>
          <button type="button" data-extable-fr="replace-current" data-extable-fr-only="replace">Replace</button>
          <button type="button" data-extable-fr="replace-all" data-extable-fr-only="replace">Replace All</button>
        </div>
        <div class="extable-search-results" data-extable-fr="results">
          <table class="extable-search-table" data-extable-fr="results-table">
            <thead>
              <tr><th>Cell</th><th>Text</th></tr>
            </thead>
            <tbody data-extable-fr="results-tbody"></tbody>
          </table>
        </div>
      </div>
    `;

    shell.appendChild(aside);
    this.findReplaceSidebar = aside;

    const query = aside.querySelector<HTMLInputElement>('input[data-extable-fr="query"]');
    const replace = aside.querySelector<HTMLInputElement>('input[data-extable-fr="replace"]');
    const toggleReplace = aside.querySelector<HTMLInputElement>(
      'input[data-extable-fr="replace-toggle"]',
    );
    const toggleReplaceRow = aside.querySelector<HTMLElement>(
      '[data-extable-fr="replace-toggle-row"]',
    );
    const caseCb = aside.querySelector<HTMLInputElement>('input[data-extable-fr="case"]');
    const regexCb = aside.querySelector<HTMLInputElement>('input[data-extable-fr="regex"]');
    const btnPrev = aside.querySelector<HTMLButtonElement>('button[data-extable-fr="prev"]');
    const btnNext = aside.querySelector<HTMLButtonElement>('button[data-extable-fr="next"]');
    const btnReplace = aside.querySelector<HTMLButtonElement>(
      'button[data-extable-fr="replace-current"]',
    );
    const btnReplaceAll = aside.querySelector<HTMLButtonElement>(
      'button[data-extable-fr="replace-all"]',
    );
    const btnClose = aside.querySelector<HTMLButtonElement>('button[data-extable-fr="close"]');
    const tbody = aside.querySelector<HTMLElement>('[data-extable-fr="results-tbody"]');

    if (
      !query ||
      !replace ||
      !toggleReplace ||
      !toggleReplaceRow ||
      !caseCb ||
      !regexCb ||
      !btnPrev ||
      !btnNext ||
      !btnReplace ||
      !btnReplaceAll ||
      !btnClose ||
      !tbody
    ) {
      removeFromParent(aside);
      this.findReplaceSidebar = null;
      return;
    }

    query.addEventListener("input", () => this.findReplace?.setQuery(query.value));
    replace.addEventListener("input", () => this.findReplace?.setReplace(replace.value));
    caseCb.addEventListener("change", () =>
      this.findReplace?.setOptions({ caseInsensitive: caseCb.checked }),
    );
    regexCb.addEventListener("change", () =>
      this.findReplace?.setOptions({ regex: regexCb.checked }),
    );
    toggleReplace.addEventListener("change", () => {
      if (this.editMode === "readonly") {
        toggleReplace.checked = false;
        this.findReplace?.setMode("find");
        aside.dataset.extableFrMode = "find";
        return;
      }
      const mode: FindReplaceMode = toggleReplace.checked ? "replace" : "find";
      this.findReplace?.setMode(mode);
      aside.dataset.extableFrMode = mode;
    });
    this.updateFindReplaceReadonlyUI();
    btnPrev.addEventListener("click", () => this.findReplace?.prev());
    btnNext.addEventListener("click", () => this.findReplace?.next());
    btnReplace.addEventListener("click", () => this.findReplace?.replaceCurrent());
    btnReplaceAll.addEventListener("click", () => this.findReplace?.replaceAll());
    btnClose.addEventListener("click", () => this.hideSearchPanel());

    const truncate = (text: string, max = 140) =>
      text.length > max ? `${text.slice(0, max - 1)}…` : text;

    tbody.addEventListener("click", (e) => {
      const tr = (e.target as HTMLElement | null)?.closest<HTMLElement>("tr[data-index]");
      const idx = tr ? Number(tr.dataset.index) : -1;
      if (Number.isFinite(idx) && idx >= 0) this.findReplace?.activateIndex(idx);
    });
    tbody.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const tr = (e.target as HTMLElement | null)?.closest<HTMLElement>("tr[data-index]");
      const idx = tr ? Number(tr.dataset.index) : -1;
      if (Number.isFinite(idx) && idx >= 0) this.findReplace?.activateIndex(idx);
    });

    this.updateFindReplaceReadonlyUI();

    this.findReplaceSidebarUnsub =
      this.findReplace?.subscribe((state) => {
        const replaceRow = aside.querySelector<HTMLElement>('[data-extable-fr="replace-row"]');
        const status = aside.querySelector<HTMLElement>('[data-extable-fr="status"]');
        const error = aside.querySelector<HTMLElement>('[data-extable-fr="error"]');
        if (!replaceRow || !status || !error) return;

        query.value = state.query;
        replace.value = state.replace;
        caseCb.checked = state.options.caseInsensitive;
        regexCb.checked = state.options.regex;
        toggleReplace.checked = state.mode === "replace";
        replaceRow.style.display = state.mode === "replace" ? "block" : "none";
        btnReplace.style.display = state.mode === "replace" ? "inline-block" : "none";
        btnReplaceAll.style.display = state.mode === "replace" ? "inline-block" : "none";

        status.textContent = `${state.matches.length} matches`;
        error.textContent = state.error ?? "";

        btnPrev.disabled = state.matches.length === 0;
        btnNext.disabled = state.matches.length === 0;
        btnReplace.disabled = state.matches.length === 0 || state.activeIndex < 0;
        btnReplaceAll.disabled = state.matches.length === 0;

        tbody.innerHTML = "";
        for (let i = 0; i < state.matches.length; i += 1) {
          const m = state.matches[i];
          if (!m) continue;
          const tr = document.createElement("tr");
          tr.dataset.index = String(i);
          tr.tabIndex = 0;
          tr.className = "extable-search-result-row";
          if (i === state.activeIndex) tr.dataset.active = "1";
          const cellTd = document.createElement("td");
          cellTd.textContent = `R${m.rowIndex + 1}C${m.colIndex + 1}`;
          const textTd = document.createElement("td");
          const preview = truncate(m.text);
          textTd.textContent = preview;
          textTd.title = m.text;
          tr.appendChild(cellTd);
          tr.appendChild(textTd);
          tbody.appendChild(tr);
        }
      }) ?? null;
  }

  private teardownFindReplace() {
    this.findReplaceSidebarUnsub?.();
    this.findReplaceSidebarUnsub = null;
    if (this.findReplaceSidebar) {
      removeFromParent(this.findReplaceSidebar);
      this.findReplaceSidebar = null;
    }
    this.findReplace?.destroy();
    this.findReplace = null;
  }

  // External toggle for host apps.
  private stableValueKey(value: unknown) {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (value instanceof Date) return `date:${value.getTime()}`;
    if (typeof value === "string") return `s:${value}`;
    if (typeof value === "number") return `n:${Number.isNaN(value) ? "NaN" : String(value)}`;
    if (typeof value === "boolean") return `b:${value ? "1" : "0"}`;
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const kind = obj.kind;
      if (kind === "enum" && typeof obj.value === "string") return `enum:${obj.value}`;
      if (kind === "tags" && Array.isArray(obj.values)) {
        return `tags:${obj.values.filter((x) => typeof x === "string").join("|")}`;
      }
    }
    try {
      return `json:${JSON.stringify(value)}`;
    } catch {
      return `str:${String(value)}`;
    }
  }

  private ensureFilterSort() {
    this.ensureFilterSortSidebar();
    this.ensureFilterSortHeaderIntegration();
    this.ensureFilterSortEscape();
  }

  private ensureFilterSortEscape() {
    if (this.filterSortKeydown) return;
    this.filterSortKeydown = (ev: KeyboardEvent) => {
      if (!this.isFilterSortPanelVisible()) return;
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation();
      this.hideFilterSortPanel();
    };
    document.addEventListener("keydown", this.filterSortKeydown, true);
  }

  private ensureFilterSortHeaderIntegration() {
    if (this.filterSortClickCapture) return;
    const host = this.viewportEl ?? this.root;
    this.filterSortClickCapture = (ev: MouseEvent) => {
      const el = ev.target as HTMLElement | null;
      const btn = el?.closest<HTMLButtonElement>('button[data-extable-fs-open="1"]');
      if (!btn) return;
      const key =
        btn.dataset.extableColKey ?? btn.closest<HTMLElement>("th[data-col-key]")?.dataset.colKey;
      if (!key) return;
      ev.preventDefault();
      ev.stopPropagation();
      this.showFilterSortPanel(key);
    };
    host.addEventListener("click", this.filterSortClickCapture, true);
    this.filterSortOpenEvent = (ev: Event) => {
      const anyEv = ev as CustomEvent<unknown>;
      const detail = anyEv.detail as Record<string, unknown> | null | undefined;
      const key = detail?.colKey;
      if (key === undefined || key === null) return;
      this.showFilterSortPanel(String(key));
    };
    host.addEventListener("extable:filter-sort-open", this.filterSortOpenEvent);
  }

  private ensureFilterSortSidebar() {
    if (this.filterSortSidebar) {
      if (this.filterSortSidebar.isConnected) return;
      this.filterSortSidebar = null;
    }
    this.ensureShell();
    const shell = this.shell ?? this.root;

    const aside = document.createElement("aside");
    aside.className = "extable-filter-sort-sidebar";
    aside.innerHTML = `
      <div class="extable-filter-sort-header">
        <div class="extable-filter-sort-row">
          <div class="extable-filter-sort-title" data-extable-fs="title">Sort/Filter</div>
          <button type="button" data-extable-fs="close" class="extable-filter-sort-close">×</button>
        </div>
      </div>
      <div class="extable-filter-sort-body">
        <div class="extable-filter-sort-section extable-filter-sort-section-filter">
          <div class="extable-filter-sort-section-title">Filter</div>
          <div class="extable-filter-sort-actions">
            <label><input type="checkbox" data-extable-fs="col-errors" /> Errors</label>
            <label><input type="checkbox" data-extable-fs="col-warnings" /> Warnings</label>
          </div>
          <input data-extable-fs="search" type="text" placeholder="Search values" />
          <div class="extable-filter-sort-values" data-extable-fs="values"></div>
          <div class="extable-filter-sort-actions" data-align="split">
            <button type="button" data-extable-fs="select-all">Select All</button>
            <button type="button" data-extable-fs="select-none">Select None</button>
            <button type="button" data-extable-fs="apply-filter">Apply</button>
            <button type="button" data-extable-fs="clear-filter">Clear</button>
          </div>
        </div>
        <div class="extable-filter-sort-section extable-filter-sort-section-sort">
          <div class="extable-filter-sort-section-title">Sort</div>
          <div class="extable-filter-sort-actions" data-align="right">
            <button type="button" data-extable-fs="sort-asc">Sort Asc</button>
            <button type="button" data-extable-fs="sort-desc">Sort Desc</button>
            <button type="button" data-extable-fs="clear-sort">Clear Sort</button>
          </div>
        </div>
      </div>
    `;
    shell.appendChild(aside);
    this.filterSortSidebar = aside;

    const btnClose = aside.querySelector<HTMLButtonElement>('button[data-extable-fs="close"]');
    const cbErrors = aside.querySelector<HTMLInputElement>('input[data-extable-fs="col-errors"]');
    const cbWarnings = aside.querySelector<HTMLInputElement>(
      'input[data-extable-fs="col-warnings"]',
    );
    const search = aside.querySelector<HTMLInputElement>('input[data-extable-fs="search"]');
    const values = aside.querySelector<HTMLElement>('[data-extable-fs="values"]');
    const btnAll = aside.querySelector<HTMLButtonElement>('button[data-extable-fs="select-all"]');
    const btnNone = aside.querySelector<HTMLButtonElement>('button[data-extable-fs="select-none"]');
    const btnApply = aside.querySelector<HTMLButtonElement>(
      'button[data-extable-fs="apply-filter"]',
    );
    const btnClear = aside.querySelector<HTMLButtonElement>(
      'button[data-extable-fs="clear-filter"]',
    );
    const btnSortAsc = aside.querySelector<HTMLButtonElement>('button[data-extable-fs="sort-asc"]');
    const btnSortDesc = aside.querySelector<HTMLButtonElement>(
      'button[data-extable-fs="sort-desc"]',
    );
    const btnSortClear = aside.querySelector<HTMLButtonElement>(
      'button[data-extable-fs="clear-sort"]',
    );

    if (
      !btnClose ||
      !cbErrors ||
      !cbWarnings ||
      !search ||
      !values ||
      !btnAll ||
      !btnNone ||
      !btnApply ||
      !btnClear ||
      !btnSortAsc ||
      !btnSortDesc ||
      !btnSortClear
    ) {
      removeFromParent(aside);
      this.filterSortSidebar = null;
      return;
    }

    btnClose.addEventListener("click", () => this.hideFilterSortPanel());

    cbErrors.addEventListener("change", () => {
      if (!this.filterSortDraft) return;
      this.filterSortDraft.diagErrors = cbErrors.checked;
    });
    cbWarnings.addEventListener("change", () => {
      if (!this.filterSortDraft) return;
      this.filterSortDraft.diagWarnings = cbWarnings.checked;
    });
    search.addEventListener("input", () => {
      if (!this.filterSortDraft) return;
      this.filterSortDraft.search = search.value;
      this.renderFilterSortValues();
    });

    values.addEventListener("change", (e) => {
      const input = (e.target as HTMLElement | null)?.closest<HTMLInputElement>(
        'input[type="checkbox"][data-fs-val]',
      );
      if (!input || !this.filterSortDraft) return;
      const k = input.dataset.fsVal ?? "";
      if (!k) return;
      if (k === "__blanks__") {
        this.filterSortDraft.includeBlanks = input.checked;
      } else if (input.checked) {
        this.filterSortDraft.selected.add(k);
      } else {
        this.filterSortDraft.selected.delete(k);
      }
    });

    btnAll.addEventListener("click", () => {
      if (!this.filterSortDraft) return;
      this.filterSortDraft.selected = new Set(this.filterSortDraft.values.map((v) => v.key));
      this.filterSortDraft.includeBlanks = this.filterSortDraft.hasBlanks;
      this.renderFilterSortValues();
    });
    btnNone.addEventListener("click", () => {
      if (!this.filterSortDraft) return;
      this.filterSortDraft.selected = new Set();
      this.filterSortDraft.includeBlanks = false;
      this.renderFilterSortValues();
    });
    btnApply.addEventListener("click", () => this.applyFilterSortDraft());
    btnClear.addEventListener("click", () => this.clearFilterSortForActiveColumn());
    btnSortAsc.addEventListener("click", () => this.setSortForActiveColumn("asc"));
    btnSortDesc.addEventListener("click", () => this.setSortForActiveColumn("desc"));
    btnSortClear.addEventListener("click", () => this.clearSort());

    this.filterSortSidebarUnsub = this.dataModel.subscribe(() => {
      if (!this.isFilterSortPanelVisible()) return;
      if (!this.filterSortActiveColumnKey) return;
      this.buildFilterSortDraft(this.filterSortActiveColumnKey);
      this.renderFilterSortSidebar();
    });
  }

  showFilterSortPanel(colKey: string) {
    this.hideSearchPanel();
    this.filterSortActiveColumnKey = colKey;
    this.buildFilterSortDraft(colKey);
    this.root.classList.toggle("extable-filter-sort-open", true);
    this.renderFilterSortSidebar();
    const input =
      this.filterSortSidebar?.querySelector<HTMLInputElement>('input[data-extable-fs="search"]') ??
      null;
    input?.focus();
  }

  hideFilterSortPanel() {
    this.root.classList.toggle("extable-filter-sort-open", false);
    this.filterSortActiveColumnKey = null;
    this.filterSortDraft = null;
  }

  toggleFilterSortPanel(colKey: string) {
    if (this.isFilterSortPanelVisible()) this.hideFilterSortPanel();
    else this.showFilterSortPanel(colKey);
  }

  private buildFilterSortDraft(colKey: string) {
    const view = this.dataModel.getView();
    const schema = this.dataModel.getSchema();
    const col = schema.columns.find((c) => String(c.key) === String(colKey));
    if (!col) {
      this.filterSortDraft = null;
      return;
    }
    const prevSearch =
      this.filterSortDraft && String(this.filterSortDraft.colKey) === String(col.key)
        ? this.filterSortDraft.search
        : "";
    const distinct = this.dataModel.getDistinctValuesForColumn(col.key);
    const values = distinct.values.map((v) => ({ ...v, key: this.stableValueKey(v.value) }));
    const existing = (view.filters ?? []).find(
      (f) =>
        (f as ViewFilterValues).kind === "values" &&
        String((f as ViewFilterValues).key) === String(col.key),
    ) as ViewFilterValues | undefined;

    const selected = new Set<string>();
    if (existing) {
      for (const v of existing.values ?? []) selected.add(this.stableValueKey(v));
    } else {
      for (const v of values) selected.add(v.key);
    }
    const includeBlanks = existing ? Boolean(existing.includeBlanks) : distinct.hasBlanks;
    const diag = view.columnDiagnostics?.[String(col.key)];
    this.filterSortDraft = {
      colKey: col.key,
      values,
      hasBlanks: distinct.hasBlanks,
      selected,
      includeBlanks,
      diagErrors: Boolean(diag?.errors),
      diagWarnings: Boolean(diag?.warnings),
      search: prevSearch,
    };
  }

  private renderFilterSortSidebar() {
    if (!this.filterSortSidebar) return;
    const title = this.filterSortSidebar.querySelector<HTMLElement>('[data-extable-fs="title"]');
    const cbErrors = this.filterSortSidebar.querySelector<HTMLInputElement>(
      'input[data-extable-fs="col-errors"]',
    );
    const cbWarnings = this.filterSortSidebar.querySelector<HTMLInputElement>(
      'input[data-extable-fs="col-warnings"]',
    );
    const search = this.filterSortSidebar.querySelector<HTMLInputElement>(
      'input[data-extable-fs="search"]',
    );
    if (!title || !cbErrors || !cbWarnings || !search) return;
    const btnSortAsc = this.filterSortSidebar.querySelector<HTMLButtonElement>(
      'button[data-extable-fs="sort-asc"]',
    );
    const btnSortDesc = this.filterSortSidebar.querySelector<HTMLButtonElement>(
      'button[data-extable-fs="sort-desc"]',
    );
    const draft = this.filterSortDraft;
    if (!draft) {
      title.textContent = "Sort/Filter";
      cbErrors.checked = false;
      cbWarnings.checked = false;
      search.value = "";
      if (btnSortAsc) btnSortAsc.dataset.active = "0";
      if (btnSortDesc) btnSortDesc.dataset.active = "0";
      this.renderFilterSortValues();
      return;
    }
    const schema = this.dataModel.getSchema();
    const col = schema.columns.find((c) => String(c.key) === String(draft.colKey));
    const name = col?.header ?? String(draft.colKey);
    title.textContent = `Sort/Filter: ${name}`;
    cbErrors.checked = draft.diagErrors;
    cbWarnings.checked = draft.diagWarnings;
    search.value = draft.search;
    const view = this.dataModel.getView();
    const sort = view.sorts?.find((s) => String(s.key) === String(draft.colKey));
    if (btnSortAsc) btnSortAsc.dataset.active = sort?.dir === "asc" ? "1" : "0";
    if (btnSortDesc) btnSortDesc.dataset.active = sort?.dir === "desc" ? "1" : "0";
    this.renderFilterSortValues();
  }

  private renderFilterSortValues() {
    if (!this.filterSortSidebar) return;
    const values = this.filterSortSidebar.querySelector<HTMLElement>('[data-extable-fs="values"]');
    if (!values) return;
    values.innerHTML = "";
    const draft = this.filterSortDraft;
    if (!draft) return;

    const q = draft.search.trim().toLowerCase();
    const total = draft.values.length + (draft.hasBlanks ? 1 : 0);
    if (total > 100 && !q) {
      const msg = document.createElement("div");
      msg.textContent = "Too many values (100+). Type to search.";
      values.appendChild(msg);
      return;
    }

    if (draft.hasBlanks) {
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.fsVal = "__blanks__";
      cb.checked = draft.includeBlanks;
      const text = document.createElement("span");
      text.textContent = "(Blanks)";
      label.appendChild(cb);
      label.appendChild(text);
      values.appendChild(label);
    }

    const filtered = q
      ? draft.values.filter((v) => v.label.toLowerCase().includes(q))
      : draft.values;
    for (const v of filtered.slice(0, 200)) {
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.dataset.fsVal = v.key;
      cb.checked = draft.selected.has(v.key);
      const text = document.createElement("span");
      text.textContent = v.label;
      label.appendChild(cb);
      label.appendChild(text);
      values.appendChild(label);
    }
  }

  private applyFilterSortDraft() {
    const draft = this.filterSortDraft;
    if (!draft) return;
    const view = this.dataModel.getView();
    const existingFilters = [...(view.filters ?? [])].filter(
      (f) =>
        !(
          (f as ViewFilterValues).kind === "values" &&
          String((f as ViewFilterValues).key) === String(draft.colKey)
        ),
    );

    const allSelected =
      draft.selected.size === draft.values.length &&
      draft.includeBlanks === Boolean(draft.hasBlanks);
    const nextFilters = allSelected
      ? existingFilters
      : [
          ...existingFilters,
          {
            kind: "values",
            key: draft.colKey,
            values: draft.values.filter((v) => draft.selected.has(v.key)).map((v) => v.value),
            includeBlanks: draft.includeBlanks,
          } satisfies ViewFilterValues,
        ];

    const nextDiagnostics = { ...(view.columnDiagnostics ?? {}) };
    if (draft.diagErrors || draft.diagWarnings) {
      nextDiagnostics[String(draft.colKey)] = {
        errors: draft.diagErrors,
        warnings: draft.diagWarnings,
      };
    } else {
      delete nextDiagnostics[String(draft.colKey)];
    }

    const nextView: View = {
      ...view,
      filters: nextFilters.length ? nextFilters : undefined,
      columnDiagnostics: Object.keys(nextDiagnostics).length ? nextDiagnostics : undefined,
    };
    this.setView(nextView);
  }

  private clearFilterSortForActiveColumn() {
    const colKey = this.filterSortActiveColumnKey;
    if (colKey === null || colKey === undefined) return;
    const view = this.dataModel.getView();
    const nextFilters = [...(view.filters ?? [])].filter(
      (f) =>
        !(
          (f as ViewFilterValues).kind === "values" &&
          String((f as ViewFilterValues).key) === String(colKey)
        ),
    );
    const nextDiagnostics = { ...(view.columnDiagnostics ?? {}) };
    delete nextDiagnostics[String(colKey)];
    const nextView: View = {
      ...view,
      filters: nextFilters.length ? nextFilters : undefined,
      columnDiagnostics: Object.keys(nextDiagnostics).length ? nextDiagnostics : undefined,
    };
    this.setView(nextView);
    this.buildFilterSortDraft(colKey);
    this.renderFilterSortSidebar();
  }

  private setSortForActiveColumn(dir: "asc" | "desc") {
    const colKey = this.filterSortActiveColumnKey;
    if (colKey === null || colKey === undefined) return;
    const view = this.dataModel.getView();
    const nextView: View = { ...view, sorts: [{ key: colKey, dir }] };
    this.setView(nextView);
    this.buildFilterSortDraft(colKey);
    this.renderFilterSortSidebar();
  }

  private clearSort() {
    const view = this.dataModel.getView();
    if (!view.sorts?.length) return;
    const nextView: View = { ...view, sorts: undefined };
    this.setView(nextView);
    if (this.filterSortActiveColumnKey !== null) {
      this.buildFilterSortDraft(this.filterSortActiveColumnKey);
      this.renderFilterSortSidebar();
    }
  }

  private teardownFilterSort() {
    this.filterSortSidebarUnsub?.();
    this.filterSortSidebarUnsub = null;
    if (this.filterSortSidebar) {
      removeFromParent(this.filterSortSidebar);
      this.filterSortSidebar = null;
    }
    if (this.filterSortKeydown) {
      document.removeEventListener("keydown", this.filterSortKeydown, true);
      this.filterSortKeydown = null;
    }
    if (this.filterSortClickCapture) {
      (this.viewportEl ?? this.root).removeEventListener(
        "click",
        this.filterSortClickCapture,
        true,
      );
      this.filterSortClickCapture = null;
    }
    if (this.filterSortOpenEvent) {
      (this.viewportEl ?? this.root).removeEventListener(
        "extable:filter-sort-open",
        this.filterSortOpenEvent,
      );
      this.filterSortOpenEvent = null;
    }
    this.root.classList.toggle("extable-filter-sort-open", false);
    this.filterSortActiveColumnKey = null;
    this.filterSortDraft = null;
  }

  private initViewportState() {
    const host = this.getScrollHost();
    this.viewportState = {
      scrollTop: host.scrollTop,
      scrollLeft: host.scrollLeft,
      clientWidth: host.clientWidth,
      clientHeight: host.clientHeight,
      deltaX: 0,
      deltaY: 0,
      timestamp: performance.now(),
    };
  }

  private updateViewportFromRoot() {
    if (!this.viewportState) this.initViewportState();
    const prev = this.viewportState ?? {
      scrollTop: 0,
      scrollLeft: 0,
      clientWidth: 0,
      clientHeight: 0,
      deltaX: 0,
      deltaY: 0,
      timestamp: performance.now(),
    };
    const host = this.getScrollHost();
    const next: ViewportState = {
      scrollTop: host.scrollTop,
      scrollLeft: host.scrollLeft,
      clientWidth: host.clientWidth,
      clientHeight: host.clientHeight,
      deltaX: host.scrollLeft - prev.scrollLeft,
      deltaY: host.scrollTop - prev.scrollTop,
      timestamp: performance.now(),
    };
    this.viewportState = next;
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => this.flushRender());
    }
  }

  private flushRender() {
    this.rafId = null;
    if (!this.viewportState) return;
    this.selectionManager?.onScroll(this.viewportState.scrollTop, this.viewportState.scrollLeft);
    // HTML renderer re-renders DOM; avoid doing it on scroll to preserve scroll position.
    if (this.renderer instanceof HTMLRenderer) return;
    this.safeRender(this.viewportState);
  }
}

// Compatibility helpers for wrappers/tests
export function createTablePlaceholder<T extends object = Record<string, unknown>>(
  config: TableConfig<T>,
  options?: CoreOptions,
) {
  const core = new ExtableCore<T>({
    root: document.createElement("div"),
    defaultData: config.data,
    defaultView: config.view,
    schema: config.schema,
    options,
  });
  return core;
}

export function mountTable(target: HTMLElement, core: ExtableCore) {
  core.remount(target);
  return core;
}
