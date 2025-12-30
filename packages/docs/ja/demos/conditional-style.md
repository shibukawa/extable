# 条件付きスタイル

値に応じてセルへ条件付きスタイルを適用する方法を紹介します。

## インタラクティブデモ

このデモでは条件付きスタイルを適用したテーブルを表示します。

<ClientOnly>
  <ConditionalStyleDemo />
</ClientOnly>

::: info Demo UI Note
このデモにはテーブル上部に**Undo**/**Redo**ボタンがあります。実運用ではショートカット（Undo: Ctrl/Cmd+Z、Redo: Ctrl/Cmd+Shift+Z）を使うケースが一般的です。ここではボタン操作でも試せるようにしています。
:::

## ここで確認できること

✅ **値に応じた色分け** - 値でセル色を変更  
✅ **ステータス表示** - 色によるステータス表現  
✅ **範囲のハイライト** - 範囲ごとの色分け  
✅ **テキスト装飾** - 文字色/太さの変更  
✅ **エラー強調** - 無効データを赤で表示  

## スキーマ定義

上のデモは次のスキーマを使用しています。

```typescript
import { defineSchema } from "@extable/core";

interface Performance {
  id: string;
  employee: string;
  department: string;
  score: number;
  attendance: number;
  projects: number;
  status: string;
}

const tableSchema = defineSchema<Performance>({
  columns: [
    { key: "id", header: "Employee ID", type: "string", readonly: true, width: 120 },
    { key: "employee", header: "Employee Name", type: "string", width: 150 },
    { key: "department", header: "Department", type: "string", width: 140 },
    {
      key: "score",
      header: "Performance Score",
      type: "number",
      format: { precision: 5, scale: 1 },
      width: 160,
      style: { align: "center" },
      conditionalStyle: (row) => {
        if (row.score >= 90) return { backgroundColor: "#d1fae5", textColor: "#065f46" };
        if (row.score >= 70) return { backgroundColor: "#fef3c7", textColor: "#78350f" };
        return { backgroundColor: "#fee2e2", textColor: "#7f1d1d" };
      },
    },
    {
      key: "attendance",
      header: "Attendance (%)",
      type: "number",
      format: { precision: 5, scale: 1 },
      width: 140,
      style: { align: "center" },
      conditionalStyle: (row) => {
        if (row.attendance >= 95) return { backgroundColor: "#dcfce7", textColor: "#166534" };
        if (row.attendance >= 85) return { backgroundColor: "#fef08a", textColor: "#713f12" };
        return { backgroundColor: "#fecaca", textColor: "#991b1b" };
      },
    },
    {
      key: "projects",
      header: "Projects Completed",
      type: "number",
      format: { precision: 3, scale: 0 },
      width: 160,
      style: { align: "center" },
      conditionalStyle: (row) => {
        if (row.projects >= 15) return { backgroundColor: "#bfdbfe", textColor: "#1e40af" };
        if (row.projects >= 8) return { backgroundColor: "#e0e7ff", textColor: "#3730a3" };
        return null;
      },
    },
    {
      key: "status",
      header: "Status",
      type: "string",
      readonly: true,
      width: 130,
      style: { align: "center" },
      conditionalStyle: (row) => {
        if (row.status === "Active") return { backgroundColor: "#ccfbf1", textColor: "#134e4a" };
        if (row.status === "On Leave") return { backgroundColor: "#fed7aa", textColor: "#92400e" };
        if (row.status === "Inactive") return { backgroundColor: "#f3f4f6", textColor: "#374151" };
        return null;
      },
    },
  ],
});
```

## 条件付きスタイルの仕組み

条件付きスタイルは、行データに応じてセルの見た目を切り替えます。`conditionalStyle`でスタイルオブジェクト（または`null`）を返します。

**重要:** `conditionalStyle`は、数式解決後の行データ（`RData`）を受け取ります。`defineSchema<TData, RData>`を使うと、`TData → RData`へ変換された結果に基づいてスタイルを決められます。

### 基本例

```typescript
{
  key: "score",
  type: "number",
  conditionalStyle: (row) => {
    if (row.score >= 90) return { backgroundColor: "#d1fae5", textColor: "#065f46" };
    if (row.score >= 70) return { backgroundColor: "#fef3c7", textColor: "#78350f" };
    return null;
  },
}
```

条件に応じてスタイルを返し、`null`なら通常表示になります。

### スタイルプロパティ

- **`background`** - 背景色
- **`textColor`** - 文字色
- **`bold`**, **`italic`**, **`underline`**, **`strike`** - 文字装飾

## 使いどころ

- **ステータス表示** - 状態を色で表現
- **パフォーマンス強調** - 値の範囲を可視化
- **出勤率の確認** - 出勤率を色で判別
- **アラート条件** - 例外や異常を強調
- **データ検証** - 範囲外や無効値の可視化
