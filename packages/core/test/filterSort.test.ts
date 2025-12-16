import { describe, expect, test } from "vitest";
import { createTablePlaceholder, mountTable } from "../src/index";

describe("filter/sort view behavior", () => {
  test("applies value-list filter (including blanks)", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: { rows: [{ a: "x" }, { a: "y" }, { a: "x" }, { a: "" }] },
        schema: { columns: [{ key: "a", type: "string" }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const countRows = () => root.querySelectorAll("tbody tr").length;
    expect(countRows()).toBe(4);

    core.setView({
      filters: [{ kind: "values", key: "a", values: ["x"], includeBlanks: false }],
    });
    expect(countRows()).toBe(2);

    core.setView({
      filters: [{ kind: "values", key: "a", values: ["x"], includeBlanks: true }],
    });
    expect(countRows()).toBe(3);

    core.setView({
      filters: [{ kind: "values", key: "a", values: [], includeBlanks: false }],
    });
    expect(countRows()).toBe(0);

    core.destroy();
    root.remove();
  });

  test("applies single-column sort with stable ordering and blanks last", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: { rows: [{ v: 2, id: "a" }, { v: 1, id: "b" }, { v: 2, id: "c" }, { v: null, id: "blank" }] },
        schema: { columns: [{ key: "v", type: "number" }, { key: "id", type: "string" }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    core.setView({ sorts: [{ key: "v", dir: "asc" }] });
    const ids = Array.from(root.querySelectorAll("tbody tr")).map((tr) => {
      const td = tr.querySelectorAll("td")[1];
      return td ? td.textContent : "";
    });
    expect(ids).toEqual(["b", "a", "c", "blank"]);

    core.destroy();
    root.remove();
  });

  test("applies column diagnostic filter (errors only)", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: { rows: [{ n: 1 }, { n: -1 }, { n: 2 }] },
        schema: {
          columns: [
            { key: "n", type: "number" },
            {
              key: "diag",
              type: "string",
              // Force an error diagnostic for n < 0
              formula: (data: any) => {
                if (typeof data.n === "number" && data.n < 0) throw new Error("bad");
                return "ok";
              },
            },
          ],
        },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    core.setView({ columnDiagnostics: { diag: { errors: true } } });
    const rows = Array.from(root.querySelectorAll("tbody tr"));
    expect(rows).toHaveLength(1);
    const nCell = rows[0]?.querySelectorAll("td")[0];
    expect(nCell?.textContent).toBe("-1");

    core.destroy();
    root.remove();
  });

  test("clamps active selection when the active row is filtered out", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: { rows: [{ id: 1, a: "x" }, { id: 2, a: "y" }, { id: 3, a: "x" }] },
        schema: { columns: [{ key: "id", type: "number" }, { key: "a", type: "string" }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    // Click the middle row (id=2), column "a"
    const row2a = root.querySelectorAll("tbody tr")[1]?.querySelectorAll("td")[1] as HTMLTableCellElement | null;
    expect(row2a).toBeTruthy();
    row2a!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

    // Apply a filter that removes the active row.
    core.setView({ filters: [{ kind: "values", key: "a", values: ["x"], includeBlanks: false }] });

    const active = root.querySelector("td.extable-active-cell") as HTMLTableCellElement | null;
    expect(active).toBeTruthy();
    const activeRow = active!.closest("tr") as HTMLTableRowElement | null;
    const idCell = activeRow?.querySelectorAll("td")[0] as HTMLTableCellElement | undefined;
    expect(idCell?.textContent).toBe("3");

    core.destroy();
    root.remove();
  });

  test("shows \"search first\" message when distinct values exceed 100", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const rows = Array.from({ length: 120 }, (_, i) => ({ a: `v${i}` }));
    const core = createTablePlaceholder(
      { data: { rows }, schema: { columns: [{ key: "a", type: "string" }] }, view: {} },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const btn = root.querySelector('button[data-extable-fs-open="1"]') as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    btn!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

    const values = root.querySelector('[data-extable-fs="values"]') as HTMLElement | null;
    expect(values).toBeTruthy();
    expect(values!.textContent ?? "").toContain("Too many values");

    const search = root.querySelector('input[data-extable-fs="search"]') as HTMLInputElement | null;
    expect(search).toBeTruthy();
    search!.value = "v1";
    search!.dispatchEvent(new Event("input", { bubbles: true }));
    expect((values!.textContent ?? "").toLowerCase()).toContain("v1");

    core.destroy();
    root.remove();
  });
});
