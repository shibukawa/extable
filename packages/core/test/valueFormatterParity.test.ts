import { describe, expect, it } from "vitest";
import { coerceDatePattern } from "../src/dateUtils";
import { formatCellValue, ValueFormatCache } from "../src/valueFormatter";

describe("valueFormatter parity", () => {
  it("formats numeric and date values consistently with shared formatter", () => {
    const cache = new ValueFormatCache();
    const numberCol = {
      key: "n",
      type: "number",
      format: { format: "decimal", scale: 2, thousandSeparator: true },
    } as any;
    const dateCol = { key: "d", type: "date", format: "yyyy/MM/dd" } as any;

    const numberRes = formatCellValue(1234.5, numberCol, cache);
    const dateRes = formatCellValue("2026-02-09T10:11:12Z", dateCol, cache, (type, fmt) =>
      coerceDatePattern(fmt, type),
    );

    expect(numberRes.text).toBe("1,234.50");
    expect(dateRes.text).toBe("2026/02/09");
  });

  it("handles lookup and labeled values", () => {
    const cache = new ValueFormatCache();
    const col = { key: "x", type: "string" } as any;

    const lookupRes = formatCellValue({ kind: "lookup", label: "Tokyo" }, col, cache);
    const labeledRes = formatCellValue({ label: "Label", value: "v" }, col, cache);

    expect(lookupRes.text).toBe("Tokyo");
    expect(labeledRes.text).toBe("Label");
  });
});
