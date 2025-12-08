import type { DataModel } from './dataModel';
import type { InternalRow, Schema } from './types';

export interface Renderer {
  mount(root: HTMLElement): void;
  render(): void;
  destroy(): void;
  getCellElements(): NodeListOf<HTMLElement> | null;
  hitTest(event: MouseEvent): { rowId: string; colKey: string | number; element?: HTMLElement; rect: DOMRect } | null;
}

export class HTMLRenderer implements Renderer {
  private tableEl: HTMLTableElement | null = null;
  private defaultRowHeight = 24;
  constructor(private dataModel: DataModel) {}

  mount(root: HTMLElement) {
    this.tableEl = document.createElement('table');
    this.tableEl.dataset.extableRenderer = 'html';
    root.innerHTML = '';
    root.appendChild(this.tableEl);
    this.render();
  }

  render() {
    if (!this.tableEl) return;
    const scrollContainer = this.tableEl.parentElement;
    const prevTop = scrollContainer?.scrollTop ?? 0;
    const prevLeft = scrollContainer?.scrollLeft ?? 0;
    const schema = this.dataModel.getSchema();
    const rows = this.dataModel.listRows();
    this.tableEl.innerHTML = '';
    this.tableEl.appendChild(this.renderHeader(schema));
    const body = document.createElement('tbody');
    rows.forEach((row) => {
      body.appendChild(this.renderRow(row, schema));
    });
    this.tableEl.appendChild(body);
    if (scrollContainer) {
      scrollContainer.scrollTop = prevTop;
      scrollContainer.scrollLeft = prevLeft;
    }
  }

  destroy() {
    if (this.tableEl && this.tableEl.parentElement) {
      this.tableEl.parentElement.removeChild(this.tableEl);
    }
    this.tableEl = null;
  }

  getCellElements() {
    return this.tableEl?.querySelectorAll<HTMLElement>('td[data-row-id][data-col-key]') ?? null;
  }

  hitTest(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    if (!target) return null;
    const cell = target.closest<HTMLElement>('td[data-row-id][data-col-key]');
    if (!cell) return null;
    return {
      rowId: cell.dataset.rowId!,
      colKey: cell.dataset.colKey!,
      element: cell,
      rect: cell.getBoundingClientRect()
    };
  }

  private renderHeader(schema: Schema) {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    schema.columns.forEach((col) => {
      const th = document.createElement('th');
      th.textContent = col.header ?? String(col.key);
      if (col.width) th.style.width = `${col.width}px`;
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    return thead;
  }

  private renderRow(row: InternalRow, schema: Schema) {
    const tr = document.createElement('tr');
    tr.dataset.rowId = row.id;
    const view = this.dataModel.getView();
    schema.columns.forEach((col) => {
      const td = document.createElement('td');
      td.dataset.rowId = row.id;
      td.dataset.colKey = String(col.key);
      const width = view.columnWidths?.[String(col.key)] ?? col.width;
      if (width) td.style.width = `${width}px`;
      if (col.wrapText) {
        td.style.whiteSpace = 'pre-wrap';
        td.style.textOverflow = 'clip';
        td.style.overflowWrap = 'anywhere';
      } else {
        td.style.whiteSpace = 'nowrap';
        td.style.textOverflow = 'ellipsis';
        td.style.overflow = 'hidden';
      }
      const raw = this.dataModel.getRawCell(row.id, col.key);
      const value = this.dataModel.getCell(row.id, col.key);
      const isPending = this.dataModel.hasPending(row.id, col.key);
      td.textContent = value === null || value === undefined ? '' : String(value);
      td.dataset.value = value === null || value === undefined ? '' : String(value);
      td.dataset.original = raw === null || raw === undefined ? '' : String(raw);
      if (isPending) td.classList.add('pending');
      tr.appendChild(td);
    });
    // variable row height based on measured content when wrap enabled
    const wrapAny = schema.columns.some((c) => c.wrapText);
    if (wrapAny) {
      let maxHeight = this.defaultRowHeight;
      schema.columns.forEach((col) => {
        if (!col.wrapText) return;
        const width = view.columnWidths?.[String(col.key)] ?? col.width ?? 100;
        const value = this.dataModel.getCell(row.id, col.key);
        const text = value === null || value === undefined ? '' : String(value);
        const measure = document.createElement('span');
        measure.style.visibility = 'hidden';
        measure.style.position = 'absolute';
        measure.style.whiteSpace = 'pre-wrap';
        measure.style.overflowWrap = 'anywhere';
        measure.style.display = 'inline-block';
        measure.style.width = `${width}px`;
        measure.textContent = text;
        document.body.appendChild(measure);
        const h = measure.clientHeight + 10; // padding allowance
        measure.remove();
        maxHeight = Math.max(maxHeight, h);
      });
      tr.style.height = `${maxHeight}px`;
      this.dataModel.setRowHeight(row.id, maxHeight);
    } else {
      tr.style.height = `${this.defaultRowHeight}px`;
      this.dataModel.setRowHeight(row.id, this.defaultRowHeight);
    }
    return tr;
  }
}

export class CanvasRenderer implements Renderer {
  private root: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private spacer: HTMLDivElement | null = null;
  private dataModel: DataModel;
  private scrollHandler: (() => void) | null = null;
  private readonly rowHeight = 24;
  private readonly headerHeight = 24;
  private readonly lineHeight = 16;
  private readonly padding = 12;

  constructor(dataModel: DataModel) {
    this.dataModel = dataModel;
  }

  mount(root: HTMLElement) {
    this.root = root;
    root.style.overflow = 'auto';
    this.canvas = document.createElement('canvas');
    this.canvas.width = root.clientWidth || 600;
    this.canvas.height = root.clientHeight || 400;
    this.canvas.style.width = `${this.canvas.width}px`;
    this.canvas.style.height = `${this.canvas.height}px`;
    this.canvas.dataset.extableRenderer = 'canvas';
    this.canvas.style.position = 'sticky';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.spacer = document.createElement('div');
    this.spacer.style.width = '1px';
    root.innerHTML = '';
    root.style.position = 'relative';
    root.appendChild(this.canvas);
    root.appendChild(this.spacer);
    this.scrollHandler = () => {
      console.log('[extable-canvas] root scroll', {
        scrollTop: this.root?.scrollTop,
        scrollLeft: this.root?.scrollLeft
      });
      this.render();
    };
    root.addEventListener('scroll', this.scrollHandler);
    this.render();
  }

  render() {
    if (!this.canvas || !this.root) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const schema = this.dataModel.getSchema();
    const view = this.dataModel.getView();
    const rows = this.dataModel.listRows();
    const colWidths = schema.columns.map((c) => view.columnWidths?.[String(c.key)] ?? c.width ?? 100);
    const totalWidth = colWidths.reduce((acc, w) => acc + (w ?? 0), 0);
    const totalHeightInitial =
      this.headerHeight +
      rows.reduce((acc, row) => acc + (this.dataModel.getRowHeight(row.id) ?? this.rowHeight), 0);
    if (this.spacer) {
      this.spacer.style.height = `${totalHeightInitial}px`;
      this.spacer.style.width = `${totalWidth}px`;
    }
    const desiredCanvasWidth = this.root.clientWidth || 600;
    const desiredCanvasHeight = this.root.clientHeight || this.canvas.height || 400;
    if (this.canvas.width !== desiredCanvasWidth) this.canvas.width = desiredCanvasWidth;
    if (this.canvas.height !== desiredCanvasHeight) this.canvas.height = desiredCanvasHeight;
    this.canvas.style.width = `${desiredCanvasWidth}px`;
    this.canvas.style.height = `${desiredCanvasHeight}px`;

    const scrollTop = this.root.scrollTop;
    const scrollLeft = this.root.scrollLeft;
    console.log('[extable-canvas] render', {
      canvas: { width: this.canvas.width, height: this.canvas.height },
      root: {
        clientWidth: this.root.clientWidth,
        clientHeight: this.root.clientHeight,
        scrollWidth: this.root.scrollWidth,
        scrollHeight: this.root.scrollHeight,
        scrollLeft,
        scrollTop
      },
      spacer: this.spacer ? { width: this.spacer.style.width, height: this.spacer.style.height } : null,
      totalWidth,
      totalHeight: totalHeightInitial,
      colWidths
    });
    // find visible start by accumulating heights
    let accum = 0;
    let visibleStart = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const h = this.dataModel.getRowHeight(rows[i].id) ?? this.rowHeight;
      if (accum + h >= scrollTop - this.headerHeight) {
        visibleStart = i;
        break;
      }
      accum += h;
    }
    let visibleEnd = visibleStart;
    let drawnHeight = 0;
    const maxHeight = this.canvas.height + this.rowHeight * 2;
    for (let i = visibleStart; i < rows.length && drawnHeight < maxHeight; i += 1) {
      drawnHeight += this.dataModel.getRowHeight(rows[i].id) ?? this.rowHeight;
      visibleEnd = i + 1;
    }
    console.log('[extable-canvas] viewport', {
      visibleStart,
      visibleEnd,
      maxHeight,
      accumStart: accum,
      scrollTop,
      scrollLeft
    });

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(-scrollLeft, 0);

    // Header
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(0, 0, this.canvas.width, this.headerHeight);
    ctx.strokeStyle = '#d0d7de';
    let xHeader = 0;
    schema.columns.forEach((c, idx) => {
      const w = colWidths[idx] ?? 100;
      ctx.strokeRect(xHeader, 0, w, this.headerHeight);
      ctx.fillStyle = '#0f172a';
      ctx.font = '14px sans-serif';
      ctx.fillText(c.header ?? String(c.key), xHeader + 8, this.headerHeight - 8);
      xHeader += w;
    });

    // Body
    let yCursor = this.headerHeight + accum - scrollTop;
    for (let i = visibleStart; i < visibleEnd; i += 1) {
      const row = rows[i];
      const rowH = this.computeRowHeight(ctx, row, schema, colWidths);
      let x = 0;
      schema.columns.forEach((c, idx) => {
        const w = colWidths[idx] ?? 100;
        ctx.strokeStyle = '#d0d7de';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, yCursor, w, rowH);
        ctx.strokeRect(x, yCursor, w, rowH);
        const value = this.dataModel.getCell(row.id, c.key);
        const text = value === null || value === undefined ? '' : String(value);
        ctx.fillStyle = this.dataModel.hasPending(row.id, c.key) ? '#b91c1c' : '#0f172a';
        this.drawCellText(ctx, text, x + 8, yCursor + 6, w - 12, rowH - 12, c.wrapText ?? false);
        x += w;
      });
      yCursor += rowH;
    }

    // update spacer height after computing dynamic row heights
    const totalHeight =
      this.headerHeight +
      rows.reduce((acc, row) => acc + (this.dataModel.getRowHeight(row.id) ?? this.rowHeight), 0);
    if (this.spacer) this.spacer.style.height = `${totalHeight}px`;

    ctx.restore();
  }

  destroy() {
    if (this.canvas && this.canvas.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    if (this.root && this.scrollHandler) {
      this.root.removeEventListener('scroll', this.scrollHandler);
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
    const colWidths = schema.columns.map((c) => view.columnWidths?.[String(c.key)] ?? c.width ?? 100);
    if (y < headerHeight) return null;
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
    let xCursor = 0;
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
      rect.left + xCursor,
      rect.top + headerHeight + rowTop - this.root.scrollTop,
      colWidths[colIndex] ?? 100,
      this.dataModel.getRowHeight(row.id) ?? this.rowHeight
    );
    return { rowId: row.id, colKey: col.key, rect: cellRect };
  }

  private computeRowHeight(ctx: CanvasRenderingContext2D, row: InternalRow, schema: Schema, colWidths: number[]) {
    let maxHeight = this.rowHeight;
    schema.columns.forEach((c, idx) => {
      if (!c.wrapText) return;
      const w = (colWidths[idx] ?? 100) - this.padding;
      const value = this.dataModel.getCell(row.id, c.key);
      const text = value === null || value === undefined ? '' : String(value);
      const lines = this.wrapLines(ctx, text, w);
      const h = lines.length * this.lineHeight + this.padding;
      maxHeight = Math.max(maxHeight, h);
    });
    this.dataModel.setRowHeight(row.id, maxHeight);
    return maxHeight;
  }

  private wrapLines(ctx: CanvasRenderingContext2D, text: string, width: number) {
    const rawLines = text.split('\n');
    const lines: string[] = [];
    rawLines.forEach((line) => {
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
    });
    return lines;
  }

  private drawCellText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    wrap: boolean
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 4, y - 4, width + 8, height + 8);
    ctx.clip();
    if (wrap) {
      const lines = this.wrapLines(ctx, text, width);
      lines.forEach((ln, idx) => {
        ctx.fillText(ln, x, y + this.lineHeight * (idx + 1));
      });
    } else {
      let out = text;
      while (ctx.measureText(out).width > width && out.length > 1) {
        out = out.slice(0, -2) + '…';
      }
      ctx.fillText(out, x, y + this.lineHeight);
    }
    ctx.restore();
  }
}
