import type { DataModel } from "./dataModel";
import type { InternalRow, Schema, ColumnSchema, SelectionRange } from "./types";
import { coerceDatePattern } from "./dateUtils";
import { toRawValue } from "./cellValueCodec";
import {
  DEFAULT_ROW_HEIGHT_PX,
  ROW_HEADER_WIDTH_PX,
  CELL_PADDING_TOP_PX,
  CELL_PADDING_BOTTOM_PX,
  getColumnWidths,
} from "./geometry";
import { removeFromParent } from "./utils";
import { columnFormatToStyle, mergeStyle, styleToCssText } from "./styleResolver";
import { getButtonLabel, getLinkLabel, resolveButtonAction, resolveLinkAction } from "./actionValue";
import { resolveUniqueBooleanCommitState } from "./uniqueBooleanCommit";
import { formatCellValue, resolveTagValues, ValueFormatCache } from "./valueFormatter";
import { getColumnSortDir, hasActiveColumnFilter, svgArrow, svgFunnel } from "./rendererShared";
import type { Renderer, ViewportState } from "./rendererTypes";

export class HTMLRenderer implements Renderer {
  private tableEl: HTMLTableElement | null = null;
  private defaultRowHeight = DEFAULT_ROW_HEIGHT_PX;
  private rowHeaderWidth = ROW_HEADER_WIDTH_PX;
  private activeRowId: string | null = null;
  private activeColKey: string | null = null;
  private selection: SelectionRange[] = [];
  private valueFormatCache = new ValueFormatCache();
  private measureCache = new Map<string, { height: number; frame: number }>();
  private frame = 0;
  constructor(private dataModel: DataModel) {}

  mount(root: HTMLElement) {
    this.tableEl = document.createElement("table");
    this.tableEl.dataset.extableRenderer = "html";
    root.innerHTML = "";
    root.appendChild(this.tableEl);
    this.render();
  }

  setActiveCell(rowId: string | null, colKey: string | null) {
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
    this.tableEl.style.width = `${totalWidth}px`;
    this.tableEl.appendChild(this.renderHeader(schema, colWidths));
    const uniqueCommitState = resolveUniqueBooleanCommitState(
      schema,
      this.dataModel.getPending(),
      (rowId, colKey) => this.dataModel.getRawCell(rowId, colKey),
    );
    const body = document.createElement("tbody");
    for (const row of rows) {
      body.appendChild(
        this.renderRow(row, schema, colWidths, colBaseStyles, colBaseCss, uniqueCommitState),
      );
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
          rowId: row.dataset.rowId ?? "",
          colKey: null,
          element: rowHeader,
          rect: rowHeader.getBoundingClientRect(),
        };
      }
    }
    const colHeader = target.closest<HTMLElement>("th[data-col-key]:not(.extable-row-header)");
    if (colHeader) {
      return {
        rowId: "__header__",
        colKey: colHeader.dataset.colKey ?? "",
        element: colHeader,
        rect: colHeader.getBoundingClientRect(),
      };
    }
    const cell = target.closest<HTMLElement>("td[data-col-key]");
    const row = cell?.closest<HTMLElement>("tr[data-row-id]");
    if (!cell || !row) return null;
    return {
      rowId: row.dataset.rowId ?? "",
      colKey: cell.dataset.colKey ?? "",
      element: cell,
      rect: cell.getBoundingClientRect(),
    };
  }

  hitTestAction(
    event: MouseEvent,
  ):
    | { rowId: string; colKey: string; kind: "button" | "link" }
    | { rowId: string; colKey: string; kind: "tag-remove"; tagIndex: number }
    | null {
    const target = event.target as HTMLElement | null;
    if (!target) return null;
    const tagRemove = target.closest<HTMLButtonElement>("[data-extable-tag-remove]");
    if (tagRemove && !tagRemove.disabled) {
      const cell = tagRemove.closest<HTMLElement>("td[data-col-key]");
      const row = cell?.closest<HTMLElement>("tr[data-row-id]");
      if (!cell || !row) return null;
      const indexStr = tagRemove.dataset.extableTagIndex;
      const tagIndex = indexStr ? Number.parseInt(indexStr, 10) : Number.NaN;
      if (!Number.isFinite(tagIndex)) return null;
      return {
        rowId: row.dataset.rowId ?? "",
        colKey: cell.dataset.colKey ?? "",
        kind: "tag-remove" as const,
        tagIndex,
      };
    }
    const actionEl = target.closest<HTMLElement>("[data-extable-action]");
    if (!actionEl) return null;
    const cell = actionEl.closest<HTMLElement>("td[data-col-key]");
    const row = cell?.closest<HTMLElement>("tr[data-row-id]");
    if (!cell || !row) return null;
    const kind = actionEl.dataset.extableAction as "button" | "link" | undefined;
    if (kind !== "button" && kind !== "link") return null;
    return {
      rowId: row.dataset.rowId ?? "",
      colKey: cell.dataset.colKey ?? "",
      kind,
    };
  }

  private renderHeader(schema: Schema, colWidths: number[]) {
    const thead = document.createElement("thead");
    const tr = document.createElement("tr");
    tr.style.height = `${this.defaultRowHeight}px`;
    const rowTh = document.createElement("th");
    rowTh.classList.add("extable-row-header", "extable-corner");
    rowTh.textContent = "";
    rowTh.style.width = `${this.rowHeaderWidth}px`;
    if (this.activeRowId) rowTh.classList.toggle("extable-active-row-header", true);
    rowTh.dataset.colKey = "";
    tr.appendChild(rowTh);
    const view = this.dataModel.getView();
    for (let idx = 0; idx < schema.columns.length; idx += 1) {
      const col = schema.columns[idx];
      if (!col) continue;
      const th = document.createElement("th");
      th.dataset.colKey = col.key;
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
      label.textContent = col.header ?? col.key;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "extable-filter-sort-trigger";
      btn.dataset.extableFsOpen = "1";
      btn.dataset.extableColKey = col.key;
      btn.title = "Filter / Sort";
      btn.innerHTML = sortDir ? svgArrow(sortDir) : svgFunnel();
      wrap.appendChild(label);
      wrap.appendChild(btn);
      th.appendChild(wrap);
      const width = colWidths[idx] ?? col.width;
      if (width) th.style.width = `${width}px`;
      th.dataset.colKey = col.key;
      if (this.activeColKey !== null && this.activeColKey === col.key) {
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
    uniqueCommitState: ReturnType<typeof resolveUniqueBooleanCommitState>,
  ) {
    const tr = document.createElement("tr");
    tr.dataset.rowId = row.id;
    tr.style.height = `${this.defaultRowHeight}px`;
    // Highlight rows where any unique-boolean column is true
    const anyUniqueTrue = schema.columns.some((c) => c && c.type === "boolean" && c.unique && this.dataModel.getCell(row.id, c.key) === true);
    if (anyUniqueTrue) tr.classList.add("extable-row--unique-true");
    const view = this.dataModel.getView();
    const rowHeader = document.createElement("th");
    rowHeader.scope = "row";
    rowHeader.classList.add("extable-row-header");
    const index = this.dataModel.getDisplayIndex(row.id) ?? "";
    rowHeader.textContent = String(index);
    if (this.activeRowId === row.id) rowHeader.classList.add("extable-active-row-header");
    tr.appendChild(rowHeader);
    for (let idx = 0; idx < schema.columns.length; idx += 1) {
      const col = schema.columns[idx];
      if (!col) continue;
      const td = document.createElement("td");
      td.classList.add("extable-cell");
      td.dataset.colKey = col.key;
      if (col.type === "boolean") td.classList.add("extable-boolean");
      const isPending = this.dataModel.hasPending(row.id, col.key);
      const condRes = this.dataModel.resolveConditionalStyle(row.id, col);
      const cellStyle = this.dataModel.getCellStyle(row.id, col.key);
      const hasTextColor = Boolean(
        cellStyle?.textColor || condRes.delta?.textColor || col.style?.textColor,
      );
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
      const wrap = view.wrapText?.[col.key] ?? col.wrapText;
      td.classList.add(wrap ? "cell-wrap" : "cell-nowrap");
      const raw = this.dataModel.getRawCell(row.id, col.key);
      const valueRes = this.dataModel.resolveCellValue(row.id, col);
      const textOverride = valueRes.textOverride ?? (condRes.forceErrorText ? "#ERROR" : undefined);
      const formatted = textOverride
        ? { text: textOverride as string }
        : this.formatValue(valueRes.value, col);
      const interaction = this.dataModel.getCellInteraction(row.id, col.key);
      const tagValues =
        col.type === "tags" && !textOverride ? resolveTagValues(valueRes.value) : null;
      const isActionType = col.type === "button" || col.type === "link";
      const actionValue = isActionType
        ? col.type === "button"
          ? resolveButtonAction(valueRes.value)
          : resolveLinkAction(valueRes.value)
        : null;
      const actionLabel = isActionType
        ? col.type === "button"
          ? getButtonLabel(valueRes.value)
          : getLinkLabel(valueRes.value)
        : "";
      if (tagValues && tagValues.length) {
        const list = document.createElement("div");
        list.className = "extable-tag-list";
        tagValues.forEach((tag, index) => {
          const chip = document.createElement("span");
          chip.className = "extable-tag";
          const label = document.createElement("span");
          label.className = "extable-tag-label";
          label.textContent = tag;
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "extable-tag-remove";
          remove.dataset.extableTagRemove = "1";
          remove.dataset.extableTagIndex = String(index);
          remove.textContent = "×";
          if (interaction.readonly || interaction.disabled) {
            remove.disabled = true;
          }
          chip.appendChild(label);
          chip.appendChild(remove);
          list.appendChild(chip);
        });
        td.replaceChildren(list);
      } else if (isActionType && !textOverride && actionValue && actionLabel) {
        const actionEl =
          col.type === "button" ? document.createElement("button") : document.createElement("span");
        if (actionEl instanceof HTMLButtonElement) actionEl.type = "button";
        actionEl.className =
          col.type === "button" ? "extable-action-button" : "extable-action-link";
        if (interaction.disabled) actionEl.classList.add("extable-action-disabled");
        if (col.type === "link" && hasTextColor) actionEl.style.color = "inherit";
        actionEl.dataset.extableAction = col.type;
        actionEl.textContent = actionLabel;
        td.replaceChildren(actionEl);
      } else {
          if (col.type === "boolean" && !textOverride) {
          if (col.unique) {
            const indicator = document.createElement("span");
            indicator.className = "extable-unique-radio";
            indicator.setAttribute("role", "radio");
            const checked = Boolean(valueRes.value);
            indicator.setAttribute("aria-checked", checked ? "true" : "false");
            if (interaction.readonly || interaction.disabled) {
              indicator.setAttribute("aria-disabled", "true");
              indicator.classList.add("extable-unique-radio--disabled");
            }
            const commitState = uniqueCommitState.get(String(col.key));
            if (commitState?.currentRowId === row.id) {
              indicator.classList.add("extable-unique-dot-current");
            } else if (commitState?.previousRowId === row.id) {
              indicator.classList.add("extable-unique-dot-previous");
            } else if (checked) {
              indicator.classList.add("extable-unique-dot-default");
            }
            indicator.setAttribute("aria-label", col.header ?? String(col.key));
            td.replaceChildren(indicator);
          } else {
            td.textContent = formatted.text;
            if (formatted.color) td.style.color = formatted.color;
          }
        } else {
          td.textContent = actionLabel || formatted.text;
          if (formatted.color) td.style.color = formatted.color;
        }
      }
      const marker = this.dataModel.getCellMarker(row.id, col.key);
      if (marker) {
        td.classList.toggle("extable-diag-warning", marker.level === "warning");
        td.classList.toggle("extable-diag-error", marker.level === "error");
        td.dataset.extableDiagMessage = marker.message;
      } else {
        td.classList.remove("extable-diag-warning", "extable-diag-error");
        td.removeAttribute("data-extable-diag-message");
      }
      const align =
        col.style?.align ??
        (col.type === "number" || col.type === "int" || col.type === "uint" ? "right" : "left");
      td.classList.add(align === "right" ? "align-right" : "align-left");
      const rawNumbered = toRawValue(raw, valueRes.value, col);
      if (rawNumbered !== null) {
        td.dataset.raw = rawNumbered;
      } else {
        const rawStr = raw === null || raw === undefined ? "" : String(raw);
        td.dataset.raw = rawStr;
      }
      if (isPending) td.classList.add("pending");
      if (interaction.readonly) {
        td.classList.add("extable-readonly");
        if (col.formula) td.classList.add("extable-readonly-formula");
      } else {
        td.classList.add("extable-editable");
      }
      if (interaction.muted) td.classList.add("extable-readonly-muted");
      if (interaction.disabled) td.classList.add("extable-disabled");
      if (
        this.activeRowId === row.id &&
        this.activeColKey !== null &&
        this.activeColKey === col.key
      ) {
        td.classList.add("extable-active-cell");
      }
      tr.appendChild(td);
    }
    // variable row height based on measured content when wrap enabled
    const wrapAny = schema.columns.some((c) => view.wrapText?.[c.key] ?? c.wrapText);
    if (wrapAny) {
      let maxHeight = this.defaultRowHeight;
      for (let idx = 0; idx < schema.columns.length; idx += 1) {
        const col = schema.columns[idx];
        if (!col || !col.wrapText) continue;
        const width = colWidths[idx] ?? view.columnWidths?.[col.key] ?? col.width ?? 100;
        const valueRes = this.dataModel.resolveCellValue(row.id, col);
        const condRes = this.dataModel.resolveConditionalStyle(row.id, col);
        const textOverride =
          valueRes.textOverride ?? (condRes.forceErrorText ? "#ERROR" : undefined);
        const text = textOverride ? "#ERROR" : this.formatValue(valueRes.value, col).text;
        const version = this.dataModel.getRowVersion(row.id);
        const key = `${row.id}|${col.key}|${version}|${width}|${text}`;
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
        const h =
          measure.clientHeight +
          CELL_PADDING_TOP_PX +
          CELL_PADDING_BOTTOM_PX +
          2; // border allowance (top+bottom)
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
        this.tableEl.querySelectorAll<HTMLElement>(`th[data-col-key="${this.activeColKey}"]`),
      )) {
        el.classList.add("extable-active-col-header");
      }
      if (this.activeRowId) {
        for (const el of Array.from(
          this.tableEl.querySelectorAll<HTMLElement>(
            `tr[data-row-id="${this.activeRowId}"] td[data-col-key="${this.activeColKey}"]`,
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
    return formatCellValue(value, col, this.valueFormatCache, (type, fmtValue) =>
      coerceDatePattern(fmtValue, type),
    );
  }
}
