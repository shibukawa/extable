import { describe, expectTypeOf, test } from "vitest";
import { createTablePlaceholder, type ExtableCore } from "../src/index";

describe("type inference", () => {
  test("infers T from defaultData rows", () => {
    const core = createTablePlaceholder(
      {
        data: { rows: [{ price: 10, qty: 2 }] },
        schema: { columns: [{ key: "price", type: "number" }, { key: "qty", type: "number" }] },
        view: {},
      },
      { renderMode: "html", editMode: "direct", lockMode: "none" },
    );

    expectTypeOf(core).toEqualTypeOf<ExtableCore<{ price: number; qty: number }>>();
  });
});

