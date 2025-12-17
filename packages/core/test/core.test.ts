import { describe, expect, test } from "vitest";
import { createTablePlaceholder, mountTable } from "../src/index";

describe("core placeholder", () => {
  test("mounts table and marks target", () => {
    const placeholder = createTablePlaceholder(
      {
        data: { rows: [] },
        schema: { columns: [] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    const target = document.createElement("div");
    const mounted = mountTable(target, placeholder);
    expect((mounted as any).root).toBe(target);
    expect(target.dataset.extable).toBe("ready");
  });

  test("datetime-local editor initializes without timezone suffix", () => {
    const placeholder = createTablePlaceholder(
      {
        data: { rows: [{ dt: "2024-11-01T09:30:00Z" }] },
        schema: { columns: [{ key: "dt", header: "DT", type: "datetime" }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    const target = document.createElement("div");
    mountTable(target, placeholder);

    const cell = target.querySelector('td[data-col-key="dt"]') as HTMLTableCellElement | null;
    expect(cell).toBeTruthy();

    cell!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    cell!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

    const input = cell!.querySelector("input") as HTMLInputElement | null;
    expect(input).toBeTruthy();
    expect(input!.type).toBe("datetime-local");
    expect(input!.value).not.toBe("");
    expect(input!.value.includes("Z")).toBe(false);
  });

  test("supports loading state (defaultData=null) and one-time null->valid transition", () => {
    const placeholder = createTablePlaceholder(
      {
        data: null as any,
        schema: { columns: [{ key: "name", header: "Name", type: "string" }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );

    const target = document.createElement("div");
    mountTable(target, placeholder);
    expect(target.dataset.extable).toBe("loading");
    expect(target.classList.contains("extable-loading")).toBe(true);

    (placeholder as any).setData({ rows: [{ name: "Alice" }] });
    expect(target.dataset.extable).toBe("ready");
    expect(target.classList.contains("extable-loading")).toBe(false);

    // After loaded, passing null again is ignored.
    (placeholder as any).setData(null);
    expect(target.dataset.extable).toBe("ready");
  });

  test("readonly editMode prevents editing without muting styles", () => {
    const placeholder = createTablePlaceholder(
      {
        data: { rows: [{ name: "Alice" }] },
        schema: { columns: [{ key: "name", header: "Name", type: "string" }] },
        view: {},
      },
      { renderMode: "html", editMode: "readonly", lockMode: "none" },
    );

    const target = document.createElement("div");
    mountTable(target, placeholder);
    expect(target.classList.contains("extable-readonly-all")).toBe(true);

    const cell = target.querySelector('td[data-col-key="name"]') as HTMLTableCellElement | null;
    expect(cell).toBeTruthy();

    // Double click would normally start editing; in readonly it should not create an input.
    cell!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    cell!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    const input = cell!.querySelector("input") as HTMLInputElement | null;
    expect(input).toBeFalsy();

    // Readonly should not visually mute.
    expect(target.classList.contains("extable-readonly-all")).toBe(true);
  });
});

describe("table state callbacks", () => {
  test("reports pending count and canCommit in commit mode", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: { rows: [{ name: "Alice" }] },
        schema: { columns: [{ key: "name", type: "string" }] },
        view: {},
      },
      { renderMode: "html", editMode: "commit", lockMode: "none" },
    );
    mountTable(root, core);

    let last: any = null;
    const unsub = (core as any).subscribeTableState((next: any) => {
      last = next;
    });
    expect(last).toBeTruthy();
    expect(last.canCommit).toBe(false);

    (core as any).setCellValue({ rowIndex: 0, colIndex: 0 }, (old: any) => `${old}-x`);
    expect(last.canCommit).toBe(true);
    expect(last.pendingCommandCount).toBe(1);
    expect(last.pendingCellCount).toBe(1);

    unsub();
    core.destroy();
    root.remove();
  });

  test("includes validation errors in activeErrors", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      // Intentionally mismatched type: number column with string value.
      {
        data: { rows: [{ n: "oops" as any }] },
        schema: { columns: [{ key: "n", type: "number" }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const state = core.getTableState();
    expect(state.activeErrors.some((e) => e.scope === "validation")).toBe(true);

    core.destroy();
    root.remove();
  });
});
