import { parseISO } from "date-fns";
import type { ColumnSchema } from "./types";

const isValidDate = (d: Date) => !Number.isNaN(d.getTime());

const asEnumValue = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.kind === "enum") {
      return typeof obj.value === "string" ? obj.value : null;
    }
  }
  return null;
};

const asTagsValues = (value: unknown) => {
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) return value as string[];
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.kind === "tags") {
      const values = obj.values;
      return Array.isArray(values) && values.every((v) => typeof v === "string")
        ? (values as string[])
        : null;
    }
  }
  return null;
};

export function validateCellValue(value: unknown, col: ColumnSchema): string | null {
  // MVP: avoid noisy "required" errors. Treat empty as valid.
  if (value === null || value === undefined) return null;

  switch (col.type) {
    case "string": {
      if (typeof value !== "string") return "Expected a string";
      if (col.string?.maxLength !== undefined && value.length > col.string.maxLength) {
        return `Too long (max ${col.string.maxLength})`;
      }
      if (col.string?.regex) {
        try {
          const re = new RegExp(col.string.regex);
          if (!re.test(value)) return "Does not match pattern";
        } catch {
          // ignore invalid regex config
        }
      }
      return null;
    }
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return "Expected a number";
      if (col.number?.signed === false && value < 0) return "Expected a non-negative number";
      return null;
    }
    case "boolean": {
      if (typeof value !== "boolean") return "Expected a boolean";
      return null;
    }
    case "enum": {
      const v = asEnumValue(value);
      if (!v) return "Expected an enum value";
      const allowCustom = col.enum?.allowCustom ?? false;
      const options = col.enum?.options ?? [];
      if (!allowCustom && options.length && !options.includes(v)) return "Not in allowed options";
      return null;
    }
    case "tags": {
      const values = asTagsValues(value);
      if (!values) return "Expected a list of tags";
      const allowCustom = col.tags?.allowCustom ?? false;
      const options = col.tags?.options ?? [];
      if (!allowCustom && options.length) {
        for (const v of values) {
          if (!options.includes(v)) return "Contains an unknown tag";
        }
      }
      return null;
    }
    case "date":
    case "time":
    case "datetime": {
      if (value instanceof Date) return isValidDate(value) ? null : "Invalid date";
      if (typeof value === "string") {
        const d = parseISO(value);
        return isValidDate(d) ? null : "Invalid date/time";
      }
      return "Expected a date/time string";
    }
    default:
      return null;
  }
}
