import type { Command, EditMode } from './types';
import type { DataModel } from './dataModel';

type EditHandler = (cmd: Command, commit: boolean) => void;
type RowSelectHandler = (rowId: string) => void;
type MoveHandler = (rowId?: string) => void;
type HitTest = (event: MouseEvent) => { rowId: string; colKey: string | number; element?: HTMLElement; rect: DOMRect } | null;

export class SelectionManager {
  private root: HTMLElement;
  private editMode: EditMode;
  private onEdit: EditHandler;
  private onRowSelect: RowSelectHandler;
  private onMove: MoveHandler;
  private hitTest: HitTest;
  private inputEl: HTMLInputElement | HTMLTextAreaElement | null = null;
  private floatingInputWrapper: HTMLDivElement | null = null;
  private activeCell: { rowId: string; colKey: string | number } | null = null;
  private activeHost: HTMLElement | null = null;
  private floatingMeta: {
    screenLeft: number; // rect.left in viewport coords
    screenTop: number; // rect.top in viewport coords
    width: number;
    height: number;
    scrollLeft0: number;
    scrollTop0: number;
  } | null = null;
  private composing = false;
  private lastCompositionEnd = 0;

  constructor(
    root: HTMLElement,
    editMode: EditMode,
    onEdit: EditHandler,
    onRowSelect: RowSelectHandler,
    onMove: MoveHandler,
    hitTest: HitTest,
    private dataModel: DataModel
  ) {
    this.root = root;
    this.editMode = editMode;
    this.onEdit = onEdit;
    this.onRowSelect = onRowSelect;
    this.onMove = onMove;
    this.hitTest = hitTest;
    this.bind();
  }

  setEditMode(mode: EditMode) {
    this.editMode = mode;
  }

  cancelEditing() {
    this.teardownInput();
  }

  destroy() {
    this.root.removeEventListener('click', this.handleClick);
    this.teardownInput();
  }

  onScroll(scrollTop: number, scrollLeft: number) {
    if (this.floatingInputWrapper && this.floatingMeta) {
      this.positionFloating(this.floatingMeta, scrollTop, scrollLeft);
    }
  }

  private bind() {
    this.root.addEventListener('click', this.handleClick);
  }

  private findColumn(colKey: string | number) {
    const schema = this.dataModel.getSchema();
    return schema.columns.find((c) => c.key === colKey);
  }

  private createEditor(colKey: string | number, initial: string) {
    const col = this.findColumn(colKey);
    const needsTextarea = col?.wrapText || initial.includes('\n');
    if (needsTextarea) {
      const ta = document.createElement('textarea');
      ta.value = initial;
      ta.style.resize = 'none';
      ta.style.whiteSpace = 'pre-wrap';
      ta.style.overflowWrap = 'anywhere';
      ta.style.overflow = 'hidden';
      this.autosize(ta);
      ta.addEventListener('input', () => this.autosize(ta));
      return { control: ta, value: initial };
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.value = initial;
    return { control: input, value: initial };
  }

  private autosize(ta: HTMLTextAreaElement) {
    const style = window.getComputedStyle(ta);
    let lineHeight = parseFloat(style.lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) lineHeight = 16;
    ta.rows = 1; // shrink to measure
    const lines = Math.ceil(ta.scrollHeight / lineHeight);
    ta.rows = Math.max(1, lines);
    ta.style.minHeight = `${lineHeight}px`;
  }

  private positionFloating(
    meta: { screenLeft: number; screenTop: number; width: number; height: number; scrollLeft0: number; scrollTop0: number },
    scrollTop: number,
    scrollLeft: number,
    wrapper?: HTMLDivElement
  ) {
    const host = wrapper ?? this.floatingInputWrapper;
    if (!host) return;
    const dpr = window.devicePixelRatio ?? 1;
    const screenLeft = meta.screenLeft + (meta.scrollLeft0 - scrollLeft);
    const screenTop = meta.screenTop + (meta.scrollTop0 - scrollTop);
    const rootRect = this.root.getBoundingClientRect();
    const leftPx = screenLeft - rootRect.left;
    const topPx = screenTop - rootRect.top;
    host.style.left = `${leftPx}px`;
    host.style.top = `${topPx}px`;
    host.style.width = `${meta.width}px`;
    host.style.height = `${meta.height}px`;
    host.style.pointerEvents = 'none';
    const hostRect = host.getBoundingClientRect();
    console.log('[extable-floating] position', {
      meta,
      scrollTop,
      scrollLeft,
      leftPx,
      topPx,
      hostRect,
      dpr,
      rootRect
    });
  }

  private handleClick = (ev: MouseEvent) => {
    if (this.inputEl && ev.target && this.inputEl.contains(ev.target as Node)) {
      return;
    }
    if (this.inputEl && this.activeHost) {
      // restore previous cell text if editing was abandoned
      const val = (this.activeHost.dataset && this.activeHost.dataset.value) ?? this.inputEl.value;
      this.activeHost.textContent = val;
      this.teardownInput();
    }
    const hit = this.hitTest(ev);
    if (!hit) return;
    this.onRowSelect(hit.rowId);
    if (hit.element) {
      this.activateCellElement(hit.element, hit.rowId, hit.colKey);
    } else {
      this.activateFloating(hit.rect, hit.rowId, hit.colKey);
    }
  };

  private activateCellElement(cell: HTMLElement, rowId: string, colKey: string | number) {
    this.teardownInput();
    this.activeCell = { rowId, colKey };
    this.activeHost = cell;
    const initialValue = cell.dataset?.value ?? cell.textContent ?? '';
    const { control, value } = this.createEditor(colKey, initialValue);
    const input = control;
    input.value = value;
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    input.addEventListener('keydown', (e) => this.handleKey(e as KeyboardEvent, cell));
    input.addEventListener('focus', () => input.select());
    this.attachInputDebug(input);
    cell.textContent = '';
    cell.appendChild(input);
    if (input.tagName.toLowerCase() === 'textarea') {
      requestAnimationFrame(() => {
        if (input instanceof HTMLTextAreaElement) this.autosize(input);
      });
    }
    input.focus();
    this.inputEl = input;
  }

  private activateFloating(rect: DOMRect, rowId: string, colKey: string | number) {
    this.teardownInput();
    this.activeCell = { rowId, colKey };
    const wrapper = document.createElement('div');
    this.activeHost = wrapper;
    wrapper.style.position = 'absolute';
    wrapper.style.pointerEvents = 'none';
    const current = this.dataModel.getCell(rowId, colKey);
    const { control, value } = this.createEditor(colKey, current === null || current === undefined ? '' : String(current));
    const input = control;
    input.value = value;
    input.style.width = '100%';
    input.style.height = '100%';
    input.style.boxSizing = 'border-box';
    input.style.pointerEvents = 'auto';
    input.addEventListener('keydown', (e) => this.handleKey(e as KeyboardEvent, wrapper));
    input.addEventListener('focus', () => input.select());
    this.attachInputDebug(input);
    wrapper.appendChild(input);
    if (input.tagName.toLowerCase() === 'textarea') {
      requestAnimationFrame(() => {
        if (input instanceof HTMLTextAreaElement) this.autosize(input);
      });
    }
    this.root.appendChild(wrapper);
    const rootRect = this.root.getBoundingClientRect();
    this.floatingMeta = {
      screenLeft: rect.left,
      screenTop: rect.top,
      width: rect.width,
      height: rect.height,
      scrollLeft0: this.root.scrollLeft,
      scrollTop0: this.root.scrollTop
    };
    console.log('[extable-floating] activate', {
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      rootRect: { left: rootRect.left, top: rootRect.top, width: rootRect.width, height: rootRect.height },
      meta: this.floatingMeta,
      dpr: window.devicePixelRatio ?? 1
    });
    this.positionFloating(this.floatingMeta, this.root.scrollTop, this.root.scrollLeft, wrapper);
    input.focus();
    this.inputEl = input;
    this.floatingInputWrapper = wrapper;
  }

  private handleKey(e: KeyboardEvent, cell: HTMLElement) {
    if (!this.activeCell || !this.inputEl) return;
    const now = Date.now();
    if (e.isComposing || this.composing) return; // IME composing; ignore control keys
    if (now - this.lastCompositionEnd < 24) return; // absorb trailing key events right after IME commit
    const { rowId, colKey } = this.activeCell;
    const isTextarea = this.inputEl.tagName.toLowerCase() === 'textarea';
    const isAltEnter = e.key === 'Enter' && (e.altKey || e.shiftKey || e.metaKey || e.ctrlKey);
    if (!isTextarea && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault();
      const value = this.inputEl.value;
      this.commitEdit(rowId, colKey, value);
      this.onMove(rowId);
      this.teardownInput();
    } else if (isTextarea && e.key === 'Enter') {
      if (isAltEnter) {
        // allow newline insertion
        return;
      }
      e.preventDefault();
      const value = this.inputEl.value;
      this.commitEdit(rowId, colKey, value);
      this.onMove(rowId);
      this.teardownInput();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelEdit(cell);
      this.onMove();
    } else if (e.key === 'Backspace' && this.inputEl.value === '') {
      e.preventDefault();
      this.commitEdit(rowId, colKey, '');
      this.onMove(rowId);
      this.teardownInput();
    }
  }

  private commitEdit(rowId: string, colKey: string | number, value: unknown) {
    const cmd: Command = {
      kind: 'edit',
      rowId,
      colKey,
      next: value
    };
    const commitNow = this.editMode === 'direct';
    this.onEdit(cmd, commitNow);
  }

  private cancelEdit(cell: HTMLElement) {
    if (this.activeCell) {
      const { rowId, colKey } = this.activeCell;
      const prev =
        cell.dataset?.original ??
        cell.dataset?.value ??
        (() => {
          const v = this.dataModel.getCell(rowId, colKey);
          return v === null || v === undefined ? '' : String(v);
        })();
      const cmd: Command = {
        kind: 'edit',
        rowId,
        colKey,
        next: prev,
        prev
      };
      this.onEdit(cmd, true);
    }
    this.teardownInput();
    if (cell.dataset?.original !== undefined || cell.dataset?.value !== undefined) {
      cell.textContent = cell.dataset.original ?? cell.dataset.value ?? '';
    }
    cell.blur();
  }

  private teardownInput() {
    if (this.inputEl && this.inputEl.parentElement) {
      this.inputEl.parentElement.removeChild(this.inputEl);
    }
    if (this.floatingInputWrapper && this.floatingInputWrapper.parentElement) {
      this.floatingInputWrapper.parentElement.removeChild(this.floatingInputWrapper);
    }
    if (this.activeHost) {
      if (this.activeHost.dataset?.value !== undefined) {
        this.activeHost.textContent = this.activeHost.dataset.value;
      } else if (this.activeCell) {
        const v = this.dataModel.getCell(this.activeCell.rowId, this.activeCell.colKey);
        this.activeHost.textContent = v === null || v === undefined ? '' : String(v);
      }
    }
    this.inputEl = null;
    this.floatingInputWrapper = null;
    this.activeCell = null;
    this.activeHost = null;
    this.floatingMeta = null;
  }

  private attachInputDebug(input: HTMLInputElement | HTMLTextAreaElement) {
    const events = [
      'keydown',
      'keyup',
      'keypress',
      'input',
      'change',
      'compositionstart',
      'compositionupdate',
      'compositionend'
    ];
    events.forEach((ev) => {
      input.addEventListener(ev, (e) => {
        const ke = e as KeyboardEvent;
        if (ev === 'compositionstart') this.composing = true;
        if (ev === 'compositionend') {
          this.composing = false;
          this.lastCompositionEnd = Date.now();
        }
        // eslint-disable-next-line no-console
        console.log('[extable-input]', ev, {
          key: 'key' in ke ? ke.key : undefined,
          isComposing: 'isComposing' in ke ? ke.isComposing : undefined,
          value: input.value
        });
      });
    });
  }
}
