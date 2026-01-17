import type { ColumnSchema } from "./types";
import { parseIsoDate } from "./dateUtils";

const DAY_MS = 86_400_000;

export function safeParseDate(value: string): Date | null {
  const parsed = parseIsoDate(value);
  if (!parsed) return null;
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function safeParseTime(value: string): Date | null {
  const parsed = new Date(`1970-01-01T${value}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toRawValue(raw: unknown, value: unknown, col: ColumnSchema): string | null {
  void raw;
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.kind === "lookup" && typeof obj.value === "string") {
      return obj.value;
    }
    if (typeof obj.label === "string" && "value" in obj && col.type === "labeled") {
      const inner = obj.value as unknown;
      if (inner === null || inner === undefined) return null;
      if (typeof inner === "string") return inner;
      if (typeof inner === "number") return String(inner);
      if (typeof inner === "boolean") return String(inner);
      if (inner instanceof Date) return inner.toISOString();
      return String(inner);
    }
  }
  if (col.type === "string") return null;
  if (col.type === "labeled") return null;
  if (col.type === "boolean") return String(Boolean(value));
  if ((col.type === "number" || col.type === "int" || col.type === "uint") && typeof value === "number") {
    return String(value);
  }
  if (col.type === "datetime") {
    const d = value instanceof Date ? value : safeParseDate(String(value));
    return d ? String(d.getTime()) : null;
  }
  if (col.type === "date") {
    const d = value instanceof Date ? value : safeParseDate(String(value));
    if (!d) return null;
    const floored = Math.floor(d.getTime() / DAY_MS) * DAY_MS;
    return String(floored);
  }
  if (col.type === "time") {
    const d = value instanceof Date ? value : safeParseTime(String(value));
    if (!d) return null;
    return String(d.getTime() % DAY_MS);
  }
  return null;
}
