import { describe, expect, test } from "vitest";
import { createTablePlaceholder, mountTable } from "../src/index";
import { resolveUniqueBooleanCommitState } from "../src/uniqueBooleanCommit";

const schema = {
  columns: [{ key: "flag", header: "Flag", type: "boolean", unique: true }],
};

describe("unique boolean commit diff", () => {
  test("resolves current and previous rows from pending map", () => {
    const pending = new Map<string, Record<string, unknown>>([
      ["row-1", { flag: false }],
      ["row-2", { flag: true }],
    ]);
    const raw = new Map([
      ["row-1", { flag: true }],
      ["row-2", { flag: false }],
    ]);
    const state = resolveUniqueBooleanCommitState(
      schema,
      pending,
      (rowId, colKey) => raw.get(rowId)?.[colKey],
    );
    const entry = state.get("flag");
    expect(entry?.currentRowId).toBe("row-2");
    expect(entry?.previousRowId).toBe("row-1");
  });

  test("html renderer marks current and previous selection in commit mode", () => {
    const placeholder = createTablePlaceholder(
      {
        data: [{ flag: true }, { flag: false }, { flag: false }],
        schema,
        view: {},
      },
      { renderMode: "html", editMode: "commit", lockMode: "none" },
    );
    const target = document.createElement("div");
    const core = mountTable(target, placeholder);

    let indicators = Array.from(
      target.querySelectorAll<HTMLElement>("tbody .extable-unique-radio"),
    );
    expect(indicators.length).toBe(3);
    expect(indicators[0]?.classList.contains("extable-unique-dot-current")).toBe(false);
    expect(indicators[0]?.classList.contains("extable-unique-dot-previous")).toBe(false);

    core.setCellValue(0, "flag", false);
    core.setCellValue(1, "flag", true);

    indicators = Array.from(
      target.querySelectorAll<HTMLElement>("tbody .extable-unique-radio"),
    );
    expect(indicators[0]?.classList.contains("extable-unique-dot-previous")).toBe(true);
    expect(indicators[1]?.classList.contains("extable-unique-dot-current")).toBe(true);
  });
});
