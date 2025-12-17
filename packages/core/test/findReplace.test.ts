import { describe, expect, test, vi } from "vitest";
import { ExtableCore } from "../src/index";

describe("find/replace", () => {
  test("computes matches (plain, case-insensitive)", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = new ExtableCore({
      root,
      defaultData: { rows: [{ name: "Alice" }, { name: "ALICIA" }, { name: "Bob" }] },
      defaultView: {},
      schema: { columns: [{ key: "name", type: "string" }] },
      options: { renderMode: "html", editMode: "direct", lockMode: "none", findReplace: { sidebar: false } },
    });

    const fr = core.getFindReplaceController();
    expect(fr).toBeTruthy();
    fr!.setOptions({ caseInsensitive: true, regex: false });
    fr!.setQuery("ali");
    fr!.recompute();
    expect(fr!.getState().matches.length).toBe(2);
    core.destroy();
    root.remove();
  });

  test("reports invalid regex", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = new ExtableCore({
      root,
      defaultData: { rows: [{ name: "Alice" }] },
      defaultView: {},
      schema: { columns: [{ key: "name", type: "string" }] },
      options: { renderMode: "html", editMode: "direct", lockMode: "none", findReplace: { sidebar: false } },
    });

    const fr = core.getFindReplaceController()!;
    fr.setOptions({ regex: true });
    fr.setQuery("(");
    fr.recompute();
    expect(fr.getState().error).toBeTruthy();
    expect(fr.getState().matches.length).toBe(0);
    core.destroy();
    root.remove();
  });

  test("shortcut does not intercept Ctrl/Cmd+R (reload collision)", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = new ExtableCore({
      root,
      defaultData: { rows: [{ name: "Alice" }] },
      defaultView: {},
      schema: { columns: [{ key: "name", type: "string" }] },
      options: {
        renderMode: "html",
        editMode: "direct",
        lockMode: "none",
        findReplace: {},
      },
    });

    // Ctrl/Cmd+R should not be intercepted (browser reload).
    const ev = new KeyboardEvent("keydown", { key: "r", ctrlKey: true, bubbles: true });
    document.dispatchEvent(ev);

    const sidebar = document.querySelector(".extable-search-sidebar") as HTMLElement | null;
    // Sidebar DOM can exist even when hidden; rely on root open state.
    expect(sidebar).toBeTruthy();
    expect(root.classList.contains("extable-search-open")).toBe(false);
    const replaceToggle = sidebar!.querySelector(
      'input[data-extable-fr="replace-toggle"]',
    ) as HTMLInputElement | null;
    expect(replaceToggle?.checked).toBe(false);
    core.destroy();
    root.remove();
  });

  test("shortcut toggles close when sidebar is open", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = new ExtableCore({
      root,
      defaultData: { rows: [{ name: "Alice" }] },
      defaultView: {},
      schema: { columns: [{ key: "name", type: "string" }] },
      options: { renderMode: "html", editMode: "direct", lockMode: "none" },
    });

    // Open via shortcut.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true }));
    const sidebar = document.querySelector(".extable-search-sidebar") as HTMLElement | null;
    expect(sidebar).toBeTruthy();
    expect(root.classList.contains("extable-search-open")).toBe(true);

    // Toggle close via the same shortcut.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true }));
    expect(root.classList.contains("extable-search-open")).toBe(false);

    core.destroy();
    root.remove();
  });

  test("updates matches when data changes", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = new ExtableCore({
      root,
      defaultData: { rows: [{ name: "Alice" }] },
      defaultView: {},
      schema: { columns: [{ key: "name", type: "string" }] },
      options: { renderMode: "html", editMode: "direct", lockMode: "none", findReplace: { sidebar: false } },
    });

    const fr = core.getFindReplaceController()!;
    fr.setOptions({ caseInsensitive: true });
    fr.setQuery("bob");
    fr.recompute();
    expect(fr.getState().matches.length).toBe(0);

    core.setData({ rows: [{ name: "Bob" }] });
    vi.advanceTimersByTime(250);
    expect(fr.getState().matches.length).toBe(1);

    vi.useRealTimers();
    core.destroy();
    root.remove();
  });
});
