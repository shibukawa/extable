import type { ColumnSchema } from "./types";
import { coerceNumericForColumn, parseNumericText } from "./numberIO";

export function coerceClipboardValue(raw: string, col: ColumnSchema | null): unknown {
  if (!col) return raw;
  if (raw === "") return "";
  if (col.type === "number" || col.type === "int" || col.type === "uint") {
    const parsed = parseNumericText(raw);
    if (!parsed.ok) return raw;
    const coerced = coerceNumericForColumn(parsed.value, col.type);
    return coerced.ok ? coerced.value : raw;
  }
  if (col.type === "boolean") {
    const v = raw.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "no") return false;
    return raw;
  }
  return raw;
}
