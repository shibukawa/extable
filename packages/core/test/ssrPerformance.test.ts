import { describe, expect, test } from "vitest";
import { renderTableHTML } from "../src/ssr";

describe("ssr performance", () => {
  test("renders 1000x20 within budget", () => {
    const rows = 1000;
    const cols = 20;
    const data: Record<string, number>[] = [];
    for (let r = 0; r < rows; r += 1) {
      const row: Record<string, number> = {};
      for (let c = 0; c < cols; c += 1) {
        row[`c${c}`] = r * c;
      }
      data.push(row);
    }

    const schema = {
      columns: Array.from({ length: cols }, (_, c) => ({
        key: `c${c}`,
        type: "number" as const,
      })),
    };

    const start = Date.now();
    const result = renderTableHTML({ data, schema });
    const elapsed = Date.now() - start;

    const budgetMs = Number(process.env.SSR_BUDGET_MS ?? 100);
    expect(elapsed).toBeLessThan(budgetMs);
    expect(result.metadata.rowCount).toBe(rows);
    expect(result.metadata.columnCount).toBe(cols);
  });
});
