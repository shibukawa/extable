import "./styles.css";
import { CommandQueue } from "./commandQueue";
import { DataModel } from "./dataModel";
import { resolveCellAddress } from "./address";
import { FindReplaceController, type FindReplaceMode } from "./findReplace";
import { LockManager } from "./lockManager";
import { CanvasRenderer, HTMLRenderer, type Renderer, type ViewportState } from "./renderers";
import { SelectionManager } from "./selectionManager";
import { columnFormatToStyle, mergeStyle, resolveCellStyles } from "./styleResolver";
import { removeFromParent, toArray } from "./utils";
import type {
  CellAddress,
  Command,
  CoreOptions,
  ConditionalStyleFn,
  ExcelRef,
  DataSet,
  HistoryCommandKind,
  NullableDataSet,
  EditMode,
  LockMode,
  RenderMode,
  Schema,
  ServerAdapter,
  SelectionChangeReason,
  SelectionListener,
  SelectionRange,
  SelectionSnapshot,
  StyleDelta,
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
  RowArray,
} from "./types";

export * from "./types";
export type {
  FindReplaceMatch,
  FindReplaceMode,
  FindReplaceOptions,
  FindReplaceState,
} from "./findReplace";
export { FindReplaceController } from "./findReplace";

export interface CoreInit<T extends Record<string, unknown> = Record<string, unknown>> {
  root: HTMLElement;
  defaultData: NullableDataSet<T>;
  defaultView: View;
  schema: Schema;
  options?: CoreOptions;
}

export class ExtableCore<T extends Record<string, unknown> = Record<string, unknown>> {
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
  private contextMenuColKey: string | number | null = null;
  private handleGlobalPointer: ((ev: MouseEvent | PointerEvent) => void) | null = null;
  private toast: HTMLDivElement | null = null;
  private toastTimer: number | null = null;
  private findReplace: FindReplaceController | null = null;
  private findReplaceSidebar: HTMLElement | null = null;
  private findReplaceSidebarUnsub: (() => void) | null = null;
  private findReplaceEnabled = true;
  private findReplaceUiEnabled = true;
  private findReplaceEnableSearch = false;
  private findReplaceOpenedAt = 0;
  private findReplaceKeydown: ((ev: KeyboardEvent) => void) | null = null;

  private mounted = false;

  private isCellReadonly(rowId: string, colKey: string | number) {
    return this.editMode === "readonly" || this.dataModel.isReadonly(rowId, colKey);
  }

  private filterSortSidebar: HTMLElement | null = null;
  private filterSortSidebarUnsub: (() => void) | null = null;
  private filterSortKeydown: ((ev: KeyboardEvent) => void) | null = null;
  private filterSortClickCapture: ((ev: MouseEvent) => void) | null = null;
  private filterSortOpenEvent: ((ev: Event) => void) | null = null;
  private filterSortActiveColumnKey: string | number | null = null;
  private filterSortDraft: {
    colKey: string | number;
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
  private activeCell: { rowId: string; colKey: string | number } | null = null;
  private activeErrors: TableError[] = [];

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

    const empty: DataSet<T> = { rows: [] };
    const initialData = init.defaultData ?? empty;
    this.dataLoaded = init.defaultData !== null;
    this.dataModel = new DataModel(initialData, init.schema, init.defaultView);
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
      const isBot =
        /bot|crawl|spider/i.test(ua) ||
        (typeof navigator !== "undefined" &&
          "userAgentData" in navigator &&
          (navigator as any).userAgentData?.brands?.some((b: any) => /bot/i.test(b.brand)));
      return isBot ? new HTMLRenderer(this.dataModel) : new CanvasRenderer(this.dataModel, () => this.editMode);
    }
    return mode === "html" ? new HTMLRenderer(this.dataModel) : new CanvasRenderer(this.dataModel, () => this.editMode);
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
    const anyRO = (globalThis as any).ResizeObserver as typeof ResizeObserver | undefined;
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
        this.renderer.setActiveCell(rowId, colKey);
        if (rowId && colKey !== null) this.activeCell = { rowId, colKey };
        else this.activeCell = null;
        this.emitSelection("selection");
      },
      (rowId, colKey, x, y) => this.showContextMenu(rowId, colKey, x, y),
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

  setEditMode(mode: EditMode) {
    const wasReadonly = this.editMode === "readonly";
    this.editMode = mode;
    this.applyReadonlyClass();
    this.selectionManager?.setEditMode(mode);
    this.emitTableState();
    const isReadonly = this.editMode === "readonly";
    if (wasReadonly !== isReadonly) {
      this.safeRender(this.viewportState ?? undefined);
      this.emitSelection("unknown");
    }
  }

  setLockMode(mode: LockMode) {
    this.lockMode = mode;
    this.lockManager.setMode(mode);
    this.emitTableState();
  }

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

  setData(data: NullableDataSet<T>) {
    if (data === null) {
      // Allow null only before the first successful data load.
      if (this.dataLoaded) return;
      this.dataLoaded = false;
      this.safeRender(this.viewportState ?? undefined);
      this.emitSelection("data");
      this.emitTableState();
      return;
    }
    const wasLoaded = this.dataLoaded;
    this.dataLoaded = true;
    this.dataModel.setData(data);
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

  private handleEdit(cmd: Command, commitNow: boolean) {
    if (this.editMode === "readonly") return;
    if (!cmd.rowId || cmd.colKey === undefined) return;
    const prev = this.dataModel.getCell(cmd.rowId, cmd.colKey);
    this.commandQueue.enqueue({ ...cmd, prev });
    this.dataModel.setCell(cmd.rowId, cmd.colKey, cmd.next, commitNow);
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
      const cmd = cmds[i]!;
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
        }
        return;
      case "insertRow":
        if (cmd.rowId) this.dataModel.removeRow(cmd.rowId);
        return;
      case "deleteRow":
        if (cmd.rowId && cmd.rowData) {
          const idx = (cmd.payload as any)?.index;
          const index = typeof idx === "number" ? idx : this.dataModel.getAllRowCount();
          this.dataModel.insertRowAt(cmd.rowData, index, cmd.rowId);
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
        }
        return;
      case "insertRow":
        if (cmd.rowData) {
          const idx = (cmd.payload as any)?.index;
          const index = typeof idx === "number" ? idx : this.dataModel.getAllRowCount();
          const forcedId = typeof cmd.rowId === "string" ? cmd.rowId : undefined;
          this.dataModel.insertRowAt(cmd.rowData, index, forcedId);
        }
        return;
      case "deleteRow":
        if (cmd.rowId) this.dataModel.removeRow(cmd.rowId);
        return;
      default:
        return;
    }
  }

  async commit() {
    const pending = this.commandQueue.listApplied();
    if (!pending.length) return;
    for (const cmd of pending) {
      if (cmd.rowId) this.dataModel.applyPending(cmd.rowId);
    }
    await this.sendCommit(pending);
    await this.lockManager.unlockOnCommit(this.commandQueue.listApplied().at(-1)?.rowId);
    this.commandQueue.clear();
    this.safeRender(this.viewportState ?? undefined);
    this.selectionManager?.syncAfterRowsChanged();
    this.emitTableState();
    this.emitSelection("edit");
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
        }
        break;
      case "insertRow":
        if (cmd.rowData) {
          this.dataModel.insertRow(cmd.rowData);
        }
        break;
      case "deleteRow":
        if (cmd.rowId) {
          this.dataModel.removeRow(cmd.rowId);
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
    if (this.contextMenu && (this.contextMenu as any).isConnected) return;
    this.contextMenu = null;
    const pop = document.createElement("div");
    pop.className = "extable-context-menu";
    pop.setAttribute("popover", "manual");
    pop.addEventListener("contextmenu", (e) => e.preventDefault());
    const actions: { key: string; label: string }[] = [
      { key: "undo", label: "Undo" },
      { key: "redo", label: "Redo" },
      { key: "insert-above", label: "Insert row above" },
      { key: "insert-below", label: "Insert row below" },
      { key: "delete-row", label: "Delete row" },
    ];
    const list = document.createElement("div");
    for (const act of actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.action = act.key;
      btn.textContent = act.label;
      btn.addEventListener("click", () => {
        this.handleContextAction(act.key);
        this.closeContextMenu();
      });
      list.appendChild(btn);
      if (act.key === "redo") {
        const hr = document.createElement("hr");
        hr.className = "extable-context-sep";
        list.appendChild(hr);
      }
    }
    pop.appendChild(list);
    (this.viewportEl ?? this.root).appendChild(pop);
    this.contextMenu = pop;
  }

  private showContextMenu(
    rowId: string | null,
    colKey: string | number | null,
    clientX: number,
    clientY: number,
  ) {
    this.ensureContextMenu();
    if (!this.contextMenu) return;
    if (!(this.contextMenu as any).isConnected) {
      // Host may have been rebuilt (e.g. renderer switch). Recreate.
      this.contextMenu = null;
      this.ensureContextMenu();
      if (!this.contextMenu) return;
    }
    this.contextMenuRowId = rowId;
    this.contextMenuColKey = colKey;
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
    const anyPopover = this.contextMenu as any;
    if (anyPopover.hidePopover) anyPopover.hidePopover();
    if (anyPopover.showPopover) anyPopover.showPopover();
  }

  private handleContextAction(action: string) {
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
      this.safeRender(this.viewportState ?? undefined);
      this.selectionManager?.syncAfterRowsChanged();
      this.showToast("Row deleted", "info");
      return;
    }
  }

  private createBlankRow(): RowObject | RowArray {
    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listAllRows();
    const sample = rows[0]?.raw;
    if (Array.isArray(sample)) {
      return new Array(schema.columns.length).fill(null) as RowArray;
    }
    const obj: RowObject = {};
    for (const col of schema.columns) {
      obj[String(col.key)] = null;
    }
    return obj;
  }

  private closeContextMenu() {
    const anyPopover = this.contextMenu as any;
    if (anyPopover?.hidePopover) anyPopover.hidePopover();
  }

  private ensureToast() {
    if (this.toast && (this.toast as any).isConnected) return;
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
    const anyPopover = this.toast as any;
    if (anyPopover.hidePopover) anyPopover.hidePopover();
    if (anyPopover.showPopover) anyPopover.showPopover();
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.toastTimer = window.setTimeout(() => {
      if (anyPopover.hidePopover) anyPopover.hidePopover();
    }, durationMs);
  }

  private bindViewport() {
    this.resizeHandler = () => this.updateViewportFromRoot();
    this.scrollHandler = () => this.updateViewportFromRoot();
    this.getScrollHost().addEventListener("scroll", this.scrollHandler, { passive: true });
    window.addEventListener("resize", this.resizeHandler);
    this.handleGlobalPointer = (ev: MouseEvent | PointerEvent) => {
      if (this.contextMenu && !this.contextMenu.contains(ev.target as Node)) {
        const anyPopover = this.contextMenu as any;
        if (anyPopover.hidePopover) anyPopover.hidePopover();
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
      const anyPopover = this.contextMenu as any;
      if (anyPopover.hidePopover) anyPopover.hidePopover();
      if (this.contextMenu.parentElement) removeFromParent(this.contextMenu);
      this.contextMenu = null;
    }
    if (this.toast) {
      const anyToast = this.toast as any;
      if (anyToast.hidePopover) anyToast.hidePopover();
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

  getFindReplaceController() {
    this.ensureFindReplace();
    return this.findReplace;
  }

  showSearchPanel(mode: FindReplaceMode = "find") {
    if (!this.findReplaceEnabled || !this.findReplaceUiEnabled) return;
    this.ensureFindReplace();
    if (!this.findReplace || !this.findReplaceSidebar) return;
    this.hideFilterSortPanel();
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.findReplace.setMode(mode);
    this.findReplaceOpenedAt = now;
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
    this.findReplaceOpenedAt = 0;
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
    listener(this.getTableState(), this.lastTableState);
    return () => this.tableStateListeners.delete(listener);
  }

  private emitTableState() {
    const next = this.getTableState();
    const prev = this.lastTableState;
    const errorsEqual = (() => {
      if (!prev) return false;
      if (prev.activeErrors.length !== next.activeErrors.length) return false;
      for (let i = 0; i < next.activeErrors.length; i += 1) {
        const a = prev.activeErrors[i]!;
        const b = next.activeErrors[i]!;
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
        const anyV = v as any;
        if (anyV.kind === "enum" && typeof anyV.value === "string") return anyV.value;
        if (anyV.kind === "tags" && Array.isArray(anyV.values)) return anyV.values.join(", ");
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
    listener(this.getSelectionSnapshot(), this.lastSelectionSnapshot, "selection");
    return () => this.selectionListeners.delete(listener);
  }

  private emitSelection(reason: SelectionChangeReason) {
    const next = this.getSelectionSnapshot();
    const prev = this.lastSelectionSnapshot;
    this.lastSelectionSnapshot = next;
    for (const l of this.selectionListeners) l(next, prev, reason);
  }

  // Public API: value updates
  setCellValue(target: CellAddress, next: Updater<unknown>) {
    const resolved = resolveCellAddress(this.dataModel, target);
    if (!resolved) return;
    if (this.isCellReadonly(resolved.rowId, resolved.colKey)) return;
    const current = this.dataModel.getCell(resolved.rowId, resolved.colKey);
    const computed = typeof next === "function" ? next(current) : next;
    this.handleEdit(
      { kind: "edit", rowId: resolved.rowId, colKey: resolved.colKey, next: computed },
      this.editMode === "direct",
    );
  }

  updateColumnFormat(
    colKey: string | number,
    next: Updater<Schema["columns"][number]["format"] | undefined>,
  ) {
    this.dataModel.updateColumnFormat(colKey, (old) =>
      typeof next === "function" ? next(old) : next,
    );
    this.safeRender(this.viewportState ?? undefined);
    this.emitSelection("schema");
    this.emitTableState();
  }

  setCellConditionalStyle(target: CellAddress, fn: ConditionalStyleFn | null) {
    const resolved = resolveCellAddress(this.dataModel, target);
    if (!resolved) return;
    this.dataModel.setCellConditionalStyle(resolved.rowId, resolved.colKey, fn);
    this.safeRender(this.viewportState ?? undefined);
    this.emitSelection("style");
    this.emitTableState();
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
            Find
            <input data-extable-fr="query" type="text" />
          </label>
          <button type="button" data-extable-fr="close" class="extable-search-close">×</button>
        </div>
        <div class="extable-search-row">
          <label><input data-extable-fr="case" type="checkbox" /> Case</label>
          <label><input data-extable-fr="regex" type="checkbox" /> Regex</label>
          <label><input data-extable-fr="replace-toggle" type="checkbox" /> Replace</label>
        </div>
        <div class="extable-search-row extable-search-replace-row" data-extable-fr="replace-row">
          <label class="extable-search-label">
            Replace
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

    const query = aside.querySelector<HTMLInputElement>('input[data-extable-fr="query"]')!;
    const replace = aside.querySelector<HTMLInputElement>('input[data-extable-fr="replace"]')!;
    const toggleReplace = aside.querySelector<HTMLInputElement>(
      'input[data-extable-fr="replace-toggle"]',
    )!;
    const caseCb = aside.querySelector<HTMLInputElement>('input[data-extable-fr="case"]')!;
    const regexCb = aside.querySelector<HTMLInputElement>('input[data-extable-fr="regex"]')!;
    const btnPrev = aside.querySelector<HTMLButtonElement>('button[data-extable-fr="prev"]')!;
    const btnNext = aside.querySelector<HTMLButtonElement>('button[data-extable-fr="next"]')!;
    const btnReplace = aside.querySelector<HTMLButtonElement>(
      'button[data-extable-fr="replace-current"]',
    )!;
    const btnReplaceAll = aside.querySelector<HTMLButtonElement>(
      'button[data-extable-fr="replace-all"]',
    )!;
    const btnClose = aside.querySelector<HTMLButtonElement>('button[data-extable-fr="close"]')!;
    const tbody = aside.querySelector<HTMLElement>('[data-extable-fr="results-tbody"]')!;

    query.addEventListener("input", () => this.findReplace?.setQuery(query.value));
    replace.addEventListener("input", () => this.findReplace?.setReplace(replace.value));
    caseCb.addEventListener("change", () =>
      this.findReplace?.setOptions({ caseInsensitive: caseCb.checked }),
    );
    regexCb.addEventListener("change", () =>
      this.findReplace?.setOptions({ regex: regexCb.checked }),
    );
    toggleReplace.addEventListener("change", () => {
      this.findReplace?.setMode(toggleReplace.checked ? "replace" : "find");
    });
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

    this.findReplaceSidebarUnsub =
      this.findReplace?.subscribe((state) => {
        const replaceRow = aside.querySelector<HTMLElement>('[data-extable-fr="replace-row"]')!;
        const status = aside.querySelector<HTMLElement>('[data-extable-fr="status"]')!;
        const error = aside.querySelector<HTMLElement>('[data-extable-fr="error"]')!;

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
          const m = state.matches[i]!;
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

    this.ensureFindReplaceShortcut();
  }

  private ensureFindReplaceShortcut() {
    if (!this.findReplaceEnableSearch) return;
    if (this.findReplaceKeydown) return;
    this.findReplaceKeydown = (ev: KeyboardEvent) => {
      const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
      const accel = isMac ? ev.metaKey : ev.ctrlKey;
      if (!accel) return;
      if (ev.isComposing) return;
      const key = ev.key.toLowerCase();
      // Avoid colliding with browser reload shortcuts (Ctrl/Cmd+R).
      if (key === "r") return;
      if (key !== "f") return;
      ev.preventDefault();
      ev.stopPropagation();
      this.toggleSearchPanel("find");
    };
    document.addEventListener("keydown", this.findReplaceKeydown, true);
  }

  private teardownFindReplace() {
    if (this.findReplaceKeydown) {
      document.removeEventListener("keydown", this.findReplaceKeydown, true);
      this.findReplaceKeydown = null;
    }
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
  toggleSearchPanel(mode: FindReplaceMode = "find") {
    if (this.isSearchPanelVisible()) {
      this.hideSearchPanel();
    } else {
      this.showSearchPanel(mode);
    }
  }

  private stableValueKey(value: unknown) {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (value instanceof Date) return `date:${value.getTime()}`;
    if (typeof value === "string") return `s:${value}`;
    if (typeof value === "number") return `n:${Number.isNaN(value) ? "NaN" : String(value)}`;
    if (typeof value === "boolean") return `b:${value ? "1" : "0"}`;
    if (typeof value === "object") {
      const anyV = value as any;
      if (anyV.kind === "enum" && typeof anyV.value === "string") return `enum:${anyV.value}`;
      if (anyV.kind === "tags" && Array.isArray(anyV.values))
        return `tags:${anyV.values.join("|")}`;
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
      const anyEv = ev as CustomEvent<any>;
      const key = anyEv?.detail?.colKey;
      if (key === undefined || key === null) return;
      this.showFilterSortPanel(key);
    };
    host.addEventListener("extable:filter-sort-open", this.filterSortOpenEvent as any);
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

    const btnClose = aside.querySelector<HTMLButtonElement>('button[data-extable-fs="close"]')!;
    const cbErrors = aside.querySelector<HTMLInputElement>('input[data-extable-fs="col-errors"]')!;
    const cbWarnings = aside.querySelector<HTMLInputElement>(
      'input[data-extable-fs="col-warnings"]',
    )!;
    const search = aside.querySelector<HTMLInputElement>('input[data-extable-fs="search"]')!;
    const values = aside.querySelector<HTMLElement>('[data-extable-fs="values"]')!;
    const btnAll = aside.querySelector<HTMLButtonElement>('button[data-extable-fs="select-all"]')!;
    const btnNone = aside.querySelector<HTMLButtonElement>(
      'button[data-extable-fs="select-none"]',
    )!;
    const btnApply = aside.querySelector<HTMLButtonElement>(
      'button[data-extable-fs="apply-filter"]',
    )!;
    const btnClear = aside.querySelector<HTMLButtonElement>(
      'button[data-extable-fs="clear-filter"]',
    )!;
    const btnSortAsc = aside.querySelector<HTMLButtonElement>(
      'button[data-extable-fs="sort-asc"]',
    )!;
    const btnSortDesc = aside.querySelector<HTMLButtonElement>(
      'button[data-extable-fs="sort-desc"]',
    )!;
    const btnSortClear = aside.querySelector<HTMLButtonElement>(
      'button[data-extable-fs="clear-sort"]',
    )!;

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

  private showFilterSortPanel(colKey: string | number) {
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

  private hideFilterSortPanel() {
    this.root.classList.toggle("extable-filter-sort-open", false);
    this.filterSortActiveColumnKey = null;
    this.filterSortDraft = null;
  }

  private buildFilterSortDraft(colKey: string | number) {
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
    const title = this.filterSortSidebar.querySelector<HTMLElement>('[data-extable-fs="title"]')!;
    const cbErrors = this.filterSortSidebar.querySelector<HTMLInputElement>(
      'input[data-extable-fs="col-errors"]',
    )!;
    const cbWarnings = this.filterSortSidebar.querySelector<HTMLInputElement>(
      'input[data-extable-fs="col-warnings"]',
    )!;
    const search = this.filterSortSidebar.querySelector<HTMLInputElement>(
      'input[data-extable-fs="search"]',
    )!;
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
    const values = this.filterSortSidebar.querySelector<HTMLElement>('[data-extable-fs="values"]')!;
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
        this.filterSortOpenEvent as any,
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
export function createTablePlaceholder<T extends Record<string, unknown> = Record<string, unknown>>(
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
