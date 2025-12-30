# レンダリングモード

## 概要

Extableは2つのレンダリングモードをサポートします。**Canvas**（パフォーマンス重視のデフォルト）と**HTMLテーブル**（アクセシビリティとテスト性重視）です。モードは自動検出または明示指定が可能です。

## Canvasモード（パフォーマンス重視）

デフォルトでは、ExtableはGoogle SheetsやCheetahGridと同様に**Canvas**で描画します。

```typescript
const table = new ExtableCore({
  root: document.getElementById('table'),
  defaultData: data,
  schema: schema,
  options: { renderMode: 'canvas' }
});
```

### 利点

- **高いパフォーマンス**: 1枚のCanvasで数千セルを滑らかに描画
- **メモリ効率**: DOMが不要で、セルはピクセル描画
- **スケーラビリティ**: 大規模データやリアルタイム更新に最適
- **一貫した見た目**: ブラウザ差の少ないピクセル描画

### トレードオフ

- **プレーンテキストではない**: セル内容はHTMLテキストではなくピクセル
- **アクセシビリティ制限**: スクリーンリーダーの対応は限定的（改善中）
- **E2Eテストの難しさ**: HTML要素としてセルを検査できない
- **SEO/クローラ**: 検索エンジンやAIクローラがテーブルを解析できない

## HTMLモード（アクセシビリティ&テスト性）

テスト、アクセシビリティ、SEO向けに**HTMLテーブルモード**を明示的に有効化できます。

```typescript
const table = new ExtableCore({
  root: document.getElementById('table'),
  defaultData: data,
  schema: schema,
  options: { renderMode: 'html' }
});
```

### 利点

- **プレーンHTML**: `<table>`、`<tr>`、`<td>`として描画
- **E2Eテスト**: PlaywrightやCypressなどでセルを直接クエリ可能
- **アクセシビリティ**: スクリーンリーダーとキーボード操作が自然
- **SEO**: 検索エンジンやAIクローラが内容をインデックス可能
- **検査しやすい**: DevToolsでDOMと属性を確認できる

### トレードオフ

- **パフォーマンス**: 大規模データ（1000行以上）では遅くなる
- **DOM更新コスト**: 再描画でDOMが大量に更新される
- **メモリ使用量**: セルごとにDOMノードが必要

## 自動モード: スマート検出

`renderMode: 'auto'`を使うか省略すると、Extableが**レンダリング環境を自動検出**します。

```typescript
// デフォルト動作（autoモード）
const table = new ExtableCore({
  root: document.getElementById('table'),
  defaultData: data,
  schema: schema,
  options: { renderMode: 'auto' }  // もしくは省略
});
```

### 自動検出ロジック

自動検出は**ユーザーエージェント**からボット/クローラを判定します。

```typescript
// packages/core/src/index.ts より
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

### 判定ルール

1. **ユーザーエージェント文字列によるボット判定**:
   - `bot`、`crawl`、`spider`などを含む場合はHTML
   - 例: Googlebot、Bingbot、AppleBot、AWS Lambda agents

2. **User-Agent Client Hintsによる判定**:
   - [User-Agent Client Hints API](https://developer.mozilla.org/en-US/docs/Web/API/User-Agent_Client_Hints_API)を利用
   - `navigator.userAgentData.brands`にボットパターンが含まれる場合はHTML

3. **一般ユーザー**:
   - 通常ブラウザはCanvasモードで高速化

### HTMLモードになる代表的なユーザーエージェント

- 検索エンジン: Googlebot、Bingbot、Baidu、DuckDuckGoなど
- AIクローラ: GPTBot、ChatGPT-User、Claude Webなど
- テストフレームワーク: Playwright、Puppeteer（ヘッドレス）
- SNSクローラ: FacebookExternalHit、Twitterbotなど

## 特定モードを強制する

自動検出を上書きして明示的に指定できます。

```typescript
// 通常ブラウザでもHTMLモードを強制
const tableForTesting = new ExtableCore({
  root: document.getElementById('test-table'),
  defaultData: data,
  schema: schema,
  options: { renderMode: 'html' }
});

// ボットでもCanvasモードを強制（公開サイトでは非推奨）
const tableForPerf = new ExtableCore({
  root: document.getElementById('perf-table'),
  defaultData: data,
  schema: schema,
  options: { renderMode: 'canvas' }
});
```

## どのモードを使うべきか

### Canvasモードが向くケース

- ✅ **大規模データ**: 1000行以上で頻繁に更新される
- ✅ **パフォーマンス重視**: リアルタイムダッシュボードや探索系UI
- ✅ **デスクトップ中心**: 主なユーザーが通常のブラウザ
- ✅ **モバイルWeb**: 制約のある端末での性能を優先

### HTMLモードが向くケース

- ✅ **E2Eテスト**: Playwright、Cypress、Seleniumなどの自動テスト
- ✅ **アクセシビリティ要件**: WCAG対応やスクリーンリーダー
- ✅ **SEO/インデックス**: 検索/AIクローラに内容を見せたい
- ✅ **小規模データ**: 100行未満でDOM負荷が軽い
- ✅ **開発/デバッグ**: DevToolsでテーブル状態を確認したい

## ExtableのE2Eテスト

PlaywrightやCypressなどの自動テストでは、ヘッドレスブラウザがボットとして検知され、**自動的にHTMLモード**になります。

テスト方針やコード例は[ユニットテストガイド](/ja/guides/unit-testing)を参照してください。

### 例: Playwrightテスト

```typescript
import { test, expect } from '@playwright/test';

test('can edit cell and verify value', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // テーブルはPlaywrightのUAを自動検出しHTMLで描画
  const cell = await page.locator('table tr:nth-child(2) td:nth-child(2)');
  
  // プレーンHTMLとしてセルを取得/操作できる
  await cell.click();
  await page.keyboard.type('New Value');
  await page.keyboard.press('Enter');
  
  const updated = await cell.textContent();
  expect(updated).toBe('New Value');
});
```

## 移行ガイド

### Canvas専用からAutoモードへ

既存がCanvas専用なら、設定を変更するだけでOKです。

```typescript
// 変更前
const table = new ExtableCore({ ..., options: { renderMode: 'canvas' } });

// 変更後（autoはユーザーにCanvas、ボットにHTML）
const table = new ExtableCore({ ..., options: { renderMode: 'auto' } });
```

### HTML専用からAutoモードへ

同様に、HTML専用からの移行も簡単です。

```typescript
// 変更前
const table = new ExtableCore({ ..., options: { renderMode: 'html' } });

// 変更後（autoは性能にCanvas、アクセシビリティにHTML）
const table = new ExtableCore({ ..., options: { renderMode: 'auto' } });
```

## パフォーマンス比較

| 項目 | Canvas | HTML |
|--------|--------|------|
| 描画速度（1000セル） | ~16ms | ~200ms |
| メモリ使用量 | 低 | 高 |
| DOMノード数 | 1（canvas） | 1000+ |
| テキスト選択 | 非対応 | ネイティブ対応 |
| スクリーンリーダー | 制限あり | 完全対応 |
| E2Eテスト | 直接アクセス不可 | 直接要素にアクセス可能 |
| SEO | インデックス不可 | インデックス可能 |

## 次のステップ

- Extableの[ユニットテスト戦略](/ja/guides/unit-testing)を確認
- データ管理のための[アンコントロールド専用の思想](/ja/concepts/uncontrolled)を理解
