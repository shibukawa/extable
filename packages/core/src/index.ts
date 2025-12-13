import "./styles.css";
import { CommandQueue } from "./commandQueue";
import { DataModel } from "./dataModel";
import { LockManager } from "./lockManager";
import { CanvasRenderer, HTMLRenderer, type Renderer, type ViewportState } from "./renderers";
import { SelectionManager } from "./selectionManager";
import { toArray } from "./utils";
import type {
  Command,
  CoreOptions,
  DataSet,
  EditMode,
  LockMode,
  RenderMode,
  Schema,
  ServerAdapter,
  TableConfig,
  UserInfo,
  View,
  RowObject,
  RowArray,
} from "./types";

export * from "./types";

export interface CoreInit {
  root: HTMLElement;
  defaultData: DataSet;
  defaultView: View;
  schema: Schema;
  options?: CoreOptions;
}

export class ExtableCore {
  private root: HTMLElement;
  private dataModel: DataModel;
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

  constructor(init: CoreInit) {
    this.root = init.root;
    this.renderMode = init.options?.renderMode ?? "auto";
    this.editMode = init.options?.editMode ?? "direct";
    this.lockMode = init.options?.lockMode ?? "none";
    this.server = init.options?.server;
    this.user = init.options?.user;
    this.dataModel = new DataModel(init.defaultData, init.schema, init.defaultView);
    this.commandQueue = new CommandQueue();
    this.lockManager = new LockManager(this.lockMode, this.server, this.user);
    this.renderer = this.chooseRenderer(this.renderMode);
    this.applyRootDecor(init.options);
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

  private chooseRenderer(mode: RenderMode): Renderer {
    if (mode === "auto") {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const isBot =
        /bot|crawl|spider/i.test(ua) ||
        (typeof navigator !== "undefined" &&
          "userAgentData" in navigator &&
          (navigator as any).userAgentData?.brands?.some((b: any) => /bot/i.test(b.brand)));
      return isBot ? new HTMLRenderer(this.dataModel) : new CanvasRenderer(this.dataModel);
    }
    return mode === "html" ? new HTMLRenderer(this.dataModel) : new CanvasRenderer(this.dataModel);
  }

  private mount() {
    this.renderer.mount(this.root);
    this.ensureContextMenu();
    this.ensureToast();
    this.initViewportState();
    this.selectionManager = new SelectionManager(
      this.root,
      this.editMode,
      (cmd, commitNow) => this.handleEdit(cmd, commitNow),
      (rowId) => void this.lockManager.selectRow(rowId),
      (rowId) => void this.lockManager.unlockOnMove(rowId),
      (ev) => this.renderer.hitTest(ev),
      this.dataModel,
      (rowId, colKey) => this.renderer.setActiveCell(rowId, colKey),
      (rowId, colKey, x, y) => this.showContextMenu(rowId, colKey, x, y),
      (ranges) => this.renderer.setSelection(ranges),
      () => this.undo(),
      () => this.redo(),
    );
    this.root.dataset.extable = "ready";
    this.bindViewport();
    if (this.server) {
      this.unsubscribe = this.server.subscribe((event) => this.handleServerEvent(event));
    }
  }

  destroy() {
    this.selectionManager?.destroy();
    this.renderer.destroy();
    this.unsubscribe?.();
    this.unbindViewport();
  }

  setRenderMode(mode: RenderMode) {
    this.renderMode = mode;
    this.renderer.destroy();
    this.renderer = this.chooseRenderer(mode);
    this.mount();
  }

  setEditMode(mode: EditMode) {
    this.editMode = mode;
    this.selectionManager?.setEditMode(mode);
  }

  setLockMode(mode: LockMode) {
    this.lockMode = mode;
    this.lockManager.setMode(mode);
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

  setData(data: DataSet) {
    this.dataModel.setData(data);
    this.renderer.render(this.viewportState ?? undefined);
  }

  setView(view: View) {
    this.dataModel.setView(view);
    this.renderer.render(this.viewportState ?? undefined);
  }

  setSchema(schema: Schema) {
    this.dataModel.setSchema(schema);
    this.renderer.render(this.viewportState ?? undefined);
  }

  private handleEdit(cmd: Command, commitNow: boolean) {
    if (!cmd.rowId || cmd.colKey === undefined) return;
    const prev = this.dataModel.getCell(cmd.rowId, cmd.colKey);
    this.commandQueue.enqueue({ ...cmd, prev });
    this.dataModel.setCell(cmd.rowId, cmd.colKey, cmd.next, commitNow);
    this.renderer.render(this.viewportState ?? undefined);
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
    this.renderer.render(this.viewportState ?? undefined);
  }

  redo() {
    this.selectionManager?.cancelEditing();
    const cmds = this.commandQueue.redo();
    if (!cmds || !cmds.length) return;
    for (const cmd of cmds) {
      this.applyForward(cmd);
    }
    this.renderer.render(this.viewportState ?? undefined);
  }

  private applyInverse(cmd: Command) {
    switch (cmd.kind) {
      case "edit":
        if (cmd.rowId && cmd.colKey !== undefined) {
          this.dataModel.setCell(cmd.rowId, cmd.colKey, cmd.prev, this.editMode === "direct");
        }
        return;
      case "insertRow":
        if (cmd.rowId) this.dataModel.deleteRow(cmd.rowId);
        return;
      case "deleteRow":
        if (cmd.rowId && cmd.rowData) {
          const idx = (cmd.payload as any)?.index;
          const index = typeof idx === "number" ? idx : this.dataModel.listRows().length;
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
          const index = typeof idx === "number" ? idx : this.dataModel.listRows().length;
          const forcedId = typeof cmd.rowId === "string" ? cmd.rowId : undefined;
          this.dataModel.insertRowAt(cmd.rowData, index, forcedId);
        }
        return;
      case "deleteRow":
        if (cmd.rowId) this.dataModel.deleteRow(cmd.rowId);
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
    this.renderer.render(this.viewportState ?? undefined);
  }

  private async sendCommit(commands: Command[]) {
    if (this.server && this.user) {
      try {
        await this.server.commit(commands, this.user);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("commit failed", e);
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
    this.renderer.render(this.viewportState ?? undefined);
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
          this.dataModel.deleteRow(cmd.rowId);
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
    if (this.contextMenu) return;
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
    document.body.appendChild(pop);
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
    this.contextMenuRowId = rowId;
    this.contextMenuColKey = colKey;
    // Update enable/disable state for undo/redo.
    for (const btn of Array.from(this.contextMenu.querySelectorAll<HTMLButtonElement>("button[data-action]"))) {
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
    // eslint-disable-next-line no-console
    console.log("[extable ctx] show", { rowId, colKey, left, top });
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
    const rows = this.dataModel.listRows();
    const idx = rows.findIndex((r) => r.id === this.contextMenuRowId);
    const targetIndex = idx >= 0 ? idx : rows.length;
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
      this.renderer.render(this.viewportState ?? undefined);
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
      this.renderer.render(this.viewportState ?? undefined);
      this.showToast("Row deleted", "info");
      return;
    }
  }

  private createBlankRow(): RowObject | RowArray {
    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
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
    if (this.toast) return;
    const toast = document.createElement("div");
    toast.className = "extable-toast";
    toast.setAttribute("popover", "manual");
    toast.style.right = "16px";
    toast.style.bottom = "16px";
    toast.style.position = "fixed";
    document.body.appendChild(toast);
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
    this.root.addEventListener("scroll", this.scrollHandler, { passive: true });
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
    if (this.scrollHandler) this.root.removeEventListener("scroll", this.scrollHandler);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.handleGlobalPointer) {
      document.removeEventListener("pointerdown", this.handleGlobalPointer, true);
      this.handleGlobalPointer = null;
    }
    if (this.contextMenu?.parentElement) {
      const anyPopover = this.contextMenu as any;
      if (anyPopover.hidePopover) anyPopover.hidePopover();
      this.contextMenu.parentElement.removeChild(this.contextMenu);
      this.contextMenu = null;
    }
    if (this.toast?.parentElement) {
      const anyToast = this.toast as any;
      if (anyToast.hidePopover) anyToast.hidePopover();
      this.toast.parentElement.removeChild(this.toast);
      this.toast = null;
    }
  }

  remount(target: HTMLElement) {
    this.unbindViewport();
    this.selectionManager?.destroy();
    this.renderer.destroy();
    this.root = target;
    this.renderer = this.chooseRenderer(this.renderMode);
    this.mount();
  }

  private initViewportState() {
    this.viewportState = {
      scrollTop: this.root.scrollTop,
      scrollLeft: this.root.scrollLeft,
      clientWidth: this.root.clientWidth,
      clientHeight: this.root.clientHeight,
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
    const next: ViewportState = {
      scrollTop: this.root.scrollTop,
      scrollLeft: this.root.scrollLeft,
      clientWidth: this.root.clientWidth,
      clientHeight: this.root.clientHeight,
      deltaX: this.root.scrollLeft - prev.scrollLeft,
      deltaY: this.root.scrollTop - prev.scrollTop,
      timestamp: performance.now(),
    };
    // eslint-disable-next-line no-console
    console.log("[extable scroll]", {
      scrollTop: next.scrollTop,
      scrollLeft: next.scrollLeft,
      deltaX: next.deltaX,
      deltaY: next.deltaY,
      clientWidth: next.clientWidth,
      clientHeight: next.clientHeight,
    });
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
    this.renderer.render(this.viewportState);
  }
}

// Compatibility helpers for wrappers/tests
export function createTablePlaceholder(config: TableConfig, options: CoreOptions) {
  const core = new ExtableCore({
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
