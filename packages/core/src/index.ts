import './styles.css';
import { CommandQueue } from './commandQueue';
import { DataModel } from './dataModel';
import { LockManager } from './lockManager';
import { CanvasRenderer, HTMLRenderer, type Renderer } from './renderers';
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
      Object.entries(options.defaultStyle).forEach(([k, v]) => {
        // @ts-expect-error CSSStyleDeclaration index
        this.root.style[k] = v ?? '';
      });
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
    this.selectionManager = new SelectionManager(
      this.root,
      this.editMode,
      (cmd, commitNow) => this.handleEdit(cmd, commitNow),
      (rowId) => void this.lockManager.selectRow(rowId),
      (rowId) => void this.lockManager.unlockOnMove(rowId),
      (ev) => this.renderer.hitTest(ev),
      this.dataModel
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
    Object.entries(style).forEach(([k, v]) => {
      // @ts-expect-error CSSStyleDeclaration index
      this.root.style[k] = v ?? '';
    });
  }

  setData(data: DataSet) {
    this.dataModel.setData(data);
    this.renderer.render();
  }

  setView(view: View) {
    this.dataModel.setView(view);
    this.renderer.render();
  }

  setSchema(schema: Schema) {
    this.dataModel.setSchema(schema);
    this.renderer.render();
  }

  private handleEdit(cmd: Command, commitNow: boolean) {
    if (!cmd.rowId || cmd.colKey === undefined) return;
    const prev = this.dataModel.getCell(cmd.rowId, cmd.colKey);
    this.commandQueue.enqueue({ ...cmd, prev });
    this.dataModel.setCell(cmd.rowId, cmd.colKey, cmd.next, commitNow);
    this.renderer.render();
    if (commitNow) {
      void this.sendCommit([cmd]);
    }
  }

  async commit() {
    const pending = this.commandQueue.listApplied();
    if (!pending.length) return;
    pending.forEach((cmd) => {
      if (cmd.rowId) this.dataModel.applyPending(cmd.rowId);
    });
    await this.sendCommit(pending);
    await this.lockManager.unlockOnCommit(this.commandQueue.listApplied().at(-1)?.rowId);
    this.commandQueue.clear();
    this.renderer.render();
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
    event.commands.forEach((cmd) => this.applyCommand(cmd));
    this.renderer.render();
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
    const rerender = () => {
      this.renderer.render();
    };
    this.resizeHandler = () => rerender();
    // HTML renderer fully re-renders the DOM, so avoid re-render-on-scroll to prevent scrollTop resets.
    if (this.renderer.constructor.name === 'CanvasRenderer') {
      this.scrollHandler = () => {
        console.log('[extable-core] root scroll -> rerender (canvas)', {
          scrollTop: this.root.scrollTop,
          scrollLeft: this.root.scrollLeft
        });
        this.selectionManager?.onScroll(this.root.scrollTop, this.root.scrollLeft);
        rerender();
      };
      this.root.addEventListener('scroll', this.scrollHandler);
    } else {
      this.scrollHandler = null;
      console.log('[extable-core] root scroll listener skipped (html renderer)');
    }
    window.addEventListener('resize', this.resizeHandler);
  }

  private unbindViewport() {
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
    if (this.scrollHandler) this.root.removeEventListener('scroll', this.scrollHandler);
  }

  remount(target: HTMLElement) {
    this.unbindViewport();
    this.selectionManager?.destroy();
    this.renderer.destroy();
    this.root = target;
    this.renderer = this.chooseRenderer(this.renderMode);
    this.mount();
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
