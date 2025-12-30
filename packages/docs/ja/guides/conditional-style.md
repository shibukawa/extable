# 条件付き書式ガイド

条件付き書式は、セル値や行状態に応じて動的にスタイルを適用します。静的な列フォーマットとは異なり、レンダリング時に関数が評価されます。

## セル単位の条件付き書式

列定義の`conditionalStyle`でセルごとのスタイルを返します。

```typescript
{
  key: 'score',
  header: 'Score',
  type: 'number',
  conditionalStyle: (row) => {
    if (row.score >= 90) {
      return { backgroundColor: '#c8e6c9', bold: true };     // 緑+太字
    }
    if (row.score < 50) {
      return { backgroundColor: '#ffcdd2', textColor: '#c62828' };  // 赤
    }
    if (row.score < 70) {
      return { backgroundColor: '#ffe0b2' };                 // オレンジ
    }
    return null;  // デフォルトスタイル
  }
}
```

### conditionalStyleの契約

- **入力:** 現在行の`row`
- **戻り値:** `StyleObject | null`
  - `StyleObject`: このスタイルを適用
  - `null`: デフォルトスタイル

## 行単位の条件付き書式 {#row-level-conditional-formatting}

`schema.row`で行全体に適用します。詳細は[行単位スタイル](/ja/guides/style#row-level-styling)を参照してください。

```typescript
{
  row: {
    conditionalStyle: (row) => {
      if (row.status === 'archived') return { backgroundColor: '#f5f5f5', italic: true };
      if (row.status === 'active') return { backgroundColor: '#e8f5e9' };
      return null;
    }
  }
}
```

## ユースケース

### パフォーマンスダッシュボード

稼働率に応じて色分けします。

```typescript
{
  key: 'uptime',
  header: 'Uptime %',
  type: 'number',
  format: { scale: 2 },
  conditionalStyle: (row) => {
    if (row.uptime >= 99.9) return { backgroundColor: '#c8e6c9', bold: true };
    if (row.uptime >= 99) return { backgroundColor: '#e8f5e9' };
    if (row.uptime >= 95) return { backgroundColor: '#fff9c4' };
    return { backgroundColor: '#ffccbc', textColor: '#d84315' };
  }
}
```

### リスクレベルの強調

```typescript
{
  key: 'riskLevel',
  header: 'Risk Level',
  type: 'enum',
  enum: { options: ['Low', 'Medium', 'High', 'Critical'] },
  conditionalStyle: (row) => {
    const colors = {
      'Low': '#c8e6c9',
      'Medium': '#fff9c4',
      'High': '#ffe0b2',
      'Critical': '#ffcdd2'
    };
    return { backgroundColor: colors[row.riskLevel] || null };
  }
}
```

### 複数列の相関

```typescript
{
  key: 'variance',
  header: 'Budget Variance',
  type: 'number',
  format: { scale: 2 },
  conditionalStyle: (row) => {
    const diff = row.actual - row.budgeted;
    const percentVariance = (diff / row.budgeted) * 100;
    
    if (percentVariance > 10) {
      return { backgroundColor: '#ffcdd2', textColor: '#c62828', bold: true };
    }
    if (percentVariance < -10) {
      return { backgroundColor: '#c8e6c9' };
    }
    return null;
  }
}
```

### 期限の緊急度

```typescript
{
  key: 'dueDate',
  header: 'Due Date',
  type: 'date',
  conditionalStyle: (row) => {
    const today = new Date();
    const dueDate = new Date(row.dueDate);
    const daysUntilDue = (dueDate - today) / (1000 * 60 * 60 * 24);
    
    if (daysUntilDue < 0) return { backgroundColor: '#ffcdd2', textColor: '#c62828' };  // 期限超過
    if (daysUntilDue < 3) return { backgroundColor: '#ffe0b2' };                         // 緊急
    if (daysUntilDue < 7) return { backgroundColor: '#fff9c4' };                         // まもなく
    return null;
  }
}
```

### データ品質

```typescript
{
  key: 'email',
  header: 'Email',
  type: 'string',
  conditionalStyle: (row) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!row.email || !emailRegex.test(row.email)) {
      return { backgroundColor: '#ffcdd2', textColor: '#c62828', bold: true };
    }
    return null;
  }
}
```

### ステータスで行全体を強調

```typescript
{
  row: {
    conditionalStyle: (row) => {
      if (row.status === 'pending') return { backgroundColor: '#fff9c4' };      // 黄
      if (row.status === 'approved') return { backgroundColor: '#c8e6c9' };     // 緑
      if (row.status === 'rejected') return { backgroundColor: '#ffcdd2' };     // 赤
      return null;
    }
  }
}
```

### 交互行の色分け

```typescript
{
  row: {
    conditionalStyle: (row) => (row.id % 2 === 0 ? { backgroundColor: '#fafafa' } : null)
  }
}
```

## パフォーマンス考慮

### 実行モデル

- `conditionalStyle`は**表示行ごとにレンダリング時1回**実行
- トリガー:
  - 初期ロード
  - データ変更（編集/貼付/undo/redo）
  - 列リサイズ/スクロール
  - ビュー変更（フィルタ/ソート）

### 最適化の指針

**DO:**
- 条件分岐をシンプルに
- 派生値はデータ層で計算
- ルックアップをキャッシュ
- デフォルトは`null`を返す

**DON'T:**
- 重い計算を実行
- API呼び出し
- グローバル状態参照
- 毎回新しいオブジェクトを生成
- 毎回正規表現をコンパイル

### 最適化例

```typescript
// ❌ 非効率: 毎回正規表現を再生成
conditionalStyle: (row) => {
  if (!new RegExp(row.pattern).test(row.value)) {
    return { backgroundColor: '#ffcdd2' };
  }
  return null;
}

// ✅ 効率的: 事前コンパイル
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 列定義内で:
conditionalStyle: (row) => {
  if (!emailRegex.test(row.email)) {
    return { backgroundColor: '#ffcdd2' };
  }
  return null;
}
```

## スタイルの優先順位

Extableは次の順で適用します（後が優先）。

1. **基本UI CSS**（`styles.css`）
2. **列フォーマット**（静的`format`）
3. **行`conditionalStyle`**（`schema.row`）
4. **セル`conditionalStyle`**（列ごとの関数）
5. **セル状態**（選択/編集）
6. **エラー状態**（無効値の赤枠）

## スタイルオプション

`conditionalStyle`で使えるプロパティ:

| プロパティ | 型 | 例 |
|----------|------|---------|
| `textColor` | string (hex) | `'#d32f2f'` |
| `background` | string (hex) | `'#c8e6c9'` |
| `bold` | boolean | `true` |
| `italic` | boolean | `false` |
| `align` | string | `'center'` \| `'left'` \| `'right'` |
| `decorations.underline` | boolean | `true` |
| `decorations.strikethrough` | boolean | `false` |

## エラー処理

### Errorオブジェクトを返す

```typescript
{
  key: 'email',
  header: 'Email',
  type: 'string',
  conditionalStyle: (row) => {
    // Errorを返して警告表示
    if (!row.email || !row.email.includes('@')) {
      return new Error('Invalid email format');
    }
    return null;
  }
}
```

### Errorを投げる

```typescript
{
  key: 'age',
  header: 'Age',
  type: 'number',
  conditionalStyle: (row) => {
    if (row.age < 0) {
      throw new Error('Age cannot be negative');
    }
    if (row.age > 150) {
      throw new Error('Age seems unrealistic');
    }
    return null;
  }
}
```

### 表示インジケータ

エラー時はセル右上にインジケータが表示されます。

- **Errorオブジェクトを返す**: 黄色の三角
  - ホバーでメッセージ表示
  - 警告として扱う

- **例外を投げる**: 赤い三角
  - 致命的なエラー
  - ホバーでメッセージ表示

### 表示例

```typescript
{
  key: 'discount',
  header: 'Discount %',
  type: 'number',
  conditionalStyle: (row) => {
    // 黄色警告: 割引が上限超過
    if (row.discount > 50) {
      return new Error('Discount exceeds 50% limit');
    }
    
    // 赤エラー: 必須フィールド不足
    if (!row.originalPrice) {
      throw new Error('Missing original price for calculation');
    }
    
    // 通常スタイル
    if (row.discount > 30) return { backgroundColor: '#fff9c4' };
    if (row.discount > 10) return { backgroundColor: '#ffe0b2' };
    return null;
  }
}
```

## アクセシビリティ注意

- **色だけに依存しない**（アイコンや装飾を併用）
- **コントラスト**をWCAG AAに合わせる
- **アイコン＋色**で意味を補強
- **テスト**で支援技術を確認

## 次のステップ

- [静的な列フォーマット](/ja/guides/style)
- [データ型とバリデーション](/ja/guides/data-format)
- [数式による計算](/ja/guides/formulas)
