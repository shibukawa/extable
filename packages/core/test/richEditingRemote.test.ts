import { describe, expect, test, vi } from "vitest";
import { createTablePlaceholder, mountTable } from "../src/index";

describe("rich editing (remote lookup / external editor / tooltip)", () => {
  test("renders labeled {label,value} in HTML mode", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const core = createTablePlaceholder(
      {
        data: [{ a: { label: "⟦LABEL⟧", value: "⟦RAW⟧" } }],
        schema: { columns: [{ key: "a", type: "labeled" }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const cell = root.querySelector('td[data-col-key="a"]') as HTMLTableCellElement | null;
    expect(cell).toBeTruthy();
    expect(cell!.textContent).toBe("⟦LABEL⟧");
    expect(cell!.dataset.raw).toBe("⟦RAW⟧");

    core.destroy();
    root.remove();
  });

  test("renders LookupCellValue label in HTML mode", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const core = createTablePlaceholder(
      {
        data: [{ a: { kind: "lookup", label: "⟦ALICE_LABEL⟧", value: "u1" } }],
        schema: { columns: [{ key: "a", type: "string" }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const cell = root.querySelector('td[data-col-key="a"]') as HTMLTableCellElement | null;
    expect(cell).toBeTruthy();
    expect(cell!.textContent).toBe("⟦ALICE_LABEL⟧");

    core.destroy();
    root.remove();
  });

  test("renders LookupCellValue label in Canvas mode", async () => {
    const original = HTMLCanvasElement.prototype.getContext;

    const texts: string[] = [];

    class Mock2DContext {
      fillStyle: any = "";
      strokeStyle: any = "";
      lineWidth = 1;
      font = "";
      textAlign: CanvasTextAlign = "left";

      clearRect() {}
      fillRect() {}
      strokeRect() {}
      beginPath() {}
      rect() {}
      clip() {}
      translate() {}
      save() {}
      restore() {}
      moveTo() {}
      lineTo() {}
      closePath() {}
      stroke() {}
      fill() {}
      measureText(text: string) {
        return { width: text.length * 7 } as TextMetrics;
      }
      fillText(text: string) {
        texts.push(text);
      }
    }

    HTMLCanvasElement.prototype.getContext = function getContext(type: string) {
      if (type !== "2d") return null;
      return new Mock2DContext() as any;
    };

    try {
      const root = document.createElement("div");
      Object.defineProperty(root, "clientWidth", { get: () => 800 });
      Object.defineProperty(root, "clientHeight", { get: () => 400 });
      document.body.appendChild(root);

      const core = createTablePlaceholder(
        {
          data: [{ a: { kind: "lookup", label: "Alice", value: "u1" } }],
          schema: { columns: [{ key: "a", header: "A", type: "string" }] },
          view: {},
        },
        { renderMode: "canvas", editMode: "direct", lockMode: "none" },
      );
      mountTable(root, core);

      // Canvas renderer paints on rAF (polyfilled by setTimeout in test/setup.ts).
      await new Promise((r) => setTimeout(r, 0));

      expect(texts.some((t) => t === "Alice")).toBe(true);

      core.destroy();
      root.remove();
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });

  test("renders labeled {label,value} in Canvas mode", async () => {
    const original = HTMLCanvasElement.prototype.getContext;

    const texts: string[] = [];

    class Mock2DContext {
      fillStyle: any = "";
      strokeStyle: any = "";
      lineWidth = 1;
      font = "";
      textAlign: CanvasTextAlign = "left";

      clearRect() {}
      fillRect() {}
      strokeRect() {}
      beginPath() {}
      rect() {}
      clip() {}
      translate() {}
      save() {}
      restore() {}
      moveTo() {}
      lineTo() {}
      closePath() {}
      stroke() {}
      fill() {}
      measureText(text: string) {
        return { width: text.length * 7 } as TextMetrics;
      }
      fillText(text: string) {
        texts.push(text);
      }
    }

    HTMLCanvasElement.prototype.getContext = function getContext(type: string) {
      if (type !== "2d") return null;
      return new Mock2DContext() as any;
    };

    try {
      const root = document.createElement("div");
      Object.defineProperty(root, "clientWidth", { get: () => 800 });
      Object.defineProperty(root, "clientHeight", { get: () => 400 });
      document.body.appendChild(root);

      const core = createTablePlaceholder(
        {
          data: [{ a: { label: "Alice", value: "u1" } }],
          schema: { columns: [{ key: "a", header: "A", type: "labeled" }] },
          view: {},
        },
        { renderMode: "canvas", editMode: "direct", lockMode: "none" },
      );
      mountTable(root, core);

      await new Promise((r) => setTimeout(r, 0));

      expect(texts.some((t) => t === "Alice")).toBe(true);

      core.destroy();
      root.remove();
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });

  test("lookup editor commits stored value on selection and exposes data-raw", async () => {
    vi.useFakeTimers();
    try {
      const root = document.createElement("div");
      document.body.appendChild(root);

      const candidates = vi.fn(async ({ query }: { query: string }) => {
        if (query !== "al") return [];
        return [{ label: "Alice", value: "u1" }];
      });

      const core = createTablePlaceholder(
        {
          data: [{ a: "" }],
          schema: {
            columns: [
              {
                key: "a",
                type: "string",
                edit: {
                    lookup: {
                    candidates: candidates as any,
                  },
                },
              },
            ],
          },
          view: {},
        },
        { renderMode: "html", editMode: "direct", lockMode: "none" },
      );
      mountTable(root, core);

      const cell = root.querySelector('td[data-col-key="a"]') as HTMLTableCellElement | null;
      expect(cell).toBeTruthy();

      cell!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
      cell!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

      // selectionInput is reused and made visible during edit mode
      const inputs = Array.from(root.querySelectorAll("input")) as HTMLInputElement[];
      const input = inputs.find((i) => i.style.opacity !== "0") ?? null;
      expect(input).toBeTruthy();

      input!.value = "al";
      input!.dispatchEvent(new Event("input", { bubbles: true }));

      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();

      const dropdown = root.querySelector(".extable-lookup-dropdown") as HTMLDivElement | null;
      expect(dropdown).toBeTruthy();
      expect(dropdown!.dataset.visible).toBe("1");

      input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await Promise.resolve();

      const cell2 = root.querySelector('td[data-col-key="a"]') as HTMLTableCellElement | null;
      expect(cell2!.textContent).toBe("Alice");
      expect(cell2!.dataset.raw).toBe("u1");

      core.destroy();
      root.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  test("lookup editor stores {label,value} for labeled columns", async () => {
    vi.useFakeTimers();
    try {
      const root = document.createElement("div");
      document.body.appendChild(root);

      const candidates = vi.fn(async ({ query }: { query: string }) => {
        if (query !== "al") return [];
        return [{ label: "Alice", value: "u1" }];
      });

      const core = createTablePlaceholder(
        {
          data: [{ a: "" }],
          schema: {
            columns: [
              {
                key: "a",
                type: "labeled",
                edit: {
                    lookup: {
                    candidates: candidates as any,
                  },
                },
              },
            ],
          },
          view: {},
        },
        { renderMode: "html", editMode: "direct", lockMode: "none" },
      );
      mountTable(root, core);

      const cell = root.querySelector('td[data-col-key="a"]') as HTMLTableCellElement | null;
      expect(cell).toBeTruthy();

      cell!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
      cell!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

      // selectionInput is reused and made visible during edit mode
      const inputs = Array.from(root.querySelectorAll("input")) as HTMLInputElement[];
      const input = inputs.find((i) => i.style.opacity !== "0") ?? null;
      expect(input).toBeTruthy();

      input!.value = "al";
      input!.dispatchEvent(new Event("input", { bubbles: true }));

      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();

      input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await Promise.resolve();

      const cell2 = root.querySelector('td[data-col-key="a"]') as HTMLTableCellElement | null;
      expect(cell2!.textContent).toBe("Alice");
      expect(cell2!.dataset.raw).toBe("u1");

      const rowId = core.listRows()[0]!.id;
      expect(core.getCell(rowId, "a")).toEqual({ label: "Alice", value: "u1" });

      core.destroy();
      root.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  test("lookup editor ignores stale async candidate results", async () => {
    vi.useFakeTimers();
    try {
      const root = document.createElement("div");
      document.body.appendChild(root);

      let resolve1: ((v: any) => void) | null = null;
      const candidates = vi.fn(
        () =>
          new Promise<any>((r) => {
            resolve1 = r;
          }),
      );

      const core = createTablePlaceholder(
        {
          data: [{ a: "", b: "" }],
          schema: {
            columns: [
              {
                key: "a",
                type: "string",
                edit: {
                    lookup: {
                    candidates: candidates as any,
                  },
                },
              },
              { key: "b", type: "string" },
            ],
          },
          view: {},
        },
        { renderMode: "html", editMode: "direct", lockMode: "none" },
      );
      mountTable(root, core);

      const cellA = root.querySelector('td[data-col-key="a"]') as HTMLTableCellElement | null;
      const cellB = root.querySelector('td[data-col-key="b"]') as HTMLTableCellElement | null;
      expect(cellA).toBeTruthy();
      expect(cellB).toBeTruthy();

      cellA!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
      cellA!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

      // selectionInput is reused and made visible during edit mode
      const inputs = Array.from(root.querySelectorAll("input")) as HTMLInputElement[];
      const input = inputs.find((i) => i.style.opacity !== "0") ?? null;
      expect(input).toBeTruthy();

      input!.value = "x";
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(300);

      // Change active cell before the promise resolves.
      cellB!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

      (resolve1 as unknown as ((v: any) => void) | null)?.([{ label: "X", value: "id-x" }]);
      await Promise.resolve();

      const dropdown = root.querySelector(".extable-lookup-dropdown") as HTMLDivElement | null;
      if (dropdown) {
        expect(dropdown.dataset.visible).not.toBe("1");
      }

      core.destroy();
      root.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  test("external editor commit/cancel/reject", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const open = vi
      .fn()
      .mockResolvedValueOnce({ kind: "commit", value: "NEW" })
      .mockResolvedValueOnce({ kind: "cancel" })
      .mockRejectedValueOnce(new Error("boom"));

    const core = createTablePlaceholder(
      {
        data: [{ a: "old" }],
        schema: {
          columns: [
            {
              key: "a",
              type: "string",
              edit: { externalEditor: open },
            },
          ],
        },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const cell = () => root.querySelector('td[data-col-key="a"]') as HTMLTableCellElement | null;

    // commit
    cell()!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    cell()!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    await Promise.resolve();
    expect(open).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(cell()!.textContent).toBe("NEW");

    // cancel
    cell()!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    cell()!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    await Promise.resolve();
    expect(open).toHaveBeenCalledTimes(2);
    await Promise.resolve();
    expect(cell()!.textContent).toBe("NEW");

    // reject
    cell()!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    cell()!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    await Promise.resolve();
    expect(open).toHaveBeenCalledTimes(3);
    await Promise.resolve();

    const toast = root.querySelector('.extable-toast[data-variant="error"]') as HTMLDivElement | null;
    expect(toast).toBeTruthy();

    core.destroy();
    root.remove();
  });

  test("external editor can commit {label,value} for labeled columns", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const open = vi.fn().mockResolvedValueOnce({ kind: "commit", value: { label: "Preview", value: "FULL" } });

    const core = createTablePlaceholder(
      {
        data: [{ a: "" }],
        schema: {
          columns: [
            {
              key: "a",
              type: "labeled",
              edit: { externalEditor: open },
            },
          ],
        },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const cell = () => root.querySelector('td[data-col-key="a"]') as HTMLTableCellElement | null;

    cell()!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    cell()!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
    await Promise.resolve();

    expect(cell()!.textContent).toBe("Preview");
    expect(cell()!.dataset.raw).toBe("FULL");

    const rowId = core.listRows()[0]!.id;
    expect(core.getCell(rowId, "a")).toEqual({ label: "Preview", value: "FULL" });

    core.destroy();
    root.remove();
  });

  test("tooltip async result is not applied when hover target changes", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    let resolveA: ((v: string | null) => void) | null = null;
    let resolveB: ((v: string | null) => void) | null = null;

    const getText = vi
      .fn()
      .mockImplementationOnce(() => new Promise<string | null>((r) => (resolveA = r)))
      .mockImplementationOnce(() => new Promise<string | null>((r) => (resolveB = r)));

    const core = createTablePlaceholder(
      {
        data: [{ a: "x", b: "y" }],
        schema: {
          columns: [
            { key: "a", type: "string", tooltip: { getText } },
            { key: "b", type: "string", tooltip: { getText } },
          ],
        },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const cellA = root.querySelector('td[data-col-key="a"]') as HTMLTableCellElement;
    const cellB = root.querySelector('td[data-col-key="b"]') as HTMLTableCellElement;

    cellA.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 10, clientY: 10 }));
    cellB.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 20, clientY: 10 }));

    (resolveA as unknown as ((v: string | null) => void) | null)?.("A tooltip");
    await Promise.resolve();

    (resolveB as unknown as ((v: string | null) => void) | null)?.("B tooltip");
    await Promise.resolve();

    const tip = root.querySelector('.extable-tooltip[data-visible="1"]') as HTMLDivElement | null;
    expect(tip).toBeTruthy();
    expect(tip!.textContent).toBe("B tooltip");

    core.destroy();
    root.remove();
  });

  test("lookup with recentLookup shows [recent] badge in dropdown", async () => {
    vi.useFakeTimers();
    try {
      const root = document.createElement("div");
      document.body.appendChild(root);

      const candidates = [
        { label: "Alice", value: "u1" },
        { label: "Bob", value: "u2" },
      ];

      const candidatesFn = vi.fn(async ({ query }: any) => {
        return candidates.filter((c) => !query || c.label.toLowerCase().includes(query.toLowerCase()));
      });

      const core = createTablePlaceholder(
        {
          data: [{ assignee: { label: "Alice", value: "u1" } }],
          schema: {
            columns: [
              {
                key: "assignee",
                type: "labeled",
                edit: {
                    lookup: {
                    candidates: candidatesFn,
                    recentLookup: true,  // enabled by default
                  },
                },
              },
            ],
          },
          view: {},
        },
        { renderMode: "html", editMode: "direct", lockMode: "none" },
      );
      mountTable(root, core);

      const cell = root.querySelector('td[data-col-key="assignee"]') as HTMLTableCellElement | null;
      expect(cell).toBeTruthy();
      expect(cell!.textContent).toBe("Alice");

      // Double-click to enter edit mode
      cell!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
      cell!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
      await Promise.resolve();

      // selectionInput is reused and made visible during edit mode
      const inputs = Array.from(root.querySelectorAll("input")) as HTMLInputElement[];
      const input = inputs.find((i) => i.style.opacity !== "0") ?? null;
      expect(input).toBeTruthy();

      // Trigger fetch with empty query to get recent candidate
      input!.value = "";
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(260);
      await Promise.resolve();

      let dropdown = root.querySelector(".extable-lookup-dropdown[data-visible='1']") as HTMLDivElement | null;
      expect(dropdown).toBeTruthy();

      let options = dropdown?.querySelectorAll("button.extable-lookup-option") || [];
      expect(options.length).toBe(2);

      // When recentLookup is true, Alice (which was already selected) should appear first with [recent] badge
      expect(options[0]?.textContent).toMatch(/Alice.*\[recent\]/);
      expect(options[1]?.textContent).toBe("Bob");

      core.destroy();
      root.remove();
    } finally {
      vi.useRealTimers();
    }
  });

  test("lookup with recentLookup=false does not show [recent] badge", async () => {
    vi.useFakeTimers();
    try {
      const root = document.createElement("div");
      document.body.appendChild(root);

      const candidates = [
        { label: "Alice", value: "u1" },
        { label: "Bob", value: "u2" },
      ];

      const candidatesFn = vi.fn(async ({ query }: any) => {
        return candidates.filter((c) => !query || c.label.toLowerCase().includes(query.toLowerCase()));
      });

      const core = createTablePlaceholder(
        {
          data: [{ assignee: { label: "Alice", value: "u1" } }],
          schema: {
            columns: [
              {
                key: "assignee",
                type: "labeled",
                edit: {
                    lookup: {
                    candidates: candidatesFn,
                    recentLookup: false,  // disabled
                  },
                },
              },
            ],
          },
          view: {},
        },
        { renderMode: "html", editMode: "direct", lockMode: "none" },
      );
      mountTable(root, core);

      const cell = root.querySelector('td[data-col-key="assignee"]') as HTMLTableCellElement | null;
      expect(cell).toBeTruthy();

      // Double-click to enter edit mode
      cell!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
      cell!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
      await Promise.resolve();

      // selectionInput is reused and made visible during edit mode
      const inputs = Array.from(root.querySelectorAll("input")) as HTMLInputElement[];
      const input = inputs.find((i) => i.style.opacity !== "0") ?? null;
      expect(input).toBeTruthy();

      input!.value = "";
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      await vi.advanceTimersByTimeAsync(260);
      await Promise.resolve();

      const dropdown = root.querySelector(".extable-lookup-dropdown[data-visible='1']") as HTMLDivElement | null;
      expect(dropdown).toBeTruthy();

      const options = dropdown?.querySelectorAll("button.extable-lookup-option") || [];

      // When recentLookup is false, Alice should NOT have [recent] badge
      expect(options[0]?.textContent).toBe("Alice");
      expect(options[0]?.textContent).not.toMatch(/\[recent\]/);
      expect(options[1]?.textContent).toBe("Bob");

      core.destroy();
      root.remove();
    } finally {
      vi.useRealTimers();
    }
  });
});

