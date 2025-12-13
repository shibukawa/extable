import type { Schema, View } from "./types";

export const HEADER_HEIGHT_PX = 24;
export const ROW_HEADER_WIDTH_PX = 48;
export const DEFAULT_ROW_HEIGHT_PX = 24;

export function getColumnWidths(schema: Schema, view: View, fallbackWidth = 100): number[] {
  const extraByType: Partial<Record<string, number>> = {
    // Reserve extra space for browser UI affordances (e.g. date picker icon) and formatting.
    date: 8,
  };
  return schema.columns.map((c) => {
    const base = view.columnWidths?.[String(c.key)] ?? c.width ?? fallbackWidth;
    const extra = extraByType[c.type] ?? 0;
    return base + extra;
  });
}
