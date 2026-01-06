import { describe, expect, test } from "vitest";
import { createTablePlaceholder, mountTable } from "../src/index";

describe("renderer style application", () => {
  test("HTML renderer applies format styles to td", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [{ a: "x" }],
        schema: {
          columns: [
            {
              key: "a",
              type: "string",
              style: {
                backgroundColor: "#ff0000",
                textColor: "#00ff00",
                decorations: { bold: true, italic: true, underline: true, strike: true },
              },
            },
          ],
        },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const td = root.querySelector('td[data-col-key="a"]') as HTMLTableCellElement | null;
    expect(td).toBeTruthy();
    const styleAttr = td!.getAttribute("style") ?? "";
    expect(styleAttr).toContain("background-color");
    expect(styleAttr).toContain("color");
    expect(styleAttr).toContain("font-weight");
    expect(styleAttr).toContain("font-style");
    expect(styleAttr).toContain("text-decoration-line");

    core.destroy();
    root.remove();
  });

  test("Canvas renderer composes font with bold/italic", () => {
    const original = HTMLCanvasElement.prototype.getContext;
    const fonts: string[] = [];

    class Mock2DContext {
      font = "";
      fillStyle: any = "";
      strokeStyle: any = "";
      lineWidth = 1;
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
      fillText() {}
      measureText(text: string) {
        return { width: text.length * 7 } as TextMetrics;
      }
      set fontSetter(v: string) {
        this.font = v;
        fonts.push(v);
      }
    }

    // Intercept `ctx.font = "..."` writes.
    Object.defineProperty(Mock2DContext.prototype, "font", {
      get() {
        return (this as any).__font ?? "";
      },
      set(v: string) {
        (this as any).__font = v;
        fonts.push(v);
      },
      configurable: true,
    });

    HTMLCanvasElement.prototype.getContext = function getContext(type: string) {
      if (type !== "2d") return null;
      return new Mock2DContext() as any;
    };

    try {
      const root = document.createElement("div");
      document.body.appendChild(root);
        const core = createTablePlaceholder(
          {
            data: [{ a: "x" }],
            schema: {
              columns: [
              {
                key: "a",
                type: "string",
                style: { decorations: { bold: true, italic: true } },
              },
            ],
          },
          view: {},
        },
        { renderMode: "canvas", editMode: "direct", lockMode: "none" },
      );
      mountTable(root, core);

      expect(
        fonts.some(
          (f) => f.includes("italic") && f.includes("600") && f.includes("13.5px") && f.includes("Inter"),
        ),
      ).toBe(true);

      core.destroy();
      root.remove();
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });

  test("Canvas renderer applies conditional background style", () => {
    const original = HTMLCanvasElement.prototype.getContext;
    const fillStyles: string[] = [];

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
      fillText() {}
      measureText(text: string) {
        return { width: text.length * 7 } as TextMetrics;
      }
    }

    Object.defineProperty(Mock2DContext.prototype, "fillStyle", {
      get() {
        return (this as any).__fillStyle ?? "";
      },
      set(v: any) {
        (this as any).__fillStyle = v;
        if (typeof v === "string") fillStyles.push(v);
      },
      configurable: true,
    });

    HTMLCanvasElement.prototype.getContext = function getContext(type: string) {
      if (type !== "2d") return null;
      return new Mock2DContext() as any;
    };

    try {
      const root = document.createElement("div");
      document.body.appendChild(root);
        const core = createTablePlaceholder(
          {
            data: [{ a: "x" }],
            schema: {
              row: { conditionalStyle: () => ({ backgroundColor: "#00ff00" }) },
              columns: [{ key: "a", type: "string" }],
            },
          view: {},
        },
        { renderMode: "canvas", editMode: "direct", lockMode: "none" },
      );
      mountTable(root, core);

      expect(fillStyles.includes("#00ff00")).toBe(true);

      core.destroy();
      root.remove();
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });

  // Note: user-applied styling APIs are intentionally removed; schema/conditional formatting remains.
});
