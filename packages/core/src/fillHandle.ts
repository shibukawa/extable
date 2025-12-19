import type { DataModel } from "./dataModel";
import type { EditMode, SelectionRange } from "./types";
import { createBuiltInRegistry, inferSequence } from "@extable/sequence";

export type FillHandleMode = 'copy' | 'sequence';

export interface FillHandleSource {
  colKey: string;
  colIndex: number;
  startRowIndex: number;
  endRowIndex: number;
  mode: FillHandleMode;
}

function normalizeRange(range: SelectionRange): SelectionRange {
  return {
    ...range,
    startRow: Math.min(range.startRow, range.endRow),
    endRow: Math.max(range.startRow, range.endRow),
    startCol: Math.min(range.startCol, range.endCol),
    endCol: Math.max(range.startCol, range.endCol)
  };
}

function coerceToTime(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^\d{1,2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(s)) {
      const d = new Date(`1970-01-01T${s}`);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function coerceToDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function getFillHandleSource(dataModel: DataModel, ranges: SelectionRange[]): FillHandleSource | null {
  if (ranges.length !== 1) return null;
  const range = normalizeRange(ranges[0]!);
  if (range.kind !== 'cells') return null;
  const width = range.endCol - range.startCol + 1;
  const height = range.endRow - range.startRow + 1;
  if (width !== 1) return null;
  if (height < 1) return null;

  const schema = dataModel.getSchema();
  const col = schema.columns[range.startCol];
  if (!col) return null;

  if (height === 1) {
    return {
      colKey: col.key,
      colIndex: range.startCol,
      startRowIndex: range.startRow,
      endRowIndex: range.endRow,
      mode: 'copy'
    };
  }

  if (col.type === 'boolean') {
    return null;
  }

  if (
    col.type === 'number' ||
    col.type === 'date' ||
    col.type === 'time' ||
    col.type === 'datetime' ||
    col.type === 'string'
  ) {
    return {
      colKey: col.key,
      colIndex: range.startCol,
      startRowIndex: range.startRow,
      endRowIndex: range.endRow,
      mode: 'sequence'
    };
  }

  // enum/tags: sequence not supported (copy only, but 2-cell handle should not appear)
  return null;
}

export function makeFillValueGetter(
  dataModel: DataModel,
  source: FillHandleSource,
  langs?: readonly string[]
): ((offsetFromEnd: number) => unknown) | null {
  const schema = dataModel.getSchema();
  const rows = dataModel.listRows();
  const col = schema.columns[source.colIndex];
  if (!col) return null;
  const seed: unknown[] = [];
  for (let r = source.startRowIndex; r <= source.endRowIndex; r += 1) {
    const row = rows[r];
    if (!row) return null;
    seed.push(dataModel.getCell(row.id, col.key));
  }

  if (source.mode === 'copy') {
    const last = seed[seed.length - 1];
    return () => last;
  }

  const registry = createBuiltInRegistry(langs);
  if (col.type === 'number') {
    const numbers = seed.map((value) => (typeof value === 'number' ? value : Number(value)));
    if (!numbers.every((value) => Number.isFinite(value))) return null;
    const seq = inferSequence(numbers, { registry });
    const cache: number[] = [];
    let done = false;
    return (offsetFromEnd) => {
      while (!done && cache.length < offsetFromEnd) {
        const next = seq.next();
        if (next.done) {
          done = true;
          break;
        }
        cache.push(next.value);
      }
      if (offsetFromEnd <= 0) return null;
      return cache[offsetFromEnd - 1] ?? null;
    };
  }

  if (col.type === 'date' || col.type === 'time' || col.type === 'datetime') {
    const dates = seed.map((value) =>
      col.type === 'time' ? coerceToTime(value) : coerceToDate(value)
    );
    if (!dates.every((value) => value instanceof Date)) return null;
    const seq = inferSequence(dates as Date[], { registry });
    const cache: Date[] = [];
    let done = false;
    return (offsetFromEnd) => {
      while (!done && cache.length < offsetFromEnd) {
        const next = seq.next();
        if (next.done) {
          done = true;
          break;
        }
        cache.push(next.value);
      }
      if (offsetFromEnd <= 0) return null;
      return cache[offsetFromEnd - 1] ?? null;
    };
  }

  if (col.type === 'string') {
    const strings = seed.map((value) => String(value ?? ''));
    const seq = inferSequence(strings, { registry });
    const cache: string[] = [];
    let done = false;
    return (offsetFromEnd) => {
      while (!done && cache.length < offsetFromEnd) {
        const next = seq.next();
        if (next.done) {
          done = true;
          break;
        }
        cache.push(next.value);
      }
      if (offsetFromEnd <= 0) return null;
      return cache[offsetFromEnd - 1] ?? null;
    };
  }

  return null;
}

export const FILL_HANDLE_VISUAL_SIZE_PX = 12;
export const FILL_HANDLE_HIT_SIZE_PX = 14;

export function getFillHandleRect(cellRect: DOMRect, size = FILL_HANDLE_VISUAL_SIZE_PX): DOMRect {
  return new DOMRect(cellRect.right - size - 1, cellRect.bottom - size - 1, size, size);
}

export function isPointInRect(x: number, y: number, rect: DOMRect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function shouldShowFillHandle(
  dataModel: DataModel,
  ranges: SelectionRange[],
  activeRowId: string | null,
  activeColKey: string | null,
  editMode: EditMode,
): boolean {
  if (editMode === "readonly") return false;
  const src = getFillHandleSource(dataModel, ranges);
  if (!src) return false;
  if (!activeRowId || activeRowId === '__all__') return false;
  if (activeColKey === null) return false;
  if (activeColKey === '__all__' || activeColKey === null) return false;
  if (activeColKey !== src.colKey) return false;
  if (dataModel.isReadonly(activeRowId, activeColKey)) return false;
  return true;
}
