export function parseClipboardGrid(payload: { html: string; tsv: string; text: string }):
  | string[][]
  | null {
  const fromHtml = parseHtmlTable(payload.html);
  if (fromHtml) return fromHtml;
  const raw = payload.tsv || payload.text;
  return parseTsv(raw);
}

export function parseTsv(text: string): string[][] | null {
  const trimmed = text.replace(/\r\n$/, "").replace(/\n$/, "");
  if (!trimmed) return null;
  const rows = trimmed.split(/\r\n|\n/);
  return rows.map((r) => r.split("\t"));
}

export function parseHtmlTable(html: string): string[][] | null {
  if (!html) return null;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const table = doc.querySelector("table");
    if (!table) return null;
    const trs = Array.from(table.querySelectorAll("tr"));
    if (trs.length === 0) return null;
    const grid: string[][] = [];
    for (const tr of trs) {
      const cells = Array.from(tr.querySelectorAll("th,td"));
      if (
        cells.some(
          (c) => (c as HTMLTableCellElement).rowSpan > 1 || (c as HTMLTableCellElement).colSpan > 1,
        )
      ) {
        return null;
      }
      grid.push(cells.map((c) => (c.textContent ?? "").trim()));
    }
    return grid.length ? grid : null;
  } catch {
    return null;
  }
}
