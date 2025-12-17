import { describe, expect, test } from "vitest";
import { createTablePlaceholder, mountTable } from "../src/index";

describe("canvas size clamp", () => {
  test("clamps canvas dimensions when host reports huge client size", () => {
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
      Object.defineProperty(root, "clientWidth", { get: () => 50000 });
      Object.defineProperty(root, "clientHeight", { get: () => 50000 });
      document.body.appendChild(root);

      const core = createTablePlaceholder(
        { data: [{ a: "x" }], schema: { columns: [{ key: "a", type: "string" }] }, view: {} },
        { renderMode: "canvas", editMode: "direct", lockMode: "none" },
      );
      mountTable(root, core);

      const canvas = root.querySelector("canvas") as HTMLCanvasElement | null;
      expect(canvas).toBeTruthy();
      expect(canvas!.width).toBeLessThanOrEqual(8192);
      expect(canvas!.height).toBeLessThanOrEqual(8192);

      core.destroy();
      root.remove();
    } finally {
      HTMLCanvasElement.prototype.getContext = original;
    }
  });
});
