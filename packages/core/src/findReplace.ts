import type { ColumnSchema } from "./types";
import type { DataModel } from "./dataModel";

export type FindReplaceMode = "find" | "replace";

export interface FindReplaceOptions {
  caseInsensitive?: boolean;
  regex?: boolean;
}

export interface FindReplaceMatch {
  rowId: string;
  colKey: string | number;
  rowIndex: number;
  colIndex: number;
  start: number;
  end: number;
  text: string;
}

export interface FindReplaceState {
  query: string;
  replace: string;
  mode: FindReplaceMode;
  options: Required<FindReplaceOptions>;
  matches: FindReplaceMatch[];
  activeIndex: number;
  error: string | null;
}

export type FindReplaceListener = (state: FindReplaceState) => void;

function defaultOptions(): Required<FindReplaceOptions> {
  return { caseInsensitive: false, regex: false };
}

function stringifyCellValue(value: unknown, col: ColumnSchema): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const maybe = value as any;
    if (maybe.kind === "enum" && typeof maybe.value === "string") return maybe.value;
    if (maybe.kind === "tags" && Array.isArray(maybe.values)) return maybe.values.join(", ");
  }
  // Fallback: stable stringification.
  return col.type === "boolean" ? (String(value).toLowerCase() === "true" ? "TRUE" : "FALSE") : String(value);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clampIndex(index: number, length: number) {
  if (length <= 0) return -1;
  return Math.max(0, Math.min(length - 1, index));
}

export class FindReplaceController {
  private state: FindReplaceState = {
    query: "",
    replace: "",
    mode: "find",
    options: defaultOptions(),
    matches: [],
    activeIndex: -1,
    error: null,
  };
  private listeners = new Set<FindReplaceListener>();
  private debounceId: number | null = null;
  private unsubscribeData: (() => void) | null = null;

  constructor(
    private dataModel: DataModel,
    private navigateToCell: (rowId: string, colKey: string | number) => void,
    private applyEdit: (rowId: string, colKey: string | number, next: unknown) => void,
    private canEdit: (rowId: string, colKey: string | number) => boolean,
  ) {
    this.unsubscribeData = this.dataModel.subscribe(() => {
      if (!this.state.query) return;
      this.scheduleRecompute();
    });
  }

  destroy() {
    if (this.debounceId !== null) window.clearTimeout(this.debounceId);
    this.debounceId = null;
    this.unsubscribeData?.();
    this.unsubscribeData = null;
    this.listeners.clear();
  }

  getState() {
    return this.state;
  }

  subscribe(listener: FindReplaceListener) {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  setMode(mode: FindReplaceMode) {
    this.setState({ ...this.state, mode });
  }

  setQuery(query: string) {
    this.setState({ ...this.state, query });
    this.scheduleRecompute();
  }

  setReplace(replace: string) {
    this.setState({ ...this.state, replace });
  }

  setOptions(next: FindReplaceOptions) {
    this.setState({ ...this.state, options: { ...this.state.options, ...next } });
    this.scheduleRecompute();
  }

  next() {
    if (!this.state.matches.length) return;
    const idx = (this.state.activeIndex + 1) % this.state.matches.length;
    this.activateIndex(idx);
  }

  prev() {
    if (!this.state.matches.length) return;
    const idx = (this.state.activeIndex - 1 + this.state.matches.length) % this.state.matches.length;
    this.activateIndex(idx);
  }

  activateIndex(index: number) {
    const idx = clampIndex(index, this.state.matches.length);
    if (idx < 0) return;
    const match = this.state.matches[idx]!;
    this.setState({ ...this.state, activeIndex: idx });
    this.navigateToCell(match.rowId, match.colKey);
  }

  replaceCurrent() {
    const idx = this.state.activeIndex;
    if (idx < 0) return;
    const match = this.state.matches[idx];
    if (!match) return;
    if (!this.canEdit(match.rowId, match.colKey)) return;

    const schema = this.dataModel.getSchema();
    const col = schema.columns[match.colIndex];
    if (!col) return;
    const current = this.dataModel.getCell(match.rowId, match.colKey);
    const currentText = stringifyCellValue(current, col);
    const replacement = this.applyReplacement(currentText, match);
    this.applyEdit(match.rowId, match.colKey, replacement);
    this.recompute();
  }

  replaceAll() {
    if (!this.state.matches.length) return;
    const schema = this.dataModel.getSchema();
    const byCell = new Map<string, FindReplaceMatch[]>();
    for (const m of this.state.matches) {
      if (!this.canEdit(m.rowId, m.colKey)) continue;
      byCell.set(`${m.rowId}|${String(m.colKey)}`, [...(byCell.get(`${m.rowId}|${String(m.colKey)}`) ?? []), m]);
    }
    for (const [key, matches] of byCell.entries()) {
      const [rowId, colKeyStr] = key.split("|");
      const colIndex = matches[0]!.colIndex;
      const col = schema.columns[colIndex];
      if (!col) continue;
      const colKey: string | number = typeof col.key === "number" ? col.key : colKeyStr;
      const current = this.dataModel.getCell(rowId!, colKey);
      const currentText = stringifyCellValue(current, col);
      const nextText = this.applyReplacementAllInCell(currentText, matches);
      this.applyEdit(rowId!, colKey, nextText);
    }
    this.recompute();
  }

  private applyReplacement(text: string, match: FindReplaceMatch) {
    const { query, replace, options } = this.state;
    if (!query) return text;
    if (options.regex) {
      try {
        const flags = `g${options.caseInsensitive ? "i" : ""}`;
        const re = new RegExp(query, flags);
        let seen = -1;
        return text.replace(re, (...args: any[]) => {
          const off = args[args.length - 2] as number;
          if (off !== match.start) return args[0];
          if (seen === off) return args[0];
          seen = off;
          return replace;
        });
      } catch {
        return text;
      }
    }
    return text.slice(0, match.start) + replace + text.slice(match.end);
  }

  private applyReplacementAllInCell(text: string, matches: FindReplaceMatch[]) {
    if (!matches.length) return text;
    const { query, replace, options } = this.state;
    if (!query) return text;
    if (options.regex) {
      try {
        const flags = `g${options.caseInsensitive ? "i" : ""}`;
        const re = new RegExp(query, flags);
        return text.replace(re, replace);
      } catch {
        return text;
      }
    }
    // Plain mode: apply from end to keep offsets valid.
    const sorted = [...matches].sort((a, b) => b.start - a.start);
    let out = text;
    for (const m of sorted) {
      out = out.slice(0, m.start) + replace + out.slice(m.end);
    }
    return out;
  }

  private scheduleRecompute() {
    if (this.debounceId !== null) window.clearTimeout(this.debounceId);
    this.debounceId = window.setTimeout(() => {
      this.debounceId = null;
      this.recompute();
    }, 180);
  }

  recompute() {
    const { query, options } = this.state;
    if (!query) {
      this.setState({ ...this.state, matches: [], activeIndex: -1, error: null });
      return;
    }
    const schema = this.dataModel.getSchema();
    const view = this.dataModel.getView();
    const rows = this.dataModel.listRows();
    const matches: FindReplaceMatch[] = [];
    let error: string | null = null;

    let re: RegExp | null = null;
    if (options.regex) {
      try {
        const flags = `g${options.caseInsensitive ? "i" : ""}`;
        re = new RegExp(query, flags);
      } catch (e) {
        error = e instanceof Error ? e.message : "Invalid pattern";
      }
    } else {
      const flags = options.caseInsensitive ? "gi" : "g";
      re = new RegExp(escapeRegExp(query), flags);
    }

    if (!re || error) {
      this.setState({ ...this.state, matches: [], activeIndex: -1, error: error ?? "Invalid pattern" });
      return;
    }

    for (let r = 0; r < rows.length; r += 1) {
      const row = rows[r]!;
      for (let c = 0; c < schema.columns.length; c += 1) {
        const col = schema.columns[c]!;
        if (view.hiddenColumns?.some((k) => String(k) === String(col.key))) continue;
        const cellValue = this.dataModel.getCell(row.id, col.key);
        const text = stringifyCellValue(cellValue, col);
        if (!text) continue;
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(text))) {
          const start = m.index;
          const end = start + (m[0]?.length ?? 0);
          matches.push({
            rowId: row.id,
            colKey: col.key,
            rowIndex: r,
            colIndex: c,
            start,
            end,
            text,
          });
          if (m[0] === "") break;
        }
      }
    }

    const activeIndex = matches.length ? clampIndex(this.state.activeIndex, matches.length) : -1;
    this.setState({ ...this.state, matches, activeIndex, error: null });
  }

  private setState(next: FindReplaceState) {
    this.state = next;
    for (const l of this.listeners) l(this.state);
  }
}
