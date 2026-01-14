# SSR API Reference

サーバーサイドレンダリングは `@extable/core/ssr` を使って初期表示用の静的HTMLを生成します。React/VueラッパーはこのHTMLをハイドレーションせず、クライアント側でDOMを再構築します。

## renderTableHTML

```typescript
import { renderTableHTML } from "@extable/core/ssr";
```

```typescript
renderTableHTML<T>(options: SSROptions<T>): SSRResult
```

データとスキーマから静的HTMLテーブルを生成します。

### Parameters

```typescript
export interface SSROptions<T extends Record<string, unknown> = Record<string, unknown>> {
  data: DataSet<T>;
  schema: Schema;
  cssMode?: "inline" | "external" | "both";
  wrapWithRoot?: boolean;
  defaultClass?: string | string[];
  defaultStyle?: Partial<CSSStyleDeclaration>;
  includeStyles?: boolean;
  includeRawAttributes?: boolean;
}
```

**Notes**:
- `cssMode`:
  - `inline`: すべてのスタイルを要素の `style` 属性に埋め込みます。
  - `external`: ベースCSSを `result.css` で返し、HTML側は最小の属性だけ持ちます。
  - `both`: 重要なスタイルをインライン化し、ベースCSSを返します。
- `wrapWithRoot` はクライアント描画と同じルート構造（`extable-root`/`extable-shell`/`extable-viewport`）を出力します。
- `defaultClass` と `defaultStyle` は最外層の要素に付与されます（wrap時はルート、未wrap時はtable）。
- `includeStyles` はセルのスタイル/診断表示/フォーマット済み表示を出力します（デフォルト: false）。
- `includeRawAttributes` は `data-raw` の出力を制御します（デフォルト: false）。
- バリデーションメッセージはSSRには出力しません。インタラクティブな検証はクライアント側で処理してください。

### Return value

```typescript
export interface SSRResult {
  html: string;
  css?: string;
  metadata: {
    rowCount: number;
    columnCount: number;
    hasFormulas: boolean;
    hasConditionalStyles: boolean;
    errors: Array<{ row: number; col: string; message: string }>;
  };
}
```

### Example

```typescript
const result = renderTableHTML({
  data: { rows: [{ id: 1, name: "Alice", score: 90 }] },
  schema: {
    columns: [
      { key: "id", type: "number", label: "ID" },
      { key: "name", type: "string", label: "Name" },
      {
        key: "score",
        type: "number",
        label: "Score",
        conditionalStyle: (row) => ({
          textColor: row.score >= 80 ? "#1f7a1f" : "#444444",
        }),
      },
    ],
  },
  cssMode: "both",
  wrapWithRoot: true,
  defaultClass: "extable",
  includeStyles: true,
});

console.log(result.html);
```

### SSR vs Client Render

- SSR出力は初期描画とSEO向けの静的HTMLです。
- クライアント描画（ExtableCore / React / Vue）はDOMを再構築します。
- 本当のDOMハイドレーションが必要なら専用APIが必要です（現時点では未提供）。

## HTML structure and caveats

Extableには「SSRで生成されるテーブルHTML」と「クライアントが生成するDOM」の2種類の出力があります。

### SSR output (renderTableHTML)

クライアント描画の見た目に合わせるには、同じルート構造で包む必要があります。`wrapWithRoot` を有効にすると自動で付与されます。

```html
<div class="extable-root">
  <div class="extable-shell">
    <div class="extable-viewport">
      <table data-extable-renderer="html">
        <thead>...</thead>
        <tbody>...</tbody>
      </table>
    </div>
    <div class="extable-overlay-layer"></div>
  </div>
</div>
```

Notes:
- 見た目を合わせるには `@extable/core/style.css` を読み込む必要があります。
- `extable-root` で包まないとExtableの標準CSSが十分に効かず、レイアウトが崩れる可能性があります。
- ホスト側のCSS（例: tableのストライプ）がSSRテーブルに当たる場合は上書きが必要です。

テーブルだけを返したい場合は `wrapWithRoot` を無効にします。

```html
<table data-extable-renderer="html">
  <thead>...</thead>
  <tbody>...</tbody>
</table>
```

### Client-rendered DOM (ExtableCore / React / Vue)

クライアント描画ではテーブルがラッパーの中に配置されます。以下は簡略化した構造です。

```html
<div class="extable-root">
  <div class="extable-shell">
    <div class="extable-viewport">
      <table data-extable-renderer="html">...</table>
    </div>
    <div class="extable-overlay-layer"></div>
  </div>
</div>
```

Notes:
- ルート要素はマウント先で、Extableが `extable-root` を付与します。
- `.extable-viewport` がスクロールとサイズの役割を持ち、HTMLモードのテーブルはその中に入ります。
- Canvasモードは内部構造が異なりますが、ルートとシェルは同じです。
