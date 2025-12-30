# 数式ガイド

数式は、同一行の他セルに基づいて値を自動計算する列を定義します。Extableの数式は、スプレッドシートのテキスト式ではなく**JavaScript関数**としてレンダリング時に評価されます。

## 基本概念

### 数式とスプレッドシート式の違い

**Extableの数式:**
- 開発者が定義するJavaScript関数
- 行ごとにレンダリング時評価
- TypeScriptで型安全
- 行全体にアクセス可能
- エラーは警告表示で止まらない

**スプレッドシート式（Excel/Sheets）:**
- 文字列式（例: `=A1*B1`）
- ユーザーがセルで編集
- 列移動で参照が変化
- 固定スキーマのExtableには不向き

### 数式の定義

スキーマの列に`formula`を追加します。

```typescript
{
  key: 'total',
  header: 'Total',
  type: 'number',
  readonly: true,  // 通常readonly（数式で計算）
  formula: (row) => row.price * row.quantity
}
```

**プロパティ:**
- `readonly: true`: 計算結果の編集を防止
- `formula`: `row`を受け取り、値またはエラー付きタプルを返す

## 戻り値

### 値を直接返す

```typescript
formula: (row) => row.price * row.quantity
```

### 値 + エラー/警告

`[value, Error]`を返すと値を表示しつつ警告状態にできます。

```typescript
formula: (row) => {
  if (row.quantity <= 0) {
    return [0, new Error('Quantity must be positive')] as const;
  }
  return row.price * row.quantity;
}
```

値は表示され、警告アイコンが出ます。

### エラー状態

例外を投げるとエラー状態になり値は表示されません。

```typescript
formula: (row) => {
  if (!row.price || !row.quantity) {
    throw new Error('Missing price or quantity');
  }
  return row.price * row.quantity;
}
```

## ユースケース

### 基本計算

```typescript
{
  key: 'lineTotal',
  header: 'Line Total',
  type: 'number',
  readonly: true,
  format: { scale: 2, thousandSeparator: true },
  style: { align: 'right' },
  formula: (row) => row.unitPrice * row.quantity
}
```

### 条件付き計算

```typescript
{
  key: 'discount',
  header: 'Discount Amount',
  type: 'number',
  readonly: true,
  format: { scale: 2 },
  formula: (row) => {
    if (row.customerType === 'VIP') {
      return row.subtotal * 0.20;  // VIPは20%割引
    }
    if (row.quantity >= 100) {
      return row.subtotal * 0.10;  // 大量注文は10%
    }
    return 0;
  }
}
```

### 文字列結合

```typescript
{
  key: 'fullName',
  header: 'Full Name',
  type: 'string',
  readonly: true,
  formula: (row) => `${row.firstName} ${row.lastName}`.trim()
}
```

### boolean導出

```typescript
{
  key: 'isOverdue',
  header: 'Overdue?',
  type: 'boolean',
  readonly: true,
  format: 'checkbox',
  formula: (row) => {
    const dueDate = new Date(row.dueDate);
    return dueDate < new Date();
  }
}
```

### 日時フォーマット

```typescript
{
  key: 'formattedDeadline',
  header: 'Deadline',
  type: 'string',
  readonly: true,
  formula: (row) => {
    const date = new Date(row.deadline);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  }
}
```

### ステータス導出 + 検証

```typescript
{
  key: 'fulfillmentStatus',
  header: 'Status',
  type: 'enum',
  readonly: true,
  enum: { options: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Error'] },
  formula: (row) => {
    if (!row.orderId) {
      return ['Error', new Error('Missing order ID')] as const;
    }
    if (row.shipped && row.delivered) return 'Delivered';
    if (row.shipped) return 'Shipped';
    if (row.packed) return 'Processing';
    return 'Pending';
  }
}
```

### 複数行コンテキスト（カスタム計算）

```typescript
{
  key: 'percentage',
  header: '% of Total',
  type: 'number',
  readonly: true,
  format: { scale: 1 },
  formula: (row) => {
    // 注: 全体に対する割合を計算する場合は
    // データ層で合計を事前計算し派生値として渡す
    if (row.grandTotal === 0) {
      return [0, new Error('Division by zero')] as const;
    }
    return (row.amount / row.grandTotal) * 100;
  }
}
```

## エラー処理と表示

数式は3つのエラーパターンを持ちます。

### 1. 値 + 警告（黄色）

```typescript
{
  key: 'discount',
  header: 'Discount Amount',
  type: 'number',
  readonly: true,
  formula: (row) => {
    if (row.discount > row.subtotal) {
      // 小計を表示しつつ警告
      return [row.subtotal, new Error('Discount exceeds subtotal')] as const;
    }
    return row.subtotal - row.discount;
  }
}
```

**表示:**
- セルに値を表示（例: `1000`）
- 右上に黄色の三角
- ホバーで警告メッセージ

### 2. エラー状態（赤）

```typescript
{
  key: 'total',
  header: 'Total',
  type: 'number',
  readonly: true,
  formula: (row) => {
    if (!row.vendorId) {
      throw new Error('Vendor not assigned');
    }
    return calculateCost(row.vendorId);
  }
}
```

**表示:**
- `#ERROR`表示
- 右上に赤い三角
- ホバーでエラーメッセージ

### 3. 通常の返却

```typescript
{
  key: 'total',
  header: 'Total',
  type: 'number',
  readonly: true,
  formula: (row) => row.price * row.quantity
}
```

**表示:**
- 値のみ表示
- エラー表示なし

### エラー比較表

| パターン | コード | 表示 | インジケータ | 用途 |
|---------|------|---------|-----------|----------|
| **通常** | `return value` | 値 | なし | 標準計算 |
| **警告** | `return [value, Error]` | 値 | 黄色三角 | 軽微な検証 |
| **エラー** | `throw Error` | `#ERROR` | 赤三角 | 重大エラー |

### エラー処理の完全例

```typescript
{
  key: 'netPrice',
  header: 'Net Price',
  type: 'number',
  readonly: true,
  format: { scale: 2, thousandSeparator: true },
  formula: (row) => {
    // 重要な検証は例外を投げる
    if (!row.basePrice || !row.quantity) {
      throw new Error('Missing basePrice or quantity');
    }

    // 軽微な検証は警告+値を返す
    if (row.discountPercent > 100) {
      const netPrice = row.basePrice * row.quantity;
      return [netPrice, new Error('Discount exceeds 100%')] as const;
    }

    if (row.discountPercent < 0) {
      const netPrice = row.basePrice * row.quantity;
      return [netPrice, new Error('Discount cannot be negative')] as const;
    }

    // 通常計算
    const subtotal = row.basePrice * row.quantity;
    const discount = (row.discountPercent / 100) * subtotal;
    return subtotal - discount;
  }
}
```

### メッセージのベストプラクティス

- **具体的に**: 「Invalid discount」より「Discount exceeds 100%」
- **文脈を含める**: 「Row 5のunitPrice不足」など
- **修正案を示す**: 「2024-01-01以降にしてください」
- **簡潔に**: 100文字以内が目安

### Try-Catchでのエラー捕捉

```typescript
{
  key: 'calculated',
  header: 'Calculated Value',
  type: 'number',
  readonly: true,
  formula: (row) => {
    try {
      const result = expensiveCalculation(row.data);
      if (result < 0) {
        return [result, new Error('Unexpected negative value')] as const;
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Calculation failed: ${message}`);
    }
  }
}
```

### エラー表示オプション

エラー表示は次のオプションで制御できます。
- `diagErrors: true`（エラー表示）
- `diagWarnings: true`（警告表示）

## パフォーマンス考慮

### 実行タイミング

- 数式は**表示行ごとにレンダリング時に1回**実行
- トリガー:
  - 初期ロード
  - データ変更（編集/貼付/undo/redo）
  - 列リサイズ/スクロール
  - ビュー変更（フィルタ/ソート）

### ベストプラクティス

**DO:**
- 低コストな演算
- `row`のフィールドのみ参照
- 高コスト計算はデータ層で事前集計
- 返却型を揃える（数値列は数値を返す）

**DON'T:**
- 数式内でAPI呼び出し
- 重い計算や大きな正規表現
- グローバル状態に依存
- `row`を変更

### 集計の事前計算

```typescript
// ❌ 非効率: 各行で再計算
formula: (row) => {
  const sum = this.data.reduce((a, b) => a + b.amount, 0);
  return row.amount / sum * 100;
}

// ✅ 効率的: 事前計算
const data = rows.map(r => ({
  ...r,
  grandTotal: rows.reduce((a, b) => a + b.amount, 0)
}));

// その後スキーマで:
formula: (row) => row.amount / row.grandTotal * 100
```

## 型安全

TypeScriptでは型を定義して補完性を高めます。

```typescript
interface OrderRow {
  id: number;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxRate: number;
}

const schema = {
  columns: [
    {
      key: 'total',
      header: 'Total',
      type: 'number',
      readonly: true,
      formula: (row: OrderRow) => {
        const subtotal = row.quantity * row.unitPrice;
        const afterDiscount = subtotal * (1 - row.discountPercent / 100);
        return afterDiscount * (1 + row.taxRate / 100);
      }
    }
  ]
};
```

## 複雑な例

複数の計算列を含む請求行の例です。

```typescript
{
  key: 'lineItems',
  header: 'Line Items',
  columns: [
    {
      key: 'sku',
      header: 'SKU',
      type: 'string',
      readonly: true
    },
    {
      key: 'quantity',
      header: 'Qty',
      type: 'number',
      format: { precision: 10, scale: 2 }
    },
    {
      key: 'unitPrice',
      header: 'Unit Price',
      type: 'number',
      format: { scale: 2 }
    },
    {
      key: 'subtotal',
      header: 'Subtotal',
      type: 'number',
      readonly: true,
      format: { scale: 2 },
      style: { align: 'right' },
      formula: (row) => row.quantity * row.unitPrice
    },
    {
      key: 'discountAmount',
      header: 'Discount',
      type: 'number',
      readonly: true,
      format: { scale: 2 },
      formula: (row) => {
        if (!row.subtotal) return 0;
        const discountRate = row.discountPercent ? row.discountPercent / 100 : 0;
        return row.subtotal * discountRate;
      }
    },
    {
      key: 'taxableAmount',
      header: 'Taxable Amount',
      type: 'number',
      readonly: true,
      format: { scale: 2 },
      formula: (row) => (row.subtotal || 0) - (row.discountAmount || 0)
    },
    {
      key: 'tax',
      header: 'Tax',
      type: 'number',
      readonly: true,
      format: { scale: 2 },
      formula: (row) => {
        const taxableAmount = (row.subtotal || 0) - (row.discountAmount || 0);
        const taxRate = row.taxRate ? row.taxRate / 100 : 0;
        return taxableAmount * taxRate;
      }
    },
    {
      key: 'total',
      header: 'Total',
      type: 'number',
      readonly: true,
      format: { scale: 2, thousandSeparator: true },
      style: { align: 'right', bold: true },
      formula: (row) => {
        const subtotal = row.subtotal || 0;
        const discount = row.discountAmount || 0;
        const tax = row.tax || 0;
        return subtotal - discount + tax;
      }
    }
  ]
}
```

## 次のステップ

- [データフォーマットと型](/ja/guides/data-format)
- [条件付きスタイル](/ja/guides/conditional-style)
- [編集モードとreadonly列](/ja/guides/editmode)
