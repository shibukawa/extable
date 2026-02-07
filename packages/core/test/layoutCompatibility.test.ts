import { describe, expect, test, vi } from "vitest";
import { createTablePlaceholder, mountTable } from "../src/index";

class Mock2DContext {
  fillStyle: any = "";
  strokeStyle: any = "";
  lineWidth = 1;
  font = "";
  textAlign: CanvasTextAlign = "left";
  textBaseline: CanvasTextBaseline = "alphabetic";

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
  fillText() {}
  measureText(text: string) {
    return { width: text.length * 7 } as TextMetrics;
  }
}

describe("layout compatibility", () => {
  test("html renderer keeps explicit total width larger than host in stretch layouts", () => {
    const root = document.createElement("div");
    Object.defineProperty(root, "clientWidth", { get: () => 320, configurable: true });
    Object.defineProperty(root, "clientHeight", { get: () => 240, configurable: true });
    document.body.appendChild(root);

    const core = createTablePlaceholder(
      {
        data: [{ a: "A", b: "B", c: "C" }],
        schema: {
          columns: [
            { key: "a", type: "string", width: 220 },
            { key: "b", type: "string", width: 220 },
            { key: "c", type: "string", width: 220 },
          ],
        },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );

    mountTable(root, core);

    const viewport = root.querySelector(".extable-viewport") as HTMLDivElement | null;
    const table = root.querySelector('table[data-extable-renderer="html"]') as HTMLTableElement | null;
    expect(viewport).toBeTruthy();
    expect(table).toBeTruthy();
    expect(table!.style.width).toBe("708px");

    core.destroy();
    root.remove();
  });

  test("canvas renderer initializes viewport width in stretch layouts", () => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type: string) {
      if (type !== "2d") return null;
      return new Mock2DContext() as any;
    };

    try {
      const root = document.createElement("div");
      Object.defineProperty(root, "clientWidth", { get: () => 320, configurable: true });
      Object.defineProperty(root, "clientHeight", { get: () => 240, configurable: true });
      document.body.appendChild(root);

      const core = createTablePlaceholder(
        {
          data: [{ a: "A", b: "B", c: "C" }],
          schema: {
            columns: [
              { key: "a", type: "string", width: 220 },
              { key: "b", type: "string", width: 220 },
              { key: "c", type: "string", width: 220 },
            ],
          },
          view: {},
        },
        { renderMode: "canvas", editMode: "direct", lockMode: "none" },
      );

      mountTable(root, core);

      const viewport = root.querySelector(".extable-viewport") as HTMLDivElement | null;
      const canvas = root.querySelector("canvas") as HTMLCanvasElement | null;
      expect(viewport).toBeTruthy();
      expect(canvas).toBeTruthy();
      expect(canvas!.width).toBe(600);

      core.destroy();
      root.remove();
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });

  test("layout diagnostics warns for flex parent shrink constraints", () => {
    const parent = document.createElement("div");
    parent.style.display = "flex";
    document.body.appendChild(parent);

    const root = document.createElement("div");
    Object.defineProperty(parent, "clientWidth", { get: () => 300, configurable: true });
    Object.defineProperty(root, "clientWidth", { get: () => 600, configurable: true });
    Object.defineProperty(root, "clientHeight", { get: () => 240, configurable: true });
    parent.appendChild(root);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const core = createTablePlaceholder(
      {
        data: [{ a: "A" }],
        schema: { columns: [{ key: "a", type: "string", width: 220 }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none", layoutDiagnostics: true },
    );

    mountTable(root, core);

    expect(warnSpy).toHaveBeenCalled();
    const messages = warnSpy.mock.calls.map((args) => String(args[0] ?? ""));
    expect(messages.some((msg) => msg.includes("Parent flex/grid item may block shrinking"))).toBe(true);

    core.destroy();
    warnSpy.mockRestore();
    parent.remove();
  });
});
