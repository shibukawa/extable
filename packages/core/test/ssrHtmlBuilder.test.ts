import { describe, expect, test } from "vitest";
import { HTMLBuilder, escapeHtml } from "../src/ssr/htmlBuilder";

describe("ssr/htmlBuilder", () => {
  test("builds nested tags with attributes", () => {
    const html = new HTMLBuilder()
      .openTag("div", { id: "root" })
      .openTag("span", { "data-x": "1" })
      .text("Hello")
      .closeTag("span")
      .closeTag("div")
      .build();

    expect(html).toBe('<div id="root"><span data-x="1">Hello</span></div>');
  });

  test("escapes text and attributes", () => {
    const html = new HTMLBuilder()
      .openTag("p", { title: "5 < 6 & 7" })
      .text("<tag> & \"quote\" and 'single'")
      .closeTag("p")
      .build();

    expect(html).toBe(
      '<p title="5 &lt; 6 &amp; 7">&lt;tag&gt; &amp; &quot;quote&quot; and &#39;single&#39;</p>',
    );
  });

  test("supports boolean attributes", () => {
    const html = new HTMLBuilder()
      .openTag("input", { disabled: true, hidden: false })
      .closeTag("input")
      .build();

    expect(html).toBe("<input disabled></input>");
  });

  test("html() inserts raw content", () => {
    const html = new HTMLBuilder()
      .openTag("div")
      .html("<span>raw</span>")
      .closeTag("div")
      .build();

    expect(html).toBe("<div><span>raw</span></div>");
  });

  test("escapeHtml handles common entities", () => {
    expect(escapeHtml("&<>\"'")).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
