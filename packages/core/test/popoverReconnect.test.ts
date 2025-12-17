import { describe, expect, test } from "vitest";
import { createTablePlaceholder, mountTable } from "../src/index";

describe("popover reconnect", () => {
  test("recreates detached context menu popover", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      { data: { rows: [{ a: "x" }] }, schema: { columns: [{ key: "a", type: "string" }] }, view: {} },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    (core as any).ensureContextMenu();
    const first = (core as any).contextMenu as HTMLElement | null;
    expect(first).toBeTruthy();
    expect(first!.isConnected).toBe(true);

    // Simulate host clearing children (renderer switch/remount).
    first!.remove();
    expect(first!.isConnected).toBe(false);

    (core as any).ensureContextMenu();
    const second = (core as any).contextMenu as HTMLElement | null;
    expect(second).toBeTruthy();
    expect(second).not.toBe(first);
    expect(second!.isConnected).toBe(true);

    core.destroy();
    root.remove();
  });
});

