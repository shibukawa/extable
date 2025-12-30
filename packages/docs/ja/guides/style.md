# スタイルガイド

Extableは複数レベルのスタイル制御を提供します。スキーマでの列フォーマット、行データに応じた条件付きスタイル、コアCSSによる基本UIです。

## 基本UIスタイル

コアライブラリは`@extable/core/styles.css`に標準テーマを含みます。

- テーブル枠とグリッド
- ヘッダスタイル（背景、太字、配置）
- セル背景（通常/選択/編集状態）
- 文字色とタイポグラフィ
- 編集時の入力フィールド
- スクロールバーとリサイズハンドル

アプリでCSSを読み込みます。

```typescript
import '@extable/core/styles.css';
```

CSS変数を上書きしてテーマを調整できます。

```css
:root {
  --extable-header-bg: #f5f5f5;
  --extable-header-text: #333;
  --extable-border-color: #e0e0e0;
  --extable-cell-selected-bg: #e3f2fd;
  --extable-cell-edited-bg: #fff9c4;
  --extable-error-outline: #d32f2f;
}
```

## 列単位フォーマット

スキーマの`format`で静的フォーマットを定義します。

```typescript
{
  key: 'salary',
  header: 'Annual Salary',
  type: 'number',
  style: {
    align: 'right',                    // 配置: 'left' | 'center' | 'right'
    textColor: '#1976d2',              // Hexカラー
    backgroundColor: '#e3f2fd',             // Hex背景色
    bold: true,                        // 太字
    italic: false,                     // 斜体
    decorations: {
      underline: false,
      strikethrough: false
    }
  }
}
```

### formatプロパティ

| プロパティ | 型 | 選択肢 | 目的 |
|----------|------|---------|---------|
| `align` | string | 'left' \| 'center' \| 'right' | 水平方向の配置 |
| `textColor` | string | Hex color (#RRGGBB) | 文字色 |
| `backgroundColor` | string | Hex color (#RRGGBB) | 背景色 |
| `bold` | boolean | true \| false | 太字 |
| `italic` | boolean | true \| false | 斜体 |
| `decorations.underline` | boolean | true \| false | 下線 |
| `decorations.strikethrough` | boolean | true \| false | 取り消し線 |

### 例

右寄せの金額（桁区切り）:

```typescript
{
  key: 'revenue',
  header: 'Revenue',
  type: 'number',
  format: { scale: 2, thousandSeparator: true },
  style: { align: 'right', textColor: '#2e7d32' }  // 緑
}
```

中央寄せのステータス:

```typescript
{
  key: 'status',
  header: 'Status',
  type: 'enum',
  enum: { options: ['Active', 'Inactive', 'Pending'] },
  style: {
    align: 'center',
    backgroundColor: '#f0f4c3',
    bold: true
  }
}
```

readonlyのID列:

```typescript
{
  key: 'id',
  header: 'ID',
  type: 'number',
  readonly: true,
  style: {
    align: 'center',
    textColor: '#999',
    italic: true
  }
}
```

## 条件付きスタイル

行データに応じて動的にスタイルを適用します。詳細は[条件付きスタイルガイド](/ja/guides/conditional-style)を参照してください。

```typescript
{
  key: 'score',
  header: 'Score',
  type: 'number',
  conditionalStyle: (row) => {
    if (row.score >= 90) return { backgroundColor: '#c8e6c9', bold: true };
    if (row.score < 50) return { backgroundColor: '#ffcdd2' };
    return null;
  }
}
```

## パフォーマンス考慮

- 列`format`は静的で、列設定時に一度だけ適用
- `conditionalStyle`は表示行ごとに1回実行
- 高コスト処理は避ける

## 行単位のスタイル {#row-level-styling}

`schema.row`で行全体にスタイルを適用できます。

```typescript
{
  row: {
    conditionalStyle: (row) => {
      if (row.status === 'archived') return { backgroundColor: '#f5f5f5', italic: true };
      if (row.isSelected) return { backgroundColor: '#e3f2fd', bold: true };
      return null;
    }
  },
  columns: [
    // 通常列...
    { key: 'id', header: '#', type: 'number' },
    { key: 'name', header: 'Name', type: 'string' }
  ]
}
```

**ポイント:**
- `schema.row`は行スタイル用（列ではない）
- `conditionalStyle`は行全体のオブジェクトを受け取る
- 返したスタイルは行内すべてに適用
- 行スタイルは列の`conditionalStyle`より優先

行単位の例は[条件付きスタイルガイド](/ja/guides/conditional-style#row-level-conditional-formatting)を参照。

## 行単位のreadonly

データに`_readonly`を付与して行全体をreadonlyにできます。

```typescript
const data = {
  rows: [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com', _readonly: true },  // 行全体がreadonly
    { id: 3, name: 'Charlie', email: 'charlie@example.com' }
  ]
};
```

**挙動:**
- `_readonly: true`の行は編集不可
- クリックで選択はできるが編集モードに入らない
- 列の`readonly`は行設定とは独立

### 使用例

**履歴ロック:**

```typescript
const data = {
  rows: [
    { id: 1, date: '2025-01-01', amount: 1000, _readonly: false },    // 編集可
    { id: 2, date: '2024-12-01', amount: 5000, _readonly: true },     // ロック済み（過去月）
    { id: 3, date: '2024-11-01', amount: 3000, _readonly: true }      // ロック済み（過去月）
  ]
};
```

**ロール別権限:**

```typescript
const data = {
  rows: userRecords.map(user => ({
    ...user,
    _readonly: currentUser.role !== 'admin'  // 管理者のみ編集可
  }))
};
```

**行スタイルと併用:**

```typescript
{
  row: {
    conditionalStyle: (row) => {
      if (row._readonly) {
        return { backgroundColor: '#f5f5f5', textColor: '#999' };  // 視覚的な手掛かり
      }
      return null;
    }
  },
  columns: [
    // ... 他の列
  ]
}
```

## スタイル優先順位

Extableは次の順で適用します（後が優先）。

1. **基本UI CSS**（`styles.css`）
2. **列フォーマット**（列全体）
3. **行`conditionalStyle`**（`schema.row`）
4. **セル`conditionalStyle`**（列ごと）
5. **セル状態**（選択/編集中）
6. **エラー状態**（無効値の赤枠）

## アクセシビリティ注意

- 色だけで意味を伝えない（太字やアイコンも併用）
- コントラストはWCAG AAを満たす
- スクリーンリーダーでの意味伝達を確認

## 次のステップ

- [条件付きスタイル](/ja/guides/conditional-style)
- [データ型とフォーマット](/ja/guides/data-format)
- [数式による計算](/ja/guides/formulas)
