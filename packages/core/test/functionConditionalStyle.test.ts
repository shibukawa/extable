import { describe, expect, test } from "vitest";
import { createTablePlaceholder, mountTable } from "../src/index";

describe("function formula + conditional style", () => {
  test("computed column renders and is readonly", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: { rows: [{ price: 10, qty: 2 }] },
        schema: {
          columns: [
            { key: "price", type: "number" },
            { key: "qty", type: "number" },
            { key: "total", type: "number", formula: (row: any) => row.price * row.qty },
          ],
        },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const total = root.querySelector('td[data-col-key="total"]') as HTMLTableCellElement | null;
    expect(total).toBeTruthy();
    expect(total!.textContent).toBe("20");
    expect(total!.classList.contains("extable-readonly")).toBe(true);

    core.destroy();
    root.remove();
  });

  test("row-level and cell-level conditional styles apply with precedence", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: { rows: [{ a: "x", b: "y" }] },
        schema: {
          columns: [
            { key: "__row__", type: "string", conditionalStyle: () => ({ background: "#ffff00" }) },
            { key: "a", type: "string" },
            { key: "b", type: "string", conditionalStyle: () => ({ background: "#ff0000" }) },
          ],
        },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    // Cell-level should win over column/row.
    core.setCellConditionalStyle({ rowIndex: 0, colKey: "b" }, () => ({ background: "#00ff00" }));

    const a = root.querySelector('td[data-col-key="a"]') as HTMLTableCellElement | null;
    const b = root.querySelector('td[data-col-key="b"]') as HTMLTableCellElement | null;
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();

    const aStyle = a!.getAttribute("style") ?? "";
    const bStyle = b!.getAttribute("style") ?? "";
    expect(aStyle).toContain("background-color");
    expect(aStyle).toMatch(/255,\s*255,\s*0/);
    expect(bStyle).toContain("background-color");
    expect(bStyle).toMatch(/0,\s*255,\s*0/);

    core.destroy();
    root.remove();
  });

  test("diagnostics: formula warning and error", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: { rows: [{ a: 1 }] },
        schema: {
          columns: [
            { key: "a", type: "number" },
            { key: "w", type: "number", formula: () => [123, new Error("warn")] as const },
            { key: "e", type: "number", formula: () => { throw new Error("boom"); } },
          ],
        },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const w = root.querySelector('td[data-col-key="w"]') as HTMLTableCellElement | null;
    const e = root.querySelector('td[data-col-key="e"]') as HTMLTableCellElement | null;
    expect(w).toBeTruthy();
    expect(e).toBeTruthy();

    expect(w!.textContent).toBe("123");
    expect(w!.classList.contains("extable-diag-warning")).toBe(true);
    expect(w!.getAttribute("data-extable-diag-message")).toBe("warn");

    expect(e!.textContent).toBe("#ERROR");
    expect(e!.classList.contains("extable-diag-error")).toBe(true);
    expect(e!.getAttribute("data-extable-diag-message")).toBe("boom");

    core.destroy();
    root.remove();
  });

  test("diagnostics propagate to selection snapshot", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: { rows: [{ a: 1 }] },
        schema: { columns: [{ key: "a", type: "number", conditionalStyle: () => { throw new Error("bad"); } }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const a = root.querySelector('td[data-col-key="a"]') as HTMLTableCellElement | null;
    expect(a).toBeTruthy();
    a!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

    const snap = core.getSelectionSnapshot();
    expect(snap.diagnostic?.level).toBe("error");
    expect(snap.diagnostic?.message).toBe("bad");

    core.destroy();
    root.remove();
  });
});
