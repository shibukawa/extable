# 読み取り専用モード

テーブルを読み取り専用にする方法を学びます。データ閲覧や表示専用のシナリオに便利です。

## インタラクティブデモ

このデモでは編集不可の読み取り専用テーブルを表示します。

<ClientOnly>
  <ReadonlyModeDemo />
</ClientOnly>

::: info Demo UI Note
このデモには **Undo** と **Redo** のボタンがありますが、読み取り専用モードのため無効化されています。実際のアプリケーションでは、これらはキーボードショートカット（Undo: Ctrl/Cmd+Z、Redo: Ctrl/Cmd+Shift+Z）で操作するのが一般的です。ここではデモ操作の補助としてボタンを配置しています。
:::

## 見どころ

✅ **読み取り専用列** - 指定した列は編集不可  
✅ **選択は可能** - 選択やコピーができる  
✅ **インライン編集なし** - ダブルクリックで編集が開かない  
✅ **コピー対応** - Ctrl/Cmd+C は利用可能

## 使い方

:::tabs
== Vue

```vue
<template>
  <ExtableVue :data="tableData" :schema="tableSchema" edit-mode="readonly" />
</template>

<script setup lang="ts">
import { ExtableVue } from "@extable/vue";
import type { Schema } from "@extable/core";

const tableData = [
  {
    id: "EMP0001",
    name: "Alice Johnson",
    role: "Admin",
    department: "Engineering",
    joinDate: new Date(2020, 0, 15),
  },
  // ... さらに行
];

const tableSchema: Schema = {
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "role", header: "Role", type: "enum", options: ["Admin", "User", "Guest"], width: 120 },
    { key: "department", header: "Department", type: "string", width: 120 },
    { key: "joinDate", header: "Join Date", type: "date", width: 120 },
  ],
};
</script>
```

== React

```tsx
import { ExtableReact } from "@extable/react";
import type { Schema } from "@extable/core";

export function ReadonlyModeDemo() {
  const tableData = [
    {
      id: "EMP0001",
      name: "Alice Johnson",
      role: "Admin",
      department: "Engineering",
      joinDate: new Date(2020, 0, 15),
    },
    // ... さらに行
  ];

  const tableSchema: Schema = {
    columns: [
      { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
      { key: "name", header: "Name", type: "string", width: 150 },
      { key: "role", header: "Role", type: "enum", options: ["Admin", "User", "Guest"], width: 120 },
      { key: "department", header: "Department", type: "string", width: 120 },
      { key: "joinDate", header: "Join Date", type: "date", width: 120 },
    ],
  };

  return <ExtableReact data={tableData} schema={tableSchema} editMode="readonly" />;
}
```

== Vanilla

```ts
import { ExtableCore } from "@extable/core";
import type { Schema } from "@extable/core";

const container = document.getElementById("table-container");

const tableSchema: Schema = {
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "role", header: "Role", type: "enum", options: ["Admin", "User", "Guest"], width: 120 },
    { key: "department", header: "Department", type: "string", width: 120 },
    { key: "joinDate", header: "Join Date", type: "date", width: 120 },
  ],
};

const core = new ExtableCore(container, {
  data: tableData,
  schema: tableSchema,
  editMode: "readonly",
});
```

:::

## 利用シーン

- **データ閲覧** - 編集できない形で表示  
- **レポート** - 閲覧専用向けに表を表示  
- **監査ログ** - 過去/アーカイブのデータ表示  
- **API 結果** - 変更させたくない検索結果の表示

## 読み取り専用の範囲

- `editMode: "readonly"` - テーブル全体が読み取り専用  
- `column.readonly: true` - 特定列のみ読み取り専用（他の列は編集可能）
