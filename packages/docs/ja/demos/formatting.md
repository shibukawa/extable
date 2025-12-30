# スタイル

通貨・数値・日付・カスタムスタイルでセルの表示を整える方法を学びます。

## インタラクティブデモ

このデモでは列のスタイル設定を確認できます。

<ClientOnly>
  <StyleDemo />
</ClientOnly>

::: info Demo UI Note
このデモではテーブル上部に **Undo** と **Redo** のボタンがあります。実際のアプリケーションでは、これらはキーボードショートカット（Undo: Ctrl/Cmd+Z、Redo: Ctrl/Cmd+Shift+Z）で操作するのが一般的です。ここではキーボード操作ができない場合の代替としてボタンを用意しています。
:::

## 見どころ

✅ **通貨表示** - 数値を通貨として表示  
✅ **日付表示** - 日付をローカライズして表示  
✅ **数値精度** - 小数桁の制御  
✅ **テキスト配置** - 左寄せ/中央/右寄せ  
✅ **セルスタイル** - 文字色/背景色

## スキーマ定義

上のデモでは次のスキーマでスタイルを定義しています。

```typescript
import { defineSchema } from "@extable/core";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: string;
  revenue: number;
}

const tableSchema = defineSchema<Product>({
  columns: [
    { key: "id", header: "Product ID", type: "string", readonly: true, width: 110 },
    {
      key: "name",
      header: "Product Name",
      type: "string",
      width: 150,
      style: {
        textColor: "#24292f",
        backgroundColor: "#f6f8fa",
        decorations: {
          bold: true,
        },
      },
    },
    {
      key: "category",
      header: "Category",
      type: "string",
      width: 120,
    },
    {
      key: "price",
      header: "Price ($)",
      type: "number",
      format: { precision: 8, scale: 2 },
      width: 120,
      style: {
        align: "right",
        textColor: "#0969da",
      },
    },
    {
      key: "stock",
      header: "Stock",
      type: "number",
      format: { precision: 6, scale: 0 },
      width: 100,
      style: {
        align: "center",
      },
    },
    {
      key: "status",
      header: "Status",
      type: "enum",
      enum: { options: ["available", "discontinued", "low-stock"] },
      width: 130,
      style: {
        backgroundColor: "#fffbcc",
        textColor: "#7f4e00",
      },
    },
    {
      key: "revenue",
      header: "Revenue ($)",
      type: "number",
      format: { precision: 12, scale: 2 },
      width: 140,
      style: {
        align: "right",
        textColor: "#28a745",
        backgroundColor: "#f0fdf4",
      },
    },
  ],
});
```

## スタイルオプション

### 文字色と背景色

`style` プロパティでセルに色を付けます。

```typescript
{
  key: "price",
  header: "Price",
  type: "number",
  style: {
    textColor: "#0969da",           // 文字色
    backgroundColor: "#f6f8fa",     // 背景色
  },
}
```

### テキスト配置

セル内の水平配置を指定します。

```typescript
{
  key: "amount",
  header: "Amount",
  type: "number",
  style: {
    align: "right",  // 配置: "left" | "center" | "right"
  },
}
```

### 数値の精度

数値列の小数桁を定義します。

```typescript
{
  key: "price",
  header: "Price",
  type: "number",
  format: {
    precision: 10,   // 総桁数
    scale: 2,        // 小数桁
    signed: false,   // 負数を許可
  },
}
```

### 装飾

セルの文字に装飾を追加します。

```typescript
{
  key: "notes",
  header: "Notes",
  type: "string",
  style: {
    decorations: {
      strike: false,
      underline: false,
      bold: false,
      italic: false,
    },
  },
}
```
