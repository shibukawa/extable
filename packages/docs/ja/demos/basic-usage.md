# 基本的な使い方

シンプルな例で、Extableの使い方とパフォーマンス指向の構成を確認します。

## インタラクティブデモ

この埋め込みデモは**10,000行**を読み込み、基本レンダリング性能を示します。

<ClientOnly>
  <BasicUsageDemo />
</ClientOnly>

::: info Demo UI Note
このデモにはテーブル上部に**Undo**/**Redo**ボタンがあります。実運用ではショートカット（Undo: Ctrl/Cmd+Z、Redo: Ctrl/Cmd+Shift+Z）を使うケースが一般的です。ここではキーボード操作なしでも試せるようボタンを用意しています。
:::

## ここで確認できること

### デモで触れる機能

✅ **仮想スクロールと性能** - 表示セルのみを描画  
✅ **型安全** - enum/tags/date/numberのフォーマット  
✅ **キーボード操作** - 矢印キー、Tab、Enter  
✅ **インライン編集** - ダブルクリックまたは入力開始で編集  
✅ **選択** - クリックで選択、Shift+クリックで範囲  
✅ **コピー/ペースト** - Ctrl/Cmd+C/V対応  
✅ **ソート&フィルター** - 列単位の絞り込みと並び替え  

## 使い方

:::tabs
== Vanilla
#### Installation

```bash
npm install @extable/core
```

#### Schema

このサンプルのスキーマは次の通りです。

```ts
import type { Schema } from "@extable/core";

const schema = {
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "active", header: "Active", type: "boolean", format: "checkbox", width: 100 },
    {
      key: "score",
      header: "Score",
      type: "number",
      format: { precision: 6, scale: 2 },
      style: { align: "right" },
      width: 120,
    },
    {
      key: "role",
      header: "Role",
      type: "enum",
      enum: { options: ["viewer", "editor", "owner"] },
      width: 130,
    },
    {
      key: "tags",
      header: "Tags",
      type: "tags",
      tags: { options: ["alpha", "beta", "priority"] },
      width: 140,
    },
    {
      key: "notes",
      header: "Notes",
      type: "string",
      wrapText: true,
      width: 260,
    },
  ],
} satisfies Schema;

```

#### Integration

```typescript
import { ExtableCore } from "@extable/core";

const data = [
  {
    id: "row-1",
    name: "User 1",
    active: false,
    score: 51,
    role: "editor",
    tags: ["beta"]
    notes: "beta	Longer text can describe context, data source, and formatting guidance for analysts.",
  },
  {
    id: "row-2",
    name: "User 2",
    active: true,
    score: 52,
    role: "viewer",
    tags: ["beta"]
    notes: "WrapText mode ensures the UI accommodates verbose annotations (manual entry encouraged).",
  },
];

const table = new ExtableCore<Row>({
  root: document.getElementById("table-root"),
  schema,
  defaultData
});
```

== React
#### Installation

```bash
npm install @extable/core @extable/react
```

#### Schema

このサンプルのスキーマは次の通りです。

```ts
import type { Schema } from "@extable/core";

const schema = {
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "active", header: "Active", type: "boolean", format: "checkbox", width: 100 },
    {
      key: "score",
      header: "Score",
      type: "number",
      format: { precision: 6, scale: 2 },
      style: { align: "right" },
      width: 120,
    },
    {
      key: "role",
      header: "Role",
      type: "enum",
      enum: { options: ["viewer", "editor", "owner"] },
      width: 130,
    },
    {
      key: "tags",
      header: "Tags",
      type: "tags",
      tags: { options: ["alpha", "beta", "priority"] },
      width: 140,
    },
    {
      key: "notes",
      header: "Notes",
      type: "string",
      wrapText: true,
      width: 260,
    },
  ],
} satisfies Schema;
```

#### Integration

```typescript
import { useRef } from import { Extable, type ExtableHandle } from "@extable/react";
import "@extable/core/style.css";

const data = [
  {
    id: "row-1",
    name: "User 1",
    active: false,
    score: 51,
    role: "editor",
    tags: ["beta"]
    notes: "beta	Longer text can describe context, data source, and formatting guidance for analysts.",
  },
  {
    id: "row-2",
    name: "User 2",
    active: true,
    score: 52,
    role: "viewer",
    tags: ["beta"]
    notes: "WrapText mode ensures the UI accommodates verbose annotations (manual entry encouraged).",
  },
];

export function Page() {
  const tableRef = useRef<ExtableHandle>(null);

  return <Extable
    ref={tableRef}
    schema={schema}
    defaultData={data}
  />;
}
```

== Vue
#### Installation

```bash
npm install @extable/core @extable/vue
```

#### Schema

このサンプルのスキーマは次の通りです。

```ts
import type { Schema } from "@extable/core";

const schema = {
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "active", header: "Active", type: "boolean", format: "checkbox", width: 100 },
    {
      key: "score",
      header: "Score",
      type: "number",
      format: { precision: 6, scale: 2 },
      style: { align: "right" },
      width: 120,
    },
    {
      key: "role",
      header: "Role",
      type: "enum",
      enum: { options: ["viewer", "editor", "owner"] },
      width: 130,
    },
    {
      key: "tags",
      header: "Tags",
      type: "tags",
      tags: { options: ["alpha", "beta", "priority"] },
      width: 140,
    },
    {
      key: "notes",
      header: "Notes",
      type: "string",
      wrapText: true,
      width: 260,
    },
  ],
} satisfies Schema;
```

#### Integration

```vue
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ExtableCore } from "@extable/core";
import { Extable, type ExtableVueHandle } from "@extable/vue";
import "@extable/core/style.css";

const tableRef = ref<ExtableVueHandle | null>(null);

const data = [
  {
    id: "row-1",
    name: "User 1",
    active: false,
    score: 51,
    role: "editor",
    tags: ["beta"]
    notes: "beta	Longer text can describe context, data source, and formatting guidance for analysts.",
  },
  {
    id: "row-2",
    name: "User 2",
    active: true,
    score: 52,
    role: "viewer",
    tags: ["beta"]
    notes: "WrapText mode ensures the UI accommodates verbose annotations (manual entry encouraged).",
  },
];
</script>

<template>
  <Extable
    ref="tableRef"
    :schema="schema"
    :defaultData="data"
    class="min-h-0 h-full w-full"
  />
</template>
```

:::

## 次のステップ

- **[データフォーマットガイド](/ja/guides/data-format)** - 列型と制約を理解
- **[編集モードガイド](/ja/guides/editmode)** - direct/commitの違い
- **[数式ガイド](/ja/guides/formulas)** - 計算列と検証
- **[条件付きスタイル](/ja/guides/conditional-style)** - パターンの可視化
