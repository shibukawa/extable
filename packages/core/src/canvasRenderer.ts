import type { DataModel } from "./dataModel";
import type {
  InternalRow,
  Schema,
  ColumnSchema,
  SelectionRange,
  View,
  EditMode,
} from "./types";
import { toRawValue } from "./cellValueCodec";
import {
  DEFAULT_ROW_HEIGHT_PX,
  HEADER_HEIGHT_PX,
  ROW_HEADER_WIDTH_PX,
  CELL_PADDING_X_PX,
  CELL_PADDING_TOP_PX,
  CELL_PADDING_BOTTOM_PX,
  COLUMN_RESIZE_HANDLE_PX,
  getColumnWidths,
} from "./geometry";
import {
  FILL_HANDLE_HIT_SIZE_PX,
  FILL_HANDLE_VISUAL_SIZE_PX,
  getFillHandleRect,
  isPointInRect,
  shouldShowFillHandle,
} from "./fillHandle";
import { removeFromParent } from "./utils";
import { columnFormatToStyle, mergeStyle } from "./styleResolver";
import { getButtonLabel, getLinkLabel, resolveButtonAction, resolveLinkAction } from "./actionValue";
import { resolveUniqueBooleanCommitState } from "./uniqueBooleanCommit";
import { formatCellValue, ValueFormatCache } from "./valueFormatter";
import {
  drawDiagnosticCorner,
  drawFunnelIcon,
  drawSortArrowIcon,
  FenwickTree,
  getColumnSortDir,
  hasActiveColumnFilter,
} from "./rendererShared";
import type { Renderer, ViewportState } from "./rendererTypes";

const CANVAS_FONT_FAMILY = '"Inter","Segoe UI",system-ui,-apple-system,"Helvetica Neue",sans-serif';
const CANVAS_FONT_SIZE_PX = 13.5;
const UNIQUE_BOOL_FONT_SIZE_PX = 10;

export class CanvasRenderer implements Renderer {
  private static readonly MAX_CANVAS_DIM_PX = 8192;
  private static readonly ROW_HEIGHT_MEASURE_CHUNK = 500;
  private static readonly ROW_HEIGHT_MEASURE_TIME_BUDGET_MS = 8;
  private static readonly TEXT_MEASURE_CACHE_MAX = 2000;
  private root: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private spacer: HTMLDivElement | null = null;
  private overlayLayer: HTMLDivElement | null = null;
  private tooltip: HTMLDivElement | null = null;
  private tooltipTarget: { rowId: string; colKey: string } | null = null;
  private tooltipMessage: string | null = null;
  private dataModel: DataModel;
  private readonly rowHeight = DEFAULT_ROW_HEIGHT_PX;
  private readonly headerHeight = HEADER_HEIGHT_PX;
  private readonly lineHeight = 16;
  private readonly padding = 12;
  private readonly rowHeaderWidth = ROW_HEADER_WIDTH_PX;
  private activeRowId: string | null = null;
  private activeColKey: string | null = null;
  private selection: SelectionRange[] = [];
  private valueFormatCache = new ValueFormatCache();
  private textMeasureCache = new Map<string, { lines: string[] }>();
  private frame = 0;
  private cursorTimer: number | null = null;
  private pendingCursorPoint: { x: number; y: number } | null = null;
  private hoverHeaderColKey: string | null = null;
  private hoverHeaderIcon = false;
  private hoverActionKey: string | null = null;
  private activeActionKey: string | null = null;
  private rowHeightCacheKey: string | null = null;
  private rowHeightMeasuredVersion = new Map<string, number>();
  private rowHeightMeasureRaf: number | null = null;
  private rowHeightMeasureTask: { key: string; nextIndex: number } | null = null;
  private heightIndex: {
    key: string | null;
    rowsRef: InternalRow[];
    idToIndex: Map<string, number>;
    heights: number[];
    fenwick: FenwickTree;
  } | null = null;

  constructor(
    dataModel: DataModel,
    private getEditMode: () => EditMode = () => "direct",
  ) {
    this.dataModel = dataModel;
  }

  mount(root: HTMLElement) {
    this.root = root;
    this.canvas = document.createElement("canvas");
    const maxDim = CanvasRenderer.MAX_CANVAS_DIM_PX;
    this.canvas.width = Math.max(1, Math.min(maxDim, Math.floor(root.clientWidth || 600)));
    this.canvas.height = Math.max(1, Math.min(maxDim, Math.floor(root.clientHeight || 400)));
    this.canvas.style.width = `${this.canvas.width}px`;
    this.canvas.style.height = `${this.canvas.height}px`;
    this.canvas.dataset.extableRenderer = "canvas";
    this.canvas.style.position = "sticky";
    this.canvas.style.top = "0";
    this.canvas.style.left = "0";
    this.canvas.style.zIndex = "1";
    this.canvas.style.cursor = "cell";
    this.canvas.addEventListener("pointermove", this.handlePointerMove);
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.canvas.addEventListener("pointerup", this.handlePointerUp);
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

  setActiveCell(rowId: string | null, colKey: string | null) {
    this.activeRowId = rowId;
    this.activeColKey = colKey;
    this.render();
  }

  setSelection(ranges: SelectionRange[]) {
    this.selection = ranges;
    this.render();
  }

  render(state?: ViewportState) {
    try {
      this.frame += 1;
      if (!this.canvas || !this.root) return;
      const ctx = this.canvas.getContext("2d");
      if (!ctx) return;
      ctx.font = `${CANVAS_FONT_SIZE_PX}px ${CANVAS_FONT_FAMILY}`;
      let baseFont = ctx.font;
      const selectAll = this.activeRowId === "__all__" && this.activeColKey === "__all__";
      const schema = this.dataModel.getSchema();
      const view = this.dataModel.getView();
      const rows = this.dataModel.listRows();
      const colWidths = getColumnWidths(schema, view);
      const colBaseStyles = schema.columns.map((c) => columnFormatToStyle(c));
      const uniqueCommitState = resolveUniqueBooleanCommitState(
        schema,
        this.dataModel.getPending(),
        (rowId, colKey) => this.dataModel.getRawCell(rowId, colKey),
      );
      const uniqueDotColors = this.getUniqueDotColors();
      const fontCache = new Map<string, string>();
      const wrapAny = schema.columns.some((c) => view.wrapText?.[c.key] ?? c.wrapText);
      const cacheKey = wrapAny ? this.getRowHeightCacheKey(schema, view, colWidths) : null;
      if (cacheKey !== this.rowHeightCacheKey) {
        this.rowHeightCacheKey = cacheKey;
        this.rowHeightMeasuredVersion.clear();
        this.rowHeightMeasureTask = null;
      }
      if (!wrapAny) this.cancelRowHeightMeasurement();

      this.ensureHeightIndex(rows, wrapAny ? cacheKey : null, wrapAny);
      const heightIndex = this.heightIndex;
      if (!heightIndex) return;

      const totalWidth = this.rowHeaderWidth + colWidths.reduce((acc, w) => acc + (w ?? 0), 0);
      const desiredCanvasWidth = state?.clientWidth ?? (this.root.clientWidth || 600);
      const desiredCanvasHeight =
        state?.clientHeight ?? (this.root.clientHeight || this.canvas.height || 400);
      const maxDim = CanvasRenderer.MAX_CANVAS_DIM_PX;
      const nextWidth = Math.max(1, Math.min(maxDim, Math.floor(desiredCanvasWidth)));
      const nextHeight = Math.max(1, Math.min(maxDim, Math.floor(desiredCanvasHeight)));
      if (this.canvas.width !== nextWidth) this.canvas.width = nextWidth;
      if (this.canvas.height !== nextHeight) this.canvas.height = nextHeight;
      this.canvas.style.width = `${nextWidth}px`;
      this.canvas.style.height = `${nextHeight}px`;
      // Resizing resets 2D state, so reapply after size update.
      ctx.font = `${CANVAS_FONT_SIZE_PX}px ${CANVAS_FONT_FAMILY}`;
      baseFont = ctx.font;
      this.refreshTooltipPosition();

      const scrollTop = state?.scrollTop ?? this.root.scrollTop;
      const scrollLeft = state?.scrollLeft ?? this.root.scrollLeft;
      const computeVisibleRange = (contentTop: number) => {
        const target = contentTop + 1;
        const visibleStart = Math.max(
          0,
          Math.min(rows.length - 1, heightIndex.fenwick.lowerBound(target)),
        );
        const accum = heightIndex.fenwick.sum(visibleStart);
        let visibleEnd = visibleStart;
        let drawnHeight = 0;
        const maxHeight = (this.canvas?.height ?? 0) + this.rowHeight * 2;
        for (let i = visibleStart; i < rows.length && drawnHeight < maxHeight; i += 1) {
          drawnHeight += heightIndex.heights[i] ?? this.rowHeight;
          visibleEnd = i + 1;
        }
        return { accum, visibleStart, visibleEnd };
      };

      let totalRowsHeight = heightIndex.fenwick.total();
      const viewportHeight = this.canvas?.height ?? this.root.clientHeight;
      const dataViewportHeight = Math.max(0, viewportHeight - this.headerHeight);
      let maxContentScrollTop = Math.max(0, totalRowsHeight - dataViewportHeight);
      let contentScrollTop = Math.max(0, Math.min(scrollTop, maxContentScrollTop));
      let { accum, visibleStart, visibleEnd } = computeVisibleRange(contentScrollTop);

      if (wrapAny && cacheKey) {
        const updates: Record<string, number> = {};
        for (let i = visibleStart; i < visibleEnd; i += 1) {
          const row = rows[i];
          if (!row) continue;
          const version = this.dataModel.getRowVersion(row.id);
          if (this.rowHeightMeasuredVersion.get(row.id) === version) continue;
          const nextH = this.measureRowHeight(ctx, row, schema, colWidths);
          updates[row.id] = nextH;
          this.rowHeightMeasuredVersion.set(row.id, version);
        }
        this.applyRowHeightUpdates(updates);
        totalRowsHeight = heightIndex.fenwick.total();
        this.dataModel.setRowHeightsBulk(updates);
        maxContentScrollTop = Math.max(0, totalRowsHeight - dataViewportHeight);
        contentScrollTop = Math.max(0, Math.min(scrollTop, maxContentScrollTop));
        ({ accum, visibleStart, visibleEnd } = computeVisibleRange(contentScrollTop));
        if (this.rowHeightMeasureTask || Object.keys(updates).length > 0)
          this.scheduleRowHeightMeasurement();
      }

      if (this.spacer) {
        this.spacer.style.height = `${maxContentScrollTop}px`;
        this.spacer.style.width = `${totalWidth}px`;
      }
      const dataXOffset = this.rowHeaderWidth - scrollLeft;

      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      // Keep row-header column background visible across scroll
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(0, 0, this.rowHeaderWidth, this.canvas.height);
      // Body
      let yCursor = this.headerHeight + accum - contentScrollTop;
      for (let i = visibleStart; i < visibleEnd; i += 1) {
        const row = rows[i];
        const rowH = heightIndex.heights[i] ?? this.rowHeight;
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
        ctx.font = `bold ${CANVAS_FONT_SIZE_PX}px ${CANVAS_FONT_FAMILY}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(idxText), this.rowHeaderWidth / 2, yCursor + rowH / 2);
        ctx.font = baseFont;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

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
          if (!c) {
            x += w;
            continue;
          }
          const interaction = this.dataModel.getCellInteraction(row.id, c.key);
          const muted = interaction.muted;
          ctx.strokeStyle = "#d0d7de";
          const condRes = this.dataModel.resolveConditionalStyle(row.id, c);
          const cellStyle = this.dataModel.getCellStyle(row.id, c.key);
          const baseStyle = colBaseStyles[idx] ?? {};
          const withCond = condRes.delta ? mergeStyle(baseStyle, condRes.delta) : baseStyle;
          const mergedStyle = cellStyle ? mergeStyle(withCond, cellStyle) : withCond;
          // Row highlight when a unique-boolean in this row is true
          const anyUniqueTrueRow = schema.columns.some((cc) => cc && cc.type === "boolean" && cc.unique && this.dataModel.getCell(row.id, cc.key) === true);
          const bg = anyUniqueTrueRow ? "rgba(59,130,246,0.06)" : (muted ? "#f3f4f6" : (mergedStyle.backgroundColor ?? "#ffffff"));
          ctx.fillStyle = bg;
          ctx.fillRect(x, yCursor, w, rowH);
          ctx.strokeRect(x, yCursor, w, rowH);
          const valueRes = this.dataModel.resolveCellValue(row.id, c);
          const textOverride = valueRes.textOverride ?? (condRes.forceErrorText ? "#ERROR" : undefined);
          const formatted = textOverride ? { text: "#ERROR" } : this.formatValue(valueRes.value, c);
          const isActionType = c.type === "button" || c.type === "link";
          const actionValue = isActionType
            ? c.type === "button"
              ? resolveButtonAction(valueRes.value)
              : resolveLinkAction(valueRes.value)
            : null;
          const actionLabel = isActionType
            ? actionValue?.label ?? (c.type === "button" ? getButtonLabel(valueRes.value) : getLinkLabel(valueRes.value))
            : "";
          const renderAction = Boolean(isActionType && actionValue && actionLabel && !textOverride);
          let text = actionLabel || formatted.text;
          const isUniqueBoolean = c.type === "boolean" && c.unique;
          let uniqueDotState: "current" | "previous" | "default" | null = null;
          if (isUniqueBoolean) {
            const commitState = uniqueCommitState.get(String(c.key));
            if (commitState?.currentRowId === row.id) {
              uniqueDotState = "current";
            } else if (commitState?.previousRowId === row.id) {
              uniqueDotState = "previous";
            } else {
              const val = valueRes.value === true || valueRes.value === "true" || valueRes.value === "1" || valueRes.value === 1;
              uniqueDotState = val ? "default" : null;
            }
            text = "";
          }
          const align = c.style?.align ?? (c.type === "number" ? "right" : "left");
          const isActiveCell =
            this.activeRowId === row.id &&
            this.activeColKey !== null &&
            this.activeColKey === c.key;
          if (isActiveCell) {
            ctx.strokeStyle = "#3b82f6";
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 1, yCursor + 1, w - 2, rowH - 2);
            ctx.lineWidth = 1;
            if (
              shouldShowFillHandle(
                this.dataModel,
                this.selection,
                this.activeRowId,
                this.activeColKey,
                this.getEditMode(),
              )
            ) {
              const size = FILL_HANDLE_VISUAL_SIZE_PX;
              const left = x + w - size - 1;
              const top = yCursor + rowH - size - 1;
              ctx.fillStyle = "#3b82f6";
              ctx.fillRect(left, top, size, size);
              ctx.strokeStyle = "#ffffff";
              ctx.strokeRect(left + 0.5, top + 0.5, size - 1, size - 1);
            }
          }
          const actionColor =
            renderAction && c.type === "link" && !muted && !mergedStyle.textColor
              ? "#2563eb"
              : undefined;
          const isGlobalReadonly = this.getEditMode() === "readonly";
          const hasExplicitTextColor = Boolean(formatted.color || mergedStyle.textColor || actionColor);
          const formulaReadonlyColor =
            !isGlobalReadonly && Boolean(c.formula) && interaction.readonly && !muted && !hasExplicitTextColor
              ? "#99aaff"
              : undefined;
          ctx.fillStyle = this.dataModel.hasPending(row.id, c.key)
            ? "#b91c1c"
            : formatted.color
              ? formatted.color
              : muted
                ? "#94a3b8"
                : (actionColor ?? mergedStyle.textColor ?? formulaReadonlyColor ?? "#0f172a");
          const wrap = view.wrapText?.[c.key] ?? c.wrapText ?? false;
          const isBoolean = c.type === "boolean" && (!c.format || c.format === "checkbox");
          const isCustomBoolean = c.type === "boolean" && Boolean(c.format && c.format !== "checkbox");
          if (!isBoolean) {
            const fontKey = `${mergedStyle.italic ? "i" : ""}${mergedStyle.bold ? "b" : ""}`;
            if (fontKey !== lastFontKey) {
              const cached = fontCache.get(fontKey);
              if (cached) ctx.font = cached;
              else {
                const weight = mergedStyle.bold ? "600 " : "";
                const ital = mergedStyle.italic ? "italic " : "";
                const f = `${ital}${weight}${CANVAS_FONT_SIZE_PX}px ${CANVAS_FONT_FAMILY}`.trim();
                fontCache.set(fontKey, f);
                ctx.font = f;
              }
              lastFontKey = fontKey;
            }
          } else {
            ctx.font = baseFont;
            lastFontKey = "";
          }
          const textAreaX = x + CELL_PADDING_X_PX;
          const textAreaY = yCursor + CELL_PADDING_TOP_PX;
          const textAreaW = Math.max(0, w - CELL_PADDING_X_PX * 2);
          const textAreaH = Math.max(0, rowH - (CELL_PADDING_TOP_PX + CELL_PADDING_BOTTOM_PX));
          const buttonTextPadX = 10;
          const textDrawX =
            renderAction && c.type === "button" ? textAreaX + buttonTextPadX : textAreaX;
          const textDrawW =
            renderAction && c.type === "button"
              ? Math.max(0, textAreaW - buttonTextPadX * 2)
              : textAreaW;
          const decorations = {
            underline: Boolean(mergedStyle.underline) || (renderAction && c.type === "link"),
            strike: Boolean(mergedStyle.strike),
          };
          const actionBounds =
            renderAction && !isBoolean
              ? this.measureTextBounds(
                  ctx,
                  text,
                  textDrawX,
                  textAreaY,
                  textDrawW,
                  textAreaH,
                  wrap,
                  align,
                )
              : null;
          if (renderAction && c.type === "button" && actionBounds) {
            const padX = 6;
            const padY = 4;
            const left = Math.max(textAreaX, actionBounds.x - padX);
            const top = Math.max(textAreaY, actionBounds.y - padY);
            const right = Math.min(textAreaX + textAreaW, actionBounds.x + actionBounds.width + padX);
            const bottom = Math.min(textAreaY + textAreaH, actionBounds.y + actionBounds.height + padY);
            const bw = Math.max(0, right - left);
            const bh = Math.max(0, bottom - top);
            ctx.save();
            const actionKey = `${row.id}::${c.key}::button`;
            const isHover = this.hoverActionKey === actionKey;
            const isActive = this.activeActionKey === actionKey;
            if (muted) {
              ctx.fillStyle = "#f3f4f6";
              ctx.strokeStyle = "#e2e8f0";
            } else if (isActive) {
              ctx.fillStyle = "#cbd5e1";
              ctx.strokeStyle = "#94a3b8";
            } else if (isHover) {
              ctx.fillStyle = "#e2e8f0";
              ctx.strokeStyle = "#94a3b8";
            } else {
              ctx.fillStyle = "#f8fafc";
              ctx.strokeStyle = "#cbd5e1";
            }
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (typeof ctx.roundRect === "function") {
              ctx.roundRect(left, top, bw, bh, 6);
            } else {
              ctx.rect(left, top, bw, bh);
            }
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }
          if (isUniqueBoolean && uniqueDotState) {
            const color =
              uniqueDotState === "current"
                ? uniqueDotColors.current
                : uniqueDotState === "previous"
                  ? uniqueDotColors.previous
                  : uniqueDotColors.default;
            this.drawUniqueRadio(ctx, textAreaX, textAreaY, textAreaW, textAreaH, align, color);
          }
          this.drawCellText(
            ctx,
            text,
            textDrawX,
            textAreaY,
            textDrawW,
            textAreaH,
            wrap,
            align,
            isBoolean,
            isCustomBoolean,
            Boolean(c.unique),
            decorations,
          );
          const marker = this.dataModel.getCellMarker(row.id, c.key);
          if (marker) drawDiagnosticCorner(ctx, x, yCursor, w, rowH, marker.level);
          x += w;
        }
        ctx.restore();
        yCursor += rowH;
      }

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
        if (!c) {
          xHeader += w;
          continue;
        }
        const isActiveCol = this.activeColKey !== null && this.activeColKey === c.key;
        if (isActiveCol) {
          ctx.fillStyle = "rgba(59,130,246,0.16)";
          ctx.fillRect(xHeader, 0, w, this.headerHeight);
        }
        ctx.strokeStyle = "#d0d7de";
        ctx.strokeRect(xHeader, 0, w, this.headerHeight);
        ctx.fillStyle = "#0f172a";
        ctx.font = `bold ${CANVAS_FONT_SIZE_PX}px ${CANVAS_FONT_FAMILY}`;
        ctx.fillText(c.header ?? c.key, xHeader + 8, this.headerHeight - 8);
        ctx.font = baseFont;

        const sortDir = getColumnSortDir(view, c.key);
        const hasFilter = hasActiveColumnFilter(view, c.key);
        const isHover = this.hoverHeaderColKey !== null && this.hoverHeaderColKey === c.key;
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
        ctx.beginPath();
        ctx.rect(
          this.rowHeaderWidth,
          this.headerHeight,
          this.canvas.width - this.rowHeaderWidth,
          this.canvas.height - this.headerHeight,
        );
        ctx.clip();
        ctx.strokeStyle = "#3b82f6";
        ctx.fillStyle = "rgba(59,130,246,0.12)";
        for (const range of this.selection) {
          const startRow = Math.max(0, Math.min(range.startRow, range.endRow));
          const endRow = Math.min(rows.length - 1, Math.max(range.startRow, range.endRow));
          const startCol = Math.max(0, Math.min(range.startCol, range.endCol));
          const endCol = Math.min(
            schema.columns.length - 1,
            Math.max(range.startCol, range.endCol),
          );
          const yTop = this.headerHeight + heightIndex.fenwick.sum(startRow) - contentScrollTop;
          const height = heightIndex.fenwick.sum(endRow + 1) - heightIndex.fenwick.sum(startRow);
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
    } catch {
      // Ignore canvas rendering errors (e.g. context enters an error state after huge resize).
      // A subsequent resize typically recovers.
      return;
    }
  }

  destroy() {
    this.cancelRowHeightMeasurement();
    this.heightIndex = null;
    if (this.canvas) {
      this.canvas.removeEventListener("pointermove", this.handlePointerMove);
      this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
      this.canvas.removeEventListener("pointerup", this.handlePointerUp);
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

  private ensureHeightIndex(rows: InternalRow[], key: string | null, wrapAny: boolean) {
    const existing = this.heightIndex;
    if (existing && existing.rowsRef === rows && existing.key === key) return;
    const heights = new Array(rows.length);
    const idToIndex = new Map<string, number>();
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row) continue;
      idToIndex.set(row.id, i);
      let h = this.rowHeight;
      if (wrapAny && key) {
        const version = this.dataModel.getRowVersion(row.id);
        const measuredVersion = this.rowHeightMeasuredVersion.get(row.id);
        const cachedHeight = this.dataModel.getRowHeight(row.id);
        if (measuredVersion === version && typeof cachedHeight === "number") h = cachedHeight;
      }
      heights[i] = h;
    }
    this.heightIndex = {
      key,
      rowsRef: rows,
      idToIndex,
      heights,
      fenwick: FenwickTree.from(heights),
    };
  }

  private applyRowHeightUpdates(updates: Record<string, number>) {
    const index = this.heightIndex;
    if (!index) return;
    for (const [rowId, next] of Object.entries(updates)) {
      const i = index.idToIndex.get(rowId);
      if (i === undefined) continue;
      const prev = index.heights[i] ?? this.rowHeight;
      if (prev === next) continue;
      index.heights[i] = next;
      index.fenwick.add(i, next - prev);
    }
  }

  private getRowHeightCacheKey(schema: Schema, view: View, colWidths: number[]) {
    const wraps = schema.columns
      .map((c) => ((view.wrapText?.[c.key] ?? c.wrapText) ? "1" : "0"))
      .join("");
    const widths = colWidths.map((w) => String(w ?? 0)).join(",");
    return `${wraps}|${widths}`;
  }

  private cancelRowHeightMeasurement() {
    if (this.rowHeightMeasureRaf !== null) {
      cancelAnimationFrame(this.rowHeightMeasureRaf);
      this.rowHeightMeasureRaf = null;
    }
    this.rowHeightMeasureTask = null;
  }

  private scheduleRowHeightMeasurement() {
    if (this.rowHeightMeasureRaf !== null) return;
    this.rowHeightMeasureRaf = requestAnimationFrame(() => {
      this.rowHeightMeasureRaf = null;
      this.runRowHeightMeasurement();
    });
  }

  private runRowHeightMeasurement() {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.font = `${CANVAS_FONT_SIZE_PX}px ${CANVAS_FONT_FAMILY}`;
    const schema = this.dataModel.getSchema();
    const view = this.dataModel.getView();
    const colWidths = getColumnWidths(schema, view);
    const wrapAny = schema.columns.some((c) => view.wrapText?.[c.key] ?? c.wrapText);
    if (!wrapAny) return;
    const key = this.getRowHeightCacheKey(schema, view, colWidths);
    if (this.rowHeightCacheKey !== key) {
      this.rowHeightCacheKey = key;
      this.rowHeightMeasuredVersion.clear();
      this.rowHeightMeasureTask = null;
    }
    const task = this.rowHeightMeasureTask ?? { key, nextIndex: 0 };
    if (task.key !== key) return;

    const rows = this.dataModel.listRows();
    const updates: Record<string, number> = {};
    let measured = 0;
    const start = performance.now();
    while (task.nextIndex < rows.length && measured < CanvasRenderer.ROW_HEIGHT_MEASURE_CHUNK) {
      if (performance.now() - start > CanvasRenderer.ROW_HEIGHT_MEASURE_TIME_BUDGET_MS) break;
      const row = rows[task.nextIndex];
      task.nextIndex += 1;
      if (!row) continue;
      const version = this.dataModel.getRowVersion(row.id);
      if (this.rowHeightMeasuredVersion.get(row.id) === version) continue;
      const h = this.measureRowHeight(ctx, row, schema, colWidths);
      updates[row.id] = h;
      this.rowHeightMeasuredVersion.set(row.id, version);
      measured += 1;
    }
    this.rowHeightMeasureTask = task.nextIndex < rows.length ? task : null;
    this.ensureHeightIndex(rows, this.rowHeightCacheKey, true);
    this.applyRowHeightUpdates(updates);
    this.dataModel.setRowHeightsBulk(updates);
    if (this.rowHeightMeasureTask) this.scheduleRowHeightMeasurement();
  }

  private handleClick = (ev: MouseEvent) => {
    if (!this.root || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const viewportX = ev.clientX - rect.left;
    const viewportY = ev.clientY - rect.top;
    const x = viewportX + this.root.scrollLeft;
    const y = viewportY;
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
    // Use viewport-relative coordinates first because headers are rendered as "sticky"
    // (they should not be offset by scrollTop in hit-test).
    const viewportX = event.clientX - rect.left;
    const viewportY = event.clientY - rect.top;
    const x = viewportX + this.root.scrollLeft;
    const schema = this.dataModel.getSchema();
    const view = this.dataModel.getView();
    const rows = this.dataModel.listRows();
    const headerHeight = this.headerHeight;
    const colWidths = getColumnWidths(schema, view);
    const wrapAny = schema.columns.some((c) => view.wrapText?.[c.key] ?? c.wrapText);
    const key = wrapAny ? this.getRowHeightCacheKey(schema, view, colWidths) : null;
    this.ensureHeightIndex(rows, key, wrapAny);
    const heightIndex = this.heightIndex;
    if (!heightIndex) return null;
    const totalRowsHeight = heightIndex.fenwick.total();
    const viewportHeight = this.canvas?.height ?? this.root.clientHeight;
    const dataViewportHeight = Math.max(0, viewportHeight - this.headerHeight);
    const maxContentScrollTop = Math.max(0, totalRowsHeight - dataViewportHeight);
    const contentScrollTop = Math.max(0, Math.min(this.root.scrollTop, maxContentScrollTop));
    if (viewportY < headerHeight && viewportX < this.rowHeaderWidth) {
      return {
        rowId: "__all__",
        colKey: "__all__",
        rect: new DOMRect(rect.left, rect.top, this.rowHeaderWidth, headerHeight),
      };
    }
    if (viewportY < headerHeight) {
      // Column header region (canvas)
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
      if (colIndex >= 0) {
        const col = schema.columns[colIndex];
        const cellRect = new DOMRect(
          rect.left + xCursor - this.root.scrollLeft,
          rect.top,
          colWidths[colIndex] ?? 100,
          headerHeight,
        );
        return { rowId: "__header__", colKey: col.key, rect: cellRect };
      }
      return null;
    }
    if (viewportX < this.rowHeaderWidth) {
      const y = viewportY - headerHeight + contentScrollTop;
      const rowIndex = Math.max(
        0,
        Math.min(rows.length - 1, heightIndex.fenwick.lowerBound(y + 1)),
      );
      const accumHeight = heightIndex.fenwick.sum(rowIndex);
      if (rowIndex < 0 || rowIndex >= rows.length) return null;
      const row = rows[rowIndex];
      const topPx = rect.top + headerHeight + accumHeight - contentScrollTop;
      const cellRect = new DOMRect(
        rect.left,
        topPx,
        this.rowHeaderWidth,
        heightIndex.heights[rowIndex] ?? this.rowHeight,
      );
      return { rowId: row.id, colKey: null, rect: cellRect };
    }
    const y = viewportY - headerHeight + contentScrollTop;
    const rowIndex = Math.max(0, Math.min(rows.length - 1, heightIndex.fenwick.lowerBound(y + 1)));
    const accumHeight = heightIndex.fenwick.sum(rowIndex);
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
      heightIndex.heights[rowIndex] ?? this.rowHeight,
    );
    return { rowId: row.id, colKey: col.key, rect: cellRect };
  }

  hitTestAction(event: MouseEvent) {
    if (!this.root || !this.canvas) return null;
    const hit = this.hitTest(event);
    if (!hit || !hit.rowId || !hit.colKey) return null;
    if (hit.rowId === "__all__" || hit.rowId === "__header__") return null;
    const schema = this.dataModel.getSchema();
    const col = schema.columns.find((c) => String(c.key) === String(hit.colKey));
    if (!col || (col.type !== "button" && col.type !== "link")) return null;
    const valueRes = this.dataModel.resolveCellValue(hit.rowId, col);
    const condRes = this.dataModel.resolveConditionalStyle(hit.rowId, col);
    const textOverride = valueRes.textOverride ?? (condRes.forceErrorText ? "#ERROR" : undefined);
    if (textOverride) return null;
    const actionValue =
      col.type === "button"
        ? resolveButtonAction(valueRes.value)
        : resolveLinkAction(valueRes.value);
    if (!actionValue || !actionValue.label) return null;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) return null;
    const baseStyle = columnFormatToStyle(col);
    const withCond = condRes.delta ? mergeStyle(baseStyle, condRes.delta) : baseStyle;
    const cellStyle = this.dataModel.getCellStyle(hit.rowId, col.key);
    const mergedStyle = cellStyle ? mergeStyle(withCond, cellStyle) : withCond;
    const weight = mergedStyle.bold ? "600 " : "";
    const ital = mergedStyle.italic ? "italic " : "";
    ctx.save();
    ctx.font = `${ital}${weight}${CANVAS_FONT_SIZE_PX}px ${CANVAS_FONT_FAMILY}`.trim();
    ctx.textBaseline = "alphabetic";
    const view = this.dataModel.getView();
    const wrap = view.wrapText?.[col.key] ?? col.wrapText ?? false;
    const align = col.style?.align ?? "left";
    const textAreaX = hit.rect.left + CELL_PADDING_X_PX;
    const textAreaY = hit.rect.top + CELL_PADDING_TOP_PX;
    const textAreaW = Math.max(0, hit.rect.width - CELL_PADDING_X_PX * 2);
    const textAreaH = Math.max(
      0,
      hit.rect.height - (CELL_PADDING_TOP_PX + CELL_PADDING_BOTTOM_PX),
    );
    const buttonTextPadX = 10;
    const textDrawX = col.type === "button" ? textAreaX + buttonTextPadX : textAreaX;
    const textDrawW =
      col.type === "button" ? Math.max(0, textAreaW - buttonTextPadX * 2) : textAreaW;
    const bounds = this.measureTextBounds(
      ctx,
      actionValue.label,
      textDrawX,
      textAreaY,
      textDrawW,
      textAreaH,
      wrap,
      align,
    );
    ctx.restore();
    if (!bounds) return null;
    const pad = col.type === "button" ? 6 : 2;
    const left = Math.max(hit.rect.left, bounds.x - pad);
    const top = Math.max(hit.rect.top, bounds.y - pad);
    const right = Math.min(hit.rect.right, bounds.x + bounds.width + pad);
    const bottom = Math.min(hit.rect.bottom, bounds.y + bounds.height + pad);
    if (
      event.clientX >= left &&
      event.clientX <= right &&
      event.clientY >= top &&
      event.clientY <= bottom
    ) {
      return { rowId: hit.rowId, colKey: String(hit.colKey), kind: col.type };
    }
    return null;
  }

  private isPointInSelection(rowId: string, colKey: string) {
    if (!this.selection.length) return false;
    const schema = this.dataModel.getSchema();
    const rowIndex = this.dataModel.getRowIndex(rowId);
    const colIndex = schema.columns.findIndex((c) => c.key === colKey);
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
    if (this.hoverActionKey || this.activeActionKey) {
      this.hoverActionKey = null;
      this.activeActionKey = null;
      this.render();
    }
  };

  private handlePointerDown = (ev: PointerEvent) => {
    if (!this.canvas) return;
    const actionHit = this.hitTestAction(
      new MouseEvent("mousemove", { clientX: ev.clientX, clientY: ev.clientY }),
    );
    if (!actionHit || actionHit.kind !== "button") return;
    const interaction = this.dataModel.getCellInteraction(actionHit.rowId, actionHit.colKey);
    if (interaction.disabled) return;
    const nextKey = `${actionHit.rowId}::${actionHit.colKey}::${actionHit.kind}`;
    if (nextKey !== this.activeActionKey) {
      this.activeActionKey = nextKey;
      this.render();
    }
  };

  private handlePointerUp = () => {
    if (this.activeActionKey) {
      this.activeActionKey = null;
      this.render();
    }
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

  private getCellRect(rowId: string, colKey: string): DOMRect | null {
    if (!this.root || !this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const schema = this.dataModel.getSchema();
    const view = this.dataModel.getView();
    const rows = this.dataModel.listRows();
    const rowIndex = this.dataModel.getRowIndex(rowId);
    const colIndex = schema.columns.findIndex((c) => c.key === colKey);
    if (rowIndex < 0 || colIndex < 0) return null;
    const colWidths = getColumnWidths(schema, view);
    const wrapAny = schema.columns.some((c) => view.wrapText?.[c.key] ?? c.wrapText);
    const key = wrapAny ? this.getRowHeightCacheKey(schema, view, colWidths) : null;
    this.ensureHeightIndex(rows, key, wrapAny);
    const heightIndex = this.heightIndex;
    if (!heightIndex) return null;
    const accumHeight = heightIndex.fenwick.sum(rowIndex);
    let xCursor = this.rowHeaderWidth;
    for (let i = 0; i < colIndex; i += 1) {
      xCursor += colWidths[i] ?? 100;
    }
    return new DOMRect(
      rect.left + xCursor - this.root.scrollLeft,
      rect.top + this.headerHeight + accumHeight - this.root.scrollTop,
      colWidths[colIndex] ?? 100,
      heightIndex.heights[rowIndex] ?? this.rowHeight,
    );
  }

  private updateCanvasCursor(clientX: number, clientY: number) {
    if (!this.root || !this.canvas) return;
    if (this.root.dataset.extableFillDragging === "1") {
      this.canvas.style.cursor = "crosshair";
      return;
    }
    if (this.root.dataset.extableColumnResize === "1") {
      this.canvas.style.cursor = "col-resize";
      return;
    }
    // Header hover (filter/sort icon affordance)
    {
      const rect = this.canvas.getBoundingClientRect();
      const viewportX = clientX - rect.left;
      const viewportY = clientY - rect.top;
      const x = viewportX + this.root.scrollLeft;
      const y = viewportY;
      const prevKey = this.hoverHeaderColKey;
      const prevIcon = this.hoverHeaderIcon;
      let nextKey: string | null = null;
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
          const inResize =
            x >= xCursor + w - COLUMN_RESIZE_HANDLE_PX && x <= xCursor + w + COLUMN_RESIZE_HANDLE_PX;
          if (inResize && !nextIcon) {
            const changed =
              String(prevKey ?? "") !== String(nextKey ?? "") || Boolean(prevIcon) !== Boolean(nextIcon);
            this.hoverHeaderColKey = nextKey;
            this.hoverHeaderIcon = nextIcon;
            this.canvas.style.cursor = "col-resize";
            if (this.tooltip) this.tooltip.dataset.visible = "0";
            this.tooltipTarget = null;
            this.tooltipMessage = null;
            if (changed) this.render();
            return;
          }
        }
      }
      const changed =
        String(prevKey ?? "") !== String(nextKey ?? "") || Boolean(prevIcon) !== Boolean(nextIcon);
      this.hoverHeaderColKey = nextKey;
      this.hoverHeaderIcon = nextIcon;
      if (nextKey !== null) {
        this.canvas.style.cursor = nextIcon ? "pointer" : "default";
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
      this.hoverActionKey = null;
      return;
    }
    if (hit.colKey === "__all__" || hit.colKey === null) {
      this.canvas.style.cursor = "default";
      if (this.tooltip) this.tooltip.dataset.visible = "0";
      this.tooltipTarget = null;
      this.tooltipMessage = null;
      this.hoverActionKey = null;
      return;
    }
    // In readonly editMode, keep spreadsheet-like cursor for all body cells.
    if (this.getEditMode() === "readonly") {
      this.canvas.style.cursor = "cell";
      return;
    }

    const marker = this.dataModel.getCellMarker(hit.rowId, hit.colKey);
    if (this.tooltip && marker) {
      const sameCell =
        this.tooltipTarget &&
        this.tooltipTarget.rowId === hit.rowId &&
        this.tooltipTarget.colKey === hit.colKey;
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

    const actionHit = this.hitTestAction(new MouseEvent("mousemove", { clientX, clientY }));
    const nextHoverKey = actionHit ? `${actionHit.rowId}::${actionHit.colKey}::${actionHit.kind}` : null;
    if (nextHoverKey !== this.hoverActionKey) {
      this.hoverActionKey = nextHoverKey;
      this.render();
    }
    if (actionHit) {
      const interaction = this.dataModel.getCellInteraction(actionHit.rowId, actionHit.colKey);
      if (!interaction.disabled) {
        this.canvas.style.cursor = "pointer";
        return;
      }
    }

    if (!this.isPointInSelection(hit.rowId, hit.colKey)) {
      this.canvas.style.cursor = "cell";
      return;
    }

    // Only the active cell shows edit-mode cursor affordances. Other selected cells stay `cell`.
    const isActiveCell =
      this.activeRowId === hit.rowId &&
      this.activeColKey !== null &&
      this.activeColKey === hit.colKey;
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
      shouldShowFillHandle(
        this.dataModel,
        this.selection,
        this.activeRowId,
        this.activeColKey,
        this.getEditMode(),
      )
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

    const col = this.dataModel.getSchema().columns.find((c) => c.key === hit.colKey);
    const interaction = this.dataModel.getCellInteraction(hit.rowId, hit.colKey);
    if (interaction.readonly || col?.type === "boolean") cursor = "default";
    else cursor = "text";
    this.canvas.style.cursor = cursor;
  }

  private measureRowHeight(
    ctx: CanvasRenderingContext2D,
    row: InternalRow,
    schema: Schema,
    colWidths: number[],
  ) {
    let maxHeight = this.rowHeight;
    const view = this.dataModel.getView();
    for (let idx = 0; idx < schema.columns.length; idx += 1) {
      const c = schema.columns[idx];
      if (!c) continue;
      const wrap = view.wrapText?.[c.key] ?? c.wrapText;
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
    return maxHeight;
  }

  private wrapLines(ctx: CanvasRenderingContext2D, text: string, width: number) {
    const key = `${ctx.font}|${width}|${text}`;
    const cached = this.textMeasureCache.get(key);
    if (cached) {
      // LRU refresh
      this.textMeasureCache.delete(key);
      this.textMeasureCache.set(key, cached);
      return cached.lines;
    }
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
    this.textMeasureCache.set(key, { lines });
    while (this.textMeasureCache.size > CanvasRenderer.TEXT_MEASURE_CACHE_MAX) {
      const firstKey = this.textMeasureCache.keys().next().value as string | undefined;
      if (!firstKey) break;
      this.textMeasureCache.delete(firstKey);
    }
    return lines;
  }

  private fitTextLine(ctx: CanvasRenderingContext2D, text: string, width: number) {
    let out = text;
    while (ctx.measureText(out).width > width && out.length > 1) {
      out = `${out.slice(0, -2)}…`;
    }
    return out;
  }

  private getTextLinesForBounds(
    ctx: CanvasRenderingContext2D,
    text: string,
    width: number,
    wrap: boolean,
    height: number,
  ) {
    const raw = wrap ? this.wrapLines(ctx, text, width) : [this.fitTextLine(ctx, text, width)];
    const maxLines = Math.max(1, Math.floor(height / this.lineHeight));
    return raw.slice(0, maxLines);
  }

  private measureTextBounds(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    wrap: boolean,
    align: "left" | "right" | "center",
  ): DOMRect | null {
    const lines = this.getTextLinesForBounds(ctx, text, width, wrap, height);
    if (!lines.length) return null;
    const totalTextHeight = lines.length * this.lineHeight;
    const baseY = y + Math.max(0, Math.floor((height - totalTextHeight) / 2));
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let idx = 0; idx < lines.length; idx += 1) {
      const line = lines[idx] ?? "";
      const lineWidth = ctx.measureText(line).width;
      let startX = x;
      if (align === "right") startX = x + width - lineWidth;
      else if (align === "center") startX = x + (width - lineWidth) / 2;
      const lineTop = baseY + this.lineHeight * idx;
      const lineBottom = lineTop + this.lineHeight;
      minX = Math.min(minX, startX);
      maxX = Math.max(maxX, startX + lineWidth);
      minY = Math.min(minY, lineTop);
      maxY = Math.max(maxY, lineBottom);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;
    return new DOMRect(minX, minY, maxX - minX, maxY - minY);
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
    isUniqueBoolean = false,
    decorations?: { underline?: boolean; strike?: boolean },
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 4, y - 4, width + 8, height + 8);
    ctx.clip();
    const fontBackup = ctx.font;
    const baselineBackup = ctx.textBaseline;
    ctx.textBaseline = "top";
    if (isBoolean) {
      if (isUniqueBoolean) {
        ctx.font = `${UNIQUE_BOOL_FONT_SIZE_PX}px ${CANVAS_FONT_FAMILY}`;
      } else {
        ctx.font = "28px sans-serif";
      }
    } else if (isCustomBoolean) {
      ctx.font = `${CANVAS_FONT_SIZE_PX}px ${CANVAS_FONT_FAMILY}`;
    }
    const lines = this.getTextLinesForBounds(ctx, text, width, wrap, height);
    const totalTextHeight = lines.length * this.lineHeight;
    const baseY = y + Math.max(0, Math.floor((height - totalTextHeight) / 2));
    const renderLine = (ln: string, lineIdx: number) => {
      const lineTop = baseY + this.lineHeight * lineIdx;
      let startX = x;
      let endX = x;
      if (align === "right") {
        ctx.textAlign = "right";
        endX = x + width;
        startX = endX - ctx.measureText(ln).width;
        ctx.fillText(ln, endX, lineTop);
      } else if (align === "center") {
        ctx.textAlign = "center";
        const center = x + width / 2;
        const w = ctx.measureText(ln).width;
        startX = center - w / 2;
        endX = center + w / 2;
        ctx.fillText(ln, center, lineTop);
      } else {
        ctx.textAlign = "left";
        startX = x;
        endX = x + ctx.measureText(ln).width;
        ctx.fillText(ln, x, lineTop);
      }
      if (decorations?.underline || decorations?.strike) {
        const strokeBackup = ctx.strokeStyle;
        const lineWidthBackup = ctx.lineWidth;
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (decorations.underline) {
          const yUnderline = lineTop + this.lineHeight - 2;
          ctx.moveTo(startX, yUnderline);
          ctx.lineTo(endX, yUnderline);
        }
        if (decorations.strike) {
          const yStrike = lineTop + Math.floor(this.lineHeight / 2);
          ctx.moveTo(startX, yStrike);
          ctx.lineTo(endX, yStrike);
        }
        ctx.stroke();
        ctx.strokeStyle = strokeBackup;
        ctx.lineWidth = lineWidthBackup;
      }
    };
    for (let idx = 0; idx < lines.length; idx += 1) {
      renderLine(lines[idx] ?? "", idx);
    }
    ctx.textAlign = "left";
    ctx.textBaseline = baselineBackup;
    ctx.font = fontBackup;
    ctx.restore();
  }

  private getUniqueDotColors() {
    const fallback = {
      current: "#ff3b30",
      previous: "#b0b0b0",
      default: "#3b82f6",
    };
    if (!this.root || typeof getComputedStyle !== "function") return fallback;
    const styles = getComputedStyle(this.root);
    const pick = (name: string, fb: string) => {
      const value = styles.getPropertyValue(name).trim();
      return value || fb;
    };
    return {
      current: pick("--extable-unique-dot-current", fallback.current),
      previous: pick("--extable-unique-dot-previous", fallback.previous),
      default: pick("--extable-unique-dot-default", fallback.default),
    };
  }

  private drawUniqueRadio(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    align: "left" | "right" | "center",
    color: string,
  ) {
    const size = Math.max(8, Math.min(12, Math.min(width, height) - 4));
    const ringRadius = size / 2;
    const dotRadius = ringRadius / 2.2;
    const centerY = y + height / 2;
    let centerX = x + ringRadius;
    if (align === "right") centerX = x + width - ringRadius;
    else if (align === "center") centerX = x + width / 2;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, dotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private formatValue(value: unknown, col: ColumnSchema): { text: string; color?: string } {
    return formatCellValue(value, col, this.valueFormatCache);
  }
}
