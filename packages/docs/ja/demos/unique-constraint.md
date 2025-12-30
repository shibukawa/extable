# 一意制約

列ごとの値を一意に保ち、重複を防ぐ方法を学びます。

## インタラクティブデモ

このデモでは一意制約のあるテーブルを表示します。

<ClientOnly>
  <UniqueConstraintDemo />
</ClientOnly>

::: info Demo UI Note
このデモではテーブル上部に **Undo** と **Redo** のボタンがあります。実際のアプリケーションでは、これらはキーボードショートカット（Undo: Ctrl/Cmd+Z、Redo: Ctrl/Cmd+Shift+Z）で操作するのが一般的です。ここではキーボード操作ができない場合の代替としてボタンを用意しています。
:::

## 見どころ

✅ **一意チェック** - 制約列で重複を防止  
✅ **エラー表示** - 不正セルに赤枠  
✅ **編集拒否** - 重複値は確定不可  
✅ **視覚フィードバック** - 不正データにエラーメッセージ

## 使い方

:::tabs
== Vue

```vue
<template>
  <ExtableVue :data="tableData" :schema="tableSchema" edit-mode="commit" />
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
    email: "alice@company.com",
  },
  // ... さらに行
];

const tableSchema: Schema = {
  columns: [
    {
      key: "id",
      header: "ID",
      type: "string",
      readonly: true,
      width: 80,
      unique: true,
    },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "role", header: "Role", type: "enum", options: ["Admin", "User", "Guest"], width: 120 },
    { key: "department", header: "Department", type: "string", width: 120 },
    { key: "joinDate", header: "Join Date", type: "date", width: 120 },
    {
      key: "email",
      header: "Email",
      type: "string",
      width: 150,
      unique: true,
    },
  ],
};
</script>
```

== React

```tsx
import { ExtableReact } from "@extable/react";
import type { Schema } from "@extable/core";

export function UniqueConstraintDemo() {
  const tableData = [
    {
      id: "EMP0001",
      name: "Alice Johnson",
      role: "Admin",
      department: "Engineering",
      joinDate: new Date(2020, 0, 15),
      email: "alice@company.com",
    },
    // ... さらに行
  ];

  const tableSchema: Schema = {
    columns: [
      {
        key: "id",
        header: "ID",
        type: "string",
        readonly: true,
        width: 80,
        unique: true,
      },
      { key: "name", header: "Name", type: "string", width: 150 },
      { key: "role", header: "Role", type: "enum", options: ["Admin", "User", "Guest"], width: 120 },
      { key: "department", header: "Department", type: "string", width: 120 },
      { key: "joinDate", header: "Join Date", type: "date", width: 120 },
      {
        key: "email",
        header: "Email",
        type: "string",
        width: 150,
        unique: true,
      },
    ],
  };

  return <ExtableReact data={tableData} schema={tableSchema} editMode="commit" />;
}
```

== Vanilla

```ts
import { ExtableCore } from "@extable/core";
import type { Schema } from "@extable/core";

const container = document.getElementById("table-container");

const tableSchema: Schema = {
  columns: [
    {
      key: "id",
      header: "ID",
      type: "string",
      readonly: true,
      width: 80,
      unique: true,
    },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "role", header: "Role", type: "enum", options: ["Admin", "User", "Guest"], width: 120 },
    { key: "department", header: "Department", type: "string", width: 120 },
    { key: "joinDate", header: "Join Date", type: "date", width: 120 },
    {
      key: "email",
      header: "Email",
      type: "string",
      width: 150,
      unique: true,
    },
  ],
};

const core = new ExtableCore(container, {
  data: tableData,
  schema: tableSchema,
  editMode: "commit",
});

// 検証エラーを監視
core.subscribeTableState((state) => {
  const errors = state.activeErrors.filter((e) => e.scope === "unique");
  if (errors.length > 0) {
    console.warn("Unique constraint violations:", errors);
  }
});
```

:::

## スキーマの設定

### 列単位の一意制約

```ts
{
  key: "email",
  type: "string",
  unique: true,  // 一意性を強制
}
```

### バリデーションと併用

```ts
{
  key: "email",
  type: "string",
  unique: true,  // 一意性を強制
}
```

## バリデーションのルール

- **一意チェック** - テーブル全行を走査して重複を検出  
- **大文字小文字** - 文字列は大文字小文字を区別  
- **Null の扱い** - null は複数あっても OK（比較対象外）  
- **編集時検証** - セル編集や確定時に検証  
- **エラー表示** - 不正セルに赤枠とメッセージ

## Finding Duplicate Values

When a unique constraint is violated, cells display a red border to indicate errors. To quickly locate all duplicate values:

1. **Click the column header** of a column with `unique: true` (e.g., Email, Username, or ID)
2. **Select "Error"** from the filter options that appear
3. Only rows with duplicate values in that column will be displayed

This makes it easy to audit and fix duplicate data issues in large tables.

## Use Cases

- **Email/Username** - Prevent duplicate user accounts
- **ID Fields** - Ensure each row has unique identifier
- **Social Security Numbers** - Prevent duplicate SSNs
- **Product SKUs** - Ensure unique product codes
- **Username Fields** - Unique usernames in user tables

## Notes

- Validation happens in commit mode by default
- In direct mode, validation prevents the edit immediately
- Use with `editMode: "commit"` for user confirmation
- Error messages appear when:
  - Attempting to edit a cell to a duplicate value
  - Attempting to commit with duplicates present
