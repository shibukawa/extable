import { describe, expect, test } from "vitest";
import { createTablePlaceholder, mountTable } from "../src/index";

describe("formula readonly visual cue", () => {
  test("adds extable-readonly-formula class only for formula readonly cells", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const core = createTablePlaceholder(
      {
        data: [{ price: 10, qty: 2, manual: 1 }],
        schema: {
          columns: [
            { key: "price", type: "number" },
            { key: "manual", type: "number", readonly: true },
            { key: "total", type: "number", formula: (row: any) => row.price * row.qty },
          ],
        },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );

    mountTable(root, core);

    const manual = root.querySelector('td[data-col-key="manual"]') as HTMLTableCellElement | null;
    const total = root.querySelector('td[data-col-key="total"]') as HTMLTableCellElement | null;
    expect(manual).toBeTruthy();
    expect(total).toBeTruthy();

    expect(manual!.classList.contains("extable-readonly")).toBe(true);
    expect(manual!.classList.contains("extable-readonly-formula")).toBe(false);

    expect(total!.classList.contains("extable-readonly")).toBe(true);
    expect(total!.classList.contains("extable-readonly-formula")).toBe(true);

    core.destroy();
    root.remove();
  });
});
