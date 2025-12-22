import type { ColumnSchema, ResolvedCellStyle, StyleDelta } from "./types";
import type { DataModel } from "./dataModel";

export function columnFormatToStyle(col: ColumnSchema): ResolvedCellStyle {
  const fmt = col.style;
  const dec = fmt?.decorations;
  return {
    backgroundColor: fmt?.backgroundColor,
    textColor: fmt?.textColor,
    bold: dec?.bold,
    italic: dec?.italic,
    underline: dec?.underline,
    strike: dec?.strike,
    readonly: fmt?.readonly,
    disabled: fmt?.disabled,
  };
}

export function mergeStyle(base: ResolvedCellStyle, override?: StyleDelta | null): ResolvedCellStyle {
  if (!override) return base;
  return {
    backgroundColor: override.backgroundColor ?? base.backgroundColor,
    textColor: override.textColor ?? base.textColor,
    bold: override.bold ?? base.bold,
    italic: override.italic ?? base.italic,
    underline: override.underline ?? base.underline,
    strike: override.strike ?? base.strike,
    readonly: override.readonly ?? base.readonly,
    disabled: override.disabled ?? base.disabled,
  };
}

export function resolveCellStyles(
  dataModel: DataModel,
  rowId: string,
  col: ColumnSchema,
): { columnStyle: ResolvedCellStyle; cellStyle: StyleDelta; resolved: ResolvedCellStyle } {
  const columnStyle = columnFormatToStyle(col);
  const conditional = dataModel.resolveConditionalStyle(rowId, col).delta ?? {};
  const cellStyle = dataModel.getCellStyle(rowId, col.key) ?? {};
  const resolved = mergeStyle(mergeStyle(columnStyle, conditional), cellStyle);
  return { columnStyle, cellStyle, resolved };
}

export function styleToCssText(style: ResolvedCellStyle): string {
  let css = "";
  if (style.backgroundColor) css += `background-color:${style.backgroundColor};`;
  if (style.textColor) css += `color:${style.textColor};`;
  if (style.bold) css += "font-weight:600;";
  if (style.italic) css += "font-style:italic;";
  const dec: string[] = [];
  if (style.underline) dec.push("underline");
  if (style.strike) dec.push("line-through");
  if (dec.length) css += `text-decoration-line:${dec.join(" ")};`;
  return css;
}
