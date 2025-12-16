import type { DataModel } from "./dataModel";
import type { InternalRow, Schema, ColumnSchema, SelectionRange, View, ViewFilterValues } from "./types";
import { format as formatDate, parseISO } from "date-fns";
import { toRawValue } from "./cellValueCodec";
import { DEFAULT_ROW_HEIGHT_PX, HEADER_HEIGHT_PX, ROW_HEADER_WIDTH_PX, getColumnWidths } from "./geometry";
import {
  FILL_HANDLE_HIT_SIZE_PX,
  FILL_HANDLE_VISUAL_SIZE_PX,
  getFillHandleRect,
  isPointInRect,
  shouldShowFillHandle,
} from "./fillHandle";
import { removeFromParent } from "./utils";
import { columnFormatToStyle, mergeStyle, styleToCssText } from "./styleResolver";

function getColumnSortDir(view: View, colKey: string | number): "asc" | "desc" | null {
  const s = view.sorts?.[0];
  if (!s) return null;
  return String(s.key) === String(colKey) ? s.dir : null;
}

function hasActiveColumnFilter(view: View, colKey: string | number): boolean {
  const hasValues = (view.filters ?? []).some((f) => {
    const vf = f as ViewFilterValues;
    return vf?.kind === "values" && String(vf.key) === String(colKey);
  });
  if (hasValues) return true;
  const diag = view.columnDiagnostics?.[String(colKey)];
  return Boolean(diag?.errors || diag?.warnings);
}

function svgFunnel() {
  // Simple funnel icon (stroke only) for filter affordance.
  return `
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `.trim();
}

function svgArrow(dir: "asc" | "desc") {
  const d =
    dir === "asc"
      ? "M12 6l6 8H6l6-8z"
      : "M12 18l-6-8h12l-6 8z";
  return `
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="${d}" fill="currentColor"/>
    </svg>
  `.trim();
}

function drawDiagnosticCorner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  level: "warning" | "error",
) {
  const size = Math.min(10, Math.floor(Math.min(w, h) / 2));
  if (size <= 0) return;
  const color = level === "error" ? "#ef4444" : "#f59e0b";
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w - size, y);
  ctx.lineTo(x + w, y + size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

class ValueFormatCache {
  private numberFormatCache = new Map<string, Intl.NumberFormat>();
  private dateParseCache = new Map<string, Date>();

  getNumberFormatter(options: Intl.NumberFormatOptions): Intl.NumberFormat {
    const key = JSON.stringify(options);
    let fmt = this.numberFormatCache.get(key);
    if (!fmt) {
      fmt = new Intl.NumberFormat("en-US", options);
      this.numberFormatCache.set(key, fmt);
    }
    return fmt;
  }

  parseIsoDate(value: string): Date | null {
    const cached = this.dateParseCache.get(value);
    const parsed = cached ?? parseISO(value);
    if (!cached && !Number.isNaN(parsed.getTime())) this.dateParseCache.set(value, parsed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}

function drawFunnelIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "rgba(15,23,42,1)";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  // Top trapezoid
  ctx.moveTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + Math.round(size * 0.62), y + Math.round(size * 0.46));
  ctx.lineTo(x + Math.round(size * 0.38), y + Math.round(size * 0.46));
  ctx.closePath();
  ctx.stroke();
  // Stem
  ctx.beginPath();
  ctx.moveTo(x + Math.round(size * 0.46), y + Math.round(size * 0.46));
  ctx.lineTo(x + Math.round(size * 0.46), y + size);
  ctx.lineTo(x + Math.round(size * 0.54), y + size - 2);
  ctx.lineTo(x + Math.round(size * 0.54), y + Math.round(size * 0.46));
  ctx.stroke();
  ctx.restore();
}

function drawSortArrowIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
  dir: "asc" | "desc",
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(15,23,42,1)";
  ctx.beginPath();
  if (dir === "asc") {
    ctx.moveTo(x + size / 2, y);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x, y + size);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size / 2, y + size);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export interface ViewportState {
  scrollTop: number;
  scrollLeft: number;
  clientWidth: number;
  clientHeight: number;
  deltaX: number;
  deltaY: number;
  timestamp: number;
}

export interface Renderer {
  mount(root: HTMLElement): void;
  render(state?: ViewportState): void;
  destroy(): void;
  getCellElements(): NodeListOf<HTMLElement> | null;
  hitTest(
    event: MouseEvent,
  ): { rowId: string; colKey: string | number; element?: HTMLElement; rect: DOMRect } | null;
  setActiveCell(rowId: string | null, colKey: string | number | null): void;
  setSelection(ranges: SelectionRange[]): void;
}

export class HTMLRenderer implements Renderer {
  private tableEl: HTMLTableElement | null = null;
  private defaultRowHeight = DEFAULT_ROW_HEIGHT_PX;
  private rowHeaderWidth = ROW_HEADER_WIDTH_PX;
  private activeRowId: string | null = null;
  private activeColKey: string | number | null = null;
  private selection: SelectionRange[] = [];
  private valueFormatCache = new ValueFormatCache();
  private measureCache = new Map<string, { height: number; frame: number }>();
  private frame = 0;
  constructor(private dataModel: DataModel) {}

  mount(root: HTMLElement) {
    this.tableEl = document.createElement("table");
    this.tableEl.dataset.extableRenderer = "html";
    root.innerHTML = "";
    root.classList.add("extable-root");
    root.appendChild(this.tableEl);
    this.render();
  }

  setActiveCell(rowId: string | null, colKey: string | number | null) {
    this.activeRowId = rowId;
    this.activeColKey = colKey;
    this.updateActiveClasses();
  }

  setSelection(ranges: SelectionRange[]) {
    this.selection = ranges;
    this.applySelectionClasses();
  }

  render(_state?: ViewportState) {
    this.frame += 1;
    if (!this.tableEl) return;
    const scrollContainer = this.tableEl.parentElement;
    const prevTop = scrollContainer?.scrollTop ?? 0;
    const prevLeft = scrollContainer?.scrollLeft ?? 0;
    const schema = this.dataModel.getSchema();
    const view = this.dataModel.getView();
    const rows = this.dataModel.listRows();
    this.tableEl.innerHTML = "";
    const colWidths = getColumnWidths(schema, view);
    const colBaseStyles = schema.columns.map((c) => columnFormatToStyle(c));
    const colBaseCss = colBaseStyles.map((s) => styleToCssText(s));
    const totalWidth = this.rowHeaderWidth + colWidths.reduce((acc, w) => acc + (w ?? 0), 0);
    const colgroup = document.createElement("colgroup");
    const rowCol = document.createElement("col");
    rowCol.style.width = `${this.rowHeaderWidth}px`;
    colgroup.appendChild(rowCol);
    for (const w of colWidths) {
      const colEl = document.createElement("col");
      if (w) colEl.style.width = `${w}px`;
      colgroup.appendChild(colEl);
    }
    this.tableEl.appendChild(colgroup);
    this.tableEl.style.width = `${totalWidth}px`;
    this.tableEl.appendChild(this.renderHeader(schema, colWidths));
    const body = document.createElement("tbody");
    for (const row of rows) {
      body.appendChild(this.renderRow(row, schema, colWidths, colBaseStyles, colBaseCss));
    }
    this.tableEl.appendChild(body);
    this.updateActiveClasses();
    this.applySelectionClasses();
    if (scrollContainer) {
      scrollContainer.scrollTop = prevTop;
      scrollContainer.scrollLeft = prevLeft;
    }
    for (const [key, entry] of Array.from(this.measureCache.entries())) {
      if (entry.frame !== this.frame) this.measureCache.delete(key);
    }
  }

  destroy() {
    removeFromParent(this.tableEl);
    this.tableEl = null;
  }

  getCellElements() {
    return this.tableEl?.querySelectorAll<HTMLElement>("tr[data-row-id] td[data-col-key]") ?? null;
  }

  hitTest(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target) return null;
    const corner = target.closest<HTMLElement>("th.extable-corner");
    if (corner) {
      return {
        rowId: "__all__",
        colKey: "__all__",
        element: corner,
        rect: corner.getBoundingClientRect(),
      };
    }
    const rowHeader = target.closest<HTMLElement>("th.extable-row-header:not(.extable-corner)");
    if (rowHeader) {
      const row = rowHeader.closest<HTMLElement>("tr[data-row-id]");
      if (row) {
        return {
          rowId: row.dataset.rowId!,
          colKey: "__row__",
          element: rowHeader,
          rect: rowHeader.getBoundingClientRect(),
        };
      }
    }
    const cell = target.closest<HTMLElement>("td[data-col-key]");
    const row = cell?.closest<HTMLElement>("tr[data-row-id]");
    if (!cell || !row) return null;
    return {
      rowId: row.dataset.rowId!,
      colKey: cell.dataset.colKey!,
      element: cell,
      rect: cell.getBoundingClientRect(),
    };
  }

  private renderHeader(schema: Schema, colWidths: number[]) {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    const rowTh = document.createElement("th");
    rowTh.classList.add("extable-row-header", "extable-corner");
    rowTh.textContent = "";
    rowTh.style.width = `${this.rowHeaderWidth}px`;
    if (this.activeRowId) rowTh.classList.toggle("extable-active-row-header", true);
    rowTh.dataset.colKey = "__row__";
    tr.appendChild(rowTh);
    const view = this.dataModel.getView();
    for (let idx = 0; idx < schema.columns.length; idx += 1) {
      const col = schema.columns[idx]!;
      const th = document.createElement("th");
      const sortDir = getColumnSortDir(view, col.key);
      const hasFilter = hasActiveColumnFilter(view, col.key);
      if (sortDir) th.dataset.extableSortDir = sortDir;
      else th.removeAttribute("data-extable-sort-dir");
      if (hasFilter) th.dataset.extableFsActive = "1";
      else th.removeAttribute("data-extable-fs-active");

      const wrap = document.createElement("div");
      wrap.className = "extable-col-header";
      const label = document.createElement("span");
      label.className = "extable-col-header-text";
      label.textContent = col.header ?? String(col.key);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "extable-filter-sort-trigger";
      btn.dataset.extableFsOpen = "1";
      btn.dataset.extableColKey = String(col.key);
      btn.title = "Filter / Sort";
      btn.innerHTML = sortDir ? svgArrow(sortDir) : svgFunnel();
      wrap.appendChild(label);
      wrap.appendChild(btn);
      th.appendChild(wrap);
      const width = colWidths[idx] ?? col.width;
      if (width) th.style.width = `${width}px`;
      th.dataset.colKey = String(col.key);
      if (this.activeColKey !== null && String(this.activeColKey) === String(col.key)) {
        th.classList.add("extable-active-col-header");
      }
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    return thead;
  }

  private renderRow(
    row: InternalRow,
    schema: Schema,
    colWidths: number[],
    colBaseStyles: ReturnType<typeof columnFormatToStyle>[],
    colBaseCss: string[],
  ) {
    const tr = document.createElement("tr");
    tr.dataset.rowId = row.id;
    const view = this.dataModel.getView();
    const rowHeader = document.createElement("th");
    rowHeader.scope = "row";
    rowHeader.classList.add("extable-row-header");
    const index = this.dataModel.getDisplayIndex(row.id) ?? "";
    rowHeader.textContent = String(index);
    rowHeader.style.width = `${this.rowHeaderWidth}px`;
    if (this.activeRowId === row.id) rowHeader.classList.add("extable-active-row-header");
    tr.appendChild(rowHeader);
    for (let idx = 0; idx < schema.columns.length; idx += 1) {
      const col = schema.columns[idx]!;
      const td = document.createElement("td");
      td.classList.add("extable-cell");
      td.dataset.colKey = String(col.key);
      if (col.type === "boolean") td.classList.add("extable-boolean");
      const isPending = this.dataModel.hasPending(row.id, col.key);
      const condRes = this.dataModel.resolveConditionalStyle(row.id, col);
      const cellStyle = this.dataModel.getCellStyle(row.id, col.key);
      if (!cellStyle && !condRes.delta && !isPending) {
        const css = colBaseCss[idx] ?? "";
        if (css) td.style.cssText = css;
      } else {
        const baseStyle = colBaseStyles[idx] ?? {};
        const withCond = condRes.delta ? mergeStyle(baseStyle, condRes.delta) : baseStyle;
        const merged = cellStyle ? mergeStyle(withCond, cellStyle) : withCond;
        const forCss = isPending ? { ...merged, textColor: undefined } : merged;
        const css = styleToCssText(forCss);
        if (css) td.style.cssText = css;
      }
      const width = colWidths[idx] ?? (view.columnWidths?.[String(col.key)] ?? col.width);
      if (width) td.style.width = `${width}px`;
      const wrap = view.wrapText?.[String(col.key)] ?? col.wrapText;
      td.classList.add(wrap ? "cell-wrap" : "cell-nowrap");
      const raw = this.dataModel.getRawCell(row.id, col.key);
      const valueRes = this.dataModel.resolveCellValue(row.id, col);
      const textOverride = valueRes.textOverride ?? (condRes.forceErrorText ? "#ERROR" : undefined);
      const formatted = textOverride
        ? { text: textOverride as string }
        : this.formatValue(valueRes.value, col);
      td.textContent = formatted.text;
      if (formatted.color) td.style.color = formatted.color;
      const diag = this.dataModel.getCellDiagnostic(row.id, col.key);
      const marker = this.dataModel.getCellMarker(row.id, col.key);
      if (marker) {
        td.classList.toggle("extable-diag-warning", marker.level === "warning");
        td.classList.toggle("extable-diag-error", marker.level === "error");
        td.dataset.extableDiagMessage = marker.message;
      } else {
        td.classList.remove("extable-diag-warning", "extable-diag-error");
        td.removeAttribute("data-extable-diag-message");
      }
      const align = col.format?.align ?? (col.type === "number" ? "right" : "left");
      td.classList.add(align === "right" ? "align-right" : "align-left");
      const rawNumbered = toRawValue(raw, valueRes.value, col);
      if (rawNumbered !== null) {
        td.dataset.raw = rawNumbered;
      } else {
        const rawStr = raw === null || raw === undefined ? "" : String(raw);
        td.dataset.raw = rawStr;
      }
      if (isPending) td.classList.add("pending");
      if (this.dataModel.isReadonly(row.id, col.key)) {
        td.classList.add("extable-readonly");
      } else {
        td.classList.add("extable-editable");
      }
      if (
        this.activeRowId === row.id &&
        this.activeColKey !== null &&
        String(this.activeColKey) === String(col.key)
      ) {
        td.classList.add("extable-active-cell");
      }
      tr.appendChild(td);
    }
    // variable row height based on measured content when wrap enabled
    const wrapAny = schema.columns.some((c) => view.wrapText?.[String(c.key)] ?? c.wrapText);
    if (wrapAny) {
      let maxHeight = this.defaultRowHeight;
      for (let idx = 0; idx < schema.columns.length; idx += 1) {
        const col = schema.columns[idx]!;
        if (!col.wrapText) continue;
        const width = colWidths[idx] ?? (view.columnWidths?.[String(col.key)] ?? col.width ?? 100);
        const valueRes = this.dataModel.resolveCellValue(row.id, col);
        const condRes = this.dataModel.resolveConditionalStyle(row.id, col);
        const textOverride = valueRes.textOverride ?? (condRes.forceErrorText ? "#ERROR" : undefined);
        const text = textOverride ? "#ERROR" : (valueRes.value === null || valueRes.value === undefined ? "" : String(valueRes.value));
        const version = this.dataModel.getRowVersion(row.id);
        const key = `${row.id}|${String(col.key)}|${version}|${width}|${text}`;
        const cached = this.measureCache.get(key);
        if (cached) {
          cached.frame = this.frame;
          this.measureCache.set(key, cached);
          maxHeight = Math.max(maxHeight, cached.height);
          continue;
        }
        const measure = document.createElement("span");
        measure.style.visibility = "hidden";
        measure.style.position = "absolute";
        measure.style.left = "-10000px";
        measure.style.top = "0";
        measure.style.whiteSpace = "pre-wrap";
        measure.style.overflowWrap = "anywhere";
        measure.style.display = "inline-block";
        measure.style.width = `${width}px`;
        measure.textContent = text;
        const measureHost = this.tableEl?.parentElement;
        if (!measureHost) continue;
        measureHost.appendChild(measure);
        const h = measure.clientHeight + 10; // padding allowance
        measure.remove();
        this.measureCache.set(key, { height: h, frame: this.frame });
        maxHeight = Math.max(maxHeight, h);
      }
      tr.style.height = `${maxHeight}px`;
      this.dataModel.setRowHeight(row.id, maxHeight);
    } else {
      tr.style.height = `${this.defaultRowHeight}px`;
      this.dataModel.setRowHeight(row.id, this.defaultRowHeight);
    }
    return tr;
  }

  private updateActiveClasses() {
    if (!this.tableEl) return;
    const isAll = this.activeRowId === "__all__" && this.activeColKey === "__all__";
    this.tableEl.classList.toggle("extable-all-selected", isAll);
    for (const el of Array.from(this.tableEl.querySelectorAll(".extable-active-row-header"))) {
      el.classList.remove("extable-active-row-header");
    }
    for (const el of Array.from(this.tableEl.querySelectorAll(".extable-active-col-header"))) {
      el.classList.remove("extable-active-col-header");
    }
    for (const el of Array.from(this.tableEl.querySelectorAll(".extable-active-cell"))) {
      el.classList.remove("extable-active-cell");
    }
    if (this.activeRowId) {
      for (const el of Array.from(
        this.tableEl.querySelectorAll<HTMLElement>(
          `tr[data-row-id="${this.activeRowId}"] .extable-row-header`,
        ),
      )) {
        el.classList.add("extable-active-row-header");
      }
    }
    if (this.activeColKey !== null) {
      for (const el of Array.from(
        this.tableEl.querySelectorAll<HTMLElement>(
          `th[data-col-key="${String(this.activeColKey)}"]`,
        ),
      )) {
        el.classList.add("extable-active-col-header");
      }
      if (this.activeRowId) {
        for (const el of Array.from(
          this.tableEl.querySelectorAll<HTMLElement>(
            `tr[data-row-id="${this.activeRowId}"] td[data-col-key="${String(this.activeColKey)}"]`,
          ),
        )) {
          el.classList.add("extable-active-cell");
        }
      }
    }
  }

  private applySelectionClasses() {
    if (!this.tableEl) return;
    for (const el of Array.from(this.tableEl.querySelectorAll(".extable-selected"))) {
      el.classList.remove("extable-selected");
    }
    if (!this.selection.length) return;
    const rows = Array.from(this.tableEl.querySelectorAll<HTMLTableRowElement>("tbody tr"));
    const schema = this.dataModel.getSchema();
    for (const range of this.selection) {
      const startRow = Math.max(0, Math.min(range.startRow, range.endRow));
      const endRow = Math.min(rows.length - 1, Math.max(range.startRow, range.endRow));
      const startCol = Math.max(0, Math.min(range.startCol, range.endCol));
      const endCol = Math.min(schema.columns.length - 1, Math.max(range.startCol, range.endCol));
      for (let r = startRow; r <= endRow; r += 1) {
        const rowEl = rows[r];
        if (!rowEl) continue;
        const th = rowEl.querySelector("th.extable-row-header");
        if (th) th.classList.add("extable-selected");
        const cells = Array.from(rowEl.querySelectorAll<HTMLTableCellElement>("td"));
        for (let c = startCol; c <= endCol; c += 1) {
          const cell = cells[c];
          if (cell) cell.classList.add("extable-selected");
        }
      }
    }
  }

  private formatValue(value: unknown, col: ColumnSchema): { text: string; color?: string } {
    if (value === null || value === undefined) return { text: "" };
    if (col.type === "boolean") {
      if (col.booleanDisplay === "checkbox" || !col.booleanDisplay) {
        return { text: value ? "☑" : "☐" };
      }
      if (Array.isArray(col.booleanDisplay) && col.booleanDisplay.length >= 2) {
        return { text: value ? String(col.booleanDisplay[0]) : String(col.booleanDisplay[1]) };
      }
      return { text: value ? String(col.booleanDisplay) : "" };
    }
    if (col.type === "number" && typeof value === "number") {
      const num = value;
      const opts: Intl.NumberFormatOptions = {};
      if (col.number?.scale !== undefined) {
        opts.minimumFractionDigits = col.number.scale;
        opts.maximumFractionDigits = col.number.scale;
      }
      opts.useGrouping = Boolean(col.number?.thousandSeparator);
      const text = this.valueFormatCache.getNumberFormatter(opts).format(num);
      const color = col.number?.negativeRed && num < 0 ? "#b91c1c" : undefined;
      return { text, color };
    }
    if (
      (col.type === "date" || col.type === "time" || col.type === "datetime") &&
      (value instanceof Date || typeof value === "string")
    ) {
      const fmt =
        col.type === "date"
          ? (col.dateFormat ?? "yyyy-MM-dd")
          : col.type === "time"
            ? (col.timeFormat ?? "HH:mm")
            : (col.dateTimeFormat ?? "yyyy-MM-dd'T'HH:mm:ss'Z'");
      let d: Date | null = null;
      if (value instanceof Date) d = value;
      else {
        d = this.valueFormatCache.parseIsoDate(value);
      }
      if (!d) return { text: String(value) };
      return { text: formatDate(d, fmt) };
    }
    return { text: String(value) };
  }
}

export class CanvasRenderer implements Renderer {
  private root: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private spacer: HTMLDivElement | null = null;
  private overlayLayer: HTMLDivElement | null = null;
  private tooltip: HTMLDivElement | null = null;
  private tooltipTarget: { rowId: string; colKey: string | number } | null = null;
  private tooltipMessage: string | null = null;
  private dataModel: DataModel;
  private readonly rowHeight = DEFAULT_ROW_HEIGHT_PX;
  private readonly headerHeight = HEADER_HEIGHT_PX;
  private readonly lineHeight = 16;
  private readonly padding = 12;
  private readonly rowHeaderWidth = ROW_HEADER_WIDTH_PX;
  private activeRowId: string | null = null;
  private activeColKey: string | number | null = null;
  private selection: SelectionRange[] = [];
  private valueFormatCache = new ValueFormatCache();
  private textMeasureCache = new Map<string, { lines: string[]; frame: number }>();
  private frame = 0;
  private cursorTimer: number | null = null;
  private pendingCursorPoint: { x: number; y: number } | null = null;
  private hoverHeaderColKey: string | number | null = null;
  private hoverHeaderIcon = false;

  constructor(dataModel: DataModel) {
    this.dataModel = dataModel;
  }

  mount(root: HTMLElement) {
    this.root = root;
    this.root.classList.add("extable-root");
    root.style.overflow = "auto";
    this.canvas = document.createElement("canvas");
    this.canvas.width = root.clientWidth || 600;
    this.canvas.height = root.clientHeight || 400;
    this.canvas.style.width = `${this.canvas.width}px`;
    this.canvas.style.height = `${this.canvas.height}px`;
    this.canvas.dataset.extableRenderer = "canvas";
    this.canvas.style.position = "sticky";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.zIndex = "1";
    this.canvas.style.cursor = "cell";
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerleave", this.handlePointerLeave);
    this.canvas.addEventListener("click", this.handleClick);
    this.spacer = document.createElement("div");
    this.spacer.style.width = "1px";
	    if (this.tooltip) this.tooltip.remove();
	    if (this.overlayLayer) this.overlayLayer.remove();
	    this.overlayLayer = document.createElement("div");
	    this.overlayLayer.className = "extable-overlay-layer";
	    this.tooltip = document.createElement("div");
	    this.tooltip.className = "extable-tooltip";
	    this.tooltip.dataset.visible = "0";
	    this.overlayLayer.appendChild(this.tooltip);
	    root.innerHTML = "";
	    root.style.position = "relative";
	    root.appendChild(this.overlayLayer);
	    root.appendChild(this.canvas);
	    root.appendChild(this.spacer);
    this.render();
  }

  setActiveCell(rowId: string | null, colKey: string | number | null) {
    this.activeRowId = rowId;
    this.activeColKey = colKey;
    this.render();
  }

  setSelection(ranges: SelectionRange[]) {
    this.selection = ranges;
    this.render();
  }

  render(state?: ViewportState) {
    this.frame += 1;
    if (!this.canvas || !this.root) return;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.font = "14px sans-serif";
    const baseFont = ctx.font;
    const selectAll = this.activeRowId === "__all__" && this.activeColKey === "__all__";
    const schema = this.dataModel.getSchema();
    const view = this.dataModel.getView();
    const rows = this.dataModel.listRows();
    const colWidths = getColumnWidths(schema, view);
    const colBaseStyles = schema.columns.map((c) => columnFormatToStyle(c));
    const fontCache = new Map<string, string>();
    const rowHeights: number[] = [];
    for (const row of rows) {
      rowHeights.push(this.computeRowHeight(ctx, row, schema, colWidths));
    }
    const totalRowsHeight = rowHeights.reduce((acc, h) => acc + h, 0);
    const totalWidth = this.rowHeaderWidth + colWidths.reduce((acc, w) => acc + (w ?? 0), 0);
    if (this.spacer) {
      this.spacer.style.height = `${totalRowsHeight + this.headerHeight}px`;
      this.spacer.style.width = `${totalWidth}px`;
    }
    const desiredCanvasWidth = state?.clientWidth ?? (this.root.clientWidth || 600);
    const desiredCanvasHeight =
      state?.clientHeight ?? (this.root.clientHeight || this.canvas.height || 400);
    if (this.canvas.width !== desiredCanvasWidth) this.canvas.width = desiredCanvasWidth;
    if (this.canvas.height !== desiredCanvasHeight) this.canvas.height = desiredCanvasHeight;
    this.canvas.style.width = `${desiredCanvasWidth}px`;
    this.canvas.style.height = `${desiredCanvasHeight}px`;
    this.refreshTooltipPosition();

    const scrollTop = state?.scrollTop ?? this.root.scrollTop;
    const scrollLeft = state?.scrollLeft ?? this.root.scrollLeft;
    const contentScrollTop = Math.max(
      0,
      Math.min(scrollTop, Math.max(0, totalRowsHeight - this.rowHeight)),
    );
    const dataXOffset = this.rowHeaderWidth - scrollLeft;
    let accum = 0;
    let visibleStart = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const h = rowHeights[i] ?? this.rowHeight;
      if (contentScrollTop < accum + h) {
        visibleStart = i;
        break;
      }
      accum += h;
      if (i === rows.length - 1) visibleStart = rows.length - 1;
    }
    let visibleEnd = visibleStart;
    let drawnHeight = 0;
    const maxHeight = this.canvas.height + this.rowHeight * 2;
    for (let i = visibleStart; i < rows.length && drawnHeight < maxHeight; i += 1) {
      drawnHeight += rowHeights[i] ?? this.rowHeight;
      visibleEnd = i + 1;
    }

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // Keep row-header column background visible across scroll
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(0, 0, this.rowHeaderWidth, this.canvas.height);
    // Body
    let yCursor = this.headerHeight + accum - contentScrollTop;
    for (let i = visibleStart; i < visibleEnd; i += 1) {
      const row = rows[i];
      const rowH = rowHeights[i] ?? this.rowHeight;
      // row header cell
      ctx.strokeStyle = "#d0d7de";
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(0, yCursor, this.rowHeaderWidth, rowH);
      ctx.strokeRect(0, yCursor, this.rowHeaderWidth, rowH);
      const idxText = this.dataModel.getDisplayIndex(row.id) ?? "";
      if (this.activeRowId === row.id) {
        ctx.fillStyle = "rgba(59,130,246,0.16)";
        ctx.fillRect(0, yCursor, this.rowHeaderWidth, rowH);
      }
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(String(idxText), 8, yCursor + this.lineHeight);
      ctx.font = baseFont;

      ctx.save();
      ctx.beginPath();
      ctx.rect(
        this.rowHeaderWidth,
        this.headerHeight,
        this.canvas.width - this.rowHeaderWidth,
        this.canvas.height - this.headerHeight,
      );
      ctx.clip();
      ctx.translate(dataXOffset, 0);
      let x = 0;
      let lastFontKey = "";
      for (let idx = 0; idx < schema.columns.length; idx += 1) {
        const c = schema.columns[idx];
        const w = colWidths[idx] ?? 100;
        const readOnly = this.dataModel.isReadonly(row.id, c.key);
        ctx.strokeStyle = "#d0d7de";
        const condRes = this.dataModel.resolveConditionalStyle(row.id, c);
        const cellStyle = this.dataModel.getCellStyle(row.id, c.key);
        const baseStyle = colBaseStyles[idx] ?? {};
        const withCond = condRes.delta ? mergeStyle(baseStyle, condRes.delta) : baseStyle;
        const mergedStyle = cellStyle ? mergeStyle(withCond, cellStyle) : withCond;
        const bg = readOnly ? "#f3f4f6" : mergedStyle.background ?? "#ffffff";
        ctx.fillStyle = bg;
        ctx.fillRect(x, yCursor, w, rowH);
        ctx.strokeRect(x, yCursor, w, rowH);
        const valueRes = this.dataModel.resolveCellValue(row.id, c);
        const textOverride = valueRes.textOverride ?? (condRes.forceErrorText ? "#ERROR" : undefined);
        const formatted = textOverride ? { text: "#ERROR" } : this.formatValue(valueRes.value, c);
        const text = formatted.text;
        const align = c.format?.align ?? (c.type === "number" ? "right" : "left");
        const isActiveCell =
          this.activeRowId === row.id &&
          this.activeColKey !== null &&
          String(this.activeColKey) === String(c.key);
        if (isActiveCell) {
          ctx.strokeStyle = "#3b82f6";
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, yCursor + 1, w - 2, rowH - 2);
          ctx.lineWidth = 1;
          if (shouldShowFillHandle(this.dataModel, this.selection, this.activeRowId, this.activeColKey)) {
            const size = FILL_HANDLE_VISUAL_SIZE_PX;
            const left = x + w - size - 1;
            const top = yCursor + rowH - size - 1;
            ctx.fillStyle = "#3b82f6";
            ctx.fillRect(left, top, size, size);
            ctx.strokeStyle = "#ffffff";
            ctx.strokeRect(left + 0.5, top + 0.5, size - 1, size - 1);
          }
        }
        ctx.fillStyle = this.dataModel.hasPending(row.id, c.key)
          ? "#b91c1c"
          : formatted.color
            ? formatted.color
            : readOnly
              ? "#94a3b8"
              : mergedStyle.textColor ?? "#0f172a";
        const wrap = view.wrapText?.[String(c.key)] ?? c.wrapText ?? false;
        const isBoolean =
          c.type === "boolean" && (!c.booleanDisplay || c.booleanDisplay === "checkbox");
        const isCustomBoolean =
          c.type === "boolean" && Boolean(c.booleanDisplay && c.booleanDisplay !== "checkbox");
        if (!isBoolean) {
          const fontKey = `${mergedStyle.italic ? "i" : ""}${mergedStyle.bold ? "b" : ""}`;
          if (fontKey !== lastFontKey) {
            const cached = fontCache.get(fontKey);
            if (cached) ctx.font = cached;
            else {
              const weight = mergedStyle.bold ? "600 " : "";
              const ital = mergedStyle.italic ? "italic " : "";
              const f = `${ital}${weight}14px sans-serif`.trim();
              fontCache.set(fontKey, f);
              ctx.font = f;
            }
            lastFontKey = fontKey;
          }
        } else {
          ctx.font = baseFont;
          lastFontKey = "";
        }
        this.drawCellText(
          ctx,
          text,
          x + 8,
          yCursor + 6,
          w - 12,
          rowH - 12,
          wrap,
          align,
          isBoolean,
          isCustomBoolean,
          { underline: Boolean(mergedStyle.underline), strike: Boolean(mergedStyle.strike) },
        );
        const marker = this.dataModel.getCellMarker(row.id, c.key);
        if (marker) drawDiagnosticCorner(ctx, x, yCursor, w, rowH, marker.level);
        x += w;
      }
      ctx.restore();
      yCursor += rowH;
    }

    // update spacer height after computing dynamic row heights
    const totalHeight = rowHeights.reduce((acc, h) => acc + h, 0);
    if (this.spacer) this.spacer.style.height = `${totalHeight}px`;

    // Header (draw last to stay on top)
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(0, 0, this.canvas.width, this.headerHeight);
    ctx.strokeStyle = "#d0d7de";
    // corner
    ctx.strokeRect(0, 0, this.rowHeaderWidth, this.headerHeight);
    ctx.fillStyle = "#9ca3af";
    ctx.beginPath();
    ctx.moveTo(4, 4);
    ctx.lineTo(16, 4);
    ctx.lineTo(4, 16);
    ctx.closePath();
    ctx.fill();
    if (this.activeRowId) {
      ctx.fillStyle = "rgba(59,130,246,0.16)";
      ctx.fillRect(0, 0, this.rowHeaderWidth, this.headerHeight);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(this.rowHeaderWidth, 0, this.canvas.width - this.rowHeaderWidth, this.headerHeight);
    ctx.clip();
    ctx.translate(dataXOffset, 0);
    let xHeader = 0;
    for (let idx = 0; idx < schema.columns.length; idx += 1) {
      const c = schema.columns[idx];
      const w = colWidths[idx] ?? 100;
      const isActiveCol = this.activeColKey !== null && String(this.activeColKey) === String(c.key);
      if (isActiveCol) {
        ctx.fillStyle = "rgba(59,130,246,0.16)";
        ctx.fillRect(xHeader, 0, w, this.headerHeight);
      }
      ctx.strokeStyle = "#d0d7de";
      ctx.strokeRect(xHeader, 0, w, this.headerHeight);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(c.header ?? String(c.key), xHeader + 8, this.headerHeight - 8);
      ctx.font = baseFont;

      const sortDir = getColumnSortDir(view, c.key);
      const hasFilter = hasActiveColumnFilter(view, c.key);
      const isHover = this.hoverHeaderColKey !== null && String(this.hoverHeaderColKey) === String(c.key);
      const showIcon = Boolean(sortDir) || hasFilter || isHover;
      if (showIcon) {
        const alpha = isHover ? 0.9 : hasFilter || sortDir ? 0.75 : 0.45;
        const iconBox = 16;
        const pad = 6;
        const ix = xHeader + w - iconBox - pad;
        const iy = Math.floor((this.headerHeight - iconBox) / 2);
        if (sortDir) {
          drawSortArrowIcon(ctx, ix + 3, iy + 3, iconBox - 6, alpha, sortDir);
        } else {
          drawFunnelIcon(ctx, ix + 2, iy + 2, iconBox - 4, alpha);
        }
      }
      xHeader += w;
    }
    ctx.restore();

    // selection overlay
    if (this.selection.length) {
      ctx.save();
      ctx.strokeStyle = "#3b82f6";
      ctx.fillStyle = "rgba(59,130,246,0.12)";
      for (const range of this.selection) {
        const startRow = Math.max(0, Math.min(range.startRow, range.endRow));
        const endRow = Math.min(rows.length - 1, Math.max(range.startRow, range.endRow));
        const startCol = Math.max(0, Math.min(range.startCol, range.endCol));
        const endCol = Math.min(schema.columns.length - 1, Math.max(range.startCol, range.endCol));
        let yTop = this.headerHeight;
        for (let i = 0; i < startRow; i += 1) {
          yTop += rowHeights[i] ?? this.rowHeight;
        }
        let height = 0;
        for (let i = startRow; i <= endRow; i += 1) {
          height += rowHeights[i] ?? this.rowHeight;
        }
        const contentScrollTop = Math.max(
          0,
          Math.min(scrollTop, Math.max(0, totalRowsHeight - this.rowHeight)),
        );
        yTop -= contentScrollTop;
        let xLeft = this.rowHeaderWidth;
        for (let c = 0; c < startCol; c += 1) {
          xLeft += colWidths[c] ?? 100;
        }
        let width = 0;
        for (let c = startCol; c <= endCol; c += 1) {
          width += colWidths[c] ?? 100;
        }
        xLeft -= scrollLeft;
        ctx.fillRect(xLeft, yTop, width, height);
        ctx.strokeRect(xLeft + 0.5, yTop + 0.5, width - 1, height - 1);
      }
      ctx.restore();
    }

    if (selectAll) {
      ctx.save();
      ctx.fillStyle = "rgba(59,130,246,0.08)";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
    }
  }

  destroy() {
    if (this.canvas) {
      this.canvas.removeEventListener("pointermove", this.handlePointerMove);
      this.canvas.removeEventListener("pointerleave", this.handlePointerLeave);
      this.canvas.removeEventListener("click", this.handleClick);
    }
    if (this.cursorTimer) {
      window.clearTimeout(this.cursorTimer);
      this.cursorTimer = null;
    }
    this.pendingCursorPoint = null;
    removeFromParent(this.canvas);
    removeFromParent(this.spacer);
    removeFromParent(this.overlayLayer);
    removeFromParent(this.tooltip);
    this.canvas = null;
    this.spacer = null;
    this.overlayLayer = null;
    this.tooltip = null;
    this.tooltipTarget = null;
    this.tooltipMessage = null;
    this.root = null;
  }

  private handleClick = (ev: MouseEvent) => {
    if (!this.root || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left + this.root.scrollLeft;
    const y = ev.clientY - rect.top + this.root.scrollTop;
    if (y >= this.headerHeight) return;
    if (x < this.rowHeaderWidth) return;
    const schema = this.dataModel.getSchema();
    const view = this.dataModel.getView();
    const colWidths = getColumnWidths(schema, view);
    let xCursor = this.rowHeaderWidth;
    let colIndex = -1;
    for (let i = 0; i < colWidths.length; i += 1) {
      const w = colWidths[i] ?? 100;
      if (x >= xCursor && x <= xCursor + w) {
        colIndex = i;
        break;
      }
      xCursor += w;
    }
    if (colIndex < 0) return;
    const col = schema.columns[colIndex];
    if (!col) return;
    const w = colWidths[colIndex] ?? 100;
    const iconSize = 18;
    const pad = 4;
    const iconLeft = xCursor + w - iconSize - pad;
    const iconTop = Math.floor((this.headerHeight - iconSize) / 2);
    const inIcon =
      x >= iconLeft && x <= iconLeft + iconSize && y >= iconTop && y <= iconTop + iconSize;
    if (!inIcon) return;
    this.root.dispatchEvent(
      new CustomEvent("extable:filter-sort-open", { bubbles: true, detail: { colKey: col.key } }),
    );
  };

  getCellElements() {
    return null;
  }

  hitTest(event: MouseEvent) {
    if (!this.root || !this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left + this.root.scrollLeft;
    const y = event.clientY - rect.top + this.root.scrollTop;
    const schema = this.dataModel.getSchema();
    const view = this.dataModel.getView();
    const rows = this.dataModel.listRows();
    const headerHeight = this.headerHeight;
    const colWidths = getColumnWidths(schema, view);
    const totalRowsHeight = rows.reduce(
      (acc, row) => acc + (this.dataModel.getRowHeight(row.id) ?? this.rowHeight),
      0,
    );
    const contentScrollTop = Math.max(
      0,
      Math.min(
        this.root.scrollTop - this.headerHeight,
        Math.max(0, totalRowsHeight - this.rowHeight),
      ),
    );
    if (y < headerHeight && x < this.rowHeaderWidth) {
      return {
        rowId: "__all__",
        colKey: "__all__",
        rect: new DOMRect(rect.left, rect.top, this.rowHeaderWidth, headerHeight),
      };
    }
    if (y < headerHeight) return null;
    if (x < this.rowHeaderWidth) {
      let accumHeight = 0;
      let rowIndex = -1;
      for (let i = 0; i < rows.length; i += 1) {
        const h = this.dataModel.getRowHeight(rows[i].id) ?? this.rowHeight;
        if (y - headerHeight < accumHeight + h) {
          rowIndex = i;
          break;
        }
        accumHeight += h;
      }
      if (rowIndex < 0 || rowIndex >= rows.length) return null;
      const row = rows[rowIndex];
      const topPx = rect.top + headerHeight + accumHeight - contentScrollTop;
      const cellRect = new DOMRect(
        rect.left,
        topPx,
        this.rowHeaderWidth,
        this.dataModel.getRowHeight(row.id) ?? this.rowHeight,
      );
      return { rowId: row.id, colKey: "__row__", rect: cellRect };
    }
    let rowIndex = -1;
    let accumHeight = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const h = this.dataModel.getRowHeight(rows[i].id) ?? this.rowHeight;
      if (y - headerHeight < accumHeight + h) {
        rowIndex = i;
        break;
      }
      accumHeight += h;
    }
    if (rowIndex < 0 || rowIndex >= rows.length) return null;
    let xCursor = this.rowHeaderWidth;
    let colIndex = -1;
    for (let i = 0; i < colWidths.length; i += 1) {
      const w = colWidths[i] ?? 100;
      if (x >= xCursor && x <= xCursor + w) {
        colIndex = i;
        break;
      }
      xCursor += w;
    }
    if (colIndex === -1) return null;
    const row = rows[rowIndex];
    const col = schema.columns[colIndex];
    const rowTop = accumHeight;
    const cellRect = new DOMRect(
      rect.left + xCursor - this.root.scrollLeft,
      rect.top + headerHeight + rowTop - this.root.scrollTop,
      colWidths[colIndex] ?? 100,
      this.dataModel.getRowHeight(row.id) ?? this.rowHeight,
    );
    return { rowId: row.id, colKey: col.key, rect: cellRect };
  }

  private isPointInSelection(rowId: string, colKey: string | number) {
    if (!this.selection.length) return false;
    const schema = this.dataModel.getSchema();
    const rowIndex = this.dataModel.getRowIndex(rowId);
    const colIndex = schema.columns.findIndex((c) => String(c.key) === String(colKey));
    if (rowIndex < 0 || colIndex < 0) return false;
    for (const range of this.selection) {
      if (range.kind !== "cells") continue;
      const startRow = Math.min(range.startRow, range.endRow);
      const endRow = Math.max(range.startRow, range.endRow);
      const startCol = Math.min(range.startCol, range.endCol);
      const endCol = Math.max(range.startCol, range.endCol);
      if (rowIndex >= startRow && rowIndex <= endRow && colIndex >= startCol && colIndex <= endCol)
        return true;
    }
    return false;
  }

  private handlePointerMove = (ev: PointerEvent) => {
    this.pendingCursorPoint = { x: ev.clientX, y: ev.clientY };
    if (this.cursorTimer) return;
    this.cursorTimer = window.setTimeout(() => {
      this.cursorTimer = null;
      const p = this.pendingCursorPoint;
      if (!p) return;
      this.updateCanvasCursor(p.x, p.y);
    }, 50);
  };

  private handlePointerLeave = () => {
    if (!this.canvas) return;
    this.canvas.style.cursor = "cell";
    if (this.tooltip) this.tooltip.dataset.visible = "0";
    this.tooltipTarget = null;
    this.tooltipMessage = null;
  };

  private positionTooltipAtRect(rect: DOMRect) {
    if (!this.tooltip) return;
    if (!this.root) return;
    const pad = 8;
    const rootRect = this.root.getBoundingClientRect();
    const maxW = this.root.clientWidth;
    const maxH = this.root.clientHeight;
    let left = rect.right - rootRect.left + pad;
    let top = rect.top - rootRect.top + pad;
    let side: "right" | "left" = "right";
    const tRect = this.tooltip.getBoundingClientRect();
    if (left + tRect.width > maxW) {
      left = Math.max(0, rect.left - rootRect.left - tRect.width - pad);
      side = "left";
    }
    if (top + tRect.height > maxH) top = Math.max(0, maxH - tRect.height - pad);
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
    this.tooltip.dataset.side = side;
  }

  private refreshTooltipPosition() {
    if (!this.tooltip || this.tooltip.dataset.visible !== "1") return;
    if (!this.tooltipTarget || !this.tooltipMessage) return;
    const rect = this.getCellRect(this.tooltipTarget.rowId, this.tooltipTarget.colKey);
    if (!rect) {
      this.tooltip.dataset.visible = "0";
      this.tooltipTarget = null;
      this.tooltipMessage = null;
      return;
    }
    this.tooltip.textContent = this.tooltipMessage;
    this.positionTooltipAtRect(rect);
  }

  private getCellRect(rowId: string, colKey: string | number): DOMRect | null {
    if (!this.root || !this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const schema = this.dataModel.getSchema();
    const view = this.dataModel.getView();
    const rows = this.dataModel.listRows();
    const rowIndex = this.dataModel.getRowIndex(rowId);
    const colIndex = schema.columns.findIndex((c) => String(c.key) === String(colKey));
    if (rowIndex < 0 || colIndex < 0) return null;
    const colWidths = getColumnWidths(schema, view);
    let accumHeight = 0;
    for (let i = 0; i < rowIndex; i += 1) {
      const r = rows[i];
      if (!r) break;
      accumHeight += this.dataModel.getRowHeight(r.id) ?? this.rowHeight;
    }
    let xCursor = this.rowHeaderWidth;
    for (let i = 0; i < colIndex; i += 1) {
      xCursor += colWidths[i] ?? 100;
    }
    return new DOMRect(
      rect.left + xCursor - this.root.scrollLeft,
      rect.top + this.headerHeight + accumHeight - this.root.scrollTop,
      colWidths[colIndex] ?? 100,
      this.dataModel.getRowHeight(rowId) ?? this.rowHeight,
    );
  }

  private updateCanvasCursor(clientX: number, clientY: number) {
    if (!this.root || !this.canvas) return;
    if (this.root.dataset.extableFillDragging === "1") {
      this.canvas.style.cursor = "crosshair";
      return;
    }
    // Header hover (filter/sort icon affordance)
    {
      const rect = this.canvas.getBoundingClientRect();
      const x = clientX - rect.left + this.root.scrollLeft;
      const y = clientY - rect.top + this.root.scrollTop;
      const prevKey = this.hoverHeaderColKey;
      const prevIcon = this.hoverHeaderIcon;
      let nextKey: string | number | null = null;
      let nextIcon = false;
      if (y >= 0 && y < this.headerHeight && x >= this.rowHeaderWidth) {
        const schema = this.dataModel.getSchema();
        const view = this.dataModel.getView();
        const colWidths = getColumnWidths(schema, view);
        let xCursor = this.rowHeaderWidth;
        let colIndex = -1;
        for (let i = 0; i < colWidths.length; i += 1) {
          const w = colWidths[i] ?? 100;
          if (x >= xCursor && x <= xCursor + w) {
            colIndex = i;
            break;
          }
          xCursor += w;
        }
        const col = colIndex >= 0 ? schema.columns[colIndex] : null;
        if (col) {
          nextKey = col.key;
          const w = colWidths[colIndex] ?? 100;
          const iconSize = 18;
          const pad = 4;
          const iconLeft = xCursor + w - iconSize - pad;
          const iconTop = Math.floor((this.headerHeight - iconSize) / 2);
          nextIcon =
            x >= iconLeft && x <= iconLeft + iconSize && y >= iconTop && y <= iconTop + iconSize;
        }
      }
      const changed =
        String(prevKey ?? "") !== String(nextKey ?? "") || Boolean(prevIcon) !== Boolean(nextIcon);
      this.hoverHeaderColKey = nextKey;
      this.hoverHeaderIcon = nextIcon;
      if (nextKey !== null) {
        this.canvas.style.cursor = nextIcon ? "pointer" : "cell";
        if (this.tooltip) this.tooltip.dataset.visible = "0";
        this.tooltipTarget = null;
        this.tooltipMessage = null;
        if (changed) this.render();
        return;
      }
      if (changed) this.render();
    }
    // Cursor spec:
    // - No selection or outside selection: cell
    // - Inside selection & on fill handle: crosshair
    // - Inside selection & readonly/boolean: default
    // - Inside selection & others: text
    let cursor = "cell";

    const hit = this.hitTest(new MouseEvent("mousemove", { clientX, clientY }));
    if (!hit) {
      this.canvas.style.cursor = cursor;
      if (this.tooltip) this.tooltip.dataset.visible = "0";
      this.tooltipTarget = null;
      this.tooltipMessage = null;
      return;
    }
    if (hit.colKey === "__all__" || hit.colKey === "__row__") {
      this.canvas.style.cursor = "cell";
      if (this.tooltip) this.tooltip.dataset.visible = "0";
      this.tooltipTarget = null;
      this.tooltipMessage = null;
      return;
    }

    const marker = this.dataModel.getCellMarker(hit.rowId, hit.colKey);
    if (this.tooltip && marker) {
      const sameCell =
        this.tooltipTarget &&
        this.tooltipTarget.rowId === hit.rowId &&
        String(this.tooltipTarget.colKey) === String(hit.colKey);
      const sameMessage = this.tooltipMessage === marker.message;
      if (!sameCell || !sameMessage || this.tooltip.dataset.visible !== "1") {
        this.tooltipTarget = { rowId: hit.rowId, colKey: hit.colKey };
        this.tooltipMessage = marker.message;
        this.tooltip.textContent = marker.message;
        const rect = this.getCellRect(hit.rowId, hit.colKey);
        if (rect) {
          this.positionTooltipAtRect(rect);
          this.tooltip.dataset.visible = "1";
        } else {
          this.tooltip.dataset.visible = "0";
        }
      }
    } else if (this.tooltip) {
      this.tooltip.dataset.visible = "0";
      this.tooltipTarget = null;
      this.tooltipMessage = null;
    }

    if (!this.isPointInSelection(hit.rowId, hit.colKey)) {
      this.canvas.style.cursor = "cell";
      return;
    }

    // Only the active cell shows edit-mode cursor affordances. Other selected cells stay `cell`.
    const isActiveCell =
      this.activeRowId === hit.rowId &&
      this.activeColKey !== null &&
      String(this.activeColKey) === String(hit.colKey);
    if (!isActiveCell) {
      this.canvas.style.cursor = "cell";
      return;
    }

    // Fill handle hover is only considered inside the active cell and when fill handle is shown.
    if (
      this.activeRowId &&
      this.activeColKey !== null &&
      this.activeRowId !== "__all__" &&
      this.activeColKey !== "__all__" &&
      this.activeColKey !== "__row__" &&
      shouldShowFillHandle(this.dataModel, this.selection, this.activeRowId, this.activeColKey)
    ) {
      const cellRect = this.getCellRect(this.activeRowId, this.activeColKey);
      if (cellRect) {
        const handleRect = getFillHandleRect(cellRect, FILL_HANDLE_HIT_SIZE_PX);
        if (isPointInRect(clientX, clientY, handleRect)) {
          this.canvas.style.cursor = "crosshair";
          return;
        }
      }
    }

    const col = this.dataModel
      .getSchema()
      .columns.find((c) => String(c.key) === String(hit.colKey));
    const readOnly = this.dataModel.isReadonly(hit.rowId, hit.colKey);
    if (readOnly || col?.type === "boolean") cursor = "default";
    else cursor = "text";
    this.canvas.style.cursor = cursor;
  }

  private computeRowHeight(
    ctx: CanvasRenderingContext2D,
    row: InternalRow,
    schema: Schema,
    colWidths: number[],
  ) {
    let maxHeight = this.rowHeight;
    const view = this.dataModel.getView();
    for (let idx = 0; idx < schema.columns.length; idx += 1) {
      const c = schema.columns[idx];
      const wrap = view.wrapText?.[String(c.key)] ?? c.wrapText;
      if (!wrap) continue;
      const w = (colWidths[idx] ?? 100) - this.padding;
      const valueRes = this.dataModel.resolveCellValue(row.id, c);
      const condRes = this.dataModel.resolveConditionalStyle(row.id, c);
      const textOverride = valueRes.textOverride ?? (condRes.forceErrorText ? "#ERROR" : undefined);
      const text = textOverride ? "#ERROR" : this.formatValue(valueRes.value, c).text;
      const lines = this.wrapLines(ctx, text, w);
      const h = lines.length * this.lineHeight + this.padding;
      maxHeight = Math.max(maxHeight, h);
    }
    this.dataModel.setRowHeight(row.id, maxHeight);
    return maxHeight;
  }

  private wrapLines(ctx: CanvasRenderingContext2D, text: string, width: number) {
    const key = `${ctx.font}|${width}|${text}`;
    const cached = this.textMeasureCache.get(key);
    if (cached && cached.frame === this.frame) return cached.lines;
    const rawLines = text.split("\n");
    const lines: string[] = [];
    for (const line of rawLines) {
      let current = line;
      while (ctx.measureText(current).width > width && current.length > 1) {
        let cut = current.length;
        while (cut > 1 && ctx.measureText(current.slice(0, cut)).width > width) {
          cut -= 1;
        }
        lines.push(current.slice(0, cut));
        current = current.slice(cut);
      }
      lines.push(current);
    }
    this.textMeasureCache.set(key, { lines, frame: this.frame });
    return lines;
  }

  private drawCellText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    wrap: boolean,
    align: "left" | "right" | "center" = "left",
    isBoolean = false,
    isCustomBoolean = false,
    decorations?: { underline?: boolean; strike?: boolean },
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 4, y - 4, width + 8, height + 8);
    ctx.clip();
    const fontBackup = ctx.font;
    if (isBoolean) {
      ctx.font = "28px sans-serif";
    } else if (isCustomBoolean) {
      ctx.font = "14px sans-serif";
    }
    const renderLine = (ln: string, lineIdx: number) => {
      const baseline = y + this.lineHeight * lineIdx;
      let startX = x;
      let endX = x;
      if (align === "right") {
        ctx.textAlign = "right";
        endX = x + width;
        startX = endX - ctx.measureText(ln).width;
        ctx.fillText(ln, endX, baseline);
      } else if (align === "center") {
        ctx.textAlign = "center";
        const center = x + width / 2;
        const w = ctx.measureText(ln).width;
        startX = center - w / 2;
        endX = center + w / 2;
        ctx.fillText(ln, center, baseline);
      } else {
        ctx.textAlign = "left";
        startX = x;
        endX = x + ctx.measureText(ln).width;
        ctx.fillText(ln, x, baseline);
      }
      if (decorations?.underline || decorations?.strike) {
        const strokeBackup = ctx.strokeStyle;
        const lineWidthBackup = ctx.lineWidth;
        ctx.strokeStyle = ctx.fillStyle as any;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (decorations.underline) {
          const yUnderline = baseline + 2;
          ctx.moveTo(startX, yUnderline);
          ctx.lineTo(endX, yUnderline);
        }
        if (decorations.strike) {
          const yStrike = baseline - Math.floor(this.lineHeight / 2) + 2;
          ctx.moveTo(startX, yStrike);
          ctx.lineTo(endX, yStrike);
        }
        ctx.stroke();
        ctx.strokeStyle = strokeBackup;
        ctx.lineWidth = lineWidthBackup;
      }
    };
    if (wrap) {
      const lines = this.wrapLines(ctx, text, width);
      for (let idx = 0; idx < lines.length; idx += 1) {
        renderLine(lines[idx], idx + 1);
      }
    } else {
      let out = text;
      while (ctx.measureText(out).width > width && out.length > 1) {
        out = out.slice(0, -2) + "…";
      }
      renderLine(out, 1);
    }
    ctx.textAlign = "left";
    ctx.font = fontBackup;
    ctx.restore();
  }

  private formatValue(value: unknown, col: ColumnSchema): { text: string; color?: string } {
    if (value === null || value === undefined) return { text: "" };
    if (col.type === "boolean") {
      if (col.booleanDisplay === "checkbox" || !col.booleanDisplay) {
        return { text: value ? "☑" : "☐" };
      }
      if (Array.isArray(col.booleanDisplay) && col.booleanDisplay.length >= 2) {
        return { text: value ? String(col.booleanDisplay[0]) : String(col.booleanDisplay[1]) };
      }
      return { text: value ? String(col.booleanDisplay) : "" };
    }
    if (col.type === "number" && typeof value === "number") {
      const num = value;
      const opts: Intl.NumberFormatOptions = {};
      if (col.number?.scale !== undefined) {
        opts.minimumFractionDigits = col.number.scale;
        opts.maximumFractionDigits = col.number.scale;
      }
      opts.useGrouping = Boolean(col.number?.thousandSeparator);
      const text = this.valueFormatCache.getNumberFormatter(opts).format(num);
      const color = col.number?.negativeRed && num < 0 ? "#b91c1c" : undefined;
      return { text, color };
    }
    if (
      (col.type === "date" || col.type === "time" || col.type === "datetime") &&
      (value instanceof Date || typeof value === "string")
    ) {
      const fmt =
        col.type === "date"
          ? (col.dateFormat ?? "yyyy-MM-dd")
          : col.type === "time"
            ? (col.timeFormat ?? "HH:mm")
            : (col.dateTimeFormat ?? "yyyy-MM-dd'T'HH:mm:ss'Z'");
      let d: Date | null = null;
      if (value instanceof Date) d = value;
      else {
        d = this.valueFormatCache.parseIsoDate(value);
      }
      if (!d) return { text: String(value) };
      return { text: formatDate(d, fmt) };
    }
    return { text: String(value) };
  }
}
