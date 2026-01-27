import type { Schema, View } from "./types";

export const HEADER_HEIGHT_PX = 35;
export const ROW_HEADER_WIDTH_PX = 48;
export const DEFAULT_ROW_HEIGHT_PX = 35;
export const DEFAULT_COLUMN_MIN_WIDTH_PX = 80;
export const COLUMN_RESIZE_HANDLE_PX = 6;

// Shared visual metrics
// Keep vertical insets compatible with DEFAULT_ROW_HEIGHT_PX (24px) and base line-height (16px).
export const CELL_PADDING_X_PX = 8;
export const CELL_PADDING_TOP_PX = 4;
export const CELL_PADDING_BOTTOM_PX = 4;

export function getColumnWidths(schema: Schema, view: View, fallbackWidth = 100): number[] {
  const extraByType: Partial<Record<string, number>> = {
    // Reserve extra space for browser UI affordances (e.g. date picker icon) and formatting.
    date: 8,
  };
  return schema.columns.map((c) => {
    // Resolution order: view override -> schema width -> fallback width.
    const base = view.columnWidths?.[String(c.key)] ?? c.width ?? fallbackWidth;
    const extra = extraByType[c.type] ?? 0;
    return base + extra;
  });
}

export function clampColumnWidth(
  baseWidth: number,
  extraWidth: number,
  minVisibleWidth: number = DEFAULT_COLUMN_MIN_WIDTH_PX,
): number {
  const minBase = Math.max(1, minVisibleWidth - extraWidth);
  return Math.max(minBase, baseWidth);
}
