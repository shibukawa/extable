export type NumericParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: "empty" | "invalid" | "non-finite" | "not-integer" | "out-of-range" };

export type NumericColumnType = "number" | "int" | "uint";

export function normalizeNumericInput(text: string): string {
  return text.normalize("NFKC").trim();
}

const parsePrefixedBaseInteger = (text: string): number | null => {
  const s = text.trim();
  const m = /^([+-]?)(0[bBoOxX])([0-9a-fA-F]+)$/.exec(s);
  if (!m) return null;

  const sign = m[1] === "-" ? -1 : 1;
  const prefix = m[2].toLowerCase();
  const digits = m[3] ?? "";

  let radix = 10;
  let validRe = /^[0-9]+$/;
  if (prefix === "0b") {
    radix = 2;
    validRe = /^[01]+$/;
  } else if (prefix === "0o") {
    radix = 8;
    validRe = /^[0-7]+$/;
  } else if (prefix === "0x") {
    radix = 16;
    validRe = /^[0-9a-fA-F]+$/;
  }

  if (!digits || !validRe.test(digits)) return NaN;
  const n = Number.parseInt(digits, radix);
  return sign * n;
};

export function parseNumericText(rawText: string): NumericParseResult {
  const text = normalizeNumericInput(rawText);
  if (text === "") return { ok: false, reason: "empty" };

  const baseParsed = parsePrefixedBaseInteger(text);
  if (baseParsed !== null) {
    if (!Number.isFinite(baseParsed)) return { ok: false, reason: "invalid" };
    return { ok: true, value: baseParsed };
  }

  const n = Number(text);
  if (!Number.isFinite(n)) return { ok: false, reason: Number.isNaN(n) ? "invalid" : "non-finite" };
  return { ok: true, value: n };
}

export function coerceNumericForColumn(
  value: number,
  type: NumericColumnType,
): NumericParseResult {
  if (!Number.isFinite(value)) return { ok: false, reason: "non-finite" };
  if (type === "number") return { ok: true, value };

  if (!Number.isSafeInteger(value)) return { ok: false, reason: "not-integer" };
  if (type === "uint" && value < 0) return { ok: false, reason: "out-of-range" };
  return { ok: true, value };
}

export type IntegerBaseFormat = "binary" | "octal" | "hex";

export function formatIntegerWithPrefix(value: number, base: IntegerBaseFormat): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const digits =
    base === "binary" ? abs.toString(2) : base === "octal" ? abs.toString(8) : abs.toString(16);
  const prefix = base === "binary" ? "0b" : base === "octal" ? "0o" : "0x";
  return `${sign}${prefix}${digits}`;
}

export function formatNumberForEdit(value: number, options?: { format?: "decimal" | "scientific"; precision?: number; scale?: number }): string {
  if (!Number.isFinite(value)) return "";
  const fmt = options?.format ?? "decimal";
  if (fmt === "scientific") {
    const p = options?.precision;
    if (p !== undefined && Number.isFinite(p) && p > 0) {
      return value.toExponential(Math.max(0, Math.floor(p) - 1));
    }
    return value.toExponential();
  }
  const scale = options?.scale;
  if (scale !== undefined && Number.isFinite(scale)) {
    const s = Math.max(0, Math.floor(scale));
    return value.toFixed(s);
  }
  return String(value);
}
