import type { Command, EditMode, SelectionRange } from './types';
import type { DataModel } from './dataModel';

type EditHandler = (cmd: Command, commit: boolean) => void;
type RowSelectHandler = (rowId: string) => void;
type MoveHandler = (rowId?: string) => void;
type HitTest = (event: MouseEvent) => { rowId: string; colKey: string | number; element?: HTMLElement; rect: DOMRect } | null;
type ActiveChange = (rowId: string | null, colKey: string | number | null) => void;
type ContextMenuHandler = (rowId: string | null, colKey: string | number | null, clientX: number, clientY: number) => void;
type SelectionChange = (ranges: SelectionRange[]) => void;

export class SelectionManager {
  private root: HTMLElement;
  private editMode: EditMode;
  private onEdit: EditHandler;
  private onRowSelect: RowSelectHandler;
  private onMove: MoveHandler;
  private hitTest: HitTest;
  private onContextMenu: ContextMenuHandler;
  private handleDocumentContextMenu: ((ev: MouseEvent) => void) | null = null;
  private debug = true;
  private selectionRanges: SelectionRange[] = [];
  private inputEl: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null = null;
  private floatingInputWrapper: HTMLDivElement | null = null;
  private activeCell: { rowId: string; colKey: string | number } | null = null;
  private activeHost: HTMLElement | null = null;
  private activeHostOriginalText: string | null = null;
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
    private onActiveChange: ActiveChange,
    onContextMenu: ContextMenuHandler,
    private onSelectionChange: SelectionChange
  ) {
    this.root = root;
    this.editMode = editMode;
    this.onEdit = onEdit;
    this.onRowSelect = onRowSelect;
    this.onMove = onMove;
    this.hitTest = hitTest;
    this.onContextMenu = onContextMenu;
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
    if (this.handleDocumentContextMenu) {
      document.removeEventListener('contextmenu', this.handleDocumentContextMenu, true);
    }
    this.teardownInput(true);
  }

  onScroll(scrollTop: number, scrollLeft: number) {
    if (this.floatingInputWrapper && this.floatingMeta) {
      if (this.debug) {
        // eslint-disable-next-line no-console
        console.log('[extable input] onScroll', { scrollTop, scrollLeft });
      }
      this.positionFloating(this.floatingMeta, scrollTop, scrollLeft);
    }
  }

  private bind() {
    this.root.addEventListener('click', this.handleClick);
    this.handleDocumentContextMenu = (ev: MouseEvent) => this.handleContextMenu(ev);
    document.addEventListener('contextmenu', this.handleDocumentContextMenu, { capture: true });
    // eslint-disable-next-line no-console
    console.log('[extable ctx] document contextmenu listener attached');
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
      let datalist = document.getElementById(listId) as HTMLDataListElement | null;
      if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = listId;
        for (const opt of options) {
          const op = document.createElement('option');
          op.value = opt;
          datalist.appendChild(op);
        }
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
    const screenLeft = meta.screenLeft + (meta.scrollLeft0 - scrollLeft);
    const screenTop = meta.screenTop + (meta.scrollTop0 - scrollTop);
    const leftPx = screenLeft;
    const topPx = screenTop;
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log('[extable input] positionFloating', {
        screenLeft,
        screenTop,
        leftPx,
        topPx,
        width: meta.width,
        height: meta.height,
        scrollLeft0: meta.scrollLeft0,
        scrollTop0: meta.scrollTop0,
        scrollLeft,
        scrollTop
      });
    }
    host.style.left = `${leftPx}px`;
    host.style.top = `${topPx}px`;
    host.style.width = `${meta.width}px`;
    host.style.height = `${meta.height}px`;
    host.style.pointerEvents = 'none';
  }

  private handleClick = (ev: MouseEvent) => {
    if (ev.button !== 0) {
      return; // only left click starts edit/selection; right-click is handled by contextmenu
    }
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
    if (hit.rowId === '__all__' && hit.colKey === '__all__') {
      this.teardownInput(false);
      this.activeCell = null;
      this.onActiveChange('__all__', '__all__');
      return;
    }
    this.onRowSelect(hit.rowId);
    this.applySelectionFromHit(ev, hit);
    if (hit.colKey === '__row__' || hit.colKey === '__all__') {
      return;
    }
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

  private handleContextMenu = (ev: MouseEvent) => {
    const target = ev.target as Node | null;
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log('[extable ctx] contextmenu event', {
        inRoot: !!(target && this.root.contains(target)),
        targetTag: (target as HTMLElement | null)?.tagName,
        x: ev.clientX,
        y: ev.clientY,
        ctrl: ev.ctrlKey
      });
    }
    if (ev.ctrlKey) {
      ev.preventDefault();
      return;
    }
    if (!target || !this.root.contains(target)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const hit = this.hitTest(ev);
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log('[extable ctx] hit', hit);
    }
    const rowId = hit?.rowId ?? null;
    const colKey = hit?.colKey ?? null;
    this.onContextMenu(rowId, colKey, ev.clientX, ev.clientY);
  };

  private applySelectionFromHit(ev: MouseEvent, hit: { rowId: string; colKey: string | number }) {
    const schema = this.dataModel.getSchema();
    const rowIdx = this.dataModel.getRowIndex(hit.rowId);
    const colIdx = schema.columns.findIndex((c) => String(c.key) === String(hit.colKey));
    const isRow = hit.colKey === '__row__';
    const targetRange: SelectionRange = isRow
      ? { kind: 'rows', startRow: rowIdx, endRow: rowIdx, startCol: 0, endCol: schema.columns.length - 1 }
      : { kind: 'cells', startRow: rowIdx, endRow: rowIdx, startCol: Math.max(0, colIdx), endCol: Math.max(0, colIdx) };
    let nextRanges: SelectionRange[] = [];
    if (ev.shiftKey && this.activeCell) {
      const anchorRow = this.dataModel.getRowIndex(this.activeCell.rowId);
      const anchorCol = schema.columns.findIndex((c) => String(c.key) === String(this.activeCell!.colKey));
      const anchorRange: SelectionRange = isRow
        ? { kind: 'rows', startRow: anchorRow, endRow: rowIdx, startCol: 0, endCol: schema.columns.length - 1 }
        : {
            kind: 'cells',
            startRow: anchorRow,
            endRow: rowIdx,
            startCol: Math.max(0, anchorCol),
            endCol: Math.max(0, colIdx)
          };
      nextRanges = [anchorRange];
    } else if (ev.metaKey || ev.ctrlKey) {
      nextRanges = [...this.selectionRanges, targetRange];
    } else {
      nextRanges = [targetRange];
    }
    this.selectionRanges = this.mergeRanges(nextRanges);
    const anchorCell =
      targetRange.kind === 'rows'
        ? { rowId: hit.rowId, colKey: schema.columns[0]?.key ?? null }
        : { rowId: hit.rowId, colKey: hit.colKey };
    this.activeCell = anchorCell;
    this.onActiveChange(anchorCell.rowId, anchorCell.colKey);
    this.onSelectionChange(this.selectionRanges);
  }

  private mergeRanges(ranges: SelectionRange[]) {
    const merged: SelectionRange[] = [];
    const sorted = [...ranges].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'rows' ? -1 : 1;
      if (a.startRow !== b.startRow) return a.startRow - b.startRow;
      if (a.startCol !== b.startCol) return a.startCol - b.startCol;
      if (a.endRow !== b.endRow) return a.endRow - b.endRow;
      return a.endCol - b.endCol;
    });
    for (const r of sorted) {
      const last = merged.at(-1);
      if (!last) {
        merged.push({ ...r });
        continue;
      }
      if (last.kind !== r.kind) {
        merged.push({ ...r });
        continue;
      }
      if (r.kind === 'rows') {
        const canMerge =
          last.startCol === r.startCol &&
          last.endCol === r.endCol &&
          last.startRow <= r.endRow + 1 &&
          r.startRow <= last.endRow + 1;
        if (canMerge) {
          last.startRow = Math.min(last.startRow, r.startRow);
          last.endRow = Math.max(last.endRow, r.endRow);
          continue;
        }
      } else {
        const sameCols = last.startCol === r.startCol && last.endCol === r.endCol;
        const sameRows = last.startRow === r.startRow && last.endRow === r.endRow;
        const rowsTouch = last.startRow <= r.endRow + 1 && r.startRow <= last.endRow + 1;
        const colsTouch = last.startCol <= r.endCol + 1 && r.startCol <= last.endCol + 1;
        if (sameCols && rowsTouch) {
          last.startRow = Math.min(last.startRow, r.startRow);
          last.endRow = Math.max(last.endRow, r.endRow);
          continue;
        }
        if (sameRows && colsTouch) {
          last.startCol = Math.min(last.startCol, r.startCol);
          last.endCol = Math.max(last.endCol, r.endCol);
          continue;
        }
      }
      merged.push({ ...r });
    }
    return merged;
  }

  private activateCellElement(cell: HTMLElement, rowId: string, colKey: string | number) {
    this.teardownInput();
    this.activeCell = { rowId, colKey };
    this.activeHost = cell;
    this.activeHostOriginalText = cell.textContent ?? '';
    const current = this.dataModel.getCell(rowId, colKey);
    const initialValue = current === null || current === undefined ? '' : String(current);
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
    this.activeHostOriginalText = null;
    wrapper.style.position = 'fixed';
    wrapper.dataset.extableFloating = 'fixed';
    wrapper.style.pointerEvents = 'auto';
    wrapper.style.padding = '0';
    wrapper.style.zIndex = '2';
    const current = this.dataModel.getCell(rowId, colKey);
    const initialValue = current === null || current === undefined ? '' : String(current);
    const { control, value } = this.createEditor(colKey, initialValue);
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
    const forwardWheel = (e: Event) => {
      const evt = e as WheelEvent;
      e.preventDefault();
      this.root.scrollBy(evt.deltaX, evt.deltaY);
    };
    wrapper.addEventListener('wheel', forwardWheel, { passive: false });
    input.addEventListener('wheel', forwardWheel, { passive: false });
    if (input instanceof HTMLSelectElement) {
      // No auto focus/click for select; standard focus will allow selection on first interaction
    }
    if (input.tagName.toLowerCase() === 'textarea') {
      requestAnimationFrame(() => {
        if (input instanceof HTMLTextAreaElement) this.autosize(input);
      });
    }
    document.body.appendChild(wrapper);
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
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log('[extable input] activateFloating meta', this.floatingMeta);
    }
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
    if (this.activeHost && this.activeHostOriginalText !== null) {
      this.activeHost.textContent = this.activeHostOriginalText;
    }
    this.inputEl = null;
    this.floatingInputWrapper = null;
    this.activeHost = null;
    this.activeHostOriginalText = null;
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
    for (const ev of events) {
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
    }
  }
}
