import { describe, expect, test } from "vitest";
import { createTablePlaceholder, mountTable } from "../src/index";

describe("fill handle visibility", () => {
  test("does not show on readonly/formula cells", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [{ price: 10, qty: 2 }],
        schema: {
          columns: [
            { key: "price", type: "number" },
            { key: "total", type: "number", formula: (row: any) => row.price * row.qty },
          ],
        },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const viewport = root.querySelector(".extable-viewport") as HTMLDivElement | null;
    expect(viewport).toBeTruthy();

    const price = root.querySelector('td[data-col-key="price"]') as HTMLTableCellElement | null;
    const total = root.querySelector('td[data-col-key="total"]') as HTMLTableCellElement | null;
    expect(price).toBeTruthy();
    expect(total).toBeTruthy();

    price!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    expect(viewport!.dataset.extableFillHandle).toBe("1");

    total!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    expect(viewport!.dataset.extableFillHandle || "").toBe("");

    core.destroy();
    root.remove();
  });
});
