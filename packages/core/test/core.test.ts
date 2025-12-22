import { describe, expect, test, vi } from "vitest";
import { createTablePlaceholder, mountTable } from "../src/index";

describe("core placeholder", () => {
  test("mounts table and marks target", () => {
    const placeholder = createTablePlaceholder(
      {
        data: [],
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
        data: [{ dt: "2024-11-01T09:30:00Z" }],
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

    (placeholder as any).setData([{ name: "Alice" }]);
    expect(target.dataset.extable).toBe("ready");
    expect(target.classList.contains("extable-loading")).toBe(false);

    // After loaded, passing null again is ignored.
    (placeholder as any).setData(null);
    expect(target.dataset.extable).toBe("ready");
  });

  test("readonly editMode prevents editing without muting styles", () => {
    const placeholder = createTablePlaceholder(
      {
        data: [{ name: "Alice" }],
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
        data: [{ name: "Alice" }],
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

    core.setCellValue(0, "name", (old: any) => `${old}-x`);
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
        data: [{ n: "oops" as any }],
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

describe("public data access api", () => {
  test("configuration getters return current values", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [{ name: "Alice" }],
        schema: { columns: [{ key: "name", type: "string" }] },
        view: { hiddenColumns: ["x"] },
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    expect(core.getSchema().columns.map((c) => c.key)).toEqual(["name"]);
    expect(core.getView().hiddenColumns).toEqual(["x"]);
    expect(core.getData()).toHaveLength(1);
    expect(core.getRawData()).toHaveLength(1);
    expect(core.getAllRows()).toHaveLength(1);
    expect(core.listRows()).toHaveLength(1);

    core.destroy();
    root.remove();
  });

  test("getCell reflects pending edits in commit mode", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [{ name: "Alice" }],
        schema: { columns: [{ key: "name", type: "string" }] },
        view: {},
      },
      { renderMode: "html", editMode: "commit", lockMode: "none" },
    );
    mountTable(root, core);

    const rowId = core.getAllRows()[0]!.id;
    expect(core.getCell(rowId, "name")).toBe("Alice");

    core.setCellValue(rowId, "name", "Bob");
    expect(core.getCell(rowId, "name")).toBe("Bob");
    expect(core.getRawData()[0]!.name).toBe("Alice");
    expect(core.getCellPending(rowId, "name")).toBe(true);
    expect(core.getPendingRowIds()).toEqual([rowId]);
    expect(core.getPendingCellCount()).toBe(1);

    core.destroy();
    root.remove();
  });

  test("pending helpers are empty in direct mode", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [{ name: "Alice" }],
        schema: { columns: [{ key: "name", type: "string" }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const rowId = core.getAllRows()[0]!.id;
    core.setCellValue(rowId, "name", "Bob");
    expect(core.getCell(rowId, "name")).toBe("Bob");
    expect(core.getPending().size).toBe(0);
    expect(core.getCellPending(rowId, "name")).toBe(false);
    expect(core.getRawData()[0]!.name).toBe("Bob");

    core.destroy();
    root.remove();
  });

  test("row operations support insert/delete with undo/redo", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [{ name: "A" }, { name: "B" }],
        schema: { columns: [{ key: "name", type: "string" }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const idStart = core.insertRow({ name: "S" }, 0);
    expect(idStart).toBeTruthy();
    const idEnd = core.insertRow({ name: "E" });
    expect(idEnd).toBeTruthy();
    const idMid = core.insertRow({ name: "M" }, 1);
    expect(idMid).toBeTruthy();

    expect((core.getRow(0) as any)?.name).toBe("S");
    expect((core.getRow(1) as any)?.name).toBe("M");
    expect((core.getRow(2) as any)?.name).toBe("A");
    expect((core.getRow(3) as any)?.name).toBe("B");
    expect((core.getRow(4) as any)?.name).toBe("E");

    expect(core.deleteRow(idMid!)).toBe(true);
    expect(core.getRowIndex(idMid!)).toBe(-1);
    core.undo();
    expect((core.getRow(1) as any)?.name).toBe("M");
    core.redo();
    expect(core.getRowIndex(idMid!)).toBe(-1);

    core.destroy();
    root.remove();
  });

  test("bulk access helpers: getTableData and getColumnData", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [{ name: "A" }, { name: "B" }],
        schema: { columns: [{ key: "name", type: "string" }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    expect(core.getTableData().map((r: any) => r.name)).toEqual(["A", "B"]);
    expect(core.getColumnData("name")).toEqual(["A", "B"]);

    core.destroy();
    root.remove();
  });

  test("row operations are tracked in commit mode and cleared on commit", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [{ name: "A" }, { name: "B" }],
        schema: { columns: [{ key: "name", type: "string" }] },
        view: {},
      },
      { renderMode: "html", editMode: "commit", lockMode: "none" },
    );
    mountTable(root, core);

    const inserted = core.insertRow({ name: "X" }, 1);
    expect(inserted).toBeTruthy();
    expect(core.getTableState().pendingCommandCount).toBe(1);
    expect(core.getTableState().undoRedo.canUndo).toBe(true);

    expect(core.deleteRow(inserted!)).toBe(true);
    expect(core.getTableState().pendingCommandCount).toBe(2);

    const committed = await core.commit();
    expect(Array.isArray(committed)).toBe(true);
    expect(core.getTableState().pendingCommandCount).toBe(0);
    expect(core.getTableState().undoRedo.canUndo).toBe(false);

    core.destroy();
    root.remove();
  });

  test("commit handler applies pending changes after resolve", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [{ name: "A" }],
        schema: { columns: [{ key: "name", type: "string" }] },
        view: {},
      },
      {
        renderMode: "html",
        editMode: "commit",
        lockMode: "none",
        user: { id: "tester", name: "Test User" },
      },
    );
    mountTable(root, core);

    core.setCellValue(0, "name", "Updated");
    const handler = vi.fn(async (changes) => {
      expect(changes.commands.length).toBe(1);
      expect(changes.commands[0]?.kind).toBe("edit");
      expect(changes.user).toEqual({ id: "tester", name: "Test User" });
    });

    const snapshots = await core.commit(handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(snapshots.length).toBe(1);
    expect(core.getTableState().pendingCommandCount).toBe(0);

    core.destroy();
    root.remove();
  });

  test("commit handler errors keep pending changes and surface commit error", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [{ name: "A" }],
        schema: { columns: [{ key: "name", type: "string" }] },
        view: {},
      },
      {
        renderMode: "html",
        editMode: "commit",
        lockMode: "none",
        user: { id: "tester", name: "Test User" },
      },
    );
    mountTable(root, core);

    core.setCellValue(0, "name", "Updated");
    const handler = vi.fn(async () => {
      throw new Error("server refused");
    });

    await expect(core.commit(handler)).rejects.toThrow("server refused");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(core.getTableState().pendingCommandCount).toBe(1);
    expect(core.getTableState().activeErrors.some((e) => e.scope === "commit")).toBe(true);

    core.destroy();
    root.remove();
  });
});

describe("subscription semantics", () => {
  test("table state subscription is idempotent and dedupes unchanged updates", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [{ name: "Alice" }],
        schema: { columns: [{ key: "name", type: "string" }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const a: any[] = [];
    const b: any[] = [];
    const unsubA = core.subscribeTableState((next, prev) => {
      a.push({ next, prev });
    });
    const unsubB = core.subscribeTableState((next, prev) => {
      b.push({ next, prev });
    });
    expect(a.length).toBe(1);
    expect(b.length).toBe(1);
    expect(a[0]!.prev).toBe(null);
    expect(b[0]!.prev).toBe(null);

    // Same state should not trigger another call.
    core.setView(core.getView());
    expect(a.length).toBe(1);
    expect(b.length).toBe(1);

    // Actual change triggers.
    core.setCellValue(0, "name", "Updated");
    expect(a.length).toBe(2);
    expect(b.length).toBe(2);

    unsubA();
    unsubA(); // idempotent
    unsubB();
    unsubB(); // idempotent
    core.setCellValue(0, "name", "Final");
    expect(a.length).toBe(2);
    expect(b.length).toBe(2);

    core.destroy();
    root.remove();
  });

  test("selection subscription returns unsubscribe and stops after cleanup", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [{ a: "x", b: "y" }],
        schema: { columns: [{ key: "a", type: "string" }, { key: "b", type: "string" }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const events: any[] = [];
    const unsub = core.subscribeSelection((next, prev, reason) => {
      events.push({ next, prev, reason });
    });
    expect(events.length).toBe(1);
    expect(events[0]!.prev).toBe(null);

    const cell = root.querySelector('td[data-col-key="a"]') as HTMLTableCellElement | null;
    expect(cell).toBeTruthy();
    cell!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.at(-1)?.reason).toBe("selection");

    unsub();
    unsub(); // idempotent
    const before = events.length;
    cell!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    expect(events.length).toBe(before);

    core.destroy();
    root.remove();
  });
});
