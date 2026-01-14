import { describe, expect, test } from "vitest";
import { renderTableHTML } from "../src/ssr";

describe("ssr integration", () => {
  test("renders complex table with tags, enum, actions, and readonly", () => {
    const result = renderTableHTML({
      data: [
        {
          _readonly: true,
          name: "Alice",
          active: true,
          status: { kind: "enum", value: "Open" },
          tags: { kind: "tags", values: ["x", "y"] },
          action: { label: "Run", command: "do", commandfor: "row" },
          link: { label: "Site", href: "https://example.com" },
        },
      ],
      schema: {
        columns: [
          { key: "name", type: "string" },
          { key: "active", type: "boolean", format: ["Yes", "No"] },
          { key: "status", type: "enum", enum: { options: ["Open", "Closed"] } },
          { key: "tags", type: "tags", tags: { options: ["x", "y"] } },
          { key: "action", type: "button" },
          { key: "link", type: "link" },
        ],
      },
      includeStyles: true,
    });

    expect(result.html).toContain("Yes");
    expect(result.html).toContain("Open");
    expect(result.html).toContain("extable-tag-list");
    expect(result.html).toContain("extable-action-button");
    expect(result.html).toContain("extable-action-link");
    expect(result.html).toContain("extable-readonly");
  });

  test("supports both CSS mode with conditional inline styles", () => {
    const result = renderTableHTML({
      data: [{ score: 10 }],
      schema: {
        columns: [
          {
            key: "score",
            type: "number",
            style: { textColor: "#555" },
            conditionalStyle: () => ({ textColor: "#e11d48" }),
          },
        ],
      },
      cssMode: "both",
      includeStyles: true,
    });

    expect(result.css).toContain("color:#555");
    expect(result.html).toContain("color:#e11d48");
  });
});
