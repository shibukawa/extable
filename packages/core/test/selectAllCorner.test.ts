import { describe, expect, test } from "vitest";
import { createTablePlaceholder, mountTable } from "../src/index";

describe("select-all corner hit-test", () => {
  test("clicking the corner selects all even after scroll (canvas)", () => {
    const original = HTMLCanvasElement.prototype.getContext;

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

    HTMLCanvasElement.prototype.getContext = function getContext(type: string) {
      if (type !== "2d") return null;
      return new Mock2DContext() as any;
    };

    try {
      const root = document.createElement("div");
      document.body.appendChild(root);
      const core = createTablePlaceholder(
        {
          data: [{ a: "x" }, { a: "y" }],
          schema: { columns: [{ key: "a", type: "string", width: 120 }] },
          view: {},
        },
        { renderMode: "canvas", editMode: "direct", lockMode: "none" },
      );
      mountTable(root, core);

      // Simulate scroll offsets.
      root.scrollTop = 240;
      root.scrollLeft = 80;

      const canvas = root.querySelector("canvas") as HTMLCanvasElement | null;
      expect(canvas).toBeTruthy();
      canvas!.getBoundingClientRect = () => new DOMRect(0, 0, 800, 600);

      // Click inside the top-left corner area (intersection of headers).
      canvas!.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, clientX: 4, clientY: 4 }));

      const snap = core.getSelectionSnapshot();
      expect(snap.activeRowKey).toBe("__all__");
      expect(String(snap.activeColumnKey)).toBe("__all__");

      core.destroy();
      root.remove();
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });
});
