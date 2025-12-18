const pad = (num: number, len = 2) => num.toString().padStart(len, "0");

const tokenHandlers: Record<
  string,
  (d: Date) => string
> = {
  yyyy: (d) => pad(d.getFullYear(), 4),
  MM: (d) => pad(d.getMonth() + 1),
  dd: (d) => pad(d.getDate()),
  HH: (d) => pad(d.getHours()),
  hh: (d) => {
    const h = d.getHours() % 12 || 12;
    return pad(h);
  },
  mm: (d) => pad(d.getMinutes()),
  ss: (d) => pad(d.getSeconds()),
  a: (d) => (d.getHours() >= 12 ? "PM" : "AM"),
};

const TOKENS = Object.keys(tokenHandlers).sort((a, b) => b.length - a.length);
const DATE_TOKENS = new Set(["yyyy", "MM", "dd"]);
const TIME_TOKENS = new Set(["HH", "hh", "mm", "ss", "a"]);
const DATETIME_TOKENS = new Set([...DATE_TOKENS, ...TIME_TOKENS]);

type DatePatternKind = "date" | "time" | "datetime";

const DATE_PRESETS: Record<string, string> = {
  iso: "yyyy-MM-dd",
  us: "MM/dd/yyyy",
  eu: "dd.MM.yyyy",
};

const TIME_PRESETS: Record<string, string> = {
  iso: "HH:mm:ss",
  "24h": "HH:mm",
  "12h": "hh:mm a",
};

const DATETIME_PRESETS: Record<string, string> = {
  iso: "yyyy-MM-dd'T'HH:mm:ss'Z'",
  "iso-24h": "yyyy-MM-dd'T'HH:mm:ss'Z'",
  "iso-12h": "yyyy-MM-dd hh:mm a",
  us: "MM/dd/yyyy HH:mm",
  "us-24h": "MM/dd/yyyy HH:mm",
  "us-12h": "MM/dd/yyyy hh:mm a",
  eu: "dd.MM.yyyy HH:mm",
  "eu-24h": "dd.MM.yyyy HH:mm",
  "eu-12h": "dd.MM.yyyy hh:mm a",
};

export function parseIsoDate(value: string): Date | null {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateLite(date: Date, pattern: string): string {
  let out = "";
  let i = 0;
  let inLiteral = false;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "'") {
      inLiteral = !inLiteral;
      i += 1;
      continue;
    }
    if (inLiteral) {
      out += ch;
      i += 1;
      continue;
    }
    let matched = false;
    for (const token of TOKENS) {
      if (pattern.startsWith(token, i)) {
        out += tokenHandlers[token](date);
        i += token.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out += ch;
      i += 1;
    }
  }
  return out;
}

function isTokenAllowed(token: string, kind: DatePatternKind): boolean {
  if (kind === "date") return DATE_TOKENS.has(token);
  if (kind === "time") return TIME_TOKENS.has(token);
  return DATETIME_TOKENS.has(token);
}

function isPatternAllowed(pattern: string, kind: DatePatternKind): boolean {
  let i = 0;
  let inLiteral = false;
  while (i < pattern.length) {
    const ch = pattern[i];
    if (ch === "'") {
      inLiteral = !inLiteral;
      i += 1;
      continue;
    }
    if (inLiteral) {
      i += 1;
      continue;
    }
    let matched = false;
    for (const token of TOKENS) {
      if (pattern.startsWith(token, i)) {
        if (!isTokenAllowed(token, kind)) return false;
        i += token.length;
        matched = true;
        break;
      }
    }
    if (!matched) i += 1;
  }
  return true;
}

export function coerceDatePattern(
  pattern: string | undefined,
  kind: DatePatternKind,
): string {
  if (!pattern) {
    return kind === "date"
      ? DATE_PRESETS.iso
      : kind === "time"
        ? TIME_PRESETS.iso
        : DATETIME_PRESETS.iso;
  }

  if (kind === "date" && DATE_PRESETS[pattern]) return DATE_PRESETS[pattern];
  if (kind === "time" && TIME_PRESETS[pattern]) return TIME_PRESETS[pattern];
  if (kind === "datetime" && DATETIME_PRESETS[pattern]) return DATETIME_PRESETS[pattern];

  const fallback =
    kind === "date"
      ? DATE_PRESETS.iso
      : kind === "time"
        ? TIME_PRESETS.iso
        : DATETIME_PRESETS.iso;

  return isPatternAllowed(pattern, kind) ? pattern : fallback;
}
