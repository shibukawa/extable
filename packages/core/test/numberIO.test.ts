import { describe, expect, test } from "vitest";
import {
  coerceNumericForColumn,
  formatIntegerWithPrefix,
  formatNumberForEdit,
  normalizeNumericInput,
  parseNumericText,
} from "../src/numberIO";

describe("numberIO", () => {
  test("normalizeNumericInput uses NFKC and trims", () => {
    expect(normalizeNumericInput(" １２３ ")).toBe("123");
    expect(normalizeNumericInput("＋０ｘ１ａ")).toBe("+0x1a");
  });

  test("parseNumericText parses prefixed bases with sign", () => {
    expect(parseNumericText("0b11")).toEqual({ ok: true, value: 3 });
    expect(parseNumericText("-0o10")).toEqual({ ok: true, value: -8 });
    expect(parseNumericText("+0x1a")).toEqual({ ok: true, value: 26 });
  });

  test("parseNumericText parses decimal and scientific", () => {
    expect(parseNumericText("123.5")).toEqual({ ok: true, value: 123.5 });
    expect(parseNumericText("10e-10")).toEqual({ ok: true, value: 10e-10 });
    expect(parseNumericText("-1.2E-3")).toEqual({ ok: true, value: -1.2e-3 });
  });

  test("parseNumericText rejects invalid", () => {
    expect(parseNumericText("").ok).toBe(false);
    expect(parseNumericText("0b102").ok).toBe(false);
    expect(parseNumericText("0x").ok).toBe(false);
    expect(parseNumericText("Infinity").ok).toBe(false);
    expect(parseNumericText("e10").ok).toBe(false);
  });

  test("coerceNumericForColumn enforces int/uint", () => {
    expect(coerceNumericForColumn(1.1, "int").ok).toBe(false);
    expect(coerceNumericForColumn(Number.MAX_SAFE_INTEGER, "int").ok).toBe(true);
    expect(coerceNumericForColumn(Number.MAX_SAFE_INTEGER + 1, "int").ok).toBe(false);
    expect(coerceNumericForColumn(-1, "uint").ok).toBe(false);
    expect(coerceNumericForColumn(0, "uint").ok).toBe(true);
  });

  test("formatIntegerWithPrefix", () => {
    expect(formatIntegerWithPrefix(3, "binary")).toBe("0b11");
    expect(formatIntegerWithPrefix(-26, "hex")).toBe("-0x1a");
    expect(formatIntegerWithPrefix(8, "octal")).toBe("0o10");
  });

  test("formatNumberForEdit", () => {
    expect(formatNumberForEdit(12.345, { scale: 2 })).toBe("12.35");
    expect(formatNumberForEdit(12345, { format: "scientific", precision: 3 })).toBe("1.23e+4");
  });
});
