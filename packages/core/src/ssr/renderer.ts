import { DataModel } from "../dataModel";
import { columnFormatToStyle, mergeStyle } from "../styleResolver";
import type {
  ColumnSchema,
  InternalRow,
  NumberFormat,
  IntegerFormat,
  Schema,
  View,
  RowObject,
  ResolvedCellStyle,
} from "../types";
import { coerceDatePattern, formatDateLite, parseIsoDate } from "../dateUtils";
import { formatIntegerWithPrefix, formatNumberForEdit } from "../numberIO";
import { toRawValue } from "../cellValueCodec";
import { getButtonLabel, getLinkLabel, resolveButtonAction, resolveLinkAction } from "../actionValue";
import { DEFAULT_ROW_HEIGHT_PX, HEADER_HEIGHT_PX, ROW_HEADER_WIDTH_PX, getColumnWidths } from "../geometry";
import { toArray } from "../utils";
import { HTMLBuilder } from "./htmlBuilder";
import { CSSBuilder, type CSSStyleMap, serializeStyle } from "./styleSerializer";

export interface SSROptions<T extends object = Record<string, unknown>> {
  data: T[] | null | undefined;
  schema: Schema<any>;
  cssMode?: "inline" | "external" | "both";
  wrapWithRoot?: boolean;
  defaultClass?: string | string[];
  defaultStyle?: Partial<CSSStyleDeclaration>;
}

export interface SSRResult {
  html: string;
  css?: string;
  metadata: {
    rowCount: number;
    columnCount: number;
    hasFormulas: boolean;
    hasConditionalStyles: boolean;
    errors: Array<{ row: number; col: string; message: string }>;
  };
}

export function renderTableHTML<T extends object = Record<string, unknown>>(
  options: SSROptions<T>,
): SSRResult {
  const cssMode = options.cssMode ?? "inline";
  const wrapWithRoot = options.wrapWithRoot ?? false;
  const defaultClass = toArray(options.defaultClass) ?? [];
  const defaultStyle = options.defaultStyle;
  const data = (options.data ?? []) as RowObject[];

  const baseView: View = {};

  const dataModel = new DataModel(data, options.schema, baseView);
  const schema = dataModel.getSchema();
  const rows = dataModel.listRows();
  const columns = schema.columns;
  const colWidths = getColumnWidths(schema, baseView);

  const cssBuilder = cssMode === "inline" ? null : new CSSBuilder();
  const errors: Array<{ row: number; col: string; message: string }> = [];

  const rootClasses = wrapWithRoot ? ["extable-root", ...defaultClass] : defaultClass;
  const rootSelector = rootClasses.length
    ? `.${rootClasses[0]}`
    : 'table[data-extable-ssr="true"]';

  if (cssBuilder && cssMode !== "inline") {
    for (const col of columns) {
      const baseStyle = resolvedStyleToMap(columnFormatToStyle(col));
      if (Object.keys(baseStyle).length === 0) continue;
      cssBuilder.addRule(`${rootSelector} tbody td[data-col-key=\"${String(col.key)}\"]`, baseStyle);
    }
  }

  const totalWidth = ROW_HEADER_WIDTH_PX + colWidths.reduce((acc, w) => acc + (w ?? 0), 0);
  const tableStyle: CSSStyleMap = { width: `${totalWidth}px` };
  if (!wrapWithRoot && defaultStyle) {
    Object.assign(tableStyle, normalizeStyle(defaultStyle));
  }
  const tableAttrs: Record<string, string | number | boolean> = {
    "data-extable-renderer": "html",
    "data-extable-ssr": true,
  };
  if (!wrapWithRoot && rootClasses.length) {
    tableAttrs.class = rootClasses.join(" ");
  }
  const tableStyleAttr = serializeStyle(tableStyle);
  if (tableStyleAttr) {
    tableAttrs.style = tableStyleAttr;
  }

  const tableBuilder = new HTMLBuilder();
  tableBuilder.openTag("table", tableAttrs);
  tableBuilder.openTag("thead");
  tableBuilder.openTag("tr", { style: `height:${HEADER_HEIGHT_PX}px;` });

  const rowHeaderAttrs: Record<string, string | number | boolean> = {
    class: "extable-row-header extable-corner",
    "data-col-key": "",
    style: `width:${ROW_HEADER_WIDTH_PX}px;`,
  };
  tableBuilder.openTag("th", rowHeaderAttrs).text("").closeTag("th");

  for (const col of columns) {
    const thAttrs: Record<string, string | number | boolean> = {
      "data-col-key": col.key,
      "data-col-type": col.type,
    };
    const width = colWidths[schema.columns.findIndex((c) => c.key === col.key)] ?? col.width;
    if (width) thAttrs.style = `width:${width}px;`;

    tableBuilder.openTag("th", thAttrs);
    tableBuilder.openTag("div", { class: "extable-col-header" });
    tableBuilder.openTag("span", { class: "extable-col-header-text" }).text(col.header ?? col.key);
    tableBuilder.closeTag("span");
    tableBuilder.openTag("button", {
      type: "button",
      class: "extable-filter-sort-trigger",
      "data-extable-fs-open": "1",
      "data-extable-col-key": col.key,
      title: "Filter / Sort",
    });
    tableBuilder.html(svgFunnel());
    tableBuilder.closeTag("button");
    tableBuilder.closeTag("div");
    tableBuilder.closeTag("th");
  }

  tableBuilder.closeTag("tr");
  tableBuilder.closeTag("thead");
  tableBuilder.openTag("tbody");

  const hasFormulas = schema.columns.some((c) => Boolean(c.formula));
  const hasConditionalStyles = schema.columns.some((c) => Boolean(c.conditionalStyle)) ||
    Boolean(schema.row?.conditionalStyle);

  rows.forEach((row, rowIndex) => {
    const trAttrs: Record<string, string | number | boolean> = {
      "data-row-id": row.id,
      "data-row-index": rowIndex,
      style: `height:${DEFAULT_ROW_HEIGHT_PX}px;`,
    };
    tableBuilder.openTag("tr", trAttrs);

    const rowHeader: Record<string, string | number | boolean> = {
      class: "extable-row-header",
    };
    const displayIndex = dataModel.getDisplayIndex(row.id) ?? "";
    tableBuilder.openTag("th", rowHeader).text(String(displayIndex)).closeTag("th");

    for (const col of columns) {
      renderCell({
        html: tableBuilder,
        row,
        rowIndex,
        col,
        dataModel,
        cssMode,
        cssBuilder,
        rootSelector,
        errors,
      });
    }

    tableBuilder.closeTag("tr");
  });

  tableBuilder.closeTag("tbody");
  tableBuilder.closeTag("table");

  const tableHtml = tableBuilder.build();
  const html = new HTMLBuilder();
  if (wrapWithRoot) {
    const rootAttrs: Record<string, string | number | boolean> = {
      class: rootClasses.join(" ").trim(),
    };
    if (defaultStyle) {
      const rootStyle = serializeStyle(normalizeStyle(defaultStyle));
      if (rootStyle) rootAttrs.style = rootStyle;
    }
    html.openTag("div", rootAttrs);
    html.openTag("div", { class: "extable-shell" });
    html.openTag("div", { class: "extable-viewport" });
    html.html(tableHtml);
    html.closeTag("div");
    html.openTag("div", { class: "extable-overlay-layer" }).closeTag("div");
    html.closeTag("div");
    html.closeTag("div");
  } else {
    html.html(tableHtml);
  }

  return {
    html: html.build(),
    css: cssBuilder?.build({ minify: true }),
    metadata: {
      rowCount: rows.length,
      columnCount: columns.length,
      hasFormulas,
      hasConditionalStyles,
      errors,
    },
  };
}

function renderCell(options: {
  html: HTMLBuilder;
  row: InternalRow;
  rowIndex: number;
  col: ColumnSchema;
  dataModel: DataModel;
  cssMode: "inline" | "external" | "both";
  cssBuilder: CSSBuilder | null;
  rootSelector: string;
  errors: Array<{ row: number; col: string; message: string }>;
}) {
  const {
    html,
    row,
    rowIndex,
    col,
    dataModel,
    cssMode,
    cssBuilder,
    rootSelector,
    errors,
  } = options;

  const tdClasses = ["extable-cell"];
  if (col.type === "boolean") tdClasses.push("extable-boolean");

  const interaction = dataModel.getCellInteraction(row.id, col.key);
  if (interaction.readonly) tdClasses.push("extable-readonly");
  else tdClasses.push("extable-editable");
  if (interaction.muted) tdClasses.push("extable-readonly-muted");
  if (interaction.disabled) tdClasses.push("extable-disabled");

  const wrap = col.wrapText;
  tdClasses.push(wrap ? "cell-wrap" : "cell-nowrap");

  const align =
    col.style?.align ??
    (col.type === "number" || col.type === "int" || col.type === "uint" ? "right" : "left");
  tdClasses.push(align === "right" ? "align-right" : "align-left");

  const condRes = dataModel.resolveConditionalStyle(row.id, col);
  const cellStyle = dataModel.getCellStyle(row.id, col.key);
  const baseStyle = columnFormatToStyle(col);
  const withCond = condRes.delta ? mergeStyle(baseStyle, condRes.delta) : baseStyle;
  const resolved = cellStyle ? mergeStyle(withCond, cellStyle) : withCond;

  const marker = dataModel.getCellMarker(row.id, col.key);
  if (marker) {
    tdClasses.push(marker.level === "warning" ? "extable-diag-warning" : "extable-diag-error");
  }

  const raw = dataModel.getRawCell(row.id, col.key);
  const valueRes = dataModel.resolveCellValue(row.id, col);
  let textOverride = valueRes.textOverride ?? (condRes.forceErrorText ? "#ERROR" : undefined);

  if (valueRes.diagnostic?.source === "formula") {
    const err = new Error(valueRes.diagnostic.message);
    errors.push({ row: rowIndex, col: String(col.key), message: err.message });
  }

  const validationMsg = dataModel.getCellValidationMessage(row.id, col.key);
  if (validationMsg) {
    const err = new Error(validationMsg);
    errors.push({ row: rowIndex, col: String(col.key), message: err.message });
  }

  const formatted = textOverride
    ? { text: textOverride }
    : formatValue(valueRes.value, col);
  const resolvedWithFormat =
    formatted.color && formatted.color !== resolved.textColor
      ? { ...resolved, textColor: formatted.color }
      : resolved;

  const tagValues = col.type === "tags" && !textOverride ? resolveTagValues(valueRes.value) : null;
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

  const tdAttrs: Record<string, string | number | boolean> = {
    class: tdClasses.join(" "),
    "data-col-key": col.key,
    "data-row-id": row.id,
    "data-col-type": col.type,
    "data-cell": `${rowIndex}:${String(col.key)}`,
  };

  if (col.formula) tdAttrs["data-computed"] = true;
  if (interaction.readonly) tdAttrs["data-readonly"] = true;
  if (marker?.level === "error") tdAttrs["data-invalid"] = true;
  if (marker) tdAttrs["data-extable-diag-message"] = marker.message;

  const rawNumbered = toRawValue(raw, valueRes.value, col);
  if (rawNumbered !== null) {
    tdAttrs["data-raw"] = rawNumbered;
  } else {
    const rawStr = raw === null || raw === undefined ? "" : String(raw);
    tdAttrs["data-raw"] = rawStr;
  }

  if (cssMode === "inline" || cssMode === "both") {
    const needsInline = cssMode === "inline" || Boolean(condRes.delta || cellStyle || formatted.color);
    const inlineStyle = needsInline ? serializeStyle(resolvedStyleToMap(resolvedWithFormat)) : "";
    if (inlineStyle) tdAttrs.style = inlineStyle;
  } else if (cssMode === "external" && cssBuilder) {
    const selector = `${rootSelector} tbody tr[data-row-id=\"${row.id}\"] td[data-col-key=\"${String(col.key)}\"]`;
    cssBuilder.addRule(selector, resolvedStyleToMap(resolvedWithFormat));
  }

  html.openTag("td", tdAttrs);

  if (tagValues && tagValues.length) {
    html.openTag("div", { class: "extable-tag-list" });
    tagValues.forEach((tag, index) => {
      html.openTag("span", { class: "extable-tag" });
      html.openTag("span", { class: "extable-tag-label" }).text(tag).closeTag("span");
      html.openTag("button", {
        type: "button",
        class: "extable-tag-remove",
        "data-extable-tag-remove": "1",
        "data-extable-tag-index": String(index),
        disabled: interaction.readonly || interaction.disabled,
      });
      html.text("×");
      html.closeTag("button");
      html.closeTag("span");
    });
    html.closeTag("div");
  } else if (isActionType && !textOverride && actionValue && actionLabel) {
    const actionAttrs: Record<string, string | number | boolean> = {
      class: col.type === "button" ? "extable-action-button" : "extable-action-link",
      "data-extable-action": col.type,
    };
    if (interaction.disabled) {
      actionAttrs.class = `${actionAttrs.class} extable-action-disabled`;
    }
    if (col.type === "button") {
      actionAttrs.type = "button";
      html.openTag("button", actionAttrs);
      html.text(actionLabel);
      html.closeTag("button");
    } else {
      html.openTag("span", actionAttrs);
      html.text(actionLabel);
      html.closeTag("span");
    }
  } else {
    html.text(actionLabel || formatted.text);
  }

  html.closeTag("td");
}

function formatValue(value: unknown, col: ColumnSchema): { text: string; color?: string } {
  if (value === null || value === undefined) return { text: "" };
  if (col.type === "button") {
    const label = getButtonLabel(value);
    return { text: label || String(value) };
  }
  if (col.type === "link") {
    const label = getLinkLabel(value);
    return { text: label || String(value) };
  }
  if (col.type === "tags") {
    const tags = resolveTagValues(value);
    if (tags) return { text: tags.join(", ") };
  }
  if (col.type === "enum") {
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (obj.kind === "enum" && typeof obj.value === "string") {
        return { text: obj.value };
      }
    }
  }
  if (col.type === "boolean") {
    if (col.format === "checkbox" || !col.format) {
      return { text: value ? "☑" : "☐" };
    }
    if (Array.isArray(col.format) && col.format.length >= 2) {
      return { text: value ? String(col.format[0]) : String(col.format[1]) };
    }
    return { text: value ? String(col.format) : "" };
  }
  if (col.type === "number" && typeof value === "number") {
    const num = value;
    const fmt = col.format as NumberFormat | undefined;
    const token = fmt?.format ?? "decimal";
    if (token === "scientific") {
      const text = formatNumberForEdit(num, { format: "scientific", precision: fmt?.precision });
      const color = fmt?.negativeRed && num < 0 ? "#b91c1c" : undefined;
      return { text, color };
    }

    const opts: Intl.NumberFormatOptions = {};
    if (fmt?.scale !== undefined) {
      opts.minimumFractionDigits = fmt.scale;
      opts.maximumFractionDigits = fmt.scale;
    }
    opts.useGrouping = Boolean(fmt?.thousandSeparator);
    const text = new Intl.NumberFormat("en-US", opts).format(num);
    const color = fmt?.negativeRed && num < 0 ? "#b91c1c" : undefined;
    return { text, color };
  }

  if ((col.type === "int" || col.type === "uint") && typeof value === "number") {
    const num = value;
    const fmt = col.format as IntegerFormat | undefined;
    const token = fmt?.format ?? "decimal";
    if (token === "binary" || token === "octal" || token === "hex") {
      const text = formatIntegerWithPrefix(num, token);
      const color = fmt?.negativeRed && num < 0 ? "#b91c1c" : undefined;
      return { text, color };
    }

    const opts: Intl.NumberFormatOptions = {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: Boolean(fmt?.thousandSeparator),
    };
    const text = new Intl.NumberFormat("en-US", opts).format(num);
    const color = fmt?.negativeRed && num < 0 ? "#b91c1c" : undefined;
    return { text, color };
  }

  if (
    (col.type === "date" || col.type === "time" || col.type === "datetime") &&
    (value instanceof Date || typeof value === "string")
  ) {
    const fmtValue = col.format as string | undefined;
    const fmt =
      col.type === "date"
        ? coerceDatePattern(fmtValue, "date")
        : col.type === "time"
          ? coerceDatePattern(fmtValue, "time")
          : coerceDatePattern(fmtValue, "datetime");
    let d: Date | null = null;
    if (value instanceof Date) d = value;
    else {
      d = parseIsoDate(value);
    }
    if (!d) return { text: String(value) };
    return { text: formatDateLite(d, fmt) };
  }
  return { text: String(value) };
}

function resolveTagValues(value: unknown): string[] | null {
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return value as string[];
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.kind === "tags") {
      const values = obj.values;
      if (Array.isArray(values)) {
        return values.filter((v): v is string => typeof v === "string");
      }
    }
  }
  return null;
}

function resolvedStyleToMap(style: ResolvedCellStyle): CSSStyleMap {
  const css: CSSStyleMap = {};
  if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
  if (style.textColor) css.color = style.textColor;
  if (style.bold) css.fontWeight = "600";
  if (style.italic) css.fontStyle = "italic";
  const dec: string[] = [];
  if (style.underline) dec.push("underline");
  if (style.strike) dec.push("line-through");
  if (dec.length) css.textDecorationLine = dec.join(" ");
  return css;
}

function svgFunnel() {
  return `
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `.trim();
}

function normalizeStyle(style: Partial<CSSStyleDeclaration>): CSSStyleMap {
  const out: CSSStyleMap = {};
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined || value === null || value === "") continue;
    out[key] = value;
  }
  return out;
}
