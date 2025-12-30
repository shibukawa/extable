# 数式

他のセルから派生値を計算する数式の使い方を学びます。

## インタラクティブデモ

このデモでは数式列を含むテーブルの動きを確認できます。

<ClientOnly>
  <FormulasDemo />
</ClientOnly>

::: info Demo UI Note
このデモではテーブル上部に **Undo** と **Redo** のボタンがあります。実際のアプリケーションでは、これらはキーボードショートカット（Undo: Ctrl/Cmd+Z、Redo: Ctrl/Cmd+Shift+Z）で操作するのが一般的です。ここではキーボード操作ができない場合の代替としてボタンを用意しています。
:::

## 見どころ

✅ **計算結果** - 他の列から数式で算出  
✅ **読み取り専用** - 数式結果は編集不可  
✅ **動的更新** - 依存値の変更で再計算  
✅ **複数数式** - 1つのテーブルに複数の数式列

## スキーマ定義

上のデモでは次のスキーマで数式を定義しています。

```typescript
import { defineSchema } from "@extable/core";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  total: number;
}

const tableSchema = defineSchema<InvoiceItem>({
  columns: [
    { key: "id", header: "Item ID", type: "string", readonly: true, width: 100 },
    { key: "description", header: "Description", type: "string", width: 180 },
    {
      key: "quantity",
      header: "Qty",
      type: "number",
      format: { precision: 6, scale: 0 },
      width: 80,
      style: { align: "center" },
    },
    {
      key: "unitPrice",
      header: "Unit Price ($)",
      type: "number",
      format: { precision: 8, scale: 2 },
      width: 130,
      style: { align: "right" },
    },
    {
      key: "discountPercent",
      header: "Discount (%)",
      type: "number",
      format: { precision: 5, scale: 1 },
      width: 120,
      style: { align: "center" },
    },
    {
      key: "total",
      header: "Total ($)",
      type: "number",
      format: { precision: 10, scale: 2 },
      readonly: true,
      formula: (row) => row.quantity * row.unitPrice * (1 - row.discountPercent / 100),
      width: 130,
      style: { align: "right", backgroundColor: "#f0fdf4" },
    },
  ],
});
```

## 数式の仕組み

数式は JavaScript の関数として定義し、同じ行の他のセル値から結果を計算します。関数には全列の値が入った `row` オブジェクトが渡され、計算結果を返します。

### 基本の数式

```typescript
const schema = defineSchema<MyRow>({
  columns: [
    {
      key: "total",
      header: "Total",
      type: "number",
      readonly: true,
      formula: (row) => row.quantity * row.unitPrice,  // rowは強い型付け
    },
  ],
});
```

### 依存関係のある数式

**重要な制約:** 数式列は他の数式列を参照できません。循環参照や無限ループを避けるため、各数式は編集可能（数式ではない）列から直接計算する必要があります。

```typescript
// ❌ 不可: 別の数式列を参照
{
  key: "tax",
  header: "Tax",
  type: "number",
  readonly: true,
  formula: (row) => row.total * 0.1,  // エラー: 'total'は数式列
}

// ✅ 可: 編集可能列のみ参照
{
  key: "total",
  header: "Total",
  type: "number",
  readonly: true,
  formula: (row) => row.quantity * row.unitPrice * (1 - row.discountPercent / 100),
}
```

### 数式の特徴

- **JavaScript 関数** - `row` を受け取るアロー関数で定義  
- **読み取り専用** - 数式結果は自動的に readonly 扱い  
- **動的再計算** - 参照セルが変わると再計算  
- **型安全** - TypeScript の型補完でプロパティにアクセス  
- **エラー処理** - `[value, Error]` を返して警告を表示、または例外で重大エラー

## 利用シーン

- **合計** - 編集列の積や合計を算出: `(row) => row.quantity * row.unitPrice`
- **割合** - 比率を計算: `(row) => row.amount / row.subtotal * 100`
- **割引** - 割引率の適用: `(row) => row.subtotal * (1 - row.discountPercent / 100)`
- **単位変換** - 単位間の換算: `(row) => row.priceFt * row.lengthFt`
- **メトリクス** - 派生指標の表示
- **バリデーション** - エラー状態を返す: `(row) => row.value < 0 ? [0, new Error('Must be positive')] : row.value`
