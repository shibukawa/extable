import { formatDateLite, parseIsoDate } from "./dateUtils";
import { getButtonLabel, getLinkLabel } from "./actionValue";
import { formatIntegerWithPrefix, formatNumberForEdit } from "./numberIO";
import type { ColumnSchema, IntegerFormat, NumberFormat } from "./types";

export class ValueFormatCache {
  private numberFormatCache = new Map<string, Intl.NumberFormat>();
  private dateParseCache = new Map<string, Date>();

  getNumberFormatter(options: Intl.NumberFormatOptions): Intl.NumberFormat {
    const key = JSON.stringify(options);
    let fmt = this.numberFormatCache.get(key);
    if (!fmt) {
      fmt = new Intl.NumberFormat("en-US", options);
      this.numberFormatCache.set(key, fmt);
    }
    return fmt;
  }

  parseIsoDate(value: string): Date | null {
    const cached = this.dateParseCache.get(value);
    if (cached) return cached;
    const parsed = parseIsoDate(value);
    if (!parsed || Number.isNaN(parsed.getTime())) return null;
    this.dateParseCache.set(value, parsed);
    return parsed;
  }
}

export function resolveTagValues(value: unknown): string[] | null {
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    return value as string[];
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.kind === "tags") {
      const values = obj.values;
      if (Array.isArray(values)) {
        return values.filter((v): v is string => typeof v === "string");
      }
    }
  }
  return null;
}

export function resolveLabeledText(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.kind === "string") return null;
  if (typeof obj.label === "string" && "value" in obj) return obj.label;
  return null;
}

export function formatCellValue(
  value: unknown,
  col: ColumnSchema,
  cache: ValueFormatCache,
  resolveDatePattern?: (type: "date" | "time" | "datetime", format: string | undefined) => string,
): { text: string; color?: string } {
  if (value === null || value === undefined) return { text: "" };
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.kind === "lookup" && typeof obj.label === "string") {
      return { text: obj.label };
    }
    const labeled = resolveLabeledText(value);
    if (labeled !== null) return { text: labeled };
  }
  if (col.type === "button") {
    const label = getButtonLabel(value);
    return { text: label || String(value) };
  }
  if (col.type === "link") {
    const label = getLinkLabel(value);
    return { text: label || String(value) };
  }
  if (col.type === "tags") {
    const tags = resolveTagValues(value);
    if (tags) return { text: tags.join(", ") };
  }
  if (col.type === "boolean") {
    if (col.format === "checkbox" || !col.format) {
      return { text: value ? "☑" : "☐" };
    }
    if (Array.isArray(col.format) && col.format.length >= 2) {
      return { text: value ? String(col.format[0]) : String(col.format[1]) };
    }
    return { text: value ? String(col.format) : "" };
  }
  if (col.type === "number" && typeof value === "number") {
    const num = value;
    const fmt = col.format as NumberFormat | undefined;
    const token = fmt?.format ?? "decimal";
    if (token === "scientific") {
      const text = formatNumberForEdit(num, { format: "scientific", precision: fmt?.precision });
      const color = fmt?.negativeRed && num < 0 ? "#b91c1c" : undefined;
      return { text, color };
    }

    const opts: Intl.NumberFormatOptions = {};
    if (fmt?.scale !== undefined) {
      opts.minimumFractionDigits = fmt.scale;
      opts.maximumFractionDigits = fmt.scale;
    }
    opts.useGrouping = Boolean(fmt?.thousandSeparator);
    const text = cache.getNumberFormatter(opts).format(num);
    const color = fmt?.negativeRed && num < 0 ? "#b91c1c" : undefined;
    return { text, color };
  }

  if ((col.type === "int" || col.type === "uint") && typeof value === "number") {
    const num = value;
    const fmt = col.format as IntegerFormat | undefined;
    const token = fmt?.format ?? "decimal";
    if (token === "binary" || token === "octal" || token === "hex") {
      const text = formatIntegerWithPrefix(num, token);
      const color = fmt?.negativeRed && num < 0 ? "#b91c1c" : undefined;
      return { text, color };
    }

    const opts: Intl.NumberFormatOptions = {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: Boolean(fmt?.thousandSeparator),
    };
    const text = cache.getNumberFormatter(opts).format(num);
    const color = fmt?.negativeRed && num < 0 ? "#b91c1c" : undefined;
    return { text, color };
  }
  if (
    (col.type === "date" || col.type === "time" || col.type === "datetime") &&
    (value instanceof Date || typeof value === "string")
  ) {
    const fmtValue = col.format as string | undefined;
    const fmt = resolveDatePattern
      ? resolveDatePattern(col.type, fmtValue)
      : col.type === "date"
        ? (fmtValue ?? "yyyy-MM-dd")
        : col.type === "time"
          ? (fmtValue ?? "HH:mm")
          : (fmtValue ?? "yyyy-MM-dd'T'HH:mm:ss'Z'");

    let d: Date | null = null;
    if (value instanceof Date) d = value;
    else {
      d = cache.parseIsoDate(value);
    }
    if (!d) return { text: String(value) };
    return { text: formatDateLite(d, fmt) };
  }
  return { text: String(value) };
}
