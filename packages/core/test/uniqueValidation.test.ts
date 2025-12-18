import { describe, expect, test } from "vitest";
import { createTablePlaceholder, mountTable } from "../src/index";

describe("unique column validation", () => {
  test("adds validation errors for duplicated values", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [{ name: "Alice" }, { name: "Alice" }, { name: "Bob" }],
        schema: { columns: [{ key: "name", type: "string", unique: true }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );
    mountTable(root, core);

    const dup = core
      .getTableState()
      .activeErrors.filter((e) => e.scope === "validation" && e.message.includes("Duplicate value"));
    expect(dup).toHaveLength(2);

    const marked = root.querySelectorAll('td.extable-diag-error[data-extable-diag-message]');
    expect(marked.length).toBeGreaterThanOrEqual(2);
    const msg = (marked[0] as HTMLElement | undefined)?.getAttribute("data-extable-diag-message") ?? "";
    expect(msg.includes("Rows:")).toBe(true);

    core.destroy();
    root.remove();
  });

  test("uses pending values in commit mode", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const core = createTablePlaceholder(
      {
        data: [{ name: "Alice" }, { name: "Alice" }],
        schema: { columns: [{ key: "name", type: "string", unique: true }] },
        view: {},
      },
      { renderMode: "html", editMode: "commit", lockMode: "none" },
    );
    mountTable(root, core);

    let dup = core
      .getTableState()
      .activeErrors.filter((e) => e.scope === "validation" && e.message.includes("Duplicate value"));
    expect(dup).toHaveLength(2);

    core.setCellValue(1, "name", "Bob");
    dup = core
      .getTableState()
      .activeErrors.filter((e) => e.scope === "validation" && e.message.includes("Duplicate value"));
    expect(dup).toHaveLength(0);

    core.destroy();
    root.remove();
  });
});
