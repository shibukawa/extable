import { describe, expect, test } from "vitest";
import { validateCellValue } from "../src/validation";
import type { ColumnSchema } from "../src/types";

describe("validateCellValue", () => {
  test("validates int as safe integer", () => {
    const col: ColumnSchema<any, any, "int"> = { key: "i", type: "int" };

    expect(validateCellValue(0, col)).toBeNull();
    expect(validateCellValue(-1, col)).toBeNull();
    expect(validateCellValue(42, col)).toBeNull();

    expect(validateCellValue(1.5, col)).toBe("Expected an integer");
    expect(validateCellValue(Number.MAX_SAFE_INTEGER + 1, col)).toBe("Expected an integer");
    expect(validateCellValue("1" as any, col)).toBe("Expected an integer");
  });

  test("validates uint as safe non-negative integer", () => {
    const col: ColumnSchema<any, any, "uint"> = { key: "u", type: "uint" };

    expect(validateCellValue(0, col)).toBeNull();
    expect(validateCellValue(1, col)).toBeNull();

    expect(validateCellValue(-1, col)).toBe("Expected a non-negative integer");
    expect(validateCellValue(1.5, col)).toBe("Expected a non-negative integer");
    expect(validateCellValue(Number.MAX_SAFE_INTEGER + 1, col)).toBe("Expected a non-negative integer");
    expect(validateCellValue("1" as any, col)).toBe("Expected a non-negative integer");
  });

  test("treats null/undefined as valid (MVP required behavior)", () => {
    const col: ColumnSchema<any, any, "int"> = { key: "i", type: "int" };

    expect(validateCellValue(null, col)).toBeNull();
    expect(validateCellValue(undefined, col)).toBeNull();
  });
});
