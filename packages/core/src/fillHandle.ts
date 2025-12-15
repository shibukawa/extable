import type { DataModel } from './dataModel';
import type { ColumnSchema, SelectionRange } from './types';

export type FillHandleMode = 'copy' | 'sequence';

export interface FillHandleSource {
  colKey: string | number;
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

function parseStringSuffixNumber(value: string) {
  const m = /^(.*?)(\d+)$/.exec(value);
  if (!m) return null;
  const prefix = m[1] ?? '';
  const digits = m[2] ?? '';
  const num = Number(digits);
  if (!Number.isFinite(num)) return null;
  return { prefix, num, width: digits.length };
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

function daysInMonthUtc(year: number, month0: number) {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

function addMonthsUtcClamped(baseUtc: Date, months: number) {
  const y = baseUtc.getUTCFullYear();
  const m = baseUtc.getUTCMonth();
  const d = baseUtc.getUTCDate();
  const hh = baseUtc.getUTCHours();
  const mm = baseUtc.getUTCMinutes();
  const ss = baseUtc.getUTCSeconds();
  const ms = baseUtc.getUTCMilliseconds();
  const totalMonths = y * 12 + m + months;
  const ny = Math.floor(totalMonths / 12);
  const nm = ((totalMonths % 12) + 12) % 12;
  const maxDay = daysInMonthUtc(ny, nm);
  const nd = Math.min(d, maxDay);
  return new Date(Date.UTC(ny, nm, nd, hh, mm, ss, ms));
}

function addYearsUtcClamped(baseUtc: Date, years: number) {
  return addMonthsUtcClamped(baseUtc, years * 12);
}

function addMonthsLocalClamped(base: Date, months: number) {
  const y = base.getFullYear();
  const m = base.getMonth();
  const d = base.getDate();
  const hh = base.getHours();
  const mm = base.getMinutes();
  const ss = base.getSeconds();
  const ms = base.getMilliseconds();
  const totalMonths = y * 12 + m + months;
  const ny = Math.floor(totalMonths / 12);
  const nm = ((totalMonths % 12) + 12) % 12;
  const maxDay = new Date(ny, nm + 1, 0).getDate();
  const nd = Math.min(d, maxDay);
  const out = new Date(ny, nm, nd, hh, mm, ss, ms);
  return out;
}

function addYearsLocalClamped(base: Date, years: number) {
  return addMonthsLocalClamped(base, years * 12);
}

export function getFillHandleSource(dataModel: DataModel, ranges: SelectionRange[]): FillHandleSource | null {
  if (ranges.length !== 1) return null;
  const range = normalizeRange(ranges[0]!);
  if (range.kind !== 'cells') return null;
  const width = range.endCol - range.startCol + 1;
  const height = range.endRow - range.startRow + 1;
  if (width !== 1) return null;
  if (height !== 1 && height !== 2) return null;

  const schema = dataModel.getSchema();
  const col = schema.columns[range.startCol];
  if (!col) return null;

  if (col.type === 'boolean') {
    if (height !== 1) return null;
    return {
      colKey: col.key,
      colIndex: range.startCol,
      startRowIndex: range.startRow,
      endRowIndex: range.endRow,
      mode: 'copy'
    };
  }

  if (height === 1) {
    return {
      colKey: col.key,
      colIndex: range.startCol,
      startRowIndex: range.startRow,
      endRowIndex: range.endRow,
      mode: 'copy'
    };
  }

  // height === 2
  if (col.type === 'string') {
    const rows = dataModel.listRows();
    const r1 = rows[range.startRow];
    const r2 = rows[range.endRow];
    if (!r1 || !r2) return null;
    const s1 = String(dataModel.getCell(r1.id, col.key) ?? '');
    const s2 = String(dataModel.getCell(r2.id, col.key) ?? '');
    const p1 = parseStringSuffixNumber(s1);
    const p2 = parseStringSuffixNumber(s2);
    if (!p1 || !p2) return null;
    if (p1.prefix !== p2.prefix) return null;
    if (p1.width !== p2.width) return null;
    return {
      colKey: col.key,
      colIndex: range.startCol,
      startRowIndex: range.startRow,
      endRowIndex: range.endRow,
      mode: 'sequence'
    };
  }

  if (col.type === 'number' || col.type === 'date' || col.type === 'time' || col.type === 'datetime') {
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
  source: FillHandleSource
): ((offsetFromEnd: number) => unknown) | null {
  const schema = dataModel.getSchema();
  const rows = dataModel.listRows();
  const col = schema.columns[source.colIndex];
  if (!col) return null;
  const r1 = rows[source.startRowIndex];
  const r2 = rows[source.endRowIndex];
  if (!r1 || !r2) return null;

  const v1 = dataModel.getCell(r1.id, col.key);
  const v2 = dataModel.getCell(r2.id, col.key);

  if (source.mode === 'copy') {
    return () => v2;
  }

  // sequence
  if (col.type === 'number') {
    const n1 = typeof v1 === 'number' ? v1 : Number(v1);
    const n2 = typeof v2 === 'number' ? v2 : Number(v2);
    if (!Number.isFinite(n1) || !Number.isFinite(n2)) return null;
    const step = n2 - n1;
    return (offsetFromEnd) => n2 + step * offsetFromEnd;
  }

  if (col.type === 'date' || col.type === 'time' || col.type === 'datetime') {
    const d1 = col.type === 'time' ? coerceToTime(v1) : coerceToDate(v1);
    const d2 = col.type === 'time' ? coerceToTime(v2) : coerceToDate(v2);
    if (!d1 || !d2) return null;
    const t1 = d1.getTime();
    const t2 = d2.getTime();
    const stepMs = t2 - t1;

    if (col.type === 'time') {
      return (offsetFromEnd) => new Date(t2 + stepMs * offsetFromEnd);
    }

    // Calendar-aware stepping for date/datetime to avoid month-length/leap-year drift.
    if (col.type === 'date') {
      const sameDayUtc = d1.getUTCDate() === d2.getUTCDate();
      const sameMonthDayUtc = sameDayUtc && d1.getUTCMonth() === d2.getUTCMonth();
      if (sameMonthDayUtc) {
        const stepYears = d2.getUTCFullYear() - d1.getUTCFullYear();
        if (stepYears !== 0) {
          const baseUtc = new Date(Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), d2.getUTCDate()));
          return (offsetFromEnd) => addYearsUtcClamped(baseUtc, stepYears * offsetFromEnd);
        }
      } else if (sameDayUtc) {
        const stepMonths =
          (d2.getUTCFullYear() - d1.getUTCFullYear()) * 12 + (d2.getUTCMonth() - d1.getUTCMonth());
        if (stepMonths !== 0) {
          const baseUtc = new Date(Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), d2.getUTCDate()));
          return (offsetFromEnd) => addMonthsUtcClamped(baseUtc, stepMonths * offsetFromEnd);
        }
      }
    } else {
      const sameDayLocal = d1.getDate() === d2.getDate();
      const sameMonthDayLocal = sameDayLocal && d1.getMonth() === d2.getMonth();
      if (sameMonthDayLocal) {
        const stepYears = d2.getFullYear() - d1.getFullYear();
        if (stepYears !== 0) {
          return (offsetFromEnd) => addYearsLocalClamped(d2, stepYears * offsetFromEnd);
        }
      } else if (sameDayLocal) {
        const stepMonths = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
        if (stepMonths !== 0) {
          return (offsetFromEnd) => addMonthsLocalClamped(d2, stepMonths * offsetFromEnd);
        }
      }
    }

    // Fallback to millisecond delta.
    return (offsetFromEnd) => new Date(t2 + stepMs * offsetFromEnd);
  }

  if (col.type === 'string') {
    const s1 = String(v1 ?? '');
    const s2 = String(v2 ?? '');
    const p1 = parseStringSuffixNumber(s1);
    const p2 = parseStringSuffixNumber(s2);
    if (!p1 || !p2) return null;
    if (p1.prefix !== p2.prefix) return null;
    if (p1.width !== p2.width) return null;
    const step = p2.num - p1.num;
    return (offsetFromEnd) => {
      const next = p2.num + step * offsetFromEnd;
      const sign = next < 0 ? '-' : '';
      const abs = Math.abs(next);
      const digits = String(abs).padStart(p2.width, '0');
      return `${p2.prefix}${sign}${digits}`;
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
  activeColKey: string | number | null
): boolean {
  const src = getFillHandleSource(dataModel, ranges);
  if (!src) return false;
  if (!activeRowId || activeRowId === '__all__') return false;
  if (activeColKey === null) return false;
  if (activeColKey === '__all__' || activeColKey === '__row__') return false;
  if (String(activeColKey) !== String(src.colKey)) return false;
  if (dataModel.isReadonly(activeRowId, activeColKey)) return false;
  return true;
}
