import { describe, expect, test } from "vitest";
import { DataModel } from "../src/dataModel";
import { resolveCellAddress } from "../src/address";

describe("cell address resolver", () => {
  test("resolves ExcelRef (A1)", () => {
    const dm = new DataModel(
      { rows: [{ a: "x", b: "y" }] },
      { columns: [{ key: "a", type: "string" }, { key: "b", type: "string" }] },
      {},
    );
    const t = resolveCellAddress(dm, "A1");
    expect(t).toBeTruthy();
    expect(t!.rowIndex).toBe(0);
    expect(t!.colIndex).toBe(0);
    expect(t!.colKey).toBe("a");
  });

  test("resolves mixed addressing (rowId + colIndex)", () => {
    const dm = new DataModel(
      { rows: [{ a: "x", b: "y" }, { a: "p", b: "q" }] },
      { columns: [{ key: "a", type: "string" }, { key: "b", type: "string" }] },
      {},
    );
    const rowId = dm.listRows()[1]!.id;
    const t = resolveCellAddress(dm, { rowId, colIndex: 1 });
    expect(t).toBeTruthy();
    expect(t!.rowIndex).toBe(1);
    expect(t!.colIndex).toBe(1);
    expect(t!.colKey).toBe("b");
  });
});

