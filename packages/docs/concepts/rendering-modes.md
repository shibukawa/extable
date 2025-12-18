# Rendering Modes

## Overview

Extable supports two rendering modes: **Canvas** (default for performance) and **HTML table** (default for accessibility and testability). The mode can be automatically detected or explicitly configured.

## Canvas Mode (Performance-Optimized)

By default, Extable renders using **Canvas**, similar to Google Sheets and CheetahGrid:

```typescript
const table = new ExtableCore({
  root: document.getElementById('table'),
  defaultData: data,
  schema: schema,
  options: { renderMode: 'canvas' }
});
```

### Advantages

- **High performance**: Renders thousands of cells smoothly using a single canvas element
- **Memory efficient**: No DOM overhead; cells are drawn as pixels
- **Scalability**: Ideal for large datasets and real-time updates
- **Consistent appearance**: Pixel-perfect rendering across browsers

### Trade-offs

- **Not plain text**: Cell content is rendered as pixels, not HTML text
- **Accessibility limitations**: Screen readers cannot easily access cell content (work in progress for deeper accessibility)
- **E2E testing challenges**: Automated tests cannot inspect cell values as HTML elements
- **SEO/bot crawling**: Search engines and AI crawlers cannot index table content

## HTML Mode (Accessibility & Testability)

You can explicitly enable **HTML table mode** for testing, accessibility, and SEO:

```typescript
const table = new ExtableCore({
  root: document.getElementById('table'),
  defaultData: data,
  schema: schema,
  options: { renderMode: 'html' }
});
```

### Advantages

- **Plain HTML**: Content is rendered as `<table>`, `<tr>`, and `<td>` elements
- **E2E testing**: Playwright, Cypress, and other browser automation tools can query cells directly
- **Accessibility**: Screen readers and keyboard navigation work naturally
- **SEO**: Search engines and AI crawlers can index table content
- **Inspectable**: DevTools can inspect cell DOM and attributes

### Trade-offs

- **Performance**: Slower for large datasets (1000+ rows)
- **DOM churn**: Every render updates or rebuilds DOM elements
- **Memory usage**: Each cell is a DOM node with associated overhead

## Auto Mode: Smart Detection

When `renderMode: 'auto'` is used (or omitted), Extable **automatically detects the rendering environment**:

```typescript
// Default behavior (auto mode)
const table = new ExtableCore({
  root: document.getElementById('table'),
  defaultData: data,
  schema: schema,
  options: { renderMode: 'auto' }  // or simply omit this
});
```

### Auto-Detection Logic

The auto-detection checks the **user agent** to determine if the requester is a bot or crawler:

```typescript
// From packages/core/src/index.ts
private chooseRenderer(mode: RenderMode): Renderer {
  if (mode === "auto") {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const isBot =
      /bot|crawl|spider/i.test(ua) ||
      (typeof navigator !== "undefined" &&
        "userAgentData" in navigator &&
        (navigator as any).userAgentData?.brands?.some((b: any) => /bot/i.test(b.brand)));
    return isBot ? new HTMLRenderer(this.dataModel) : new CanvasRenderer(this.dataModel);
  }
  return mode === "html" ? new HTMLRenderer(this.dataModel) : new CanvasRenderer(this.dataModel);
}
```

### Detection Rules

1. **Bot Detection via User-Agent String**:
   - If user agent contains keywords like `bot`, `crawl`, or `spider` (case-insensitive), render as HTML
   - Example: Googlebot, Bingbot, AppleBot, AWS Lambda agents

2. **Bot Detection via User-Agent Client Hints**:
   - Modern browsers support the [User-Agent Client Hints API](https://developer.mozilla.org/en-US/docs/Web/API/User-Agent_Client_Hints_API)
   - If any brand in `navigator.userAgentData.brands` matches a bot pattern, render as HTML

3. **Default for Regular Users**:
   - Regular browser users see Canvas mode for optimal performance

### Common Bot User Agents That Trigger HTML Mode

- Search engines: Googlebot, Bingbot, Baidu, DuckDuckGo, etc.
- AI crawlers: GPTBot, ChatGPT-User, Claude Web, etc.
- Testing frameworks: Playwright, Puppeteer (when launched headless)
- Social media crawlers: FacebookExternalHit, Twitterbot, etc.

## Forcing a Specific Mode

You can override auto-detection by explicitly setting the render mode:

```typescript
// Force HTML mode even for regular browsers
const tableForTesting = new ExtableCore({
  root: document.getElementById('test-table'),
  defaultData: data,
  schema: schema,
  options: { renderMode: 'html' }
});

// Force Canvas mode even for bots (not recommended for public sites)
const tableForPerf = new ExtableCore({
  root: document.getElementById('perf-table'),
  defaultData: data,
  schema: schema,
  options: { renderMode: 'canvas' }
});
```

## When to Use Each Mode

### Use Canvas Mode For

- ✅ **Large datasets**: 1000+ rows with frequent updates
- ✅ **Performance-critical applications**: Real-time dashboards, data exploration
- ✅ **Desktop users**: Primary audience is regular browsers
- ✅ **Mobile web**: Better performance on constrained devices

### Use HTML Mode For

- ✅ **E2E testing**: Automated browser testing with Playwright, Cypress, Selenium
- ✅ **Accessibility requirements**: WCAG compliance, screen reader support
- ✅ **SEO/indexing**: Content needs to be discoverable by search or AI crawlers
- ✅ **Small datasets**: < 100 rows where DOM overhead is negligible
- ✅ **Development/debugging**: Inspecting table state in browser DevTools

## E2E Testing with Extable

When testing Extable in an automated test framework (Playwright, Cypress, etc.), the table **automatically renders in HTML mode** because test runners use headless browsers with bot-like user agents.

For detailed testing strategies and code examples, see [E2E Testing Guide](/guides/unit-testing).

### Example: Playwright Test

```typescript
import { test, expect } from '@playwright/test';

test('can edit cell and verify value', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // The table auto-detects Playwright's user agent and renders as HTML
  const cell = await page.locator('table tr:nth-child(2) td:nth-child(2)');
  
  // You can now query and interact with cells as plain HTML
  await cell.click();
  await page.keyboard.type('New Value');
  await page.keyboard.press('Enter');
  
  const updated = await cell.textContent();
  expect(updated).toBe('New Value');
});
```

## Migration Guide

### From Canvas-Only to Auto Mode

If you have an existing Canvas-only implementation, simply update the configuration:

```typescript
// Before
const table = new ExtableCore({ ..., options: { renderMode: 'canvas' } });

// After (auto mode detects Canvas for users, HTML for bots)
const table = new ExtableCore({ ..., options: { renderMode: 'auto' } });
```

### From HTML-Only to Auto Mode

Similarly, if you have HTML-only rendering:

```typescript
// Before
const table = new ExtableCore({ ..., options: { renderMode: 'html' } });

// After (auto mode uses Canvas for performance, HTML for accessibility)
const table = new ExtableCore({ ..., options: { renderMode: 'auto' } });
```

## Performance Comparison

| Aspect | Canvas | HTML |
|--------|--------|------|
| Rendering speed (1000 cells) | ~16ms | ~200ms |
| Memory usage | Low | High |
| DOM nodes | 1 (canvas) | 1000+ |
| Text selection | Not supported | Native support |
| Screen reader | Limited | Full support |
| E2E testing | Not accessible | Direct element access |
| SEO | Not indexed | Fully indexable |

## Next Steps

- Explore [unit testing strategies](/guides/unit-testing) for Extable components
- Understand the [uncontrolled-only philosophy](/concepts/uncontrolled) for data management

