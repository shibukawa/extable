import type { CellAction, Command, EditMode, LookupCandidate, SelectionRange } from "./types";
import type { DataModel } from "./dataModel";
import {
  coerceNumericForColumn,
  formatIntegerWithPrefix,
  formatNumberForEdit,
  normalizeNumericInput,
  parseNumericText,
} from "./numberIO";
import {
  FILL_HANDLE_HIT_SIZE_PX,
  getFillHandleRect,
  getFillHandleSource,
  isPointInRect,
  makeFillValueGetter,
  shouldShowFillHandle,
} from "./fillHandle";
import { removeFromParent } from "./utils";
import {
  DEFAULT_ROW_HEIGHT_PX,
  HEADER_HEIGHT_PX,
  ROW_HEADER_WIDTH_PX,
  CELL_PADDING_X_PX,
  CELL_PADDING_TOP_PX,
  CELL_PADDING_BOTTOM_PX,
  getColumnWidths,
} from "./geometry";
import { resolveButtonAction, resolveLinkAction } from "./actionValue";

type EditHandler = (cmd: Command, commit: boolean) => void;
type RowSelectHandler = (rowId: string) => void;
type MoveHandler = (rowId?: string) => void;
type HitTest = (
  event: MouseEvent,
) => { rowId: string; colKey: string | null; element?: HTMLElement; rect: DOMRect } | null;
type ActionHitTest = (
  event: MouseEvent,
) =>
  | { rowId: string; colKey: string; kind: "button" | "link" }
  | { rowId: string; colKey: string; kind: "tag-remove"; tagIndex: number }
  | null;
type ActiveChange = (rowId: string | null, colKey: string | null) => void;
type ContextMenuHandler = (
  rowId: string | null,
  colKey: string | null,
  clientX: number,
  clientY: number,
) => void;
type SelectionChange = (ranges: SelectionRange[]) => void;
type UndoRedoHandler = () => void;
type ActionHandler = (action: CellAction) => void;

export class SelectionManager {
  private root: HTMLElement;
  private editMode: EditMode;
  private onEdit: EditHandler;
  private onRowSelect: RowSelectHandler;
  private onMove: MoveHandler;
  private hitTest: HitTest;
  private hitAction: ActionHitTest | null = null;
  private onContextMenu: ContextMenuHandler;
  private handleDocumentContextMenu: ((ev: MouseEvent) => void) | null = null;
  private selectionRanges: SelectionRange[] = [];
  private inputEl: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null = null;
  private floatingInputWrapper: HTMLDivElement | null = null;
  private selectionInput: HTMLInputElement | null = null;
  private copyToastEl: HTMLDivElement | null = null;
  private copyToastTimer: number | null = null;

  private lookupDropdownEl: HTMLDivElement | null = null;
  private lookupDropdownTarget: { rowId: string; colKey: string } | null = null;
  private lookupCandidates: readonly LookupCandidate[] = [];
  private lookupHighlightIndex = -1;
  private lookupRequestId = 0;
  private lookupAbort: AbortController | null = null;
  private lookupDebounceTimer: number | null = null;
  private lookupInputCleanup: (() => void) | null = null;

  private hoverTooltipEl: HTMLDivElement | null = null;
  private hoverTooltipTarget: { rowId: string; colKey: string } | null = null;
  private hoverTooltipMessage: string | null = null;
  private hoverTooltipRequestId = 0;
  private hoverTooltipAbort: AbortController | null = null;

  private externalEditInFlight = false;
  private externalEditRequestId = 0;
  private selectionMode = true;
  private lastBooleanCell: { rowId: string; colKey: string } | null = null;
  private selectionAnchor: { rowIndex: number; colIndex: number } | null = null;
  private dragging = false;
  private dragStart: { rowIndex: number; colIndex: number; kind: "cells" | "rows" } | null = null;
  private pointerDownClient: { x: number; y: number } | null = null;
  private dragMoved = false;
  private dragSelectionChanged = false;
  private suppressNextClick = false;
  private fillDragging = false;
  private fillSource: import("./fillHandle").FillHandleSource | null = null;
  private fillEndRowIndex: number | null = null;
  private rootCursorBackup: string | null = null;
  private lastPointerClient: { x: number; y: number } | null = null;
  private autoScrollRaf: number | null = null;
  private autoScrollActive = false;
  private activeCell: { rowId: string; colKey: string | null } | null = null;
  private activeHost: HTMLElement | null = null;
  private activeHostOriginalText: string | null = null;
  private activeOriginalValue: { rowId: string; colKey: string; value: unknown } | null = null;
  private composing = false;
  private lastCompositionEnd = 0;
  private readonly handleInputCompositionStart = () => {
    this.composing = true;
  };
  private readonly handleInputCompositionEnd = () => {
    this.composing = false;
    this.lastCompositionEnd = Date.now();
  };
  private readonly handleSelectionBlur = () => this.teardownSelectionInput();
  private readonly handleRootKeydown = async (ev: KeyboardEvent) => {
    if (ev.defaultPrevented) return;
    if (!this.selectionMode) return;
    if (this.inputEl) return;
    if (ev.isComposing || this.composing) return;
    const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
    const accel = isMac ? ev.metaKey : ev.ctrlKey;
    if (!accel) return;
    const key = ev.key.toLowerCase();
    if (key === "c") {
      ev.preventDefault();
      await this.copySelection();
    } else if (key === "x") {
      ev.preventDefault();
      await this.copySelection();
      this.clearSelectionValues();
    }
  };
  private isCellReadonly: (rowId: string, colKey: string) => boolean;
  private sequenceLangs?: readonly string[];
  private onCellAction: ActionHandler;

  constructor(
    root: HTMLElement,
    editMode: EditMode,
    onEdit: EditHandler,
    onRowSelect: RowSelectHandler,
    onMove: MoveHandler,
    hitTest: HitTest,
    hitAction: ActionHitTest | null,
    private dataModel: DataModel,
    sequenceLangs: readonly string[] | undefined,
    isCellReadonly: (rowId: string, colKey: string) => boolean,
    onCellAction: ActionHandler,
    private onActiveChange: ActiveChange,
    onContextMenu: ContextMenuHandler,
    private onSelectionChange: SelectionChange,
    private onUndo: UndoRedoHandler,
    private onRedo: UndoRedoHandler,
  ) {
    this.root = root;
    this.editMode = editMode;
    this.onEdit = onEdit;
    this.onRowSelect = onRowSelect;
    this.onMove = onMove;
    this.hitTest = hitTest;
    this.hitAction = hitAction;
    this.sequenceLangs = sequenceLangs;
    this.isCellReadonly = isCellReadonly;
    this.onCellAction = onCellAction;
    this.onContextMenu = onContextMenu;
    this.bind();
  }

  setEditMode(mode: EditMode) {
    this.editMode = mode;
  }

  syncAfterRowsChanged() {
    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
    if (!rows.length || !schema.columns.length) {
      this.selectionRanges = [];
      this.activeCell = null;
      this.selectionAnchor = null;
      this.lastBooleanCell = null;
      this.teardownInput(true);
      this.onActiveChange(null, null);
      this.onSelectionChange(this.selectionRanges);
      this.updateFillHandleFlag();
      return;
    }

    const maxRow = rows.length - 1;
    const maxCol = schema.columns.length - 1;

    const activeRowId = this.activeCell?.rowId ?? null;
    const activeColKey = this.activeCell?.colKey ?? null;
    const activeRowIndex = activeRowId ? this.dataModel.getRowIndex(activeRowId) : -1;
    const activeColIndex =
      activeColKey !== null
        ? schema.columns.findIndex((c) => String(c.key) === String(activeColKey))
        : -1;

    // If current active cell is still visible, just clamp selection ranges when needed.
    if (activeRowIndex >= 0 && activeColIndex >= 0) {
      let changed = false;
      if (!this.selectionRanges.length) {
        this.selectionRanges = [
          {
            kind: "cells",
            startRow: activeRowIndex,
            endRow: activeRowIndex,
            startCol: activeColIndex,
            endCol: activeColIndex,
          },
        ];
        changed = true;
      } else {
        const nextRanges: SelectionRange[] = this.selectionRanges.map((r) => {
          const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n));
          const next: SelectionRange = {
            ...r,
            startRow: clamp(r.startRow, maxRow),
            endRow: clamp(r.endRow, maxRow),
            startCol: clamp(r.startCol, maxCol),
            endCol: clamp(r.endCol, maxCol),
          };
          if (
            next.startRow !== r.startRow ||
            next.endRow !== r.endRow ||
            next.startCol !== r.startCol ||
            next.endCol !== r.endCol
          ) {
            changed = true;
          }
          return next;
        });
        this.selectionRanges = nextRanges;
      }
      if (changed) this.onSelectionChange(this.selectionRanges);
      this.updateFillHandleFlag();
      return;
    }

    // Active row got filtered out (or active col disappeared): move to the nearest visible row/col.
    const desiredColKey = activeColKey ?? schema.columns[0]?.key ?? "";
    let colIndex = schema.columns.findIndex((c) => String(c.key) === String(desiredColKey));
    if (colIndex < 0) colIndex = 0;
    const colKey = schema.columns[colIndex]?.key ?? "";

    const baseIndex = activeRowId ? this.dataModel.getBaseRowIndex(activeRowId) : 0;
    const fallbackRow = rows[rows.length - 1] ?? rows[0] ?? null;
    const nextRow =
      rows.find((r) => this.dataModel.getBaseRowIndex(r.id) >= baseIndex) ?? fallbackRow;
    if (!nextRow) return;
    const rowId = nextRow.id;
    const rowIndex = this.dataModel.getRowIndex(rowId);

    this.selectionAnchor = null;
    this.lastBooleanCell = null;
    this.teardownInput(false);
    this.selectionRanges = [
      {
        kind: "cells",
        startRow: rowIndex,
        endRow: rowIndex,
        startCol: colIndex,
        endCol: colIndex,
      },
    ];
    this.activeCell = { rowId, colKey };
    this.onActiveChange(rowId, colKey);
    this.onSelectionChange(this.selectionRanges);
    this.ensureVisibleCell(rowId, colKey);
    const current = this.dataModel.getCell(rowId, colKey);
    this.focusSelectionInput(this.cellToClipboardString(current));
    this.updateFillHandleFlag();
  }

  navigateToCell(rowId: string, colKey: string) {
    const schema = this.dataModel.getSchema();
    const rowIndex = this.dataModel.getRowIndex(rowId);
    const colIndex = schema.columns.findIndex((c) => String(c.key) === String(colKey));
    if (rowIndex < 0 || colIndex < 0) return;
    this.selectionAnchor = null;
    this.lastBooleanCell = null;
    this.teardownInput(false);
    const nextRange: SelectionRange = {
      kind: "cells",
      startRow: rowIndex,
      endRow: rowIndex,
      startCol: colIndex,
      endCol: colIndex,
    };
    this.selectionRanges = [nextRange];
    this.activeCell = { rowId, colKey };
    this.onActiveChange(rowId, colKey);
    this.onSelectionChange(this.selectionRanges);
    this.ensureVisibleCell(rowId, colKey);
    const current = this.dataModel.getCell(rowId, colKey);
    this.focusSelectionInput(this.cellToClipboardString(current));
    this.updateFillHandleFlag();
  }

  cancelEditing() {
    this.teardownInput(true);
  }

  destroy() {
    this.root.removeEventListener("click", this.handleClick);
    this.root.removeEventListener("pointerdown", this.handlePointerDown);
    this.root.removeEventListener("pointermove", this.handlePointerMove);
    this.root.removeEventListener("pointerup", this.handlePointerUp);
    this.root.removeEventListener("pointercancel", this.handlePointerUp);
    this.root.removeEventListener("pointerleave", this.handlePointerLeave);
    this.root.removeEventListener("keydown", this.handleRootKeydown);
    if (this.handleDocumentContextMenu) {
      document.removeEventListener("contextmenu", this.handleDocumentContextMenu, true);
    }
    this.teardownInput(true);
    this.teardownSelectionInput();
    this.teardownCopyToast();
    removeFromParent(this.lookupDropdownEl);
    this.lookupDropdownEl = null;
    this.hideHoverTooltip();
    this.teardownHoverTooltip();
    this.stopAutoScroll();
  }

  onScroll(scrollTop: number, scrollLeft: number) {
    // Editors are positioned in scroll-container content coordinates and follow scroll automatically.
    void scrollTop;
    void scrollLeft;
    this.positionCopyToast();
    this.refreshHoverTooltipPosition();
    this.refreshLookupDropdownPosition();
  }

  private bind() {
    this.root.addEventListener("click", this.handleClick);
    this.root.addEventListener("pointerdown", this.handlePointerDown);
    this.root.addEventListener("pointermove", this.handlePointerMove);
    this.root.addEventListener("pointerup", this.handlePointerUp);
    this.root.addEventListener("pointercancel", this.handlePointerUp);
    this.root.addEventListener("pointerleave", this.handlePointerLeave);
    this.root.addEventListener("keydown", this.handleRootKeydown);
    this.handleDocumentContextMenu = (ev: MouseEvent) => this.handleContextMenu(ev);
    document.addEventListener("contextmenu", this.handleDocumentContextMenu, { capture: true });
  }

  private updateFillHandleFlag() {
    const activeColKey = this.activeCell?.colKey ?? null;
    const activeRowId = this.activeCell?.rowId ?? null;
    this.root.dataset.extableFillHandle = shouldShowFillHandle(
      this.dataModel,
      this.selectionRanges,
      activeRowId,
      activeColKey,
      this.editMode,
    )
      ? "1"
      : "";
  }

  private findColumn(colKey: string) {
    const schema = this.dataModel.getSchema();
    return schema.columns.find((c) => c.key === colKey);
  }

  private pad2(n: number) {
    return String(n).padStart(2, "0");
  }

  private formatLocalDateForInput(d: Date) {
    return `${d.getFullYear()}-${this.pad2(d.getMonth() + 1)}-${this.pad2(d.getDate())}`;
  }

  private formatLocalTimeForInput(d: Date) {
    return `${this.pad2(d.getHours())}:${this.pad2(d.getMinutes())}`;
  }

  private formatLocalDateTimeForInput(d: Date) {
    return `${this.formatLocalDateForInput(d)}T${this.formatLocalTimeForInput(d)}`;
  }

  private normalizeTemporalInitialValue(colType: "date" | "time" | "datetime", initial: string) {
    const value = initial.trim();
    if (!value) return "";

    if (colType === "date") {
      const m = value.match(/^(\d{4}-\d{2}-\d{2})/);
      if (m) return m[1] ?? "";
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return this.formatLocalDateForInput(d);
      return "";
    }

    if (colType === "time") {
      const m = value.match(/(\d{2}:\d{2})(?::\d{2})?/);
      if (m) return m[1] ?? "";
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) return this.formatLocalTimeForInput(d);
      return "";
    }

    // datetime => input[type="datetime-local"] expects "YYYY-MM-DDTHH:mm" (no timezone).
    if (/Z$/.test(value) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      return value.replace(/Z$/, "").slice(0, 16);
    }
    if (
      /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}/.test(value) &&
      !/[+-]\d{2}:\d{2}$/.test(value)
    ) {
      return value.slice(0, 16);
    }
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return this.formatLocalDateTimeForInput(d);
    return "";
  }

  private ensureCopyToast() {
    if (this.copyToastEl) return this.copyToastEl;
    // Ensure a positioning context for the toast.
    const computed = window.getComputedStyle(this.root);
    if (computed.position === "static") {
      this.root.style.position = "relative";
    }
    const toast = document.createElement("div");
    toast.className = "extable-toast";
    toast.dataset.extableCopyToast = "1";
    toast.style.position = "absolute";
    toast.style.left = "0";
    toast.style.top = "0";
    toast.style.pointerEvents = "none";
    toast.style.zIndex = "1000";
    toast.style.display = "none";
    // Keep it from affecting layout.
    toast.style.margin = "0";
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
    this.copyToastEl.style.display = "none";
    removeFromParent(this.copyToastEl);
    this.copyToastEl = null;
  }

  private positionCopyToast() {
    if (!this.copyToastEl) return;
    const w = this.copyToastEl.offsetWidth || 0;
    const h = this.copyToastEl.offsetHeight || 0;
    const inset = 16;
    const maxLeft = Math.max(0, this.root.scrollLeft + this.root.clientWidth - w - inset);
    const maxTop = Math.max(0, this.root.scrollTop + this.root.clientHeight - h - inset);
    const minLeft = Math.max(0, this.root.scrollLeft + inset);
    const minTop = Math.max(0, this.root.scrollTop + inset);
    const rootRect = this.root.getBoundingClientRect();
    const rect = this.getActiveCellRect();
    if (rect) {
      const candidateLeft = rect.right - rootRect.left + this.root.scrollLeft - w + 8;
      const candidateTop = rect.top - rootRect.top + this.root.scrollTop - h + 8;
      const left = Math.min(maxLeft, Math.max(minLeft, candidateLeft));
      const top = Math.min(maxTop, Math.max(minTop, candidateTop));
      this.copyToastEl.style.left = `${left}px`;
      this.copyToastEl.style.top = `${top}px`;
      return;
    }
    this.copyToastEl.style.left = `${maxLeft}px`;
    this.copyToastEl.style.top = `${maxTop}px`;
  }

  private showCopyToast(message: string, variant: "info" | "error" = "info", durationMs = 1200) {
    const toast = this.ensureCopyToast();
    toast.textContent = message;
    toast.dataset.variant = variant;
    toast.style.display = "block";
    this.positionCopyToast();
    if (this.copyToastTimer) {
      window.clearTimeout(this.copyToastTimer);
      this.copyToastTimer = null;
    }
    this.copyToastTimer = window.setTimeout(() => {
      toast.style.display = "none";
    }, durationMs);
  }

  private ensureHoverTooltip() {
    if (this.hoverTooltipEl) return this.hoverTooltipEl;
    // Ensure a positioning context.
    const computed = window.getComputedStyle(this.root);
    if (computed.position === "static") {
      this.root.style.position = "relative";
    }
    const tip = document.createElement("div");
    tip.className = "extable-tooltip";
    tip.dataset.visible = "0";
    tip.style.position = "absolute";
    tip.style.left = "0";
    tip.style.top = "0";
    tip.style.pointerEvents = "none";
    tip.style.zIndex = "1000";
    this.root.appendChild(tip);
    this.hoverTooltipEl = tip;
    return tip;
  }

  private teardownHoverTooltip() {
    this.hoverTooltipAbort?.abort();
    this.hoverTooltipAbort = null;
    this.hoverTooltipRequestId += 1;
    this.hoverTooltipTarget = null;
    this.hoverTooltipMessage = null;
    removeFromParent(this.hoverTooltipEl);
    this.hoverTooltipEl = null;
  }

  private hideHoverTooltip() {
    if (this.hoverTooltipEl) this.hoverTooltipEl.dataset.visible = "0";
    this.hoverTooltipTarget = null;
    this.hoverTooltipMessage = null;
    this.hoverTooltipAbort?.abort();
    this.hoverTooltipAbort = null;
    this.hoverTooltipRequestId += 1;
  }

  private getCellRect(rowId: string, colKey: string): DOMRect | null {
    const cell = this.findHtmlCellElement(rowId, colKey);
    if (cell) return cell.getBoundingClientRect();
    return this.computeCanvasCellRect(rowId, colKey);
  }

  private positionTooltipAtRect(rect: DOMRect) {
    const tip = this.hoverTooltipEl;
    if (!tip) return;
    const pad = 8;
    const rootRect = this.root.getBoundingClientRect();
    const maxW = this.root.clientWidth;
    const maxH = this.root.clientHeight;
    let left = rect.right - rootRect.left + pad;
    let top = rect.top - rootRect.top + pad;
    let side: "right" | "left" = "right";
    const tRect = tip.getBoundingClientRect();
    if (left + tRect.width > maxW) {
      left = Math.max(0, rect.left - rootRect.left - tRect.width - pad);
      side = "left";
    }
    if (top + tRect.height > maxH) top = Math.max(0, maxH - tRect.height - pad);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.dataset.side = side;
  }

  private refreshHoverTooltipPosition() {
    const tip = this.hoverTooltipEl;
    if (!tip || tip.dataset.visible !== "1") return;
    if (!this.hoverTooltipTarget || !this.hoverTooltipMessage) return;
    const rect = this.getCellRect(this.hoverTooltipTarget.rowId, this.hoverTooltipTarget.colKey);
    if (!rect) {
      this.hideHoverTooltip();
      return;
    }
    tip.textContent = this.hoverTooltipMessage;
    this.positionTooltipAtRect(rect);
  }

  private updateHoverTooltip(ev: PointerEvent) {
    if (this.inputEl) {
      this.hideHoverTooltip();
      return;
    }
    const hit = this.hitTest(ev as unknown as MouseEvent);
    if (!hit || hit.colKey === null || hit.colKey === "__all__" || hit.rowId === "__header__") {
      this.hideHoverTooltip();
      return;
    }
    const colKey = String(hit.colKey);
    const rowId = hit.rowId;
    // Keep existing marker tooltips (HTML: CSS, Canvas: renderer).
    const marker = this.dataModel.getCellMarker(rowId, colKey);
    if (marker) {
      this.hideHoverTooltip();
      return;
    }
    const col = this.findColumn(colKey);
    const getText = col?.tooltip?.getText;
    if (!getText) {
      this.hideHoverTooltip();
      return;
    }

    const sameTarget =
      this.hoverTooltipTarget?.rowId === rowId && this.hoverTooltipTarget?.colKey === colKey;
    if (sameTarget && this.hoverTooltipMessage) {
      const tip = this.ensureHoverTooltip();
      tip.textContent = this.hoverTooltipMessage;
      this.positionTooltipAtRect(hit.rect);
      tip.dataset.visible = "1";
      return;
    }

    this.hoverTooltipAbort?.abort();
    const controller = new AbortController();
    this.hoverTooltipAbort = controller;
    const requestId = (this.hoverTooltipRequestId += 1);
    this.hoverTooltipTarget = { rowId, colKey };
    this.hoverTooltipMessage = null;
    const value = this.dataModel.getCell(rowId, colKey);

    const applyText = (text: string | null) => {
      if (requestId !== this.hoverTooltipRequestId) return;
      if (controller.signal.aborted) return;
      if (!text) {
        this.hideHoverTooltip();
        return;
      }
      const tip = this.ensureHoverTooltip();
      this.hoverTooltipMessage = text;
      tip.textContent = text;
      this.positionTooltipAtRect(hit.rect);
      tip.dataset.visible = "1";
    };

    try {
      const res = getText({ rowId, colKey, value, signal: controller.signal });
      if (res && typeof (res as Promise<unknown>).then === "function") {
        void (res as Promise<string | null>).then(applyText).catch((err) => {
          if (requestId !== this.hoverTooltipRequestId) return;
          if (controller.signal.aborted) return;
          void err;
          this.hideHoverTooltip();
          this.showCopyToast("Tooltip failed", "error", 1800);
        });
      } else {
        applyText(res as string | null);
      }
    } catch (err) {
      void err;
      this.hideHoverTooltip();
      this.showCopyToast("Tooltip failed", "error", 1800);
    }
  }

  private ensureLookupDropdown() {
    if (this.lookupDropdownEl) {
      return this.lookupDropdownEl;
    }
    const computed = window.getComputedStyle(this.root);
    if (computed.position === "static") {
      this.root.style.position = "relative";
    }
    const el = document.createElement("div");
    el.className = "extable-lookup-dropdown";
    el.dataset.visible = "0";
    el.style.position = "absolute";
    el.style.left = "0";
    el.style.top = "0";
    el.style.zIndex = "1001";
    el.style.display = "none";
    el.style.pointerEvents = "auto";
    this.root.appendChild(el);
    this.lookupDropdownEl = el;
    return el;
  }

  private hideLookupDropdown() {
    const el = this.lookupDropdownEl;
    if (!el) return;
    el.dataset.visible = "0";
    el.style.display = "none";
    el.replaceChildren();
    this.lookupCandidates = [];
    this.lookupHighlightIndex = -1;
  }

  private refreshLookupDropdownPosition() {
    const el = this.lookupDropdownEl;
    if (!el || el.dataset.visible !== "1") return;
    const target = this.lookupDropdownTarget;
    if (!target) {
      this.hideLookupDropdown();
      return;
    }
    const rect = this.getCellRect(target.rowId, target.colKey);
    if (!rect) {
      this.hideLookupDropdown();
      return;
    }
    const rootRect = this.root.getBoundingClientRect();
    el.style.left = `${rect.left - rootRect.left}px`;
    el.style.top = `${rect.bottom - rootRect.top + 2}px`;
    el.style.minWidth = `${Math.max(120, rect.width)}px`;
  }

  private renderLookupDropdown() {
    const el = this.ensureLookupDropdown();
    const items = this.lookupCandidates;
    if (!items.length || !this.lookupDropdownTarget) {
      this.hideLookupDropdown();
      return;
    }
    el.replaceChildren();
    items.forEach((c, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "extable-lookup-option";
      btn.dataset.index = String(index);
      btn.dataset.active = index === this.lookupHighlightIndex ? "1" : "0";
      btn.textContent = c.label;
      btn.style.pointerEvents = "auto";
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        this.commitLookupCandidate(index);
      });
      el.appendChild(btn);
    });
    el.dataset.visible = "1";
    el.style.display = "block";
    el.style.zIndex = "1001";
    el.style.pointerEvents = "auto";
    this.refreshLookupDropdownPosition();
  }

  private commitLookupCandidate(index: number) {
    const target = this.lookupDropdownTarget;
    if (!target) {
      return;
    }
    const col = this.findColumn(target.colKey);
    const hook = col?.edit?.lookup;
    if (!hook) {
      return;
    }
    const candidate = this.lookupCandidates[index];
    if (!candidate) {
      return;
    }
    const stored = hook.toStoredValue
      ? hook.toStoredValue(candidate)
      : col?.type === "labeled"
        ? { label: candidate.label, value: candidate.value }
        : { kind: "lookup", label: candidate.label, value: candidate.value, meta: candidate.meta };
    // Hide lookup dropdown before teardown to prevent input event interference
    this.hideLookupDropdown();
    // Teardown current input editor
    this.teardownInput(false);
    // Commit edit to data model
    this.commitEdit(target.rowId, target.colKey, stored);
    // Notify listeners of move
    this.onMove(target.rowId);
    // Delay focusSelectionInput to ensure all synchronous processing (including external render) completes first
    requestAnimationFrame(() => {
      // Verify we're still on the same cell
      if (this.activeCell?.rowId === target.rowId && this.activeCell?.colKey === target.colKey) {
        // Show the committed label, not the partial input text
        this.focusSelectionInput(candidate.label);
      } else {
      }
    });
  }

  private setupLookupEditor(
    rowId: string,
    colKey: string,
    input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  ) {
    this.teardownLookupEditor();
    const col = this.findColumn(colKey);
    const hook = col?.edit?.lookup;
    if (!hook) {
      return;
    }
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
      return;
    }

    this.lookupDropdownTarget = { rowId, colKey };

    let lastFetchedCandidateCount = -1;
    const debounceMs = hook.debounceMs ?? 250;

    const schedule = () => {
      const query = input.value;
      if (this.lookupDebounceTimer) {
        window.clearTimeout(this.lookupDebounceTimer);
        this.lookupDebounceTimer = null;
      }
      this.lookupAbort?.abort();
      this.lookupAbort = null;
      this.lookupRequestId += 1;

      const requestId = this.lookupRequestId;
      const prevCandidateCount = lastFetchedCandidateCount;
      this.lookupDebounceTimer = window.setTimeout(() => {
        this.lookupDebounceTimer = null;
        const controller = new AbortController();
        this.lookupAbort = controller;
        void hook
          .fetchCandidates({ query, rowId, colKey, signal: controller.signal })
          .then((candidates) => {
            if (requestId !== this.lookupRequestId) return;
            if (controller.signal.aborted) return;
            if (!this.activeCell || this.activeCell.rowId !== rowId || this.activeCell.colKey !== colKey)
              return;
            lastFetchedCandidateCount = candidates.length;
            // Auto-commit if narrowed down from multiple to exactly one
            if (prevCandidateCount > 1 && candidates.length === 1) {
              this.lookupCandidates = candidates;
              this.lookupHighlightIndex = 0;
              this.commitLookupCandidate(0);
              return;
            }
            this.lookupCandidates = candidates;
            this.lookupHighlightIndex = candidates.length ? 0 : -1;
            this.renderLookupDropdown();
          })
          .catch((err) => {
            if (requestId !== this.lookupRequestId) return;
            if (controller.signal.aborted) return;
            void err;
            this.hideLookupDropdown();
            this.showCopyToast("Lookup failed", "error", 1800);
          });
      }, debounceMs);
    };

    input.addEventListener("input", schedule);
    this.lookupInputCleanup = () => input.removeEventListener("input", schedule);
    // Kick off the initial fetch for the existing text.
    schedule();
  }

  private teardownLookupEditor() {
    if (this.lookupDebounceTimer) {
      window.clearTimeout(this.lookupDebounceTimer);
      this.lookupDebounceTimer = null;
    }
    this.lookupAbort?.abort();
    this.lookupAbort = null;
    this.lookupRequestId += 1;
    this.lookupInputCleanup?.();
    this.lookupInputCleanup = null;
    this.lookupDropdownTarget = null;
    this.hideLookupDropdown();
  }

  private handleLookupKeydown(e: KeyboardEvent): boolean {
    const el = this.lookupDropdownEl;
    if (!el || el.dataset.visible !== "1") return false;
    if (!this.lookupCandidates.length) return false;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.lookupHighlightIndex = Math.min(
        this.lookupCandidates.length - 1,
        Math.max(0, this.lookupHighlightIndex + 1),
      );
      this.renderLookupDropdown();
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      this.lookupHighlightIndex = Math.max(0, this.lookupHighlightIndex - 1);
      this.renderLookupDropdown();
      return true;
    }
    if (e.key === "Enter") {
      if (this.lookupHighlightIndex >= 0) {
        e.preventDefault();
        this.commitLookupCandidate(this.lookupHighlightIndex);
        return true;
      }
    }
    if (e.key === "Escape") {
      e.preventDefault();
      this.hideLookupDropdown();
      return true;
    }
    return false;
  }

  private tryStartExternalEditor(rowId: string, colKey: string): boolean {
    const col = this.findColumn(colKey);
    const open = col?.edit?.externalEditor?.open;
    if (!open) return false;
    if (this.editMode === "readonly") return true;
    if (this.isCellReadonly(rowId, colKey)) return true;

    if (this.externalEditInFlight) return true;

    const requestId = (this.externalEditRequestId += 1);
    this.externalEditInFlight = true;
    const currentValue = this.dataModel.getCell(rowId, colKey);

    // Ensure we stay in selection mode (no inline editor).
    this.selectionMode = true;
    try {
      const currentText = this.cellToClipboardString(currentValue);
      this.focusSelectionInput(currentText);
    } catch {
      // ignore
    }

    void open({ rowId, colKey, currentValue })
      .then((res) => {
        if (requestId !== this.externalEditRequestId) return;
        this.externalEditInFlight = false;
        if (!this.activeCell || this.activeCell.rowId !== rowId || this.activeCell.colKey !== colKey)
          return;
        if (res.kind === "commit") {
          this.commitEdit(rowId, colKey, res.value);
          const nextText = this.cellToClipboardString(res.value);
          this.focusSelectionInput(nextText);
        }
        if (res.kind === "cancel") {
          try {
            const nextText = this.cellToClipboardString(currentValue);
            this.focusSelectionInput(nextText);
          } catch {
            // ignore
          }
        }
      })
      .catch((err) => {
        if (requestId !== this.externalEditRequestId) return;
        this.externalEditInFlight = false;
        void err;
        this.showCopyToast("External editor failed", "error", 1800);
      });

    return true;
  }

  private handlePointerLeave = () => {
    this.hideHoverTooltip();
  };

  private ensureSelectionInput() {
    if (this.selectionInput) return this.selectionInput;
    const input = document.createElement("input");
    input.type = "text";
    // This input exists only to receive keyboard/clipboard/IME events in selection mode.
    // It is not a text editor.
    input.readOnly = true;
    // Helps suppress virtual keyboards; also reduces IME oddities on some platforms.
    input.inputMode = "none";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.style.position = "absolute";
    input.style.left = "0";
    input.style.top = "0";
    // Avoid affecting scroll extents in the scroll container.
    input.style.transform = "translate(-10000px, 0)";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0";
    input.style.pointerEvents = "none";
    input.addEventListener("keydown", (e) => {
      this.handleSelectionKeydown(e);
    });
    input.addEventListener("beforeinput", (e) => {
      this.handleSelectionBeforeInput(e);
    });
    input.addEventListener("input", (e) => {
    });
    input.addEventListener("change", (e) => {
    });
    input.addEventListener("compositionstart", this.handleSelectionCompositionStart);
    input.addEventListener("copy", this.handleSelectionCopy);
    input.addEventListener("cut", this.handleSelectionCut);
    input.addEventListener("paste", this.handleSelectionPaste);
    input.addEventListener("blur", (e) => {
      this.handleSelectionBlur();
    });
    input.addEventListener("focus", (e) => {
    });
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

  private openEditorAtActiveCell(options?: {
    initialValueOverride?: string;
    placeCursorAtEnd?: boolean;
  }) {
    if (!this.activeCell) return;
    const { rowId, colKey } = this.activeCell;
    if (colKey === null) return;

    if (this.tryStartExternalEditor(rowId, colKey)) {
      return;
    }
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

  private escapeCssAttrValue(value: string) {
    return CSS.escape(value);
  }

  private findHtmlCellElement(rowId: string, colKey: string | null) {
    if (colKey === null) return null;
    const key = String(colKey);
    const rowIdEsc = this.escapeCssAttrValue(rowId);
    const keyEsc = this.escapeCssAttrValue(key);
    return (
      this.root.querySelector<HTMLElement>(
        `tr[data-row-id="${rowIdEsc}"] td[data-col-key="${keyEsc}"]`,
      ) ?? null
    );
  }

  private computeCanvasCellRect(rowId: string, colKey: string | null) {
    if (colKey === null) return null;
    const box = this.computeCanvasCellBoxContent(rowId, colKey);
    if (!box) return null;
    const rootRect = this.root.getBoundingClientRect();
    return new DOMRect(
      rootRect.left + box.left - this.root.scrollLeft,
      rootRect.top + box.top - this.root.scrollTop,
      box.width,
      box.height,
    );
  }

  private computeCanvasCellBoxContent(rowId: string, colKey: string) {
    const canvas = this.root.querySelector<HTMLCanvasElement>(
      'canvas[data-extable-renderer="canvas"]',
    );
    if (!canvas) return null;
    return this.getCanvasCellMetrics(rowId, colKey);
  }

  private getCanvasCellMetrics(rowId: string, colKey: string) {
    const schema = this.dataModel.getSchema();
    const view = this.dataModel.getView();
    const rows = this.dataModel.listRows();
    const rowIndex = rows.findIndex((r) => r.id === rowId);
    const colIndex = schema.columns.findIndex((c) => String(c.key) === String(colKey));
    if (rowIndex < 0 || colIndex < 0) return null;

    const headerHeight = HEADER_HEIGHT_PX;
    const rowHeaderWidth = ROW_HEADER_WIDTH_PX;
    const defaultRowHeight = DEFAULT_ROW_HEIGHT_PX;
    const colWidths = getColumnWidths(schema, view);

    let left = rowHeaderWidth;
    for (let i = 0; i < colIndex; i += 1) left += colWidths[i] ?? 100;

    let top = headerHeight;
    for (let i = 0; i < rowIndex; i += 1) {
      const row = rows[i];
      if (!row) return null;
      const h = this.dataModel.getRowHeight(row.id) ?? defaultRowHeight;
      top += h;
    }
    const height = this.dataModel.getRowHeight(rowId) ?? defaultRowHeight;
    const width = colWidths[colIndex] ?? 100;
    return { left, top, width, height, rowIndex, colIndex };
  }

  private getActiveCellRect() {
    const active = this.activeCell;
    if (!active) return null;
    const rootRect = this.root.getBoundingClientRect();
    const schema = this.dataModel.getSchema();
    const view = this.dataModel.getView();
    if (active.rowId === "__all__" && active.colKey === "__all__") {
      return new DOMRect(rootRect.left, rootRect.top, ROW_HEADER_WIDTH_PX, HEADER_HEIGHT_PX);
    }
    if (active.rowId === "__header__" && active.colKey !== null) {
      const key = this.escapeCssAttrValue(String(active.colKey));
      const headerEl = this.root.querySelector<HTMLElement>(`th[data-col-key="${key}"]`);
      if (headerEl) return headerEl.getBoundingClientRect();
      const colIndex = schema.columns.findIndex((c) => String(c.key) === String(active.colKey));
      if (colIndex >= 0) {
        const colWidths = getColumnWidths(schema, view);
        let x = ROW_HEADER_WIDTH_PX;
        for (let i = 0; i < colIndex; i += 1) x += colWidths[i] ?? 100;
        const width = colWidths[colIndex] ?? 100;
        return new DOMRect(
          rootRect.left + x - this.root.scrollLeft,
          rootRect.top,
          width,
          HEADER_HEIGHT_PX,
        );
      }
    }
    if (active.colKey === null) {
      const rowIndex = this.dataModel.getRowIndex(active.rowId);
      if (rowIndex >= 0) {
        let y = HEADER_HEIGHT_PX;
        const rows = this.dataModel.listRows();
        for (let i = 0; i < rowIndex; i += 1) {
          const row = rows[i];
          if (!row) break;
          y += this.dataModel.getRowHeight(row.id) ?? DEFAULT_ROW_HEIGHT_PX;
        }
        const height = this.dataModel.getRowHeight(active.rowId) ?? DEFAULT_ROW_HEIGHT_PX;
        return new DOMRect(
          rootRect.left,
          rootRect.top + y - this.root.scrollTop,
          ROW_HEADER_WIDTH_PX,
          height,
        );
      }
    }
    if (active.colKey === null) return null;
    const cellEl = this.findHtmlCellElement(active.rowId, active.colKey);
    if (cellEl) return cellEl.getBoundingClientRect();
    return this.computeCanvasCellRect(active.rowId, active.colKey);
  }

  private ensureVisibleCell(rowId: string, colKey: string) {
    const htmlCell = this.findHtmlCellElement(rowId, colKey);
    if (htmlCell) {
      if (typeof (htmlCell as HTMLElement).scrollIntoView === "function") {
        (htmlCell as HTMLElement).scrollIntoView({ block: "nearest", inline: "nearest" });
      }
      return;
    }
    const metrics = this.getCanvasCellMetrics(rowId, colKey);
    if (!metrics) return;
    const xStart = metrics.left;
    const xEnd = metrics.left + metrics.width;
    const yStart = metrics.top;
    const yEnd = metrics.top + metrics.height;

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
      extendSelection && this.selectionAnchor
        ? this.selectionAnchor
        : extendSelection
          ? { rowIndex, colIndex }
          : null;
    if (extendSelection && !this.selectionAnchor) this.selectionAnchor = { rowIndex, colIndex };
    const nextRowIndex = Math.max(0, Math.min(rows.length - 1, rowIndex + deltaRow));
    const nextColIndex = Math.max(0, Math.min(schema.columns.length - 1, colIndex + deltaCol));
    {
      const row = rows[nextRowIndex];
      if (!row) return;
      const col = schema.columns[nextColIndex];
      if (!col) return;
      const rowId = row.id;
      const colKey = col.key;

      const nextRange: SelectionRange = anchor
        ? {
            kind: "cells",
            startRow: anchor.rowIndex,
            endRow: nextRowIndex,
            startCol: anchor.colIndex,
            endCol: nextColIndex,
          }
        : {
            kind: "cells",
            startRow: nextRowIndex,
            endRow: nextRowIndex,
            startCol: nextColIndex,
            endCol: nextColIndex,
          };
      this.selectionRanges = [nextRange];
      this.activeCell = { rowId, colKey };
      this.onActiveChange(rowId, colKey);
      this.onSelectionChange(this.selectionRanges);
      this.ensureVisibleCell(rowId, colKey);

      const current = this.dataModel.getCell(rowId, colKey);
      const currentText = this.cellToClipboardString(current);
      this.focusSelectionInput(currentText);
      this.updateFillHandleFlag();
      return;
    }
  }

  private handlePointerDown = (ev: PointerEvent) => {
    if (ev.button !== 0) return;
    const el = ev.target as HTMLElement | null;
    if (el?.closest('button[data-extable-fs-open="1"]')) return;
    if (el?.closest(".extable-filter-sort-trigger")) return;
    // Don't interfere with lookup dropdown button clicks
    if (el?.closest('button.extable-lookup-option')) {
      return;
    }
    // Avoid starting a drag from inside an active editor.
    if (this.inputEl && ev.target && this.inputEl.contains(ev.target as Node)) return;
    // Commit current editor before starting a drag/select operation.
    if (this.inputEl && this.activeCell && this.activeCell.colKey !== null) {
      if (!this.tryCommitActiveEditor()) return;
    }
    if (this.fillDragging) return;
    const hit = this.hitTest(ev as unknown as MouseEvent);
    if (!hit) return;
    if (hit.rowId === "__all__" && hit.colKey === "__all__") return;
    if (hit.colKey === "__all__") return;

    // Fill handle drag starts only when the pointer is down on the handle area.
    const fillSrc = getFillHandleSource(this.dataModel, this.selectionRanges);
    if (fillSrc && this.activeCell) {
      const schema = this.dataModel.getSchema();
      const rows = this.dataModel.listRows();
      const handleRowIndex = fillSrc.endRowIndex;
      const handleColIndex = fillSrc.colIndex;
      const handleRow = rows[handleRowIndex];
      const handleCol = schema.columns[handleColIndex];
      if (handleRow && handleCol) {
        const cellRect =
          this.findHtmlCellElement(handleRow.id, handleCol.key)?.getBoundingClientRect() ??
          this.computeCanvasCellRect(handleRow.id, handleCol.key);
        if (
          cellRect &&
          shouldShowFillHandle(
            this.dataModel,
            this.selectionRanges,
            this.activeCell.rowId,
            this.activeCell.colKey,
            this.editMode,
          )
        ) {
          const handleRect = getFillHandleRect(cellRect, FILL_HANDLE_HIT_SIZE_PX);
          if (isPointInRect(ev.clientX, ev.clientY, handleRect)) {
            ev.preventDefault();
            this.fillDragging = true;
            this.fillSource = fillSrc;
            this.fillEndRowIndex = fillSrc.endRowIndex;
            this.root.dataset.extableFillDragging = "1";
            if (this.rootCursorBackup === null)
              this.rootCursorBackup = this.root.style.cursor || "";
            this.root.style.cursor = "crosshair";
            this.lastPointerClient = { x: ev.clientX, y: ev.clientY };
            this.dragging = false;
            this.dragStart = null;
            this.suppressNextClick = true;
            try {
              (ev.target as Element | null)?.setPointerCapture?.(ev.pointerId);
            } catch {
              // ignore
            }
            // Expand selection to include filled range preview (start with source).
            this.selectionRanges = [
              {
                kind: "cells",
                startRow: fillSrc.startRowIndex,
                endRow: fillSrc.endRowIndex,
                startCol: fillSrc.colIndex,
                endCol: fillSrc.colIndex,
              },
            ];
            this.onSelectionChange(this.selectionRanges);
            this.startAutoScroll();
            return;
          }
        }
      }
    }

    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
    const rowIndex = hit.rowId === "__header__" ? 0 : this.dataModel.getRowIndex(hit.rowId);
    const colIndex = schema.columns.findIndex((c) => String(c.key) === String(hit.colKey));
    if (colIndex < 0) return;

    if (hit.rowId === "__header__") {
      // Select entire column when clicking column header.
      if (!rows.length) return;
      const range: SelectionRange = {
        kind: "cells",
        startRow: 0,
        endRow: rows.length - 1,
        startCol: colIndex,
        endCol: colIndex,
      };
      this.selectionRanges = [range];
      this.onSelectionChange(this.selectionRanges);
      this.dragging = false;
      this.selectionMode = true;
      this.dragStart = null;
      this.selectionAnchor = null;
      this.suppressNextClick = false;
      const targetRow = rows[0];
      const targetCol = schema.columns[colIndex];
      if (targetRow && targetCol) {
        this.activeCell = { rowId: targetRow.id, colKey: targetCol.key };
        this.onActiveChange(targetRow.id, targetCol.key);
      }
      this.focusSelectionInput("");
      return;
    }

    if (rowIndex < 0) return;

    const kind: "cells" | "rows" = hit.colKey === null ? "rows" : "cells";
    this.dragging = true;
    this.pointerDownClient = { x: ev.clientX, y: ev.clientY };
    this.dragMoved = false;
    this.dragSelectionChanged = false;
    this.dragStart = { rowIndex, colIndex, kind };
    this.suppressNextClick = false;
    this.selectionMode = true;
    this.selectionAnchor = null;
    this.lastPointerClient = { x: ev.clientX, y: ev.clientY };

    try {
      (ev.target as Element | null)?.setPointerCapture?.(ev.pointerId);
    } catch {
      // ignore
    }
    this.startAutoScroll();
  };

  private getHitAtClientPoint(
    clientX: number,
    clientY: number,
    fallbackTarget?: EventTarget | null,
  ) {
    // Prefer coordinate-based hit-test for auto-scroll ticks (no real event.target).
    let el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    if (!el && fallbackTarget instanceof HTMLElement) {
      el = fallbackTarget;
    }
    if (el && this.root.contains(el)) {
      const corner = el.closest<HTMLElement>("th.extable-corner");
      if (corner) {
        return {
          rowId: "__all__",
          colKey: "__all__",
          element: corner,
          rect: corner.getBoundingClientRect(),
        };
      }
      const rowHeader = el.closest<HTMLElement>("th.extable-row-header:not(.extable-corner)");
      if (rowHeader) {
        const row = rowHeader.closest<HTMLElement>("tr[data-row-id]");
        if (row) {
          return {
            rowId: row.dataset.rowId ?? "",
            colKey: null,
            element: rowHeader,
            rect: rowHeader.getBoundingClientRect(),
          };
        }
      }
      const colHeader = el.closest<HTMLElement>("th[data-col-key]");
      if (colHeader) {
        return {
          rowId: "__header__",
          colKey: colHeader.dataset.colKey ?? "",
          element: colHeader,
          rect: colHeader.getBoundingClientRect(),
        };
      }
      const cell = el.closest<HTMLElement>("td[data-col-key]");
      const row = cell?.closest<HTMLElement>("tr[data-row-id]");
      if (cell && row) {
        return {
          rowId: row.dataset.rowId ?? "",
          colKey: cell.dataset.colKey ?? "",
          element: cell,
          rect: cell.getBoundingClientRect(),
        };
      }
    }
    // Canvas renderer hitTest does not rely on target; a minimal shape is enough.
    const target = fallbackTarget instanceof HTMLElement ? fallbackTarget : null;
    return this.hitTest({ clientX, clientY, target } as unknown as MouseEvent);
  }

  private updateDragFromClientPoint(clientX: number, clientY: number) {
    if (!this.dragging || !this.dragStart) return;
    const hit = this.getHitAtClientPoint(clientX, clientY);
    if (!hit) return;
    if (
      hit.colKey === "__all__" ||
      (this.dragStart.kind === "cells" && hit.colKey === null)
    )
      return;

    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
    const endRowIndex = this.dataModel.getRowIndex(hit.rowId);
    if (endRowIndex < 0) return;
    const endColIndex =
      this.dragStart.kind === "rows"
        ? schema.columns.length - 1
        : schema.columns.findIndex((c) => String(c.key) === String(hit.colKey));
    if (endColIndex < 0) return;

    const startRow = this.dragStart.rowIndex;
    const startCol = this.dragStart.kind === "rows" ? 0 : this.dragStart.colIndex;
    const endCol = this.dragStart.kind === "rows" ? schema.columns.length - 1 : endColIndex;
    if (endRowIndex !== startRow || endCol !== startCol) {
      this.dragSelectionChanged = true;
    }
    const nextRange: SelectionRange = {
      kind: this.dragStart.kind,
      startRow,
      endRow: endRowIndex,
      startCol,
      endCol,
    };
    this.selectionRanges = [nextRange];
    const activeRowId = rows[endRowIndex]?.id ?? hit.rowId;
    const activeColKey =
      this.dragStart.kind === "rows"
        ? (schema.columns[0]?.key ?? hit.colKey)
        : (schema.columns[endColIndex]?.key ?? hit.colKey);
    this.activeCell = { rowId: activeRowId, colKey: activeColKey };
    this.onActiveChange(activeRowId, activeColKey);
    this.onSelectionChange(this.selectionRanges);
    this.updateFillHandleFlag();
  }

  private updateFillDragFromClientPoint(clientX: number, clientY: number) {
    if (!this.fillDragging || !this.fillSource) return;
    const hit = this.getHitAtClientPoint(clientX, clientY);
    if (!hit) return;
    if (hit.colKey === "__all__" || hit.colKey === null) return;
    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
    const endRowIndex = this.dataModel.getRowIndex(hit.rowId);
    if (endRowIndex < 0) return;
    const colIndex = schema.columns.findIndex((c) => String(c.key) === String(hit.colKey));
    if (colIndex !== this.fillSource.colIndex) return;

    // Vertical fill only; allow dragging downwards from the source end.
    const nextEnd = Math.max(this.fillSource.endRowIndex, endRowIndex);
    if (this.fillEndRowIndex !== nextEnd) {
      this.fillEndRowIndex = nextEnd;
      const activeRowId = rows[nextEnd]?.id ?? hit.rowId;
      const col = schema.columns[this.fillSource.colIndex];
      if (!col) return;
      const colKey = col.key;
      this.activeCell = { rowId: activeRowId, colKey };
      this.onActiveChange(activeRowId, colKey);
      this.selectionRanges = [
        {
          kind: "cells",
          startRow: this.fillSource.startRowIndex,
          endRow: nextEnd,
          startCol: this.fillSource.colIndex,
          endCol: this.fillSource.colIndex,
        },
      ];
      this.onSelectionChange(this.selectionRanges);
    }
    this.suppressNextClick = true;
  }

  private computeAutoScrollDelta(clientX: number, clientY: number) {
    const rect = this.root.getBoundingClientRect();
    const threshold = 24;
    const maxStep = 18;
    let dx = 0;
    let dy = 0;
    if (clientX < rect.left + threshold) {
      dx = -Math.ceil(((rect.left + threshold - clientX) / threshold) * maxStep);
    } else if (clientX > rect.right - threshold) {
      dx = Math.ceil(((clientX - (rect.right - threshold)) / threshold) * maxStep);
    }
    if (clientY < rect.top + threshold) {
      dy = -Math.ceil(((rect.top + threshold - clientY) / threshold) * maxStep);
    } else if (clientY > rect.bottom - threshold) {
      dy = Math.ceil(((clientY - (rect.bottom - threshold)) / threshold) * maxStep);
    }
    return { dx, dy };
  }

  private startAutoScroll() {
    if (this.autoScrollActive) return;
    this.autoScrollActive = true;
    const tick = () => {
      if (!this.autoScrollActive) return;
      const p = this.lastPointerClient;
      if (!p || (!this.dragging && !this.fillDragging)) {
        this.stopAutoScroll();
        return;
      }
      const { dx, dy } = this.computeAutoScrollDelta(p.x, p.y);
      if (dx !== 0 || dy !== 0) {
        const prevTop = this.root.scrollTop;
        const prevLeft = this.root.scrollLeft;
        this.root.scrollTop = Math.max(0, prevTop + dy);
        this.root.scrollLeft = Math.max(0, prevLeft + dx);
        // While scrolling, keep updating selection/fill based on the latest pointer position.
        if (this.fillDragging) this.updateFillDragFromClientPoint(p.x, p.y);
        else this.updateDragFromClientPoint(p.x, p.y);
      }
      this.autoScrollRaf = window.requestAnimationFrame(tick);
    };
    this.autoScrollRaf = window.requestAnimationFrame(tick);
  }

  private stopAutoScroll() {
    this.autoScrollActive = false;
    if (this.autoScrollRaf !== null) {
      window.cancelAnimationFrame(this.autoScrollRaf);
      this.autoScrollRaf = null;
    }
  }

  private handlePointerMove = (ev: PointerEvent) => {
    this.lastPointerClient = { x: ev.clientX, y: ev.clientY };
    if (this.fillDragging && this.fillSource) {
      this.updateFillDragFromClientPoint(ev.clientX, ev.clientY);
      return;
    }
    if (!this.dragging || !this.dragStart) {
      this.updateHoverTooltip(ev);
      return;
    }
    if (!this.dragMoved && this.pointerDownClient) {
      const dx = ev.clientX - this.pointerDownClient.x;
      const dy = ev.clientY - this.pointerDownClient.y;
      // Ignore tiny pointer jitter so clicks aren't suppressed.
      if (dx * dx + dy * dy < 9) return;
      this.dragMoved = true;
    }
    this.updateDragFromClientPoint(ev.clientX, ev.clientY);
  };

  private handlePointerUp = (ev: PointerEvent) => {
    if (this.fillDragging && this.fillSource) {
      const src = this.fillSource;
      const endRowIndex = this.fillEndRowIndex ?? src.endRowIndex;
      this.fillDragging = false;
      this.fillSource = null;
      this.fillEndRowIndex = null;
      this.root.dataset.extableFillDragging = "";
      if (this.rootCursorBackup !== null) {
        this.root.style.cursor = this.rootCursorBackup;
        this.rootCursorBackup = null;
      }
      this.stopAutoScroll();
      try {
        (ev.target as Element | null)?.releasePointerCapture?.(ev.pointerId);
      } catch {
        // ignore
      }
      this.commitFill(src, endRowIndex);
      this.suppressNextClick = true;
      return;
    }
    if (!this.dragging) return;
    this.dragging = false;
    this.dragStart = null;
    const suppressTrailingClick = this.dragSelectionChanged;
    this.pointerDownClient = null;
    this.dragMoved = false;
    this.dragSelectionChanged = false;
    this.stopAutoScroll();
    try {
      (ev.target as Element | null)?.releasePointerCapture?.(ev.pointerId);
    } catch {
      // ignore
    }
    if (suppressTrailingClick) this.suppressNextClick = true;
    if (this.suppressNextClick) {
      // Keep selection mode focus; prevent the trailing click from opening edit.
      if (this.activeCell && this.activeCell.colKey !== null) {
        const current = this.dataModel.getCell(this.activeCell.rowId, this.activeCell.colKey);
        this.focusSelectionInput(this.cellToClipboardString(current));
      }
    }
  };

  private commitFill(source: import("./fillHandle").FillHandleSource, endRowIndex: number) {
    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
    const col = schema.columns[source.colIndex];
    if (!col) return;
    if (endRowIndex <= source.endRowIndex) return;

    const getValue = makeFillValueGetter(this.dataModel, source, this.sequenceLangs);
    if (!getValue) return;

    const commitNow = this.editMode === "direct";
    const batchId = `fill:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    for (let r = source.endRowIndex + 1; r <= endRowIndex; r += 1) {
      const row = rows[r];
      if (!row) break;
      if (this.isCellReadonly(row.id, col.key)) continue;
      const offset = r - source.endRowIndex;
      const next = getValue(offset);
      const cmd: Command = {
        kind: "edit",
        rowId: row.id,
        colKey: col.key,
        next,
        payload: { batchId },
      };
      this.onEdit(cmd, commitNow);
    }

    // Select the filled range after commit and focus selection mode.
    const endRow = rows[endRowIndex];
    if (!endRow) return;
    this.selectionRanges = [
      {
        kind: "cells",
        startRow: source.startRowIndex,
        endRow: endRowIndex,
        startCol: source.colIndex,
        endCol: source.colIndex,
      },
    ];
    this.activeCell = { rowId: endRow.id, colKey: col.key };
    this.onActiveChange(endRow.id, col.key);
    this.onSelectionChange(this.selectionRanges);
    this.updateFillHandleFlag();
    this.ensureVisibleCell(endRow.id, col.key);
    const current = this.dataModel.getCell(endRow.id, col.key);
    this.focusSelectionInput(this.cellToClipboardString(current));
  }

  private teardownSelectionInput() {
    const input = this.selectionInput;
    if (!input) return;

    // Avoid re-entrancy via blur fired during DOM removal.
    this.selectionInput = null;

    input.removeEventListener("keydown", this.handleSelectionKeydown);
    input.removeEventListener("beforeinput", this.handleSelectionBeforeInput);
    input.removeEventListener("compositionstart", this.handleSelectionCompositionStart);
    input.removeEventListener("copy", this.handleSelectionCopy);
    input.removeEventListener("cut", this.handleSelectionCut);
    input.removeEventListener("paste", this.handleSelectionPaste);
    input.removeEventListener("blur", this.handleSelectionBlur);
    removeFromParent(input);
  }

  private handleSelectionCopy = (ev: ClipboardEvent) => {
    if (!this.selectionMode) return;
    const payload = this.buildSelectionClipboardPayload();
    if (!payload) return;
    ev.preventDefault();
    ev.clipboardData?.setData("text/plain", payload.text);
    ev.clipboardData?.setData("text/tab-separated-values", payload.text);
    ev.clipboardData?.setData("text/html", payload.html);
    this.showCopyToast(`Copied ${payload.cellCount} cells`, "info");
  };

  private handleSelectionCut = (ev: ClipboardEvent) => {
    if (!this.selectionMode) return;
    const payload = this.buildSelectionClipboardPayload();
    if (!payload) return;
    ev.preventDefault();
    ev.clipboardData?.setData("text/plain", payload.text);
    ev.clipboardData?.setData("text/tab-separated-values", payload.text);
    ev.clipboardData?.setData("text/html", payload.html);
    this.clearSelectionValues();
  };

  private handleSelectionPaste = (ev: ClipboardEvent) => {
    if (!this.selectionMode) return;
    ev.preventDefault();
    const html = ev.clipboardData?.getData("text/html") ?? "";
    const tsv = ev.clipboardData?.getData("text/tab-separated-values") ?? "";
    const text = ev.clipboardData?.getData("text/plain") ?? "";
    const grid = this.parseClipboardGrid({ html, tsv, text });
    if (!grid) return;
    this.applyClipboardGrid(grid);
  };

  private handleSelectionCompositionStart = (ev?: CompositionEvent) => {
    if (!this.selectionMode) return;
    const ac = this.activeCell;
    if (!ac || ac.colKey === null) return;

    if (this.isCellReadonly(ac.rowId, ac.colKey)) {
      // Keep selection mode for readonly cells.
      // IMPORTANT: cancel any ongoing IME composition by tearing down the focused hidden input.
      // Otherwise, some IMEs show a floating preedit UI (e.g. an "a") even though we ignore edits.
      ev?.preventDefault?.();
      ev?.stopPropagation?.();
      const current = this.dataModel.getCell(ac.rowId, ac.colKey);
      const currentText = this.cellToClipboardString(current);
      this.teardownSelectionInput();
      this.focusSelectionInput(currentText);
      return;
    }

    this.selectionMode = false;
    this.teardownSelectionInput();
    this.openEditorAtActiveCell();
  };

  private handleSelectionBeforeInput = (ev: InputEvent) => {
    if (!this.selectionMode) return;
    const ac = this.activeCell;
    if (!ac || ac.colKey === null) return;
    if (!this.isCellReadonly(ac.rowId, ac.colKey)) return;

    // Block text insertion into the hidden selection input while readonly.
    ev.preventDefault();
    try {
      const current = this.dataModel.getCell(ac.rowId, ac.colKey);
      const currentText = this.cellToClipboardString(current);
      const input = this.ensureSelectionInput();
      input.value = currentText;
      input.select();
    } catch {
      // ignore
    }
  };

  public async copySelection() {
    const payload = this.buildSelectionClipboardPayload();
    if (!payload) return;
    const { text, html, cellCount } = payload;

    const copyViaClipboardApi = async () => {
      if (typeof navigator === "undefined" || !navigator.clipboard) return false;
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        try {
          const item = new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          });
          await navigator.clipboard.write([item]);
          return true;
        } catch {
          /* fallthrough */
        }
      }
      if (navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return true;
        } catch {
          /* fallthrough */
        }
      }
      return false;
    };

    const copyViaFallbackInput = () => {
      const input = this.ensureSelectionInput();
      const prev = input.value;
      input.value = text;
      input.select();
      document.execCommand?.("copy");
      input.value = prev;
    };

    const copied = await copyViaClipboardApi();
    if (!copied) copyViaFallbackInput();
    this.showCopyToast(`Copied ${cellCount} cells`, "info");
  }

  public async pasteFromClipboard() {
    if (this.editMode === "readonly") return;
    if (!this.selectionMode) return;
    if (typeof navigator === "undefined" || !navigator.clipboard?.readText) return;
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const grid = this.parseClipboardGrid({ html: "", tsv: text, text });
      if (!grid) return;
      this.applyClipboardGrid(grid);
    } catch {
      /* ignore */
    }
  }

  private handleSelectionKeydown = async (ev: KeyboardEvent) => {
    if (!this.selectionMode) return;
    if (!this.activeCell) return;
    if (ev.isComposing || this.composing) return;

    // Ignore modifier-only keys in selection mode (do not enter edit mode).
    if (
      ev.key === "Shift" ||
      ev.key === "Control" ||
      ev.key === "Alt" ||
      ev.key === "Meta" ||
      ev.key === "CapsLock" ||
      ev.key === "NumLock" ||
      ev.key === "ScrollLock"
    ) {
      return;
    }

    const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
    const accel = isMac ? ev.metaKey : ev.ctrlKey;
    if (accel) {
      const key = ev.key.toLowerCase();
      if (key === "z") {
        ev.preventDefault();
        if (isMac && ev.shiftKey) this.onRedo();
        else this.onUndo();
        this.selectionAnchor = null;
        return;
      }
      if (key === "y") {
        ev.preventDefault();
        this.onRedo();
        this.selectionAnchor = null;
        return;
      }
      if (key === "c") {
        ev.preventDefault();
        await this.copySelection();
        this.selectionAnchor = null;
        return;
      }
      if (key === "x") {
        ev.preventDefault();
        await this.copySelection();
        this.clearSelectionValues();
        this.selectionAnchor = null;
        return;
      }
      if (key === "v") {
        // Let the paste event fire; it will be handled on the input.
        this.selectionAnchor = null;
        return;
      }
    }

    if (ev.key === " " && this.activeCell.colKey !== null) {
      const col = this.findColumn(this.activeCell.colKey);
      if (col?.type === "button" || col?.type === "link") {
        ev.preventDefault();
        this.triggerCellAction(this.activeCell.rowId, this.activeCell.colKey, col.type);
        this.selectionAnchor = null;
        return;
      }
      if (col?.type === "boolean") {
        ev.preventDefault();
        this.toggleBoolean(this.activeCell.rowId, this.activeCell.colKey);
        this.selectionAnchor = null;
        return;
      }
      this.selectionAnchor = null;
      return;
    }

    const isTab = ev.key === "Tab";
    const isEnter = ev.key === "Enter";
    const isArrow =
      ev.key === "ArrowLeft" ||
      ev.key === "ArrowRight" ||
      ev.key === "ArrowUp" ||
      ev.key === "ArrowDown";
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
      if (ev.key === "ArrowLeft") this.moveActiveCell(0, -1, extend);
      else if (ev.key === "ArrowRight") this.moveActiveCell(0, 1, extend);
      else if (ev.key === "ArrowUp") this.moveActiveCell(-1, 0, extend);
      else if (ev.key === "ArrowDown") this.moveActiveCell(1, 0, extend);
      return;
    }

    if (
      this.activeCell.colKey !== null &&
      this.isCellReadonly(this.activeCell.rowId, this.activeCell.colKey)
    ) {
      ev.preventDefault();
      this.selectionAnchor = null;
      return;
    }

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
    const ac = this.activeCell;
    if (!ac) return fallback;
    const rowIndex = rows.findIndex((r) => r.id === ac.rowId);
    const colIndex = schema.columns.findIndex((c) => String(c.key) === String(ac.colKey));
    return { rowIndex: rowIndex >= 0 ? rowIndex : 0, colIndex: colIndex >= 0 ? colIndex : 0 };
  }

  private normalizeRange(range: SelectionRange): SelectionRange {
    return {
      ...range,
      startRow: Math.min(range.startRow, range.endRow),
      endRow: Math.max(range.startRow, range.endRow),
      startCol: Math.min(range.startCol, range.endCol),
      endCol: Math.max(range.startCol, range.endCol),
    };
  }

  private getCopyRange(): SelectionRange | null {
    const schema = this.dataModel.getSchema();
    if (this.selectionRanges.length > 0) {
      const first = this.selectionRanges[0];
      if (!first) return null;
      const normalized = this.normalizeRange(first);
      if (normalized.kind === "rows") {
        return {
          kind: "cells",
          startRow: normalized.startRow,
          endRow: normalized.endRow,
          startCol: normalized.startCol,
          endCol: normalized.endCol,
        };
      }
      return normalized;
    }
    if (!this.activeCell) return null;
    const ac = this.activeCell;
    if (!ac) return null;
    const rowIdx = this.dataModel.getRowIndex(ac.rowId);
    const colIdx = schema.columns.findIndex((c) => String(c.key) === String(ac.colKey));
    if (rowIdx < 0 || colIdx < 0) return null;
    return { kind: "cells", startRow: rowIdx, endRow: rowIdx, startCol: colIdx, endCol: colIdx };
  }

  private cellToClipboardString(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
    if (typeof value === "number") return String(value);
    const linkAction = resolveLinkAction(value);
    if (linkAction?.href) return linkAction.href;
    const buttonAction = resolveButtonAction(value);
    if (buttonAction?.label) return buttonAction.label;
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const kind = obj.kind;
      if (kind === "enum" && typeof obj.value === "string") return obj.value;
      if (kind === "tags" && Array.isArray(obj.values)) {
        return obj.values.filter((x) => typeof x === "string").join(", ");
      }
      if (kind === "lookup" && typeof obj.label === "string") return obj.label;
      if (typeof obj.kind !== "string" && typeof obj.label === "string" && "value" in obj) return obj.label;
    }
    return String(value);
  }

  private escapeHtml(text: string) {
    return text
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  private buildSelectionClipboardPayload(): {
    text: string;
    html: string;
    cellCount: number;
  } | null {
    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
    const range = this.getCopyRange();
    if (!range) return null;
    if (range.kind !== "cells") return null;

    const out: string[] = [];
    const htmlRows: string[] = [];
    const tableStyle = "border-collapse:collapse;border-spacing:0;";
    const cellStyle = "border:1px solid #d0d7de;padding:4px 6px;vertical-align:top;";
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
      out.push(line.join("\t"));
      htmlRows.push(`<tr>${htmlCells.join("")}</tr>`);
    }
    const text = out.join("\r\n");
    const html = `<table style="${tableStyle}"><tbody>${htmlRows.join("")}</tbody></table>`;
    return { text, html, cellCount };
  }

  private clearSelectionValues() {
    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
    const range = this.getCopyRange();
    if (!range || range.kind !== "cells") return;
    const commitNow = this.editMode === "direct";
    const batchId = `cut:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    for (let r = range.startRow; r <= range.endRow; r += 1) {
      const row = rows[r];
      if (!row) continue;
      for (let c = range.startCol; c <= range.endCol; c += 1) {
        const col = schema.columns[c];
        if (!col) continue;
        if (this.isCellReadonly(row.id, col.key)) continue;
        const next = col.type === "boolean" ? false : "";
        const cmd: Command = {
          kind: "edit",
          rowId: row.id,
          colKey: col.key,
          next,
          payload: { batchId },
        };
        this.onEdit(cmd, commitNow);
      }
    }
  }

  private parseClipboardGrid(payload: { html: string; tsv: string; text: string }):
    | string[][]
    | null {
    const fromHtml = this.parseHtmlTable(payload.html);
    if (fromHtml) return fromHtml;
    const raw = payload.tsv || payload.text;
    return this.parseTsv(raw);
  }

  private parseTsv(text: string): string[][] | null {
    const trimmed = text.replace(/\r\n$/, "").replace(/\n$/, "");
    if (!trimmed) return null;
    const rows = trimmed.split(/\r\n|\n/);
    return rows.map((r) => r.split("\t"));
  }

  private parseHtmlTable(html: string): string[][] | null {
    if (!html) return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const table = doc.querySelector("table");
      if (!table) return null;
      const trs = Array.from(table.querySelectorAll("tr"));
      if (trs.length === 0) return null;
      const grid: string[][] = [];
      for (const tr of trs) {
        const cells = Array.from(tr.querySelectorAll("th,td"));
        if (
          cells.some(
            (c) =>
              (c as HTMLTableCellElement).rowSpan > 1 || (c as HTMLTableCellElement).colSpan > 1,
          )
        ) {
          return null;
        }
        grid.push(cells.map((c) => (c.textContent ?? "").trim()));
      }
      return grid.length ? grid : null;
    } catch {
      return null;
    }
  }

  private coerceCellValue(raw: string, colKey: string): unknown {
    const col = this.findColumn(colKey);
    if (!col) return raw;
    if (raw === "") return "";
    if (col.type === "number" || col.type === "int" || col.type === "uint") {
      const parsed = parseNumericText(raw);
      if (!parsed.ok) return raw;
      const coerced = coerceNumericForColumn(parsed.value, col.type);
      return coerced.ok ? coerced.value : raw;
    }
    if (col.type === "boolean") {
      const v = raw.trim().toLowerCase();
      if (v === "true" || v === "1" || v === "yes") return true;
      if (v === "false" || v === "0" || v === "no") return false;
      return raw;
    }
    return raw;
  }

  private applyClipboardGrid(grid: string[][]) {
    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
    const { rowIndex: startRow, colIndex: startCol } = this.getActiveIndices();
    const commitNow = this.editMode === "direct";
    const batchId = `paste:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    for (let r = 0; r < grid.length; r += 1) {
      const row = rows[startRow + r];
      if (!row) break;
      const line = grid[r] ?? [];
      for (let c = 0; c < line.length; c += 1) {
        const col = schema.columns[startCol + c];
        if (!col) break;
        if (this.isCellReadonly(row.id, col.key)) continue;
        const next = this.coerceCellValue(line[c] ?? "", col.key);
        const cmd: Command = {
          kind: "edit",
          rowId: row.id,
          colKey: col.key,
          next,
          payload: { batchId },
        };
        this.onEdit(cmd, commitNow);
      }
    }
  }

  private createEditor(colKey: string, initial: string) {
    const col = this.findColumn(colKey);
    if (col?.edit?.lookup) {
      const input = document.createElement("input");
      input.type = "text";
      input.value = initial;
      input.autocomplete = "off";
      input.spellcheck = false;
      return { control: input, value: initial };
    }
    const needsTextarea = col?.wrapText || initial.includes("\n");
    if (needsTextarea) {
      const ta = document.createElement("textarea");
      ta.value = initial;
      ta.style.resize = "none";
      ta.style.whiteSpace = "pre-wrap";
      ta.style.overflowWrap = "anywhere";
      ta.style.overflow = "hidden";
      this.autosize(ta);
      ta.addEventListener("input", () => this.autosize(ta));
      return { control: ta, value: initial };
    }
    if (col?.type === "boolean") {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = initial === "true" || initial === "1" || initial === "on";
      return { control: input, value: initial };
    }
    if (col?.type === "number" || col?.type === "int" || col?.type === "uint") {
      const input = document.createElement("input");
      input.type = "text";
      input.value = initial;
      return { control: input, value: initial };
    }
    if (col?.type === "date" || col?.type === "time" || col?.type === "datetime") {
      const input = document.createElement("input");
      input.type = col.type === "date" ? "date" : col.type === "time" ? "time" : "datetime-local";
      const normalized = this.normalizeTemporalInitialValue(col.type, initial);
      input.value = normalized;
      return { control: input, value: normalized };
    }
    if (col?.type === "enum" || col?.type === "tags") {
      const allowCustom = col.enum?.allowCustom ?? col.tags?.allowCustom;
      const options = col.enum?.options ?? col.tags?.options ?? [];
      if (allowCustom === false) {
        const select = document.createElement("select");
        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = "";
        select.appendChild(empty);
        for (const opt of options) {
          const op = document.createElement("option");
          op.value = opt;
          op.textContent = opt;
          if (initial === opt) op.selected = true;
          select.appendChild(op);
        }
        return { control: select, value: initial };
      }
      const input = document.createElement("input");
      input.type = "text";
      const listId = `extable-datalist-${String(colKey)}`;
      input.setAttribute("list", listId);
      input.value = initial;
      let datalist = document.getElementById(listId) as HTMLDataListElement | null;
      if (!datalist) {
        datalist = document.createElement("datalist");
        datalist.id = listId;
        for (const opt of options) {
          const op = document.createElement("option");
          op.value = opt;
          datalist.appendChild(op);
        }
        this.root.appendChild(datalist);
      }
      return { control: input, value: initial, datalistId: listId };
    }
    const input = document.createElement("input");
    input.type = "text";
    input.value = initial;
    return { control: input, value: initial };
  }

  private getInitialEditValue(colKey: string, current: unknown): string {
    if (current === null || current === undefined) return "";
    const col = this.findColumn(colKey);
    if (!col) return String(current);

    if (typeof current === "object") {
      const obj = current as Record<string, unknown>;
      if (obj.kind === "lookup" && typeof obj.label === "string") {
        return obj.label;
      }
      if (typeof obj.kind !== "string" && typeof obj.label === "string" && "value" in obj) {
        return obj.label;
      }
    }

    if ((col.type === "number" || col.type === "int" || col.type === "uint") && typeof current === "number") {
      if (col.type === "number") {
        const fmt = col.format as { format?: string; precision?: number; scale?: number } | undefined;
        const token = fmt?.format ?? "decimal";
        if (token === "scientific") {
          return formatNumberForEdit(current, { format: "scientific", precision: fmt?.precision });
        }
        return formatNumberForEdit(current, { format: "decimal", scale: fmt?.scale });
      }

      const fmt = col.format as { format?: string } | undefined;
      const token = fmt?.format ?? "decimal";
      if (token === "binary" || token === "octal" || token === "hex") {
        return formatIntegerWithPrefix(current, token);
      }
      return String(current);
    }

    return String(current);
  }

  private readActiveValueForCommit(): { ok: true; value: unknown } | { ok: false } {
    if (!this.inputEl || !this.activeCell || this.activeCell.colKey === null) {
      return { ok: true, value: this.inputEl?.value ?? "" };
    }

    const col = this.findColumn(this.activeCell.colKey);
    if (
      col &&
      (col.type === "number" || col.type === "int" || col.type === "uint") &&
      this.inputEl instanceof HTMLInputElement
    ) {
      const normalized = normalizeNumericInput(this.inputEl.value);
      if (normalized === "") return { ok: true, value: "" };

      const parsed = parseNumericText(normalized);
      if (!parsed.ok) return { ok: false };
      const coerced = coerceNumericForColumn(parsed.value, col.type);
      if (!coerced.ok) return { ok: false };
      return { ok: true, value: coerced.value };
    }

    return { ok: true, value: this.readActiveValue() };
  }

  private tryCommitActiveEditor(): boolean {
    if (!this.inputEl || !this.activeCell || this.activeCell.colKey === null) return true;
    const { rowId, colKey } = this.activeCell;
    const next = this.readActiveValueForCommit();
    if (!next.ok) {
      this.inputEl.focus({ preventScroll: true });
      return false;
    }
    this.commitEdit(rowId, colKey, next.value);
    this.onMove(rowId);
    this.teardownInput(false);
    return true;
  }

  private autosize(ta: HTMLTextAreaElement) {
    const style = window.getComputedStyle(ta);
    let lineHeight = Number.parseFloat(style.lineHeight);
    if (!Number.isFinite(lineHeight) || lineHeight <= 0) lineHeight = 16;
    ta.rows = 1; // shrink to measure
    const lines = Math.ceil(ta.scrollHeight / lineHeight);
    ta.rows = Math.max(1, lines);
    ta.style.minHeight = `${lineHeight}px`;
  }

  private positionFloatingContentBox(
    box: { left: number; top: number; width: number; height: number },
    wrapper: HTMLDivElement,
  ) {
    const insetX = CELL_PADDING_X_PX;
    const insetTop = CELL_PADDING_TOP_PX;
    const insetBottom = CELL_PADDING_BOTTOM_PX;
    wrapper.style.left = `${box.left + insetX}px`;
    wrapper.style.top = `${box.top + insetTop}px`;
    wrapper.style.width = `${Math.max(8, box.width - insetX * 2)}px`;
    wrapper.style.height = `${Math.max(8, box.height - (insetTop + insetBottom))}px`;
  }

  private handleClick = (ev: MouseEvent) => {
    const el = ev.target as HTMLElement | null;
    if (ev.button !== 0) {
      return; // only left click starts edit/selection; right-click is handled by contextmenu
    }
    // Allow clicks on lookup dropdown buttons to propagate
    if (el?.closest('button.extable-lookup-option')) {
      return;
    }
    if (el?.closest('button[data-extable-fs-open="1"]')) {
      return;
    }
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    if (this.inputEl && ev.target && this.inputEl.contains(ev.target as Node)) {
      return;
    }
    if (this.inputEl && this.activeCell && this.activeCell.colKey !== null) {
      if (!this.tryCommitActiveEditor()) return;
    }
    const hit = this.getHitAtClientPoint(ev.clientX, ev.clientY, ev.target);
    if (!hit) return;
    const actionHit = this.hitAction ? this.hitAction(ev) : null;
    if (actionHit) {
      if ((globalThis as { __EXTABLE_DEBUG_ACTIONS?: boolean }).__EXTABLE_DEBUG_ACTIONS) {
      }
      if (actionHit.kind === "tag-remove") {
        const removed = this.removeTagValue(actionHit.rowId, actionHit.colKey, actionHit.tagIndex);
        if (removed) {
          ev.preventDefault();
          return;
        }
      } else {
        const triggered = this.triggerCellAction(actionHit.rowId, actionHit.colKey, actionHit.kind);
        if (triggered) {
          ev.preventDefault();
          return;
        }
      }
    } else if ((globalThis as { __EXTABLE_DEBUG_ACTIONS?: boolean }).__EXTABLE_DEBUG_ACTIONS) {
    }
    const wasSameCell =
      this.selectionMode &&
      !ev.shiftKey &&
      !ev.metaKey &&
      !ev.ctrlKey &&
      this.activeCell?.rowId === hit.rowId &&
      String(this.activeCell?.colKey) === String(hit.colKey);
    if (hit.rowId === "__all__" && hit.colKey === "__all__") {
      const schema = this.dataModel.getSchema();
      const rows = this.dataModel.listRows();
      this.teardownInput(false);
      if (rows.length && schema.columns.length) {
        this.selectionRanges = [
          {
            kind: "cells",
            startRow: 0,
            endRow: rows.length - 1,
            startCol: 0,
            endCol: schema.columns.length - 1,
          },
        ];
        this.activeCell = { rowId: "__all__", colKey: "__all__" };
        this.onActiveChange("__all__", "__all__");
        this.onSelectionChange(this.selectionRanges);
        this.updateFillHandleFlag();
        this.selectionMode = true;
        this.selectionAnchor = null;
        this.focusSelectionInput("");
      } else {
        this.activeCell = null;
        this.onActiveChange("__all__", "__all__");
        this.selectionAnchor = null;
      }
      return;
    }
    this.onRowSelect(hit.rowId);
    if (hit.rowId === "__header__") {
      const schema = this.dataModel.getSchema();
      const rows = this.dataModel.listRows();
      const colIndex = schema.columns.findIndex((c) => String(c.key) === String(hit.colKey));
      if (rows.length && colIndex >= 0) {
        this.selectionRanges = [
          {
            kind: "cells",
            startRow: 0,
            endRow: rows.length - 1,
            startCol: colIndex,
            endCol: colIndex,
          },
        ];
        this.activeCell = { rowId: rows[0].id, colKey: hit.colKey };
        this.onActiveChange(this.activeCell.rowId, this.activeCell.colKey);
        this.onSelectionChange(this.selectionRanges);
        this.updateFillHandleFlag();
        this.selectionMode = true;
        this.selectionAnchor = null;
        this.focusSelectionInput("");
      }
      return;
    }
    this.applySelectionFromHit(ev, hit);
    if (hit.colKey === null || hit.colKey === "__all__") {
      this.selectionMode = true;
      this.selectionAnchor = null;
      this.focusSelectionInput("");
      return;
    }
    if (hit.rowId === "__header__") {
      this.selectionMode = true;
      this.selectionAnchor = null;
      this.focusSelectionInput("");
      return;
    }
    if (this.isCellReadonly(hit.rowId, hit.colKey)) {
      this.selectionMode = true;
      this.selectionAnchor = null;
      this.teardownInput(false);
      const current = this.dataModel.getCell(hit.rowId, hit.colKey);
      this.focusSelectionInput(this.cellToClipboardString(current));
      return;
    }
    const col = this.findColumn(hit.colKey);
    const isBoolean = col?.type === "boolean";
    if (isBoolean) {
      const isSecondClick =
        this.lastBooleanCell?.rowId === hit.rowId &&
        String(this.lastBooleanCell?.colKey) === String(hit.colKey);
      this.lastBooleanCell = { rowId: hit.rowId, colKey: hit.colKey };
      this.selectionMode = true;
      this.selectionAnchor = null;
      this.teardownInput(false);
      this.teardownSelectionInput();
      if (isSecondClick) {
        this.toggleBoolean(hit.rowId, hit.colKey);
        // Keep focus on the hidden selection input so Space does not scroll the container/page.
        this.focusSelectionInput("");
        return;
      }
      // Keep focus on the hidden selection input so Space can toggle.
      this.focusSelectionInput("");
      return;
    }
    this.lastBooleanCell = null;
    this.selectionAnchor = null;
    this.teardownInput(false);
    const current = this.dataModel.getCell(hit.rowId, hit.colKey);
    const currentText = this.cellToClipboardString(current);

    // Setup Lookup in selection mode if column has lookup
    const colForLookup = this.findColumn(hit.colKey);
    if (colForLookup?.edit?.lookup) {
      this.focusSelectionInput(currentText);
      if (this.selectionInput) {
        this.setupLookupEditor(hit.rowId, hit.colKey, this.selectionInput);
      }
    } else {
      this.focusSelectionInput(currentText);
    }

    if (wasSameCell) {
      this.selectionMode = false;
      this.teardownSelectionInput();
      this.openEditorAtActiveCell();
    }
  };

  private triggerCellAction(rowId: string, colKey: string, kind: "button" | "link") {
    const col = this.findColumn(colKey);
    if (!col) return false;
    if (col.type !== kind) return false;
    const interaction = this.dataModel.getCellInteraction(rowId, colKey);
    if (interaction.disabled) return false;
    const valueRes = this.dataModel.resolveCellValue(rowId, col);
    const condRes = this.dataModel.resolveConditionalStyle(rowId, col);
    const textOverride = valueRes.textOverride ?? (condRes.forceErrorText ? "#ERROR" : undefined);
    if (textOverride) return false;
    if (col.type === "button") {
      const actionValue = resolveButtonAction(valueRes.value);
      if (!actionValue) return false;
      this.onCellAction({ kind: "button", rowId, colKey, value: actionValue });
      return true;
    }
    if (col.type === "link") {
      const linkValue = resolveLinkAction(valueRes.value);
      if (!linkValue?.href) return false;
      this.openLink(linkValue.href, linkValue.target);
      return true;
    }
    return false;
  }

  private removeTagValue(rowId: string, colKey: string, tagIndex: number) {
    if (this.isCellReadonly(rowId, colKey)) return false;
    const col = this.findColumn(colKey);
    if (!col || col.type !== "tags") return false;
    const current = this.dataModel.getCell(rowId, colKey);
    const values = this.normalizeTagValues(current);
    if (!values || tagIndex < 0 || tagIndex >= values.length) return false;
    const nextValues = values.filter((_, i) => i !== tagIndex);
    const next =
      current && typeof current === "object" && (current as Record<string, unknown>).kind === "tags"
        ? { kind: "tags", values: nextValues }
        : nextValues;
    const cmd: Command = {
      kind: "edit",
      rowId,
      colKey,
      next,
    };
    const commitNow = this.editMode === "direct";
    this.onEdit(cmd, commitNow);
    return true;
  }

  private normalizeTagValues(value: unknown): string[] | null {
    if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
      return value as string[];
    }
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (obj.kind === "tags" && Array.isArray(obj.values)) {
        return obj.values.filter((v): v is string => typeof v === "string");
      }
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return [];
      return trimmed.split(/\s*,\s*/).filter(Boolean);
    }
    return null;
  }

  private openLink(href: string, target?: string) {
    if (typeof document === "undefined") return;
    if (!href) return;
    const link = document.createElement("a");
    link.href = href;
    link.target = target ?? "_self";
    link.rel = "noopener noreferrer";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  private toggleBoolean(rowId: string, colKey: string) {
    const current = this.dataModel.getCell(rowId, colKey);
    const currentBool = current === true || current === "true" || current === "1" || current === 1;
    const next = !currentBool;
    const cmd: Command = { kind: "edit", rowId, colKey, next };
    const commitNow = this.editMode === "direct";
    this.onEdit(cmd, commitNow);
    this.onMove(rowId);
  }

  private handleContextMenu = (ev: MouseEvent) => {
    const target = ev.target as Node | null;
    if (ev.ctrlKey) {
      ev.preventDefault();
      return;
    }
    if (!target || !this.root.contains(target)) return;
    ev.preventDefault();
    ev.stopPropagation();
    const hit = this.hitTest(ev);
    const rowId = hit?.rowId ?? null;
    const colKey = hit?.colKey ?? null;
    this.onContextMenu(rowId, colKey, ev.clientX, ev.clientY);
  };

  private applySelectionFromHit(ev: MouseEvent, hit: { rowId: string; colKey: string | null }) {
    const schema = this.dataModel.getSchema();
    const rowIdx = this.dataModel.getRowIndex(hit.rowId);
    const isRow = hit.colKey === null;
    const colIdx = isRow ? (schema.columns.length > 0 ? 0 : -1) : schema.columns.findIndex((c) => String(c.key) === String(hit.colKey));
    if (colIdx < 0) return;
    const targetRange: SelectionRange = isRow
      ? {
          kind: "rows",
          startRow: rowIdx,
          endRow: rowIdx,
          startCol: 0,
          endCol: schema.columns.length - 1,
        }
      : {
          kind: "cells",
          startRow: rowIdx,
          endRow: rowIdx,
          startCol: Math.max(0, colIdx),
          endCol: Math.max(0, colIdx),
        };
    let nextRanges: SelectionRange[] = [];
    if (ev.shiftKey && this.activeCell) {
      const ac = this.activeCell;
      const anchorRow = this.dataModel.getRowIndex(ac.rowId);
      const anchorCol = schema.columns.findIndex((c) => String(c.key) === String(ac.colKey));
      const anchorRange: SelectionRange = isRow
        ? {
            kind: "rows",
            startRow: anchorRow,
            endRow: rowIdx,
            startCol: 0,
            endCol: schema.columns.length - 1,
          }
        : {
            kind: "cells",
            startRow: anchorRow,
            endRow: rowIdx,
            startCol: Math.max(0, anchorCol),
            endCol: Math.max(0, colIdx),
          };
      nextRanges = [anchorRange];
    } else if (ev.metaKey || ev.ctrlKey) {
      nextRanges = [...this.selectionRanges, targetRange];
    } else {
      nextRanges = [targetRange];
    }
    this.selectionRanges = this.mergeRanges(nextRanges);
    const anchorCell =
      targetRange.kind === "rows"
        ? { rowId: hit.rowId, colKey: schema.columns[colIdx]?.key ?? null }
        : { rowId: hit.rowId, colKey: hit.colKey };
    this.activeCell = anchorCell;
    this.onActiveChange(anchorCell.rowId, anchorCell.colKey);
    this.onSelectionChange(this.selectionRanges);
    this.updateFillHandleFlag();
    if (targetRange.kind === "rows") {
      this.selectionMode = true;
      this.selectionAnchor = null;
      this.focusSelectionInput("");
    }
  }

  private mergeRanges(ranges: SelectionRange[]) {
    const merged: SelectionRange[] = [];
    const sorted = [...ranges].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "rows" ? -1 : 1;
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
      if (r.kind === "rows") {
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
    colKey: string,
    options?: { initialValueOverride?: string; placeCursorAtEnd?: boolean },
  ) {
    this.teardownInput();
    this.activeCell = { rowId, colKey };
    this.activeHost = cell;
    this.activeHostOriginalText = cell.textContent ?? "";
    const current = this.dataModel.getCell(rowId, colKey);
    this.activeOriginalValue = { rowId, colKey, value: current };
    const initialValue =
      options?.initialValueOverride ?? this.getInitialEditValue(colKey, current);
    const { control, value } = this.createEditor(colKey, initialValue);
    const input = control;
    input.value = value;
    const isCheckbox = input instanceof HTMLInputElement && input.type === "checkbox";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";
    input.style.margin = "0";
    input.style.padding = isCheckbox ? "0" : "2px 4px";
    input.style.border = "none";
    input.style.borderRadius = "0";
    input.style.boxShadow = "none";
    input.style.background = "#fff";
    input.style.color = "#000";
    input.style.outline = "none";
    input.style.fontSize = "14px";
    input.style.fontFamily = "inherit";
    input.style.lineHeight = "16px";
    input.style.fontWeight = "inherit";
    // Safari-specific fixes
    (input.style as any).WebkitAppearance = "none";
    (input.style as any).WebkitBorderRadius = "0";
    (input.style as any).WebkitBoxShadow = "none";
    (input.style as any).WebkitUserSelect = "text";
    (input.style as any).WebkitUserModify = "read-write";
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      input.style.visibility = "visible";
      input.style.opacity = "1";
      input.style.display = "block";
    }
    if (isCheckbox) {
      input.style.width = "auto";
      input.style.lineHeight = "normal";
    }
    const col = this.findColumn(colKey);
    input.style.textAlign =
      col?.style?.align ??
      (col?.type === "number" || col?.type === "int" || col?.type === "uint" ? "right" : "left");
    input.addEventListener("keydown", (e) => this.handleKey(e as KeyboardEvent, cell));
    input.addEventListener("focus", () => {
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) input.select();
    });
    this.bindImmediateCommit(input);
    cell.textContent = "";
    cell.appendChild(input);
    if (input.tagName.toLowerCase() === "textarea") {
      requestAnimationFrame(() => {
        if (input instanceof HTMLTextAreaElement) this.autosize(input);
      });
    }
    input.focus({ preventScroll: true });
    if (
      options?.placeCursorAtEnd &&
      (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)
    ) {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
    this.inputEl = input;
    this.setupLookupEditor(rowId, colKey, input);
  }

  private activateFloating(
    rect: DOMRect,
    rowId: string,
    colKey: string,
    options?: { initialValueOverride?: string; placeCursorAtEnd?: boolean },
  ) {
    this.teardownInput();
    this.activeCell = { rowId, colKey };
    void rect;
    const box = this.computeCanvasCellBoxContent(rowId, colKey);
    if (!box) return;
    const wrapper = document.createElement("div");
    this.activeHost = wrapper;
    this.activeHostOriginalText = null;
    wrapper.style.position = "absolute";
    wrapper.style.display = "block";
    wrapper.style.visibility = "visible";
    wrapper.dataset.extableFloating = "fixed";
    wrapper.style.pointerEvents = "auto";
    wrapper.style.padding = "0";
    wrapper.style.zIndex = "10";
    const current = this.dataModel.getCell(rowId, colKey);
    this.activeOriginalValue = { rowId, colKey, value: current };
    const initialValue =
      options?.initialValueOverride ?? this.getInitialEditValue(colKey, current);
    const { control, value } = this.createEditor(colKey, initialValue);
    const input = control;
    input.value = value;
    const isCheckbox = input instanceof HTMLInputElement && input.type === "checkbox";
    input.style.width = "100%";
    input.style.height = "100%";
    input.style.boxSizing = "border-box";
    input.style.margin = "0";
    input.style.padding = isCheckbox ? "0" : "2px 4px";
    input.style.border = "none";
    input.style.borderRadius = "0";
    input.style.boxShadow = "none";
    input.style.background = "#fff";
    input.style.color = "#000";
    input.style.outline = "none";
    input.style.fontSize = "14px";
    input.style.fontFamily = "inherit";
    input.style.lineHeight = "16px";
    input.style.fontWeight = "inherit";
    // Safari-specific fixes
    (input.style as any).WebkitAppearance = "none";
    (input.style as any).WebkitBorderRadius = "0";
    (input.style as any).WebkitBoxShadow = "none";
    (input.style as any).WebkitUserSelect = "text";
    (input.style as any).WebkitUserModify = "read-write";
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      input.style.visibility = "visible";
      input.style.opacity = "1";
      input.style.display = "block";
    }
    if (isCheckbox) {
      input.style.width = "auto";
      input.style.height = "auto";
      input.style.lineHeight = "normal";
    }
    const col = this.findColumn(colKey);
    input.style.textAlign =
      col?.style?.align ??
      (col?.type === "number" || col?.type === "int" || col?.type === "uint" ? "right" : "left");
    input.style.pointerEvents = "auto";
    input.addEventListener("keydown", (e) => this.handleKey(e as KeyboardEvent, wrapper));
    input.addEventListener("compositionstart", this.handleInputCompositionStart);
    input.addEventListener("compositionend", this.handleInputCompositionEnd);
    input.addEventListener("focus", () => {
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) input.select();
    });
    this.bindImmediateCommit(input);
    wrapper.appendChild(input);
    if (input instanceof HTMLSelectElement) {
      // No auto focus/click for select; standard focus will allow selection on first interaction
    }
    if (input.tagName.toLowerCase() === "textarea") {
      requestAnimationFrame(() => {
        if (input instanceof HTMLTextAreaElement) this.autosize(input);
      });
    }
    this.root.appendChild(wrapper);
    this.positionFloatingContentBox(box, wrapper);
    input.focus({ preventScroll: true });
    if (
      options?.placeCursorAtEnd &&
      (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)
    ) {
      const end = input.value.length;
      input.setSelectionRange(end, end);
    }
    this.inputEl = input;
    this.floatingInputWrapper = wrapper;
    this.setupLookupEditor(rowId, colKey, input);
  }

  private handleKey(e: KeyboardEvent, cell: HTMLElement) {
    if (!this.activeCell || !this.inputEl) return;
    const now = Date.now();
    if (e.isComposing || this.composing) return; // IME composing; ignore control keys
    if (now - this.lastCompositionEnd < 24) return; // absorb trailing key events right after IME commit
    if (this.handleLookupKeydown(e)) return;
    const { rowId, colKey } = this.activeCell;
    if (colKey === null) return;
    const isTextarea = this.inputEl.tagName.toLowerCase() === "textarea";
    const isAltEnter = e.key === "Enter" && e.altKey;
    const commitAndMove = (deltaRow: number, deltaCol: number) => {
      const next = this.readActiveValueForCommit();
      if (!next.ok) return;
      this.commitEdit(rowId, colKey, next.value);
      this.onMove(rowId);
      this.teardownInput(false);
      this.moveActiveCell(deltaRow, deltaCol);
    };

    if (e.key === "Tab") {
      e.preventDefault();
      commitAndMove(0, e.shiftKey ? -1 : 1);
      return;
    }
    if (e.key === "Enter") {
      if (isTextarea && isAltEnter) {
        // allow newline insertion (Excel-like Alt+Enter)
        return;
      }
      e.preventDefault();
      commitAndMove(e.shiftKey ? -1 : 1, 0);
      return;
    }
      if (e.key === "Escape") {
        e.preventDefault();
        this.cancelEdit(cell);
        this.onMove();
        if (this.activeCell && this.activeCell.colKey !== null) {
          const current = this.dataModel.getCell(this.activeCell.rowId, this.activeCell.colKey);
          const currentText = this.cellToClipboardString(current);
          this.focusSelectionInput(currentText);
        }
      } else if (e.key === "Backspace" && this.inputEl.value === "") {
        e.preventDefault();
        this.commitEdit(rowId, colKey, "");
        this.onMove(rowId);
        this.teardownInput(false);
        this.moveActiveCell(0, 0);
      }
  }

  private commitEdit(rowId: string, colKey: string | null, value: unknown) {
    if (colKey === null) return;
    const col = this.findColumn(colKey);
    const normalized =
      col?.type === "labeled"
        ? value &&
            typeof value === "object" &&
            typeof (value as any).label === "string" &&
            "value" in (value as any)
          ? value
          : { label: value === null || value === undefined ? "" : String(value), value: value ?? "" }
        : value;
    const cmd: Command = {
      kind: "edit",
      rowId,
      colKey,
      next: normalized,
    };
    const commitNow = this.editMode === "direct";
    this.onEdit(cmd, commitNow);
  }

  private readActiveValue() {
    if (!this.inputEl || !this.activeCell) return this.inputEl?.value ?? "";
    if (this.inputEl instanceof HTMLInputElement) {
      if (this.inputEl.type === "checkbox") {
        return this.inputEl.checked;
      }
      if (this.inputEl.type === "number") {
        if (this.inputEl.value === "") return "";
        const parsed = Number(this.inputEl.value);
        return Number.isNaN(parsed) ? "" : parsed;
      }
      return this.inputEl.value;
    }
    if (this.inputEl instanceof HTMLSelectElement) {
      return this.inputEl.value;
    }
    return (this.inputEl as HTMLTextAreaElement).value;
  }

  private bindImmediateCommit(control: HTMLElement) {
    if (!this.activeCell) return;
    const isInstant =
      control instanceof HTMLInputElement
        ? control.type === "checkbox" ||
          control.type === "date" ||
          control.type === "time" ||
          control.type === "datetime-local"
        : control instanceof HTMLSelectElement;
    if (!isInstant) return;
    control.addEventListener("change", () => {
      const ac = this.activeCell;
      if (!ac) return;
      const { rowId, colKey } = ac;
      if (colKey === null) return;
      const next = this.readActiveValueForCommit();
      if (!next.ok) return;
      this.commitEdit(rowId, colKey, next.value);
      this.onMove(rowId);
      this.teardownInput(false);
    });
  }

  private cancelEdit(cell: HTMLElement) {
    const ac = this.activeCell;
    if (!ac || ac.colKey === null) {
      this.teardownInput(false);
      cell.blur();
      return;
    }

    const { rowId, colKey } = ac;
    const orig =
      this.activeOriginalValue &&
      this.activeOriginalValue.rowId === rowId &&
      this.activeOriginalValue.colKey === colKey
        ? this.activeOriginalValue.value
        : this.dataModel.getCell(rowId, colKey);

    const current = this.dataModel.getCell(rowId, colKey);
    const norm = (v: unknown) => (v === null || v === undefined ? "" : v);
    const normalizedOrig = norm(orig);
    const normalizedCurrent = norm(current);

    // If something committed/changed during this edit session (e.g. due to a validation path),
    // revert it back to the original value. Otherwise, do not emit any command.
    if (!Object.is(normalizedCurrent, normalizedOrig)) {
      const cmd: Command = {
        kind: "edit",
        rowId,
        colKey,
        next: normalizedOrig,
        prev: normalizedCurrent,
      };
      this.onEdit(cmd, true);
    }

    this.teardownInput(false);
    cell.blur();
  }

  private teardownInput(clearActive = false) {
    this.teardownLookupEditor();
    removeFromParent(this.inputEl);
    removeFromParent(this.floatingInputWrapper);
    if (this.activeHost && this.activeHostOriginalText !== null) {
      this.activeHost.textContent = this.activeHostOriginalText;
    }
    this.inputEl = null;
    this.floatingInputWrapper = null;
    this.activeHost = null;
    this.activeHostOriginalText = null;
    this.activeOriginalValue = null;
    this.composing = false;
    if (clearActive) {
      this.activeCell = null;
      this.onActiveChange(null, null);
      this.hideHoverTooltip();
    }
  }
}
