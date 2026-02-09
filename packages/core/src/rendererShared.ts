import type { View, ViewFilterValues } from "./types";

export function getColumnSortDir(view: View, colKey: string): "asc" | "desc" | null {
  const s = view.sorts?.[0];
  if (!s) return null;
  return s.key === colKey ? s.dir : null;
}

export function hasActiveColumnFilter(view: View, colKey: string): boolean {
  const hasValues = (view.filters ?? []).some((f) => {
    const vf = f as ViewFilterValues;
    return vf?.kind === "values" && vf.key === colKey;
  });
  if (hasValues) return true;
  const diag = view.columnDiagnostics?.[colKey];
  return Boolean(diag?.errors || diag?.warnings);
}

export function svgFunnel() {
  return `
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `.trim();
}

export function svgArrow(dir: "asc" | "desc") {
  const d = dir === "asc" ? "M12 6l6 8H6l6-8z" : "M12 18l-6-8h12l-6 8z";
  return `
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="${d}" fill="currentColor"/>
    </svg>
  `.trim();
}

export function drawDiagnosticCorner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  level: "warning" | "error",
) {
  const size = Math.min(10, Math.floor(Math.min(w, h) / 2));
  if (size <= 0) return;
  const color = level === "error" ? "#ef4444" : "#f59e0b";
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + w, y);
  ctx.lineTo(x + w - size, y);
  ctx.lineTo(x + w, y + size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawFunnelIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "rgba(15,23,42,1)";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x + Math.round(size * 0.62), y + Math.round(size * 0.46));
  ctx.lineTo(x + Math.round(size * 0.38), y + Math.round(size * 0.46));
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + Math.round(size * 0.46), y + Math.round(size * 0.46));
  ctx.lineTo(x + Math.round(size * 0.46), y + size);
  ctx.lineTo(x + Math.round(size * 0.54), y + size - 2);
  ctx.lineTo(x + Math.round(size * 0.54), y + Math.round(size * 0.46));
  ctx.stroke();
  ctx.restore();
}

export function drawSortArrowIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number,
  dir: "asc" | "desc",
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(15,23,42,1)";
  ctx.beginPath();
  if (dir === "asc") {
    ctx.moveTo(x + size / 2, y);
    ctx.lineTo(x + size, y + size);
    ctx.lineTo(x, y + size);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x + size / 2, y + size);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export class FenwickTree {
  private tree: number[];
  private n: number;

  constructor(n: number) {
    this.n = n;
    this.tree = new Array(n + 1).fill(0);
  }

  static from(values: number[]) {
    const ft = new FenwickTree(values.length);
    for (let i = 0; i < values.length; i += 1) ft.add(i, values[i] ?? 0);
    return ft;
  }

  sum(count: number) {
    let i = Math.max(0, Math.min(this.n, count));
    let res = 0;
    while (i > 0) {
      res += this.tree[i] ?? 0;
      i -= i & -i;
    }
    return res;
  }

  total() {
    return this.sum(this.n);
  }

  add(index0: number, delta: number) {
    let i = index0 + 1;
    if (i <= 0 || i > this.n) return;
    while (i <= this.n) {
      this.tree[i] = (this.tree[i] ?? 0) + delta;
      i += i & -i;
    }
  }

  lowerBound(target: number) {
    if (this.n <= 0) return 0;
    if (target <= 0) return 0;
    const total = this.total();
    if (target > total) return this.n - 1;
    let idx = 0;
    let bit = 1;
    while (bit <= this.n) bit <<= 1;
    let acc = 0;
    for (let step = bit; step !== 0; step >>= 1) {
      const next = idx + step;
      if (next <= this.n) {
        const nextAcc = acc + (this.tree[next] ?? 0);
        if (nextAcc < target) {
          idx = next;
          acc = nextAcc;
        }
      }
    }
    return Math.min(this.n - 1, idx);
  }
}
