import { describe, expect, test } from "vitest";
import { CSSBuilder, serializeStyle } from "../src/ssr/styleSerializer";

describe("ssr/styleSerializer", () => {
  test("serializes camelCase to kebab-case", () => {
    const css = serializeStyle({
      backgroundColor: "#fff",
      textDecorationLine: "underline",
      fontWeight: 600,
    });
    expect(css).toBe("background-color:#fff;text-decoration-line:underline;font-weight:600;");
  });

  test("preserves css variables and kebab-case keys", () => {
    const css = serializeStyle({
      "--custom-color": "red",
      "border-radius": "4px",
    });
    expect(css).toBe("--custom-color:red;border-radius:4px;");
  });

  test("ignores null/undefined/false values", () => {
    const css = serializeStyle({
      color: "#000",
      opacity: null,
      padding: undefined,
      margin: false,
    });
    expect(css).toBe("color:#000;");
  });

  test("builds CSS rules with merging", () => {
    const builder = new CSSBuilder();
    builder.addRule(".a", { color: "red" });
    builder.addRule(".a", { backgroundColor: "white" });
    builder.addRule(".b", { paddingTop: "4px" });
    const css = builder.build();
    expect(css).toContain(".a { color:red;background-color:white; }");
    expect(css).toContain(".b { padding-top:4px; }");
  });

  test("minifies CSS output", () => {
    const builder = new CSSBuilder();
    builder.addRule(".a", { color: "red" });
    const css = builder.build({ minify: true });
    expect(css).toBe(".a{color:red;}");
  });
});
