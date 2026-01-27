import { describe, expect, test } from "vitest";
import { clampColumnWidth, getColumnWidths, DEFAULT_COLUMN_MIN_WIDTH_PX } from "../src/geometry";
import type { Schema, View } from "../src/types";

describe("geometry column widths", () => {
  test("getColumnWidths prefers view overrides then schema width", () => {
    const schema: Schema = {
      columns: [
        { key: "a", type: "string", width: 120 },
        { key: "b", type: "date", width: 100 },
      ],
    };
    const view: View = { columnWidths: { a: 150 } };
    expect(getColumnWidths(schema, view)).toEqual([150, 108]);
  });

  test("clampColumnWidth enforces minimum visible width", () => {
    const extra = 8;
    const minBase = DEFAULT_COLUMN_MIN_WIDTH_PX - extra;
    expect(clampColumnWidth(40, extra)).toBe(minBase);
    expect(clampColumnWidth(90, extra)).toBe(90);
  });
});
