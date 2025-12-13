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
  private selectionInput: HTMLInputElement | null = null;
  private copyToastEl: HTMLDivElement | null = null;
  private copyToastTimer: number | null = null;
  private selectionMode = true;
  private lastBooleanCell: { rowId: string; colKey: string | number } | null = null;
  private selectionAnchor: { rowIndex: number; colIndex: number } | null = null;
  private activeCell: { rowId: string; colKey: string | number } | null = null;
  private activeHost: HTMLElement | null = null;
  private activeHostOriginalText: string | null = null;
  private floatingMeta: null = null;
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
    this.teardownSelectionInput();
    this.teardownCopyToast();
  }

  onScroll(scrollTop: number, scrollLeft: number) {
    // Editors are positioned in scroll-container content coordinates and follow scroll automatically.
    void scrollTop;
    void scrollLeft;
    this.positionCopyToast();
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

  private ensureCopyToast() {
    if (this.copyToastEl) return this.copyToastEl;
    // Ensure a positioning context for the toast.
    const computed = window.getComputedStyle(this.root);
    if (computed.position === 'static') {
      this.root.style.position = 'relative';
    }
    const toast = document.createElement('div');
    toast.className = 'extable-toast';
    toast.dataset.extableCopyToast = '1';
    toast.setAttribute('popover', 'manual');
    toast.style.position = 'absolute';
    toast.style.left = '0';
    toast.style.top = '0';
    toast.style.pointerEvents = 'none';
    toast.style.zIndex = '1000';
    // Keep it from affecting layout.
    toast.style.margin = '0';
    this.root.appendChild(toast);
    this.copyToastEl = toast;
    return toast;
  }

  private teardownCopyToast() {
    if (this.copyToastTimer) {
      window.clearTimeout(this.copyToastTimer);
      this.copyToastTimer = null;
    }
    if (!this.copyToastEl) return;
    const anyPopover = this.copyToastEl as any;
    if (anyPopover.hidePopover) anyPopover.hidePopover();
    if (this.copyToastEl.parentElement) {
      this.copyToastEl.parentElement.removeChild(this.copyToastEl);
    }
    this.copyToastEl = null;
  }

  private positionCopyToast() {
    if (!this.copyToastEl) return;
    const w = this.copyToastEl.offsetWidth || 0;
    const h = this.copyToastEl.offsetHeight || 0;
    const inset = 16;
    const left = Math.max(0, this.root.scrollLeft + this.root.clientWidth - w - inset);
    const top = Math.max(0, this.root.scrollTop + this.root.clientHeight - h - inset);
    this.copyToastEl.style.left = `${left}px`;
    this.copyToastEl.style.top = `${top}px`;
  }

  private showCopyToast(message: string, variant: 'info' | 'error' = 'info', durationMs = 1200) {
    const toast = this.ensureCopyToast();
    toast.textContent = message;
    toast.dataset.variant = variant;
    const anyPopover = toast as any;
    if (anyPopover.hidePopover) anyPopover.hidePopover();
    if (anyPopover.showPopover) anyPopover.showPopover();
    this.positionCopyToast();
    if (this.copyToastTimer) {
      window.clearTimeout(this.copyToastTimer);
      this.copyToastTimer = null;
    }
    this.copyToastTimer = window.setTimeout(() => {
      if (anyPopover.hidePopover) anyPopover.hidePopover();
    }, durationMs);
  }

  private ensureSelectionInput() {
    if (this.selectionInput) return this.selectionInput;
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.setAttribute('aria-hidden', 'true');
    input.style.position = 'absolute';
    input.style.left = '0';
    input.style.top = '0';
    // Avoid affecting scroll extents in the scroll container.
    input.style.transform = 'translate(-10000px, 0)';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    input.addEventListener('keydown', this.handleSelectionKeydown);
    input.addEventListener('compositionstart', this.handleSelectionCompositionStart);
    input.addEventListener('copy', this.handleSelectionCopy);
    input.addEventListener('cut', this.handleSelectionCut);
    input.addEventListener('paste', this.handleSelectionPaste);
    input.addEventListener('blur', () => this.teardownSelectionInput());
    // Keep the selection input inside the table container (root), but offscreen.
    this.root.appendChild(input);
    this.selectionInput = input;
    return input;
  }

  private focusSelectionInput(valueForSelection: string) {
    const input = this.ensureSelectionInput();
    input.value = valueForSelection;
    this.selectionMode = true;
    input.focus({ preventScroll: true });
    input.select();
  }

  private openEditorAtActiveCell(options?: { initialValueOverride?: string; placeCursorAtEnd?: boolean }) {
    if (!this.activeCell) return;
    const { rowId, colKey } = this.activeCell;
    const cell = this.findHtmlCellElement(rowId, colKey);
    if (cell) {
      this.activateCellElement(cell, rowId, colKey, options);
      return;
    }
    const rect = this.computeCanvasCellRect(rowId, colKey);
    if (rect) {
      this.activateFloating(rect, rowId, colKey, options);
    }
  }

  private findHtmlCellElement(rowId: string, colKey: string | number) {
    const key = String(colKey);
    return (
      this.root.querySelector<HTMLElement>(
        `tr[data-row-id="${CSS.escape(rowId)}"] td[data-col-key="${CSS.escape(key)}"]`
      ) ?? null
    );
  }

  private computeCanvasCellRect(rowId: string, colKey: string | number) {
    const box = this.computeCanvasCellBoxContent(rowId, colKey);
    if (!box) return null;
    const rootRect = this.root.getBoundingClientRect();
    return new DOMRect(
      rootRect.left + box.left - this.root.scrollLeft,
      rootRect.top + box.top - this.root.scrollTop,
      box.width,
      box.height
    );
  }

  private computeCanvasCellBoxContent(rowId: string, colKey: string | number) {
    const canvas = this.root.querySelector<HTMLCanvasElement>('canvas[data-extable-renderer="canvas"]');
    if (!canvas) return null;
    const schema = this.dataModel.getSchema();
    const view = this.dataModel.getView();
    const rows = this.dataModel.listRows();
    const rowIndex = rows.findIndex((r) => r.id === rowId);
    const colIndex = schema.columns.findIndex((c) => String(c.key) === String(colKey));
    if (rowIndex < 0 || colIndex < 0) return null;

    const headerHeight = 24;
    const rowHeaderWidth = 48;
    const defaultRowHeight = 24;
    const colWidths = schema.columns.map((c) => view.columnWidths?.[String(c.key)] ?? c.width ?? 100);

    let left = rowHeaderWidth;
    for (let i = 0; i < colIndex; i += 1) left += colWidths[i] ?? 100;

    let top = headerHeight;
    for (let i = 0; i < rowIndex; i += 1) {
      const h = this.dataModel.getRowHeight(rows[i]!.id) ?? defaultRowHeight;
      top += h;
    }
    const height = this.dataModel.getRowHeight(rowId) ?? defaultRowHeight;
    const width = colWidths[colIndex] ?? 100;
    return { left, top, width, height };
  }

  private ensureVisibleCell(rowId: string, colKey: string | number) {
    const htmlCell = this.findHtmlCellElement(rowId, colKey);
    if (htmlCell) {
      htmlCell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }
    const schema = this.dataModel.getSchema();
    const view = this.dataModel.getView();
    const rows = this.dataModel.listRows();
    const rowIndex = rows.findIndex((r) => r.id === rowId);
    const colIndex = schema.columns.findIndex((c) => String(c.key) === String(colKey));
    if (rowIndex < 0 || colIndex < 0) return;

    const headerHeight = 24;
    const rowHeaderWidth = 48;
    const defaultRowHeight = 24;
    const colWidths = schema.columns.map((c) => view.columnWidths?.[String(c.key)] ?? c.width ?? 100);

    let xStart = rowHeaderWidth;
    for (let i = 0; i < colIndex; i += 1) xStart += colWidths[i] ?? 100;
    const cellW = colWidths[colIndex] ?? 100;
    const xEnd = xStart + cellW;

    let yStart = headerHeight;
    for (let i = 0; i < rowIndex; i += 1) {
      const h = this.dataModel.getRowHeight(rows[i]!.id) ?? defaultRowHeight;
      yStart += h;
    }
    const cellH = this.dataModel.getRowHeight(rowId) ?? defaultRowHeight;
    const yEnd = yStart + cellH;

    const leftVis = this.root.scrollLeft;
    const rightVis = this.root.scrollLeft + this.root.clientWidth;
    const topVis = this.root.scrollTop;
    const bottomVis = this.root.scrollTop + this.root.clientHeight;

    if (xStart < leftVis) this.root.scrollLeft = Math.max(0, xStart);
    else if (xEnd > rightVis) this.root.scrollLeft = Math.max(0, xEnd - this.root.clientWidth);

    if (yStart < topVis) this.root.scrollTop = Math.max(0, yStart);
    else if (yEnd > bottomVis) this.root.scrollTop = Math.max(0, yEnd - this.root.clientHeight);
  }

  private moveActiveCell(deltaRow: number, deltaCol: number, extendSelection = false) {
    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
    if (!rows.length || !schema.columns.length) return;
    const { rowIndex, colIndex } = this.getActiveIndices();
    if (!extendSelection) this.selectionAnchor = null;
    const anchor =
      extendSelection && this.selectionAnchor ? this.selectionAnchor : extendSelection ? { rowIndex, colIndex } : null;
    if (extendSelection && !this.selectionAnchor) this.selectionAnchor = { rowIndex, colIndex };
    const nextRowIndex = Math.max(0, Math.min(rows.length - 1, rowIndex + deltaRow));
    const nextColIndex = Math.max(0, Math.min(schema.columns.length - 1, colIndex + deltaCol));
    const rowId = rows[nextRowIndex]!.id;
    const colKey = schema.columns[nextColIndex]!.key;

    const nextRange: SelectionRange = anchor
      ? {
          kind: 'cells',
          startRow: anchor.rowIndex,
          endRow: nextRowIndex,
          startCol: anchor.colIndex,
          endCol: nextColIndex
        }
      : {
          kind: 'cells',
          startRow: nextRowIndex,
          endRow: nextRowIndex,
          startCol: nextColIndex,
          endCol: nextColIndex
        };
    this.selectionRanges = [nextRange];
    this.activeCell = { rowId, colKey };
    this.onActiveChange(rowId, colKey);
    this.onSelectionChange(this.selectionRanges);
    this.ensureVisibleCell(rowId, colKey);

    const current = this.dataModel.getCell(rowId, colKey);
    const currentText = this.cellToClipboardString(current);
    this.focusSelectionInput(currentText);
  }

  private teardownSelectionInput() {
    if (!this.selectionInput) return;
    this.selectionInput.removeEventListener('keydown', this.handleSelectionKeydown);
    this.selectionInput.removeEventListener('compositionstart', this.handleSelectionCompositionStart);
    this.selectionInput.removeEventListener('copy', this.handleSelectionCopy);
    this.selectionInput.removeEventListener('cut', this.handleSelectionCut);
    this.selectionInput.removeEventListener('paste', this.handleSelectionPaste);
    if (this.selectionInput.parentElement) {
      this.selectionInput.parentElement.removeChild(this.selectionInput);
    }
    this.selectionInput = null;
  }

  private handleSelectionCopy = (ev: ClipboardEvent) => {
    if (!this.selectionMode) return;
    const payload = this.buildSelectionClipboardPayload();
    if (!payload) return;
    ev.preventDefault();
    ev.clipboardData?.setData('text/plain', payload.text);
    ev.clipboardData?.setData('text/tab-separated-values', payload.text);
    ev.clipboardData?.setData('text/html', payload.html);
    this.showCopyToast(`Copied ${payload.cellCount} cells`, 'info');
  };

  private handleSelectionCut = (ev: ClipboardEvent) => {
    if (!this.selectionMode) return;
    const payload = this.buildSelectionClipboardPayload();
    if (!payload) return;
    ev.preventDefault();
    ev.clipboardData?.setData('text/plain', payload.text);
    ev.clipboardData?.setData('text/tab-separated-values', payload.text);
    ev.clipboardData?.setData('text/html', payload.html);
    this.clearSelectionValues();
  };

  private handleSelectionPaste = (ev: ClipboardEvent) => {
    if (!this.selectionMode) return;
    ev.preventDefault();
    const html = ev.clipboardData?.getData('text/html') ?? '';
    const tsv = ev.clipboardData?.getData('text/tab-separated-values') ?? '';
    const text = ev.clipboardData?.getData('text/plain') ?? '';
    const grid = this.parseClipboardGrid({ html, tsv, text });
    if (!grid) return;
    this.applyClipboardGrid(grid);
  };

  private handleSelectionCompositionStart = () => {
    if (!this.selectionMode) return;
    this.selectionMode = false;
    this.teardownSelectionInput();
    this.openEditorAtActiveCell();
  };

  private handleSelectionKeydown = (ev: KeyboardEvent) => {
    if (!this.selectionMode) return;
    if (!this.activeCell) return;
    if (ev.isComposing || this.composing) return;

    // Ignore modifier-only keys in selection mode (do not enter edit mode).
    if (
      ev.key === 'Shift' ||
      ev.key === 'Control' ||
      ev.key === 'Alt' ||
      ev.key === 'Meta' ||
      ev.key === 'CapsLock' ||
      ev.key === 'NumLock' ||
      ev.key === 'ScrollLock'
    ) {
      return;
    }

    const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
    const accel = isMac ? ev.metaKey : ev.ctrlKey;
    if (accel) {
      const key = ev.key.toLowerCase();
      if (key === 'c') {
        ev.preventDefault();
        document.execCommand('copy');
        this.selectionAnchor = null;
        return;
      }
      if (key === 'x') {
        ev.preventDefault();
        document.execCommand('cut');
        this.selectionAnchor = null;
        return;
      }
      if (key === 'v') {
        // Let the paste event fire; it will be handled on the input.
        this.selectionAnchor = null;
        return;
      }
    }

    if (ev.key === ' ') {
      const col = this.findColumn(this.activeCell.colKey);
      if (col?.type === 'boolean') {
        ev.preventDefault();
        this.toggleBoolean(this.activeCell.rowId, this.activeCell.colKey);
      }
      this.selectionAnchor = null;
      return;
    }

    const isTab = ev.key === 'Tab';
    const isEnter = ev.key === 'Enter';
    const isArrow =
      ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'ArrowUp' || ev.key === 'ArrowDown';
    if (isTab || isEnter || isArrow) {
      ev.preventDefault();
      this.teardownSelectionInput();
      if (isTab) {
        this.moveActiveCell(0, ev.shiftKey ? -1 : 1, false);
        return;
      }
      if (isEnter) {
        this.moveActiveCell(ev.shiftKey ? -1 : 1, 0, false);
        return;
      }
      const extend = ev.shiftKey;
      if (ev.key === 'ArrowLeft') this.moveActiveCell(0, -1, extend);
      else if (ev.key === 'ArrowRight') this.moveActiveCell(0, 1, extend);
      else if (ev.key === 'ArrowUp') this.moveActiveCell(-1, 0, extend);
      else if (ev.key === 'ArrowDown') this.moveActiveCell(1, 0, extend);
      return;
    }

    const isPrintable = ev.key.length === 1 && !ev.altKey && !ev.ctrlKey && !ev.metaKey && !ev.repeat;
    this.selectionMode = false;
    this.selectionAnchor = null;
    this.teardownSelectionInput();
    // Let the original keydown insert the character into the now-focused editor naturally.
    this.openEditorAtActiveCell();
  };

  private getActiveIndices() {
    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
    const fallback = { rowIndex: 0, colIndex: 0 };
    if (!this.activeCell) return fallback;
    const rowIndex = rows.findIndex((r) => r.id === this.activeCell!.rowId);
    const colIndex = schema.columns.findIndex((c) => String(c.key) === String(this.activeCell!.colKey));
    return { rowIndex: rowIndex >= 0 ? rowIndex : 0, colIndex: colIndex >= 0 ? colIndex : 0 };
  }

  private normalizeRange(range: SelectionRange): SelectionRange {
    return {
      ...range,
      startRow: Math.min(range.startRow, range.endRow),
      endRow: Math.max(range.startRow, range.endRow),
      startCol: Math.min(range.startCol, range.endCol),
      endCol: Math.max(range.startCol, range.endCol)
    };
  }

  private getCopyRange(): SelectionRange | null {
    const schema = this.dataModel.getSchema();
    if (this.selectionRanges.length > 0) {
      return this.normalizeRange(this.selectionRanges[0]!);
    }
    if (!this.activeCell) return null;
    const rowIdx = this.dataModel.getRowIndex(this.activeCell.rowId);
    const colIdx = schema.columns.findIndex((c) => String(c.key) === String(this.activeCell!.colKey));
    if (rowIdx < 0 || colIdx < 0) return null;
    return { kind: 'cells', startRow: rowIdx, endRow: rowIdx, startCol: colIdx, endCol: colIdx };
  }

  private cellToClipboardString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      const maybe = value as any;
      if (maybe.kind === 'enum' && typeof maybe.value === 'string') return maybe.value;
      if (maybe.kind === 'tags' && Array.isArray(maybe.values)) return maybe.values.join(', ');
    }
    return String(value);
  }

  private escapeHtml(text: string) {
    return text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private buildSelectionClipboardPayload(): { text: string; html: string; cellCount: number } | null {
    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
    const range = this.getCopyRange();
    if (!range) return null;
    if (range.kind !== 'cells') return null;

    const out: string[] = [];
    const htmlRows: string[] = [];
    const tableStyle = 'border-collapse:collapse;border-spacing:0;';
    const cellStyle = 'border:1px solid #d0d7de;padding:4px 6px;vertical-align:top;';
    let cellCount = 0;
    for (let r = range.startRow; r <= range.endRow; r += 1) {
      const row = rows[r];
      if (!row) continue;
      const line: string[] = [];
      const htmlCells: string[] = [];
      for (let c = range.startCol; c <= range.endCol; c += 1) {
        const col = schema.columns[c];
        if (!col) continue;
        const v = this.dataModel.getCell(row.id, col.key);
        const s = this.cellToClipboardString(v);
        line.push(s);
        htmlCells.push(`<td style="${cellStyle}">${this.escapeHtml(s)}</td>`);
        cellCount += 1;
      }
      out.push(line.join('\t'));
      htmlRows.push(`<tr>${htmlCells.join('')}</tr>`);
    }
    const text = out.join('\r\n');
    const html = `<table style="${tableStyle}"><tbody>${htmlRows.join('')}</tbody></table>`;
    return { text, html, cellCount };
  }

  private clearSelectionValues() {
    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
    const range = this.getCopyRange();
    if (!range || range.kind !== 'cells') return;
    const commitNow = this.editMode === 'direct';
    for (let r = range.startRow; r <= range.endRow; r += 1) {
      const row = rows[r];
      if (!row) continue;
      for (let c = range.startCol; c <= range.endCol; c += 1) {
        const col = schema.columns[c];
        if (!col) continue;
        if (this.dataModel.isReadonly(row.id, col.key)) continue;
        const next = col.type === 'boolean' ? false : '';
        const cmd: Command = { kind: 'edit', rowId: row.id, colKey: col.key, next };
        this.onEdit(cmd, commitNow);
      }
    }
  }

  private parseClipboardGrid(payload: { html: string; tsv: string; text: string }): string[][] | null {
    const fromHtml = this.parseHtmlTable(payload.html);
    if (fromHtml) return fromHtml;
    const raw = payload.tsv || payload.text;
    return this.parseTsv(raw);
  }

  private parseTsv(text: string): string[][] | null {
    const trimmed = text.replace(/\r\n$/, '').replace(/\n$/, '');
    if (!trimmed) return null;
    const rows = trimmed.split(/\r\n|\n/);
    return rows.map((r) => r.split('\t'));
  }

  private parseHtmlTable(html: string): string[][] | null {
    if (!html) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const table = doc.querySelector('table');
      if (!table) return null;
      const trs = Array.from(table.querySelectorAll('tr'));
      if (trs.length === 0) return null;
      const grid: string[][] = [];
      for (const tr of trs) {
        const cells = Array.from(tr.querySelectorAll('th,td'));
        if (cells.some((c) => (c as HTMLTableCellElement).rowSpan > 1 || (c as HTMLTableCellElement).colSpan > 1)) {
          return null;
        }
        grid.push(cells.map((c) => (c.textContent ?? '').trim()));
      }
      return grid.length ? grid : null;
    } catch {
      return null;
    }
  }

  private coerceCellValue(raw: string, colKey: string | number): unknown {
    const col = this.findColumn(colKey);
    if (!col) return raw;
    if (raw === '') return '';
    if (col.type === 'number') {
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
    if (col.type === 'boolean') {
      const v = raw.trim().toLowerCase();
      if (v === 'true' || v === '1' || v === 'yes') return true;
      if (v === 'false' || v === '0' || v === 'no') return false;
      return raw;
    }
    return raw;
  }

  private applyClipboardGrid(grid: string[][]) {
    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
    const { rowIndex: startRow, colIndex: startCol } = this.getActiveIndices();
    const commitNow = this.editMode === 'direct';
    for (let r = 0; r < grid.length; r += 1) {
      const row = rows[startRow + r];
      if (!row) break;
      const line = grid[r] ?? [];
      for (let c = 0; c < line.length; c += 1) {
        const col = schema.columns[startCol + c];
        if (!col) break;
        if (this.dataModel.isReadonly(row.id, col.key)) continue;
        const next = this.coerceCellValue(line[c] ?? '', col.key);
        const cmd: Command = { kind: 'edit', rowId: row.id, colKey: col.key, next };
        this.onEdit(cmd, commitNow);
      }
    }
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

  private positionFloatingContentBox(box: { left: number; top: number; width: number; height: number }, wrapper: HTMLDivElement) {
    const inset = 2;
    wrapper.style.left = `${box.left + inset}px`;
    wrapper.style.top = `${box.top + inset}px`;
    wrapper.style.width = `${Math.max(8, box.width - inset * 2)}px`;
    wrapper.style.height = `${Math.max(8, box.height - inset * 2)}px`;
  }

  private handleClick = (ev: MouseEvent) => {
    if (ev.button !== 0) {
      return; // only left click starts edit/selection; right-click is handled by contextmenu
    }
    if (this.inputEl && ev.target && this.inputEl.contains(ev.target as Node)) {
      return;
    }
    if (this.inputEl && this.activeCell) {
      const { rowId, colKey } = this.activeCell;
      const value = this.readActiveValue();
      this.commitEdit(rowId, colKey, value);
      this.onMove(rowId);
      this.teardownInput(false);
    }
    const hit = this.hitTest(ev);
    if (!hit) return;
    const wasSameCell =
      this.selectionMode &&
      !ev.shiftKey &&
      !ev.metaKey &&
      !ev.ctrlKey &&
      this.activeCell?.rowId === hit.rowId &&
      String(this.activeCell?.colKey) === String(hit.colKey);
    if (hit.rowId === '__all__' && hit.colKey === '__all__') {
      this.teardownInput(false);
      this.activeCell = null;
      this.onActiveChange('__all__', '__all__');
      this.selectionAnchor = null;
      return;
    }
    this.onRowSelect(hit.rowId);
    this.applySelectionFromHit(ev, hit);
    if (hit.colKey === '__row__' || hit.colKey === '__all__') {
      return;
    }
    if (this.dataModel.isReadonly(hit.rowId, hit.colKey)) {
      this.selectionMode = true;
      this.selectionAnchor = null;
      this.teardownInput(false);
      this.teardownSelectionInput();
      return;
    }
    const col = this.findColumn(hit.colKey);
    const isBoolean = col?.type === 'boolean';
    if (isBoolean) {
      const isSecondClick =
        this.lastBooleanCell?.rowId === hit.rowId && String(this.lastBooleanCell?.colKey) === String(hit.colKey);
      this.lastBooleanCell = { rowId: hit.rowId, colKey: hit.colKey };
      this.selectionMode = true;
      this.selectionAnchor = null;
      this.teardownInput(false);
      this.teardownSelectionInput();
      if (isSecondClick) {
        this.toggleBoolean(hit.rowId, hit.colKey);
        // Keep focus on the hidden selection input so Space does not scroll the container/page.
        this.focusSelectionInput('');
        return;
      }
      // Keep focus on the hidden selection input so Space can toggle.
      this.focusSelectionInput('');
      return;
    }
    this.lastBooleanCell = null;
    this.selectionAnchor = null;
    this.teardownInput(false);
    const current = this.dataModel.getCell(hit.rowId, hit.colKey);
    const currentText = this.cellToClipboardString(current);
    this.focusSelectionInput(currentText);
    if (wasSameCell) {
      this.selectionMode = false;
      this.teardownSelectionInput();
      this.openEditorAtActiveCell();
    }
  };

  private toggleBoolean(rowId: string, colKey: string | number) {
    const current = this.dataModel.getCell(rowId, colKey);
    const currentBool = current === true || current === 'true' || current === '1' || current === 1;
    const next = !currentBool;
    const cmd: Command = { kind: 'edit', rowId, colKey, next };
    const commitNow = this.editMode === 'direct';
    this.onEdit(cmd, commitNow);
    this.onMove(rowId);
  }

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

  private activateCellElement(
    cell: HTMLElement,
    rowId: string,
    colKey: string | number,
    options?: { initialValueOverride?: string; placeCursorAtEnd?: boolean }
  ) {
    this.teardownInput();
    this.activeCell = { rowId, colKey };
    this.activeHost = cell;
    this.activeHostOriginalText = cell.textContent ?? '';
    const current = this.dataModel.getCell(rowId, colKey);
    const initialValue =
      options?.initialValueOverride ?? (current === null || current === undefined ? '' : String(current));
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
    input.focus({ preventScroll: true });
    if (options?.placeCursorAtEnd && (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
    this.inputEl = input;
  }

  private activateFloating(
    rect: DOMRect,
    rowId: string,
    colKey: string | number,
    options?: { initialValueOverride?: string; placeCursorAtEnd?: boolean }
  ) {
    this.teardownInput();
    this.activeCell = { rowId, colKey };
    void rect;
    const box = this.computeCanvasCellBoxContent(rowId, colKey);
    if (!box) return;
    const wrapper = document.createElement('div');
    this.activeHost = wrapper;
    this.activeHostOriginalText = null;
    wrapper.style.position = 'absolute';
    wrapper.dataset.extableFloating = 'fixed';
    wrapper.style.pointerEvents = 'auto';
    wrapper.style.padding = '0';
    wrapper.style.zIndex = '10';
    const current = this.dataModel.getCell(rowId, colKey);
    const initialValue =
      options?.initialValueOverride ?? (current === null || current === undefined ? '' : String(current));
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
    if (input instanceof HTMLSelectElement) {
      // No auto focus/click for select; standard focus will allow selection on first interaction
    }
    if (input.tagName.toLowerCase() === 'textarea') {
      requestAnimationFrame(() => {
        if (input instanceof HTMLTextAreaElement) this.autosize(input);
      });
    }
    this.root.appendChild(wrapper);
    this.positionFloatingContentBox(box, wrapper);
    input.focus({ preventScroll: true });
    if (options?.placeCursorAtEnd && (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
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
    const isAltEnter = e.key === 'Enter' && e.altKey;
    const commitAndMove = (deltaRow: number, deltaCol: number) => {
      const value = this.readActiveValue();
      this.commitEdit(rowId, colKey, value);
      this.onMove(rowId);
      this.teardownInput(false);
      this.moveActiveCell(deltaRow, deltaCol);
    };

    if (e.key === 'Tab') {
      e.preventDefault();
      commitAndMove(0, e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === 'Enter') {
      if (isTextarea && isAltEnter) {
        // allow newline insertion (Excel-like Alt+Enter)
        return;
      }
      e.preventDefault();
      commitAndMove(e.shiftKey ? -1 : 1, 0);
      return;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelEdit(cell);
      this.onMove();
      if (this.activeCell) {
        const current = this.dataModel.getCell(this.activeCell.rowId, this.activeCell.colKey);
        const currentText = this.cellToClipboardString(current);
        this.focusSelectionInput(currentText);
      }
    } else if (e.key === 'Backspace' && this.inputEl.value === '') {
      e.preventDefault();
      this.commitEdit(rowId, colKey, '');
      this.onMove(rowId);
      this.teardownInput(false);
      this.moveActiveCell(0, 0);
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
