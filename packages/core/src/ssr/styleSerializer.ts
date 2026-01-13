export type CSSValue = string | number | null | undefined | false;
export type CSSStyleMap = Record<string, CSSValue>;

export function serializeStyle(style: CSSStyleMap): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(style)) {
    if (value === null || value === undefined || value === false) continue;
    const prop = toKebabCase(key);
    parts.push(`${prop}:${String(value)};`);
  }
  return parts.join("");
}

export class CSSBuilder {
  private rules = new Map<string, CSSStyleMap>();

  addRule(selector: string, style: CSSStyleMap) {
    const prev = this.rules.get(selector) ?? {};
    this.rules.set(selector, { ...prev, ...style });
  }

  build(options?: { minify?: boolean }): string {
    const minify = options?.minify ?? false;
    const lines: string[] = [];
    for (const [selector, style] of this.rules.entries()) {
      const body = serializeStyle(style);
      if (!body) continue;
      if (minify) {
        lines.push(`${selector}{${body}}`);
      } else {
        lines.push(`${selector} { ${body} }`);
      }
    }
    return lines.join(minify ? "" : "\n");
  }
}

function toKebabCase(input: string): string {
  if (input.startsWith("--")) return input;
  if (input.includes("-")) return input.toLowerCase();
  return input.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
