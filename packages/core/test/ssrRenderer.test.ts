import { describe, expect, test } from "vitest";
import { renderTableHTML } from "../src/ssr";

const schema = {
  columns: [
    { key: "name", type: "string", header: "Name" },
    { key: "score", type: "number", header: "Score" },
  ],
};

describe("ssr/renderer", () => {
  test("renders basic table with headers and data attributes", () => {
    const result = renderTableHTML({
      data: [
        { name: "Alice", score: 90 },
        { name: "Bob", score: 80 },
      ],
      schema,
    });

    expect(result.html).toContain("data-extable-renderer=\"html\"");
    expect(result.html).toContain('<th data-col-key="name"');
    expect(result.html).toContain('<th data-col-key="score"');
    expect(result.html).toContain("data-col-type=\"string\"");
    expect(result.html).toContain("data-col-type=\"number\"");
    expect(result.html).toContain("Alice");
    expect(result.html).toContain("Bob");
    expect(result.html).toMatch(/data-row-id=\"[^\"]+\"/);
  });

  test("renders formulas and errors", () => {
    const result = renderTableHTML({
      data: [{ score: 90 }],
      schema: {
        columns: [
          { key: "score", type: "number" },
          {
            key: "grade",
            type: "string",
            formula: () => {
              throw new Error("boom");
            },
          },
        ],
      },
    });

    expect(result.html).toContain("#ERROR");
    expect(result.metadata.errors[0]?.message).toBe("boom");
  });

  test("renders conditional styles inline", () => {
    const result = renderTableHTML({
      data: [{ score: 90 }],
      schema: {
        columns: [
          {
            key: "score",
            type: "number",
            conditionalStyle: () => ({ textColor: "#00aa00" }),
          },
        ],
      },
      cssMode: "inline",
    });

    expect(result.html).toContain("color:#00aa00");
  });

  test("adds validation error indicators", () => {
    const result = renderTableHTML({
      data: [{ score: "bad" }],
      schema: {
        columns: [{ key: "score", type: "number" }],
      },
    });

    expect(result.html).toContain("data-invalid");
    expect(result.metadata.errors.length).toBeGreaterThan(0);
  });

  test("generates external CSS", () => {
    const result = renderTableHTML({
      data: [{ status: "ok" }],
      schema: {
        columns: [
          { key: "status", type: "string", style: { textColor: "#111" } },
        ],
      },
      cssMode: "external",
    });

    expect(result.css).toContain("data-col-key=\"status\"");
    expect(result.css).toContain("color:#111");
  });

  test("wraps table with extable-root when enabled", () => {
    const result = renderTableHTML({
      data: [{ name: "Alice", score: 90 }],
      schema,
      wrapWithRoot: true,
      defaultClass: "extable-ssr",
    });

    expect(result.html).toContain("extable-root");
    expect(result.html).toContain("extable-shell");
    expect(result.html).toContain("extable-viewport");
    expect(result.html).toContain("extable-overlay-layer");
    expect(result.html).toContain("extable-ssr");
  });

  test("applies defaultClass and defaultStyle on table when not wrapped", () => {
    const result = renderTableHTML({
      data: [{ name: "Alice", score: 90 }],
      schema,
      defaultClass: ["extable-ssr", "extra-class"],
      defaultStyle: { height: "320px" },
    });

    expect(result.html).toContain("class=\"extable-ssr extra-class\"");
    expect(result.html).toContain("height:320px;");
  });
});
