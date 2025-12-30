# ユニットテスト

extableは、Vitestによるロジック中心のユニットテストと、PlaywrightによるDOM操作のE2Eテストの2つを補完的に使います。

## テスト戦略

### ユニットテスト（Vitest + jsdom）

用途:
- データモデル、数式、バリデーション
- コマンドキューとundo/redo
- ロックマネージャの状態遷移
- ビューのフィルタ/ソート

実行:
```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- core.test.ts

# Watch mode
npm test -- --watch
```

### E2Eテスト（Playwright）

用途:
- HTMLモードのDOM描画
- セル選択、編集、フィルハンドル
- クリック/入力/コピー&ペースト
- マルチユーザーの同期シナリオ
- ビジュアルリグレッション

実行:
```bash
# Install browsers (one-time)
npx playwright install

# Run E2E tests
npx playwright test

# Run specific test file
npx playwright test playwright/demo.spec.ts

# Debug mode (opens inspector)
npx playwright test --debug

# Show browser UI during test
npx playwright test --headed
```

詳細は[Playwright Documentation](https://playwright.dev/docs/intro)を参照してください。

---

## PlaywrightでのE2Eテスト

### HTMLモード描画

jsdom実行時は自動でHTMLモードになります。テストで明示的にHTMLモードにしたい場合:

```typescript
import { test, expect } from "@playwright/test";

test("verify HTML table rendering", async ({ page }) => {
  await page.goto("http://localhost:5173/demo");
  
  // ルートコンテナを待機
  const root = page.locator(".extable-root");  // またはカスタムクラス
  await expect(root).toBeVisible();
  
  // テーブル要素を待機
  const table = page.locator("table");
  await expect(table).toBeVisible();
  
  // HTMLモードを確認
  const htmlMode = await table.getAttribute("data-extable-renderer");
  expect(htmlMode).toBe("html");
});
```

**テーブルルートのクラス**

| Class | Condition |
|-------|-----------|
| `extable-root` | ベースルート（推奨セレクタ） |
| `extable-readonly-all` | テーブル全体がreadonly |
| `extable-loading` | データ読み込み中 |
| `extable-filter-sort-open` | フィルタ/ソートパネルが開いている |
| Custom classes | `defaultClass`から付与 |

### Playwright向け自動HTMLモード（推奨）

`ExtableCore`はUser-Agentにボット文字列が含まれるとHTMLレンダラーを選択します。PlaywrightのUAに`"PlaywrightBot"`を追加することで、UI操作なしでHTMLモードでE2Eできます。

```ts
// playwright.config.ts（抜粋）
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: 'http://127.0.0.1:5173',
    userAgent: `${devices['Desktop Chrome'].userAgent} PlaywrightBot`,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        userAgent: `${devices['Desktop Chrome'].userAgent} PlaywrightBot`,
        launchOptions: { args: ['--headless=old'] },
      },
    },
    // firefox/webkitも必要に応じてUAを追加
  ],
});
```

HTMLモードを検証する例:

```ts
await expect(page.locator('#commit-state')).toContainText('mode=html');
// またはdata-extable-renderer属性を確認
await expect(page.locator('table')).toHaveAttribute('data-extable-renderer', 'html');
```

この方法によりUI操作不要で安定したE2Eが可能です。

### 行・列の識別

#### セル値で探す

```typescript
// ルートコンテナを取得
const root = page.locator(".extable-root");

// 値"Alice"のセルを探す
const cell = root.locator("td:has-text('Alice')");

// このセルを含む行(tr)を取得
const row = cell.locator("xpath=ancestor::tr");

// この行の全セルを取得
const rowCells = row.locator("td");

// 列インデックスを取得
const cellIndex = await cell.locator("xpath=parent::tr/td[contains(., 'Alice')]/preceding-sibling::td").count();
```

#### 行インデックスで指定

```typescript
const root = page.locator(".extable-root");

// データ3行目を取得（ヘッダー除外）
const row = root.locator("table tbody tr").nth(2);

// その行の全セルを取得
const cells = row.locator("td");

// 行内の特定セルを取得
const nameCell = row.locator("td").nth(1);  // 列インデックス1
```

#### 列インデックスで指定

```typescript
const root = page.locator(".extable-root");

// 2列目の全セルを取得（ヘッダー除外）
const columnCells = root.locator("table tbody tr td:nth-child(3)");

// 特定セル: 行1, 列2
const cell = root.locator("table tbody tr").nth(1).locator("td").nth(2);
```

#### 列キーで指定（属性がある場合）

```typescript
const root = page.locator(".extable-root");

// <td data-colkey="name">が描画される前提
const nameColumn = root.locator("td[data-colkey='name']");

// name列の先頭セルを取得
const firstNameCell = root.locator("table tbody tr").nth(0).locator("td[data-colkey='name']");

// name列の全セルを取得
const allNameCells = root.locator("table tbody td[data-colkey='name']");
```

#### 行IDで指定（属性がある場合）

```typescript
const root = page.locator(".extable-root");

// <tr data-rowid="row123">が描画される前提
const row = root.locator("tr[data-rowid='row123']");

// この行のセルを取得
const cells = row.locator("td");
```

### データ取得

#### セル値

```typescript
const root = page.locator(".extable-root");
const cell = root.locator("table tbody tr").nth(0).locator("td").nth(1);

// セルのテキストを取得
const cellValue = await cell.textContent();
console.log(cellValue);  // "Alice"

// innerHTMLを取得（フォーマット含む）
const cellHTML = await cell.innerHTML();

// 編集中ならinput値を取得
const inputValue = await cell.locator("input").inputValue();
```

#### 行データ

```typescript
const root = page.locator(".extable-root");

// 行のセル値を配列で取得
const row = root.locator("table tbody tr").nth(0);
const cellValues = await row.locator("td").allTextContents();
// 戻り値: ["1", "Alice", "30"]
```

#### 列データ

```typescript
const root = page.locator(".extable-root");

// 列の全値を取得
const nameColumn = root.locator("table tbody td[data-colkey='name']");
const nameValues = await nameColumn.allTextContents();
// 戻り値: ["Alice", "Bob", "Charlie"]
```

#### テーブル全体

```typescript
const root = page.locator(".extable-root");

// テーブル全体を2次元配列で取得
const rows = root.locator("table tbody tr");
const rowCount = await rows.count();
const tableData = [];

for (let i = 0; i < rowCount; i++) {
  const cells = rows.nth(i).locator("td");
  const rowData = await cells.allTextContents();
  tableData.push(rowData);
}

console.log(tableData);
// [
//   ["1", "Alice", "30"],
//   ["2", "Bob", "25"],
//   ["3", "Charlie", "28"]
// ]
```

### セル編集

#### 単一セル編集

```typescript
const root = page.locator(".extable-root");

// セルを特定して編集
const cell = root.locator("td[data-colkey='name']").nth(0);

// クリックして編集モードへ
await cell.click();

// 新しい値を入力
await cell.locator("input").fill("NewName");

// 確定（Enter/Tab）
await cell.locator("input").press("Enter");

// 新しい値を確認
const newValue = await cell.textContent();
await expect(newValue).toBe("NewName");
```

#### フィルハンドルで一括

```typescript
const root = page.locator(".extable-root");

// 単一セルでドラッグフィルを再現
const startCell = root.locator("td[data-colkey='value']").nth(0);

// セルをクリック
await startCell.click();

// 値を入力
await startCell.locator("input").fill("100");

// 確定
await startCell.locator("input").press("Enter");

// 確認
const value = await startCell.textContent();
await expect(value).toBe("100");
```

#### 複数セル編集

```typescript
const root = page.locator(".extable-root");

// 複数セルを順に編集
const cells = [
  { row: 0, col: 1, value: "Alice" },
  { row: 1, col: 1, value: "Bob" },
  { row: 2, col: 2, value: "35" }
];

for (const edit of cells) {
  const cell = root.locator("table tbody tr").nth(edit.row).locator("td").nth(edit.col);
  await cell.click();
  await cell.locator("input").fill(edit.value);
  await cell.locator("input").press("Enter");
}
```

### スタイルクラスと属性

#### クラス取得

```typescript
const root = page.locator(".extable-root");
const cell = root.locator("td[data-colkey='name']").nth(0);

// セルのクラス一覧を取得
const classList = await cell.getAttribute("class");
console.log(classList);  // "ext-cell ext-readonly ext-error"

// 特定クラスの有無を確認
const isReadonly = await cell.evaluate(el => el.classList.contains("ext-readonly"));
const isError = await cell.evaluate(el => el.classList.contains("ext-error"));
```

#### 計算済みスタイル取得

```typescript
const root = page.locator(".extable-root");
const cell = root.locator("td[data-colkey='value']").nth(0);

// 計算済みCSSを取得
const bgColor = await cell.evaluate(el => window.getComputedStyle(el).backgroundColor);
const textColor = await cell.evaluate(el => window.getComputedStyle(el).color);

console.log({ bgColor, textColor });  // { bgColor: "rgb(255, 0, 0)", textColor: "rgb(0, 0, 0)" }
```

#### スタイル条件の検証

```typescript
const root = page.locator(".extable-root");
const cell = root.locator("td[data-colkey='status']").nth(0);

// エラー状態のハイライトを確認
await expect(cell).toHaveClass(/ext-error/);

// readonlyを確認
await expect(cell).toHaveClass(/ext-readonly/);

// 背景色（条件付き書式）を確認
const hasRedBg = await cell.evaluate(el => {
  const style = window.getComputedStyle(el);
  return style.backgroundColor.includes("rgb(255"); // 赤系
});
await expect(hasRedBg).toBe(true);
```

### 利用可能なクラス

extableはセルに次のクラスを付与します。

#### 状態クラス

| Class | Condition | Usage |
|-------|-----------|-------|
| `ext-selected` | セル選択中 | ハイライト表示 |
| `ext-editing` | 編集中 | 入力フィールド表示 |
| `ext-readonly` | readonlyセル | 入力無効 |
| `ext-error` | 数式/検証エラー | 赤枠 |
| `ext-warning` | 数式警告（`[value, Error]`） | 黄色の三角や警告アイコン |

#### 列タイプクラス

| Class | Condition |
|-------|-----------|
| `ext-type-string` | Column type is "string" |
| `ext-type-number` | Column type is "number" |
| `ext-type-boolean` | Column type is "boolean" |
| `ext-type-date` | Column type is "date" |
| `ext-type-datetime` | Column type is "datetime" |
| `ext-type-enum` | Column type is "enum" |
| `ext-type-tag` | Column type is "tag" |

#### フォーマットクラス

| Class | Condition |
|-------|-----------|
| `ext-align-left` | Column alignment left |
| `ext-align-right` | Column alignment right |
| `ext-align-center` | Column alignment center |
| `ext-strikethrough` | Strikethrough style applied |
| `ext-underline` | Underline style applied |
| `ext-bold` | Bold style applied |
| `ext-italic` | Italic style applied |

#### 行状態クラス

| Class | Condition |
|-------|-----------|
| `ext-row-locked` | Row is locked (multi-user) |
| `ext-row-readonly` | Row is readonly |
| `ext-row-pending` | Row has pending edits (commit mode) |

### テスト例

#### テスト1: セル表示

```typescript
test("display cell value correctly", async ({ page }) => {
  await page.goto("http://localhost:5173/demo");
  
  const root = page.locator(".extable-root");
  
  // テーブルを待機
  await expect(root).toBeVisible();
  
  // 最初のnameセルを取得
  const nameCell = root.locator("table tbody tr").nth(0).locator("td").nth(1);
  
  // 値を確認
  await expect(nameCell).toHaveText("Alice");
});
```

#### テスト2: セル編集

```typescript
test("edit cell and persist value", async ({ page }) => {
  await page.goto("http://localhost:5173/demo");
  
  const root = page.locator(".extable-root");
  const cell = root.locator("table tbody tr").nth(0).locator("td").nth(1);
  
  // 編集
  await cell.click();
  await cell.locator("input").fill("UpdatedName");
  await cell.locator("input").press("Enter");
  
  // 新しい値を確認
  await expect(cell).toHaveText("UpdatedName");
});
```

#### テスト3: Readonlyセル

```typescript
test("readonly cell prevents editing", async ({ page }) => {
  await page.goto("http://localhost:5173/demo");
  
  const root = page.locator(".extable-root");
  const readonlyCell = root.locator("td[data-colkey='id']").nth(0);
  
  // クラスを確認
  await expect(readonlyCell).toHaveClass(/ext-readonly/);
  
  // 編集できないことを確認
  await readonlyCell.click();
  
  // inputが存在しない/無効を確認
  const input = readonlyCell.locator("input");
  await expect(input).not.toBeVisible();
});
```

#### テスト4: エラー表示

```typescript
test("invalid formula shows error state", async ({ page }) => {
  await page.goto("http://localhost:5173/demo");
  
  const root = page.locator(".extable-root");
  const cell = root.locator("td[data-colkey='computed']").nth(0);
  
  // エラークラスを確認
  await expect(cell).toHaveClass(/ext-error/);
  
  // 赤枠などのスタイルを確認
  const hasBorder = await cell.evaluate(el => {
    const style = window.getComputedStyle(el);
    return style.borderColor.includes("rgb(255, 0, 0)"); // 赤
  });
  
  await expect(hasBorder).toBe(true);
});
```

#### テスト5: 列データ取得

```typescript
test("retrieve all values from column", async ({ page }) => {
  await page.goto("http://localhost:5173/demo");
  
  const root = page.locator(".extable-root");
  const ageColumn = root.locator("table tbody td[data-colkey='age']");
  const ages = await ageColumn.allTextContents();
  
  await expect(ages).toEqual(["30", "25", "28"]);
});
```

#### テスト6: 条件付き書式

```typescript
test("apply conditional formatting based on value", async ({ page }) => {
  await page.goto("http://localhost:5173/demo");
  
  const root = page.locator(".extable-root");
  const ageCell = root.locator("table tbody tr").nth(0).locator("td[data-colkey='age']");
  
  // age > 25なら背景は緑
  const bgColor = await ageCell.evaluate(el => {
    return window.getComputedStyle(el).backgroundColor;
  });
  
  await expect(bgColor).toMatch(/rgb\(0, 255, 0\)/);  // 緑
});
```

---

## Vitestでのユニットテスト

### 基本構成

```typescript
// core.test.ts
import { describe, it, expect } from "vitest";
import { ExtableCore } from "../src/index";

describe("Table", () => {
  it("initializes with data", () => {
    const data = {
      rows: [
        { id: "1", name: "Alice", age: 30 },
        { id: "2", name: "Bob", age: 25 }
      ]
    };
    
    const table = new ExtableCore({
      root: document.createElement("div"),
      defaultData: data,
      defaultView: {},
      schema: {
        columns: [{ key: "name", header: "Name", type: "string" }]
      }
    });
    
    expect(table.getAllRows()).toHaveLength(2);
  });
});
```

### データモデルのテスト

```typescript
describe("DataModel", () => {
  it("sets and retrieves cell values", () => {
    const table = new ExtableCore({ root, defaultData, defaultView, schema, options: { editMode: "direct" } });
    
    // セル値を設定
    table.setCellValue("row1", "name", "NewValue");
    
    // 値を確認
    const value = table.getCell("row1", "name");
    expect(value).toBe("NewValue");
  });
});
```

### 数式のテスト

```typescript
describe("Formulas", () => {
  it("computes cell value from formula", () => {
    const schema = {
      columns: [
        { key: "qty", type: "number" },
        { key: "price", type: "number" },
        {
          key: "total",
          type: "number",
          formula: (row) => row.qty * row.price
        }
      ]
    };
    
    const data = [{ id: "1", qty: 5, price: 10 }];
    
    const table = new ExtableCore({
      root: document.createElement("div"),
      defaultData: data,
      defaultView: {},
      schema
    });
    
    const rowId = table.getAllRows()[0].id;
    const total = table.getCell(rowId, "total");
    expect(total).toBe(50);
  });
});
```

### Undo/Redoのテスト

```typescript
describe("Undo/Redo in Commit Mode", () => {
  it("undoes a cell edit", async () => {
    const table = new ExtableCore({
      root: document.createElement("div"),
      defaultData: [{ id: "1", name: "Alice" }],
      defaultView: {},
      schema: { columns: [{ key: "name", type: "string" }] },
      options: { editMode: "commit" }
    });
    
    const rowId = table.getAllRows()[0].id;

    // セルを編集
    table.setCellValue(rowId, "name", "Bob");
    expect(table.canUndo()).toBe(true);
    
    // 取り消し
    table.undo();
    const value = table.getCell(rowId, "name");
    expect(value).toBe("Alice");
  });
  
  it("clears history after commit", async () => {
    const table = new ExtableCore({
      root: document.createElement("div"),
      defaultData: [{ id: "1", name: "Alice" }],
      defaultView: {},
      schema: { columns: [{ key: "name", type: "string" }] },
      options: {
        editMode: "commit",
        server: mockServer,
        user: { id: "user1", name: "User One" }
      }
    });
    
    const rowId = table.getAllRows()[0].id;

    // 編集してcommit
    table.setCellValue(rowId, "name", "Bob");
    await table.commit();
    
    // 履歴がクリアされる
    expect(table.canUndo()).toBe(false);
  });
});
```

---

## ベストプラクティス

1. **HTMLモードを優先**: E2EではHTMLモードでDOMアクセス性を確保
2. **明示的な待機**: 操作前にセレクタ待ち
3. **data属性の付与**: `data-colkey`や`data-rowid`で安定したセレクタ
4. **テストの独立性**: 依存しない構成
5. **モックサーバー**: E2Eで通信を制御
6. **重要経路を優先**: 編集/commit/エラー処理
7. **アクセシビリティ**: セマンティックHTMLやARIAの確認

## 関連項目

- [Playwright Docs](https://playwright.dev)
- [Vitest Docs](https://vitest.dev)
- [HTMLモードガイド](/ja/guides/unit-testing)
- [編集モード](/ja/guides/editmode)
