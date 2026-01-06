import { describe, test } from "vitest";
import type { ColumnSchema } from "../src/types";

describe("format typing", () => {
  test("enforces format by column type", () => {
    const numberCol: ColumnSchema<any, any, "number"> = {
      key: "price",
      type: "number",
      format: { precision: 10, scale: 2 },
    };

    const intCol: ColumnSchema<any, any, "int"> = {
      key: "count",
      type: "int",
      format: { format: "hex" },
    };

    const uintCol: ColumnSchema<any, any, "uint"> = {
      key: "count-unsigned",
      type: "uint",
      format: { format: "binary" },
    };

    const booleanCol: ColumnSchema<any, any, "boolean"> = {
      key: "active",
      type: "boolean",
      format: "checkbox",
    };

    const dateCol: ColumnSchema<any, any, "date"> = {
      key: "due",
      type: "date",
      format: "yyyy-MM-dd",
    };

    // @ts-expect-error boolean format is not valid for number columns
    const invalidNumber: ColumnSchema<any, any, "number"> = {
      key: "invalid-number",
      type: "number",
      format: "checkbox",
    };

    // @ts-expect-error number format is not valid for int columns
    const invalidInt: ColumnSchema<any, any, "int"> = {
      key: "invalid-int",
      type: "int",
      format: { precision: 2 },
    };

    // @ts-expect-error number format is not valid for uint columns
    const invalidUint: ColumnSchema<any, any, "uint"> = {
      key: "invalid-uint",
      type: "uint",
      format: { scale: 0 },
    };

    // @ts-expect-error number format is not valid for boolean columns
    const invalidBoolean: ColumnSchema<any, any, "boolean"> = {
      key: "invalid-boolean",
      type: "boolean",
      format: { precision: 2 },
    };

    // @ts-expect-error format is not supported for enum columns
    const invalidEnum: ColumnSchema<any, any, "enum"> = {
      key: "status",
      type: "enum",
      enum: { options: ["a", "b"] },
      format: "x",
    };

    void numberCol;
    void intCol;
    void uintCol;
    void booleanCol;
    void dateCol;
    void invalidNumber;
    void invalidInt;
    void invalidUint;
    void invalidBoolean;
    void invalidEnum;
  });
});
