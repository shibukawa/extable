export type HTMLAttributeValue = string | number | boolean | null | undefined;

export class HTMLBuilder {
  private parts: string[] = [];

  openTag(tag: string, attrs?: Record<string, HTMLAttributeValue>): this {
    let html = `<${tag}`;
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value === true) {
          html += ` ${key}`;
        } else if (value !== false && value !== null && value !== undefined) {
          html += ` ${key}="${escapeHtml(String(value))}"`;
        }
      }
    }
    html += ">";
    this.parts.push(html);
    return this;
  }

  tag(tag: string, attrs: Record<string, HTMLAttributeValue> | undefined, content: string): this {
    let html = `<${tag}`;
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value === true) {
          html += ` ${key}`;
        } else if (value !== false && value !== null && value !== undefined) {
          html += ` ${key}="${escapeHtml(String(value))}"`;
        }
      }
    }
    html += ">";
    html += escapeHtml(content);
    html += `</${tag}>`;
    this.parts.push(html);
    return this;
  }

  closeTag(tag: string): this {
    this.parts.push(`</${tag}>`);
    return this;
  }

  text(content: string): this {
    this.parts.push(escapeHtml(content));
    return this;
  }

  html(content: string): this {
    this.parts.push(content);
    return this;
  }

  build(): string {
    return this.parts.join("");
  }
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
