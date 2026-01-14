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
import { HTMLBuilder, escapeHtml } from "./htmlBuilder";
import { CSSBuilder, type CSSStyleMap, serializeStyle } from "./styleSerializer";

export interface SSROptions<T extends object = Record<string, unknown>> {
  data: T[] | null | undefined;
  schema: Schema<any>;
  cssMode?: "inline" | "external" | "both";
  wrapWithRoot?: boolean;
  defaultClass?: string | string[];
  defaultStyle?: Partial<CSSStyleDeclaration>;
  includeStyles?: boolean;
  includeRawAttributes?: boolean;
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
  const includeStyles = options.includeStyles ?? false;
  const includeRawAttributes = options.includeRawAttributes ?? false;
  const data = (options.data ?? []) as RowObject[];

  const baseView: View = {};
  const schema = options.schema;
  const columns = schema.columns;
  const colWidths = getColumnWidths(schema, baseView);
  const hasFormulas = columns.some((c) => Boolean(c.formula));
  const hasConditionalStyles =
    columns.some((c) => Boolean(c.conditionalStyle)) || Boolean(schema.row?.conditionalStyle);

  const cssBuilder = includeStyles && cssMode !== "inline" ? new CSSBuilder() : null;
  const errors: Array<{ row: number; col: string; message: string }> = [];
  const valueFormatters = new Map<string, (value: unknown) => { text: string; color?: string }>();
  const baseStyles = includeStyles ? new Map<string, ResolvedCellStyle>() : null;
  const columnMeta = columns.map((col) => {
    const colKey = String(col.key);
    valueFormatters.set(colKey, createValueFormatter(col, includeStyles));
    if (baseStyles) baseStyles.set(colKey, columnFormatToStyle(col));
    const baseClasses = ["extable-cell"];
    if (col.type === "boolean") baseClasses.push("extable-boolean");
    const wrap = col.wrapText;
    baseClasses.push(wrap ? "cell-wrap" : "cell-nowrap");
    const align =
      col.style?.align ??
      (col.type === "number" || col.type === "int" || col.type === "uint" ? "right" : "left");
    baseClasses.push(align === "right" ? "align-right" : "align-left");
    return {
      col,
      colKey,
      baseClass: baseClasses.join(" "),
      tdAttrPrefix: ` class="${baseClasses.join(" ")} extable-editable" data-col-key="${escapeHtml(
        colKey,
      )}"`,
      isActionType: col.type === "button" || col.type === "link",
    };
  });
  const hasInteraction =
    columns.some((col) => Boolean(col.readonly || col.style?.readonly || col.style?.disabled)) ||
    data.some((row) => Boolean(row._readonly));
  const useFastPath =
    !includeStyles &&
    !includeRawAttributes &&
    !hasFormulas &&
    !hasConditionalStyles &&
    !hasInteraction;

  if (useFastPath) {
    return renderFastTableHTML({
      data,
      columns,
      columnMeta,
      colWidths,
      wrapWithRoot,
      defaultClass,
      defaultStyle,
      valueFormatters,
    });
  }

  const dataModel = new DataModel(data, schema, baseView);
  const rows = dataModel.listRows();

  const rootClasses = wrapWithRoot ? ["extable-root", ...defaultClass] : defaultClass;
  const rootSelector = rootClasses.length ? `.${rootClasses[0]}` : 'table[data-extable-renderer="html"]';

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
  };
  if (!wrapWithRoot && rootClasses.length) {
    tableAttrs.class = rootClasses.join(" ");
  }
  const tableStyleAttr = serializeStyle(tableStyle);
  if (tableStyleAttr) {
    tableAttrs.style = tableStyleAttr;
  }

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
  }

  html.openTag("table", tableAttrs);
  html.openTag("thead");
  html.openTag("tr", { style: `height:${HEADER_HEIGHT_PX}px;` });

  const rowHeaderAttrs: Record<string, string | number | boolean> = {
    class: "extable-row-header extable-corner",
    "data-col-key": "",
    style: `width:${ROW_HEADER_WIDTH_PX}px;`,
  };
  html.tag("th", rowHeaderAttrs, "");

  columns.forEach((col, colIndex) => {
    const thAttrs: Record<string, string | number | boolean> = {
      "data-col-key": col.key,
    };
    const width = colWidths[colIndex] ?? col.width;
    if (width) thAttrs.style = `width:${width}px;`;

    html.openTag("th", thAttrs);
    html.openTag("div", { class: "extable-col-header" });
    html.tag("span", { class: "extable-col-header-text" }, col.header ?? String(col.key));
    html.openTag("button", {
      type: "button",
      class: "extable-filter-sort-trigger",
      "data-extable-fs-open": "1",
      "data-extable-col-key": col.key,
      title: "Filter / Sort",
    });
    html.html(svgFunnel());
    html.closeTag("button");
    html.closeTag("div");
    html.closeTag("th");
  });

  html.closeTag("tr");
  html.closeTag("thead");
  html.openTag("tbody");

  rows.forEach((row, rowIndex) => {
    const trAttrs: Record<string, string | number | boolean> = {
      style: `height:${DEFAULT_ROW_HEIGHT_PX}px;`,
    };
    html.openTag("tr", trAttrs);

    const rowHeader: Record<string, string | number | boolean> = {
      class: "extable-row-header",
    };
    const displayIndex = dataModel.getDisplayIndex(row.id) ?? "";
    html.openTag("th", rowHeader).text(String(displayIndex)).closeTag("th");

    for (const meta of columnMeta) {
      renderCell({
        html,
        row,
        rowIndex,
        meta,
        dataModel,
        cssMode,
        cssBuilder,
        rootSelector,
        errors,
        valueFormatters,
        baseStyles,
        includeStyles,
        includeRawAttributes,
        hasInteraction,
      });
    }

    html.closeTag("tr");
  });

  html.closeTag("tbody");
  html.closeTag("table");

  if (wrapWithRoot) {
    html.closeTag("div");
    html.openTag("div", { class: "extable-overlay-layer" }).closeTag("div");
    html.closeTag("div");
    html.closeTag("div");
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

function renderFastTableHTML(options: {
  data: RowObject[];
  columns: ColumnSchema[];
  columnMeta: Array<{
    col: ColumnSchema;
    colKey: string;
    baseClass: string;
    tdAttrPrefix: string;
    isActionType: boolean;
  }>;
  colWidths: number[];
  wrapWithRoot: boolean;
  defaultClass: string[];
  defaultStyle: Partial<CSSStyleDeclaration> | undefined;
  valueFormatters: Map<string, (value: unknown) => { text: string; color?: string }>;
}): SSRResult {
  const {
    data,
    columns,
    columnMeta,
    colWidths,
    wrapWithRoot,
    defaultClass,
    defaultStyle,
    valueFormatters,
  } = options;
  const rootClasses = wrapWithRoot ? ["extable-root", ...defaultClass] : defaultClass;

  let totalWidth = ROW_HEADER_WIDTH_PX;
  for (const width of colWidths) totalWidth += width;
  const tableStyle: CSSStyleMap = { width: `${totalWidth}px` };
  if (!wrapWithRoot && defaultStyle) {
    Object.assign(tableStyle, normalizeStyle(defaultStyle));
  }
  const tableAttrs: Record<string, string | number | boolean> = {
    "data-extable-renderer": "html",
  };
  if (!wrapWithRoot && rootClasses.length) {
    tableAttrs.class = rootClasses.join(" ");
  }
  const tableStyleAttr = serializeStyle(tableStyle);
  if (tableStyleAttr) {
    tableAttrs.style = tableStyleAttr;
  }

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
  }

  html.openTag("table", tableAttrs);
  html.openTag("thead");
  html.openTag("tr", { style: `height:${HEADER_HEIGHT_PX}px;` });
  html.tag(
    "th",
    {
      class: "extable-row-header extable-corner",
      "data-col-key": "",
      style: `width:${ROW_HEADER_WIDTH_PX}px;`,
    },
    "",
  );
  columns.forEach((col, colIndex) => {
      const thAttrs: Record<string, string | number | boolean> = {
        "data-col-key": col.key,
      };
    const width = colWidths[colIndex] ?? col.width;
    if (width) thAttrs.style = `width:${width}px;`;
    html.openTag("th", thAttrs);
    html.openTag("div", { class: "extable-col-header" });
    html.tag("span", { class: "extable-col-header-text" }, col.header ?? String(col.key));
    html.openTag("button", {
      type: "button",
      class: "extable-filter-sort-trigger",
      "data-extable-fs-open": "1",
      "data-extable-col-key": col.key,
      title: "Filter / Sort",
    });
    html.html(svgFunnel());
    html.closeTag("button");
    html.closeTag("div");
    html.closeTag("th");
  });
  html.closeTag("tr");
  html.closeTag("thead");
  html.openTag("tbody");

  for (let rowIndex = 0; rowIndex < data.length; rowIndex += 1) {
    const row = data[rowIndex] as RowObject;
    html.openTag("tr", {
      style: `height:${DEFAULT_ROW_HEIGHT_PX}px;`,
    });
    html.tag("th", { class: "extable-row-header" }, String(rowIndex + 1));
    for (const meta of columnMeta) {
      const { col, colKey, tdAttrPrefix, isActionType } = meta;
      const formatter = valueFormatters.get(colKey);
      const value = (row as Record<string, unknown>)[colKey];
      const formatted = formatter ? formatter(value) : { text: String(value ?? "") };
      const tagValues = col.type === "tags" ? resolveTagValues(value) : null;
      const actionValue = isActionType
        ? col.type === "button"
          ? resolveButtonAction(value)
          : resolveLinkAction(value)
        : null;
      const actionLabel = isActionType
        ? col.type === "button"
          ? getButtonLabel(value)
          : getLinkLabel(value)
        : "";
      const hasActionContent = isActionType && actionValue && actionLabel;
      if (tagValues && tagValues.length) {
        html.openTag("td", {
          class: `${meta.baseClass} extable-editable`,
          "data-col-key": col.key,
        });
        html.openTag("div", { class: "extable-tag-list" });
        tagValues.forEach((tag, index) => {
          html.openTag("span", { class: "extable-tag" });
          html.tag("span", { class: "extable-tag-label" }, tag);
          html.openTag("button", {
            type: "button",
            class: "extable-tag-remove",
            "data-extable-tag-remove": "1",
            "data-extable-tag-index": String(index),
            disabled: false,
          });
          html.text("×");
          html.closeTag("button");
          html.closeTag("span");
        });
        html.closeTag("div");
        html.closeTag("td");
      } else if (hasActionContent) {
        html.openTag("td", {
          class: `${meta.baseClass} extable-editable`,
          "data-col-key": col.key,
        });
        if (col.type === "button") {
          html.tag(
            "button",
            { class: "extable-action-button", "data-extable-action": "button", type: "button" },
            actionLabel,
          );
        } else {
          html.tag(
            "span",
            { class: "extable-action-link", "data-extable-action": "link" },
            actionLabel,
          );
        }
        html.closeTag("td");
      } else {
        const text = escapeHtml(actionLabel || formatted.text);
        html.html(`<td${tdAttrPrefix}>${text}</td>`);
      }
    }
    html.closeTag("tr");
  }

  html.closeTag("tbody");
  html.closeTag("table");

  if (wrapWithRoot) {
    html.closeTag("div");
    html.openTag("div", { class: "extable-overlay-layer" }).closeTag("div");
    html.closeTag("div");
    html.closeTag("div");
  }

  return {
    html: html.build(),
    metadata: {
      rowCount: data.length,
      columnCount: columns.length,
      hasFormulas: false,
      hasConditionalStyles: false,
      errors: [],
    },
  };
}

function renderCell(options: {
  html: HTMLBuilder;
  row: InternalRow;
  rowIndex: number;
  meta: {
    col: ColumnSchema;
    colKey: string;
    baseClass: string;
    isActionType: boolean;
  };
  dataModel: DataModel;
  cssMode: "inline" | "external" | "both";
  cssBuilder: CSSBuilder | null;
  rootSelector: string;
  errors: Array<{ row: number; col: string; message: string }>;
  valueFormatters: Map<string, (value: unknown) => { text: string; color?: string }>;
  baseStyles: Map<string, ResolvedCellStyle> | null;
  includeStyles: boolean;
  includeRawAttributes: boolean;
  hasInteraction: boolean;
}) {
  const {
    html,
    row,
    rowIndex,
    meta,
    dataModel,
    cssMode,
    cssBuilder,
    rootSelector,
    errors,
    valueFormatters,
    baseStyles,
    includeStyles,
    includeRawAttributes,
    hasInteraction,
  } = options;

  const { col, colKey, baseClass, isActionType } = meta;

  const interaction = hasInteraction
    ? dataModel.getCellInteraction(row.id, col.key)
    : { readonly: false, muted: false, disabled: false };
  let className = baseClass;
  if (interaction.readonly) className += " extable-readonly";
  else className += " extable-editable";
  if (interaction.muted) className += " extable-readonly-muted";
  if (interaction.disabled) className += " extable-disabled";

  const condRes = includeStyles
    ? dataModel.resolveConditionalStyle(row.id, col)
    : { delta: null, forceErrorText: false };
  const cellStyle = includeStyles ? dataModel.getCellStyle(row.id, col.key) : null;
  const baseStyle = includeStyles ? baseStyles?.get(colKey) ?? {} : {};
  const withCond = includeStyles && condRes.delta ? mergeStyle(baseStyle, condRes.delta) : baseStyle;
  const resolved = includeStyles && cellStyle ? mergeStyle(withCond, cellStyle) : withCond;

  const diagnostic = includeStyles ? dataModel.getCellDiagnostic(row.id, col.key) : null;
  if (diagnostic) {
    className += diagnostic.level === "warning" ? " extable-diag-warning" : " extable-diag-error";
  }

  const raw = dataModel.getRawCell(row.id, col.key);
  const valueRes = dataModel.resolveCellValue(row.id, col);
  let textOverride = valueRes.textOverride ?? (condRes.forceErrorText ? "#ERROR" : undefined);

  if (valueRes.diagnostic?.source === "formula") {
    if (!textOverride) textOverride = "#ERROR";
    errors.push({ row: rowIndex, col: colKey, message: valueRes.diagnostic.message });
  }

  const formatter = valueFormatters.get(colKey);
  const formatted = textOverride
    ? { text: textOverride }
    : (formatter ? formatter(valueRes.value) : { text: String(valueRes.value ?? "") });
  const resolvedWithFormat =
    formatted.color && formatted.color !== resolved.textColor
      ? { ...resolved, textColor: formatted.color }
      : resolved;

  const tagValues = col.type === "tags" && !textOverride ? resolveTagValues(valueRes.value) : null;
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
    class: className,
    "data-col-key": col.key,
  };

  if (includeStyles && diagnostic) tdAttrs["data-extable-diag-message"] = diagnostic.message;

  if (includeRawAttributes) {
    const rawNumbered = toRawValue(raw, valueRes.value, col);
    if (rawNumbered !== null) {
      tdAttrs["data-raw"] = rawNumbered;
    } else {
      const rawStr = raw === null || raw === undefined ? "" : String(raw);
      tdAttrs["data-raw"] = rawStr;
    }
  }

  if (includeStyles) {
    if (cssMode === "inline" || cssMode === "both") {
      if (hasRenderableStyle(resolvedWithFormat)) {
        const inlineStyle = serializeStyle(resolvedStyleToMap(resolvedWithFormat));
        if (inlineStyle) tdAttrs.style = inlineStyle;
      }
    } else if (cssMode === "external" && cssBuilder && hasRenderableStyle(resolvedWithFormat)) {
      const selector = `${rootSelector} tbody tr:nth-child(${rowIndex + 1}) td[data-col-key=\"${colKey}\"]`;
      cssBuilder.addRule(selector, resolvedStyleToMap(resolvedWithFormat));
    }
  }

  const hasActionContent = isActionType && !textOverride && actionValue && actionLabel;
  if (tagValues && tagValues.length) {
    html.openTag("td", tdAttrs);
    html.openTag("div", { class: "extable-tag-list" });
    tagValues.forEach((tag, index) => {
      html.openTag("span", { class: "extable-tag" });
      html.tag("span", { class: "extable-tag-label" }, tag);
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
    html.closeTag("td");
  } else if (hasActionContent) {
    html.openTag("td", tdAttrs);
    const actionAttrs: Record<string, string | number | boolean> = {
      class: col.type === "button" ? "extable-action-button" : "extable-action-link",
      "data-extable-action": col.type,
    };
    if (interaction.disabled) {
      actionAttrs.class = `${actionAttrs.class} extable-action-disabled`;
    }
    if (col.type === "button") {
      actionAttrs.type = "button";
      html.tag("button", actionAttrs, actionLabel);
    } else {
      html.tag("span", actionAttrs, actionLabel);
    }
    html.closeTag("td");
  } else {
    html.tag("td", tdAttrs, actionLabel || formatted.text);
  }
}

function createValueFormatter(
  col: ColumnSchema,
  includeStyles: boolean,
): (value: unknown) => { text: string; color?: string } {
  if (!includeStyles) {
    return createFastValueFormatter(col);
  }
  if (col.type === "button") {
    return (value) => {
      if (value === null || value === undefined) return { text: "" };
      const label = getButtonLabel(value);
      return { text: label || String(value) };
    };
  }
  if (col.type === "link") {
    return (value) => {
      if (value === null || value === undefined) return { text: "" };
      const label = getLinkLabel(value);
      return { text: label || String(value) };
    };
  }
  if (col.type === "tags") {
    return (value) => {
      if (value === null || value === undefined) return { text: "" };
      const tags = resolveTagValues(value);
      if (tags) return { text: tags.join(", ") };
      return { text: String(value) };
    };
  }
  if (col.type === "enum") {
    return (value) => {
      if (value === null || value === undefined) return { text: "" };
      if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        if (obj.kind === "enum" && typeof obj.value === "string") {
          return { text: obj.value };
        }
      }
      return { text: String(value) };
    };
  }
  if (col.type === "boolean") {
    return (value) => {
      if (value === null || value === undefined) return { text: "" };
      if (col.format === "checkbox" || !col.format) {
        return { text: value ? "☑" : "☐" };
      }
      if (Array.isArray(col.format) && col.format.length >= 2) {
        return { text: value ? String(col.format[0]) : String(col.format[1]) };
      }
      return { text: value ? String(col.format) : "" };
    };
  }
  if (col.type === "number") {
    const fmt = col.format as NumberFormat | undefined;
    const token = fmt?.format ?? "decimal";
    if (token === "scientific") {
      return (value) => {
        if (value === null || value === undefined) return { text: "" };
        if (typeof value !== "number") return { text: String(value) };
        const text = formatNumberForEdit(value, {
          format: "scientific",
          precision: fmt?.precision,
        });
        const color = fmt?.negativeRed && value < 0 ? "#b91c1c" : undefined;
        return { text, color };
      };
    }
    const opts: Intl.NumberFormatOptions = {};
    if (fmt?.scale !== undefined) {
      opts.minimumFractionDigits = fmt.scale;
      opts.maximumFractionDigits = fmt.scale;
    }
    opts.useGrouping = Boolean(fmt?.thousandSeparator);
    const formatter = new Intl.NumberFormat("en-US", opts);
    return (value) => {
      if (value === null || value === undefined) return { text: "" };
      if (typeof value !== "number") return { text: String(value) };
      const text = formatter.format(value);
      const color = fmt?.negativeRed && value < 0 ? "#b91c1c" : undefined;
      return { text, color };
    };
  }
  if (col.type === "int" || col.type === "uint") {
    const fmt = col.format as IntegerFormat | undefined;
    const token = fmt?.format ?? "decimal";
    if (token === "binary" || token === "octal" || token === "hex") {
      return (value) => {
        if (value === null || value === undefined) return { text: "" };
        if (typeof value !== "number") return { text: String(value) };
        const text = formatIntegerWithPrefix(value, token);
        const color = fmt?.negativeRed && value < 0 ? "#b91c1c" : undefined;
        return { text, color };
      };
    }
    const formatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: Boolean(fmt?.thousandSeparator),
    });
    return (value) => {
      if (value === null || value === undefined) return { text: "" };
      if (typeof value !== "number") return { text: String(value) };
      const text = formatter.format(value);
      const color = fmt?.negativeRed && value < 0 ? "#b91c1c" : undefined;
      return { text, color };
    };
  }
  if (col.type === "date" || col.type === "time" || col.type === "datetime") {
    const fmtValue = col.format as string | undefined;
    const fmt =
      col.type === "date"
        ? coerceDatePattern(fmtValue, "date")
        : col.type === "time"
          ? coerceDatePattern(fmtValue, "time")
          : coerceDatePattern(fmtValue, "datetime");
    return (value) => {
      if (value === null || value === undefined) return { text: "" };
      let d: Date | null = null;
      if (value instanceof Date) d = value;
      else if (typeof value === "string") d = parseIsoDate(value);
      if (!d) return { text: String(value) };
      return { text: formatDateLite(d, fmt) };
    };
  }
  return (value) => {
    if (value === null || value === undefined) return { text: "" };
    return { text: String(value) };
  };
}

function createFastValueFormatter(col: ColumnSchema): (value: unknown) => { text: string; color?: string } {
  if (col.type === "button") {
    return (value) => {
      if (value === null || value === undefined) return { text: "" };
      const label = getButtonLabel(value);
      return { text: label || String(value) };
    };
  }
  if (col.type === "link") {
    return (value) => {
      if (value === null || value === undefined) return { text: "" };
      const label = getLinkLabel(value);
      return { text: label || String(value) };
    };
  }
  if (col.type === "tags") {
    return (value) => {
      if (value === null || value === undefined) return { text: "" };
      const tags = resolveTagValues(value);
      if (tags) return { text: tags.join(", ") };
      return { text: String(value) };
    };
  }
  if (col.type === "enum") {
    return (value) => {
      if (value === null || value === undefined) return { text: "" };
      if (value && typeof value === "object") {
        const obj = value as Record<string, unknown>;
        if (obj.kind === "enum" && typeof obj.value === "string") {
          return { text: obj.value };
        }
      }
      return { text: String(value) };
    };
  }
  return (value) => {
    if (value === null || value === undefined) return { text: "" };
    return { text: String(value) };
  };
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

function hasRenderableStyle(style: ResolvedCellStyle): boolean {
  return Boolean(
    style.backgroundColor ||
      style.textColor ||
      style.bold ||
      style.italic ||
      style.underline ||
      style.strike,
  );
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
    if (typeof value !== "string" && typeof value !== "number") continue;
    out[key] = value;
  }
  return out;
}
