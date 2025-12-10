import './styles.css';
import { CommandQueue } from './commandQueue';
import { DataModel } from './dataModel';
import { LockManager } from './lockManager';
import { CanvasRenderer, HTMLRenderer, type Renderer, type ViewportState } from './renderers';
import { SelectionManager } from './selectionManager';
import { toArray } from './utils';
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
  View
} from './types';

export * from './types';

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

  constructor(init: CoreInit) {
    this.root = init.root;
    this.renderMode = init.options?.renderMode ?? 'auto';
    this.editMode = init.options?.editMode ?? 'direct';
    this.lockMode = init.options?.lockMode ?? 'none';
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
        console.warn('fetchInitial failed', e);
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
        this.root.style[k] = v ?? '';
      }
    }
  }

  private chooseRenderer(mode: RenderMode): Renderer {
    if (mode === 'auto') {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const isBot = /bot|crawl|spider/i.test(ua) || (typeof navigator !== 'undefined' && 'userAgentData' in navigator && (navigator as any).userAgentData?.brands?.some((b: any) => /bot/i.test(b.brand)));
      return isBot ? new HTMLRenderer(this.dataModel) : new CanvasRenderer(this.dataModel);
    }
    return mode === 'html' ? new HTMLRenderer(this.dataModel) : new CanvasRenderer(this.dataModel);
  }

  private mount() {
    this.renderer.mount(this.root);
    this.initViewportState();
    this.selectionManager = new SelectionManager(
      this.root,
      this.editMode,
      (cmd, commitNow) => this.handleEdit(cmd, commitNow),
      (rowId) => void this.lockManager.selectRow(rowId),
      (rowId) => void this.lockManager.unlockOnMove(rowId),
      (ev) => this.renderer.hitTest(ev),
      this.dataModel,
      (rowId, colKey) => this.renderer.setActiveCell(rowId, colKey)
    );
    this.root.dataset.extable = 'ready';
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
    this.root.className = '';
    this.root.classList.add(...toArray(classNames) ?? []);
  }

  setRootStyle(style: Partial<CSSStyleDeclaration>) {
    for (const [k, v] of Object.entries(style)) {
      // @ts-expect-error CSSStyleDeclaration index
      this.root.style[k] = v ?? '';
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
        console.warn('commit failed', e);
      }
    }
  }

  private handleServerEvent(event: { type: 'update'; commands: Command[]; user: UserInfo }) {
    for (const cmd of event.commands) {
      this.applyCommand(cmd);
    }
    this.renderer.render(this.viewportState ?? undefined);
  }

  private applyCommand(cmd: Command) {
    switch (cmd.kind) {
      case 'edit':
        if (cmd.rowId && cmd.colKey !== undefined) {
          this.dataModel.setCell(cmd.rowId, cmd.colKey, cmd.next, true);
        }
        break;
      case 'insertRow':
        if (cmd.rowData) {
          this.dataModel.insertRow(cmd.rowData);
        }
        break;
      case 'deleteRow':
        if (cmd.rowId) {
          this.dataModel.deleteRow(cmd.rowId);
        }
        break;
      case 'updateView':
        if (cmd.next && typeof cmd.next === 'object') {
          this.dataModel.setView(cmd.next as View);
        }
        break;
      default:
        break;
    }
  }

  private bindViewport() {
    this.resizeHandler = () => this.updateViewportFromRoot();
    this.scrollHandler = () => this.updateViewportFromRoot();
    this.root.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('resize', this.resizeHandler);
  }

  private unbindViewport() {
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    if (this.scrollHandler) this.root.removeEventListener('scroll', this.scrollHandler);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
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
      timestamp: performance.now()
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
      timestamp: performance.now()
    };
    const next: ViewportState = {
      scrollTop: this.root.scrollTop,
      scrollLeft: this.root.scrollLeft,
      clientWidth: this.root.clientWidth,
      clientHeight: this.root.clientHeight,
      deltaX: this.root.scrollLeft - prev.scrollLeft,
      deltaY: this.root.scrollTop - prev.scrollTop,
      timestamp: performance.now()
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
    this.renderer.render(this.viewportState);
  }
}

// Compatibility helpers for wrappers/tests
export function createTablePlaceholder(config: TableConfig, options: CoreOptions) {
  const core = new ExtableCore({
    root: document.createElement('div'),
    defaultData: config.data,
    defaultView: config.view,
    schema: config.schema,
    options
  });
  return core;
}

export function mountTable(target: HTMLElement, core: ExtableCore) {
  core.remount(target);
  return core;
}
