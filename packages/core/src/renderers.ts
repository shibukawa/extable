import type { DataModel } from "./dataModel";
import type { InternalRow, Schema, ColumnSchema, SelectionRange } from "./types";
import { format as formatDate, parseISO } from "date-fns";

const DAY_MS = 86_400_000;

function safeParseDate(value: string): Date | null {
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeParseTime(value: string): Date | null {
  const parsed = new Date(`1970-01-01T${value}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toRawValue(raw: unknown, value: unknown, col: ColumnSchema): string | null {
  if (value === null || value === undefined) return null;
  if (col.type === "string") return null;
  if (col.type === "boolean") return String(Boolean(value));
  if (col.type === "number" && typeof value === "number") return String(value);
  if (col.type === "datetime") {
    const d = value instanceof Date ? value : safeParseDate(String(value));
    return d ? String(d.getTime()) : null;
  }
  if (col.type === "date") {
    const d = value instanceof Date ? value : safeParseDate(String(value));
    if (!d) return null;
    const floored = Math.floor(d.getTime() / DAY_MS) * DAY_MS;
    return String(floored);
  }
  if (col.type === "time") {
    const d = value instanceof Date ? value : safeParseTime(String(value));
    if (!d) return null;
    return String(d.getTime() % DAY_MS);
  }
  return null;
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
  private defaultRowHeight = 24;
  private rowHeaderWidth = 48;
  private activeRowId: string | null = null;
  private activeColKey: string | number | null = null;
  private selection: SelectionRange[] = [];
  private numberFormatCache = new Map<string, Intl.NumberFormat>();
  private dateParseCache = new Map<string, Date>();
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
    const colWidths = schema.columns.map(
      (c) => view.columnWidths?.[String(c.key)] ?? c.width ?? 100,
    );
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
    this.tableEl.appendChild(this.renderHeader(schema));
    const body = document.createElement("tbody");
    for (const row of rows) {
      body.appendChild(this.renderRow(row, schema));
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
    if (this.tableEl && this.tableEl.parentElement) {
      this.tableEl.parentElement.removeChild(this.tableEl);
    }
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

  private renderHeader(schema: Schema) {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    const rowTh = document.createElement("th");
    rowTh.classList.add("extable-row-header", "extable-corner");
    rowTh.textContent = "";
    rowTh.style.width = `${this.rowHeaderWidth}px`;
    if (this.activeRowId) rowTh.classList.toggle("extable-active-row-header", true);
    rowTh.dataset.colKey = "__row__";
    tr.appendChild(rowTh);
    for (const col of schema.columns) {
      const th = document.createElement("th");
      th.textContent = col.header ?? String(col.key);
      if (col.width) th.style.width = `${col.width}px`;
      th.dataset.colKey = String(col.key);
      if (this.activeColKey !== null && String(this.activeColKey) === String(col.key)) {
        th.classList.add("extable-active-col-header");
      }
      tr.appendChild(th);
    }
    thead.appendChild(tr);
    return thead;
  }

  private renderRow(row: InternalRow, schema: Schema) {
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
    for (const col of schema.columns) {
      const td = document.createElement("td");
      td.classList.add("extable-cell");
      td.dataset.colKey = String(col.key);
      const width = view.columnWidths?.[String(col.key)] ?? col.width;
      if (width) td.style.width = `${width}px`;
      const wrap = view.wrapText?.[String(col.key)] ?? col.wrapText;
      td.classList.add(wrap ? "cell-wrap" : "cell-nowrap");
      const raw = this.dataModel.getRawCell(row.id, col.key);
      const value = this.dataModel.getCell(row.id, col.key);
      const formatted = this.formatValue(value, col);
      const isPending = this.dataModel.hasPending(row.id, col.key);
      td.textContent = formatted.text;
      if (formatted.color) td.style.color = formatted.color;
      const align = col.format?.align ?? (col.type === "number" ? "right" : "left");
      td.classList.add(align === "right" ? "align-right" : "align-left");
      const rawNumbered = toRawValue(raw, value, col);
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
      for (const col of schema.columns) {
        if (!col.wrapText) continue;
        const width = view.columnWidths?.[String(col.key)] ?? col.width ?? 100;
        const value = this.dataModel.getCell(row.id, col.key);
        const text = value === null || value === undefined ? "" : String(value);
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
        measure.style.whiteSpace = "pre-wrap";
        measure.style.overflowWrap = "anywhere";
        measure.style.display = "inline-block";
        measure.style.width = `${width}px`;
        measure.textContent = text;
        document.body.appendChild(measure);
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
      const key = JSON.stringify(opts);
      let fmt = this.numberFormatCache.get(key);
      if (!fmt) {
        fmt = new Intl.NumberFormat("en-US", opts);
        this.numberFormatCache.set(key, fmt);
      }
      const text = fmt.format(num);
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
        const cached = this.dateParseCache.get(value);
        const parsed = cached ?? parseISO(value);
        if (!cached && !Number.isNaN(parsed.getTime())) this.dateParseCache.set(value, parsed);
        d = Number.isNaN(parsed.getTime()) ? null : parsed;
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
  private dataModel: DataModel;
  private readonly rowHeight = 24;
  private readonly headerHeight = 24;
  private readonly lineHeight = 16;
  private readonly padding = 12;
  private readonly rowHeaderWidth = 48;
  private activeRowId: string | null = null;
  private activeColKey: string | number | null = null;
  private selection: SelectionRange[] = [];
  private numberFormatCache = new Map<string, Intl.NumberFormat>();
  private dateParseCache = new Map<string, Date>();
  private textMeasureCache = new Map<string, { lines: string[]; frame: number }>();
  private frame = 0;

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
    this.spacer = document.createElement("div");
    this.spacer.style.width = "1px";
    root.innerHTML = "";
    root.style.position = "relative";
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
    const selectAll = this.activeRowId === "__all__" && this.activeColKey === "__all__";
    const schema = this.dataModel.getSchema();
    const view = this.dataModel.getView();
    const rows = this.dataModel.listRows();
    const colWidths = schema.columns.map(
      (c) => view.columnWidths?.[String(c.key)] ?? c.width ?? 100,
    );
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
      for (let idx = 0; idx < schema.columns.length; idx += 1) {
        const c = schema.columns[idx];
        const w = colWidths[idx] ?? 100;
        const readOnly = this.dataModel.isReadonly(row.id, c.key);
        ctx.strokeStyle = "#d0d7de";
        ctx.fillStyle = readOnly ? "#f3f4f6" : "#ffffff";
        ctx.fillRect(x, yCursor, w, rowH);
        ctx.strokeRect(x, yCursor, w, rowH);
        const value = this.dataModel.getCell(row.id, c.key);
        const formatted = this.formatValue(value, c);
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
        }
        ctx.fillStyle = this.dataModel.hasPending(row.id, c.key)
          ? "#b91c1c"
          : formatted.color
            ? formatted.color
            : readOnly
              ? "#94a3b8"
              : "#0f172a";
        const wrap = view.wrapText?.[String(c.key)] ?? c.wrapText ?? false;
        const isBoolean =
          c.type === "boolean" && (!c.booleanDisplay || c.booleanDisplay === "checkbox");
        const isCustomBoolean =
          c.type === "boolean" && Boolean(c.booleanDisplay && c.booleanDisplay !== "checkbox");
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
        );
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
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    if (this.spacer && this.spacer.parentElement) {
      this.spacer.parentElement.removeChild(this.spacer);
    }
    this.canvas = null;
    this.spacer = null;
    this.root = null;
  }

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
    const colWidths = schema.columns.map(
      (c) => view.columnWidths?.[String(c.key)] ?? c.width ?? 100,
    );
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
      const value = this.dataModel.getCell(row.id, c.key);
      const text = this.formatValue(value, c).text;
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
      if (align === "right") {
        ctx.textAlign = "right";
        ctx.fillText(ln, x + width, y + this.lineHeight * lineIdx);
      } else if (align === "center") {
        ctx.textAlign = "center";
        ctx.fillText(ln, x + width / 2, y + this.lineHeight * lineIdx);
      } else {
        ctx.textAlign = "left";
        ctx.fillText(ln, x, y + this.lineHeight * lineIdx);
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
      const key = JSON.stringify(opts);
      let fmt = this.numberFormatCache.get(key);
      if (!fmt) {
        fmt = new Intl.NumberFormat("en-US", opts);
        this.numberFormatCache.set(key, fmt);
      }
      const text = fmt.format(num);
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
        const cached = this.dateParseCache.get(value);
        const parsed = cached ?? parseISO(value);
        if (!cached && !Number.isNaN(parsed.getTime())) this.dateParseCache.set(value, parsed);
        d = Number.isNaN(parsed.getTime()) ? null : parsed;
      }
      if (!d) return { text: String(value) };
      return { text: formatDate(d, fmt) };
    }
    return { text: String(value) };
  }
}
