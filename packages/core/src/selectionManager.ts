import type { Command, EditMode } from './types';
import type { DataModel } from './dataModel';

type EditHandler = (cmd: Command, commit: boolean) => void;
type RowSelectHandler = (rowId: string) => void;
type MoveHandler = (rowId?: string) => void;
type HitTest = (event: MouseEvent) => { rowId: string; colKey: string | number; element?: HTMLElement; rect: DOMRect } | null;
type ActiveChange = (rowId: string | null, colKey: string | number | null) => void;

export class SelectionManager {
  private root: HTMLElement;
  private editMode: EditMode;
  private onEdit: EditHandler;
  private onRowSelect: RowSelectHandler;
  private onMove: MoveHandler;
  private hitTest: HitTest;
  private inputEl: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null = null;
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
    private dataModel: DataModel,
    private onActiveChange: ActiveChange
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
    this.teardownInput(true);
  }

  destroy() {
    this.root.removeEventListener('click', this.handleClick);
    this.teardownInput(true);
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
    if (col?.type === 'boolean') {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = initial === 'true' || initial === '1' || initial === 'on';
      return { control: input, value: initial };
    }
    if (col?.type === 'number') {
      const input = document.createElement('input');
      input.type = 'number';
      input.value = initial;
      return { control: input, value: initial };
    }
    if (col?.type === 'date' || col?.type === 'time' || col?.type === 'datetime') {
      const input = document.createElement('input');
      input.type = col.type === 'date' ? 'date' : col.type === 'time' ? 'time' : 'datetime-local';
      input.value = initial;
      return { control: input, value: initial };
    }
    if (col?.type === 'enum' || col?.type === 'tags') {
      const allowCustom = col.enum?.allowCustom ?? col.tags?.allowCustom;
      const options = col.enum?.options ?? col.tags?.options ?? [];
      if (allowCustom === false) {
        const select = document.createElement('select');
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = '';
        select.appendChild(empty);
        for (const opt of options) {
          const op = document.createElement('option');
          op.value = opt;
          op.textContent = opt;
          if (initial === opt) op.selected = true;
          select.appendChild(op);
        }
        return { control: select, value: initial };
      }
      const input = document.createElement('input');
      input.type = 'text';
      const listId = `extable-datalist-${String(colKey)}`;
      input.setAttribute('list', listId);
      input.value = initial;
      const datalist = document.getElementById(listId) ?? document.createElement('datalist');
      datalist.id = listId;
      if (!datalist.childElementCount) {
        options.forEach((opt) => {
          const op = document.createElement('option');
          op.value = opt;
          datalist.appendChild(op);
        });
        document.body.appendChild(datalist);
      }
      return { control: input, value: initial, datalistId: listId };
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
  }

  private handleClick = (ev: MouseEvent) => {
    if (this.inputEl && ev.target && this.inputEl.contains(ev.target as Node)) {
      return;
    }
    if (this.inputEl && this.activeHost) {
      // restore previous cell text if editing was abandoned
      const val = (this.activeHost.dataset && this.activeHost.dataset.value) ?? this.inputEl.value;
      this.activeHost.textContent = val;
      this.teardownInput(false);
    }
    const hit = this.hitTest(ev);
    if (!hit) return;
    this.onRowSelect(hit.rowId);
    this.onActiveChange(hit.rowId, hit.colKey);
    if (this.dataModel.isReadonly(hit.rowId, hit.colKey)) return;
    const col = this.findColumn(hit.colKey);
    const isBoolean = col?.type === 'boolean';
    if (isBoolean) {
      const current = this.dataModel.getCell(hit.rowId, hit.colKey);
      const currentBool = current === true || current === 'true' || current === '1' || current === 1;
      const next = !currentBool;
      const cmd: Command = { kind: 'edit', rowId: hit.rowId, colKey: hit.colKey, next };
      const commitNow = this.editMode === 'direct';
      this.onEdit(cmd, commitNow);
      this.onMove(hit.rowId);
      return;
    }
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
    input.style.width = 'calc(100% - 4px)';
    input.style.boxSizing = 'border-box';
    input.style.margin = '2px';
    input.style.padding = '4px 6px';
    input.style.border = 'none';
    input.style.borderRadius = '0';
    input.style.boxShadow = 'none';
    input.style.background = '#fff';
    input.style.outline = 'none';
    input.style.fontSize = '14px';
    input.style.fontFamily = 'inherit';
    input.style.lineHeight = '1.2';
    input.style.fontWeight = 'inherit';
    const col = this.findColumn(colKey);
    input.style.textAlign = col?.format?.align ?? (col?.type === 'number' ? 'right' : 'left');
    input.addEventListener('keydown', (e) => this.handleKey(e as KeyboardEvent, cell));
    input.addEventListener('focus', () => {
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) input.select();
    });
    this.bindImmediateCommit(input, cell);
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) this.attachInputDebug(input);
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
    wrapper.style.padding = '0';
    wrapper.style.zIndex = '2';
    const current = this.dataModel.getCell(rowId, colKey);
    const { control, value } = this.createEditor(colKey, current === null || current === undefined ? '' : String(current));
    const input = control;
    input.value = value;
    input.style.width = 'calc(100% - 4px)';
    input.style.height = 'calc(100% - 4px)';
    input.style.boxSizing = 'border-box';
    input.style.margin = '2px';
    input.style.padding = '4px 6px';
    input.style.border = 'none';
    input.style.borderRadius = '0';
    input.style.boxShadow = 'none';
    input.style.background = '#fff';
    input.style.outline = 'none';
    input.style.fontSize = '14px';
    input.style.fontFamily = 'inherit';
    input.style.lineHeight = '1.2';
    input.style.fontWeight = 'inherit';
    const col = this.findColumn(colKey);
    input.style.textAlign = col?.format?.align ?? (col?.type === 'number' ? 'right' : 'left');
    input.style.pointerEvents = 'auto';
    input.addEventListener('keydown', (e) => this.handleKey(e as KeyboardEvent, wrapper));
    input.addEventListener('focus', () => {
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) input.select();
    });
    this.bindImmediateCommit(input, wrapper);
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) this.attachInputDebug(input);
    wrapper.appendChild(input);
    if (input instanceof HTMLSelectElement) {
      // No auto focus/click for select; standard focus will allow selection on first interaction
    }
    if (input.tagName.toLowerCase() === 'textarea') {
      requestAnimationFrame(() => {
        if (input instanceof HTMLTextAreaElement) this.autosize(input);
      });
    }
    this.root.appendChild(wrapper);
    const rootRect = this.root.getBoundingClientRect();
    const inset = 2;
    this.floatingMeta = {
      screenLeft: rect.left + inset,
      screenTop: rect.top + inset,
      width: Math.max(8, rect.width - inset * 2),
      height: Math.max(8, rect.height - inset * 2),
      scrollLeft0: this.root.scrollLeft,
      scrollTop0: this.root.scrollTop
    };
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
      const value = this.readActiveValue();
      this.commitEdit(rowId, colKey, value);
      this.onMove(rowId);
      this.teardownInput(false);
    } else if (isTextarea && e.key === 'Enter') {
      if (isAltEnter) {
        // allow newline insertion
        return;
      }
      e.preventDefault();
      const value = this.readActiveValue();
      this.commitEdit(rowId, colKey, value);
      this.onMove(rowId);
      this.teardownInput(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelEdit(cell);
      this.onMove();
    } else if (e.key === 'Backspace' && this.inputEl.value === '') {
      e.preventDefault();
      this.commitEdit(rowId, colKey, '');
      this.onMove(rowId);
      this.teardownInput(false);
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

  private readActiveValue() {
    if (!this.inputEl || !this.activeCell) return this.inputEl?.value ?? '';
    if (this.inputEl instanceof HTMLInputElement) {
      if (this.inputEl.type === 'checkbox') {
        return this.inputEl.checked;
      }
      if (this.inputEl.type === 'number') {
        if (this.inputEl.value === '') return '';
        const parsed = Number(this.inputEl.value);
        return Number.isNaN(parsed) ? '' : parsed;
      }
      return this.inputEl.value;
    }
    if (this.inputEl instanceof HTMLSelectElement) {
      return this.inputEl.value;
    }
    return (this.inputEl as HTMLTextAreaElement).value;
  }

  private bindImmediateCommit(control: HTMLElement, host: HTMLElement) {
    if (!this.activeCell) return;
    const isInstant =
      control instanceof HTMLInputElement
        ? control.type === 'checkbox' || control.type === 'number' || control.type === 'date' || control.type === 'time' || control.type === 'datetime-local'
        : control instanceof HTMLSelectElement;
    if (!isInstant) return;
    control.addEventListener('change', () => {
      const { rowId, colKey } = this.activeCell!;
      const value = this.readActiveValue();
      this.commitEdit(rowId, colKey, value);
      this.onMove(rowId);
      this.teardownInput(false);
    });
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
    this.teardownInput(false);
    if (cell.dataset?.original !== undefined || cell.dataset?.value !== undefined) {
      cell.textContent = cell.dataset.original ?? cell.dataset.value ?? '';
    }
    cell.blur();
  }

  private teardownInput(clearActive = false) {
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
    this.activeHost = null;
    this.floatingMeta = null;
    if (clearActive) {
      this.activeCell = null;
      this.onActiveChange(null, null);
    }
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
