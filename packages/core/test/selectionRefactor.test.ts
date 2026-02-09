import { describe, expect, it } from "vitest";
import { parseClipboardGrid } from "../src/selectionClipboard";
import { createEditorControl, normalizeTemporalInitialValue } from "../src/selectionEditorFactory";
import { getInitialEditValue } from "../src/selectionInitialValue";

describe("selection refactor helpers", () => {
  it("parses html table and rejects merged cells", () => {
    const ok = parseClipboardGrid({
      html: "<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>",
      tsv: "",
      text: "",
    });
    const ng = parseClipboardGrid({
      html: "<table><tr><td colspan=\"2\">A</td></tr></table>",
      tsv: "",
      text: "",
    });
    expect(ok).toEqual([
      ["A", "B"],
      ["C", "D"],
    ]);
    expect(ng).toBeNull();
  });

  it("normalizes datetime initial value", () => {
    expect(normalizeTemporalInitialValue("datetime", "2026-02-09T10:11:12Z")).toBe(
      "2026-02-09T10:11",
    );
  });

  it("creates enum editor and resolves numeric initial display", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const col = {
      key: "status",
      type: "enum",
      enum: ["open", "closed"],
      enumAllowCustom: false,
    } as any;
    const editor = createEditorControl(col, "status", "closed", root);
    expect(editor.control.tagName).toBe("SELECT");

    const numericCol = {
      key: "amount",
      type: "number",
      format: { format: "scientific", precision: 2 },
    } as any;
    expect(getInitialEditValue(1234, numericCol)).toContain("e");

    root.remove();
  });
});
