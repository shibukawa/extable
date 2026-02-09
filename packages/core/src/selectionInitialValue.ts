import { formatIntegerWithPrefix, formatNumberForEdit } from "./numberIO";
import type { ColumnSchema } from "./types";

export function getInitialEditValue(current: unknown, col: ColumnSchema | undefined): string {
  if (current === null || current === undefined) return "";
  if (!col) return String(current);

  if (typeof current === "object") {
    const obj = current as Record<string, unknown>;
    if (obj.kind === "lookup" && typeof obj.label === "string") {
      return obj.label;
    }
    if (typeof obj.kind !== "string" && typeof obj.label === "string" && "value" in obj) {
      return obj.label;
    }
  }

  if (
    (col.type === "number" || col.type === "int" || col.type === "uint") &&
    typeof current === "number"
  ) {
    if (col.type === "number") {
      const fmt = col.format as { format?: string; precision?: number; scale?: number } | undefined;
      const token = fmt?.format ?? "decimal";
      if (token === "scientific") {
        return formatNumberForEdit(current, { format: "scientific", precision: fmt?.precision });
      }
      return formatNumberForEdit(current, { format: "decimal", scale: fmt?.scale });
    }

    const fmt = col.format as { format?: string } | undefined;
    const token = fmt?.format ?? "decimal";
    if (token === "binary" || token === "octal" || token === "hex") {
      return formatIntegerWithPrefix(current, token);
    }
    return String(current);
  }

  return String(current);
}
