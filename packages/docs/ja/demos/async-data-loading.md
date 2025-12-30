# 非同期データ読み込み

データを非同期で取得し、テーブルを動的に更新する方法を紹介します。

## インタラクティブデモ

このデモは、必要になったタイミングでデータを読み込み、ローディング表示を出します。

<ClientOnly>
  <AsyncDataLoadingDemo />
</ClientOnly>

::: info Demo UI Note
このデモにはテーブル上部に**Undo**/**Redo**ボタンがあります。実運用ではキーボードショートカット（Undo: Ctrl/Cmd+Z、Redo: Ctrl/Cmd+Shift+Z）が一般的です。ここではマウス操作でも試せるようボタンを用意しています。
:::

## ここで確認できること

✅ **遅延ロード** - コンポーネント起動時に読み込み  
✅ **ローディング状態** - 取得中のUI表示  
✅ **動的更新** - 取得後にテーブル更新  

## 使い方

:::tabs

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

// nullで初期化するとローディングスピナー表示
const core = new ExtableCore(container, {
  data: null,
  schema: tableSchema,
});

const res = await fetch("/api/users");
const users = await res.json();

core.setData(users.map(user => {
  ...user,
  joinDate: Date(user),
}))
```

== React

```tsx
import useSWR from "swr";
import { useEffect, useState } from "react";
import { ExtableReact } from "@extable/react";
import type { Schema } from "@extable/core";

async function fetcher(url: string) {
  const res = await fetch("/api/users");
  const users = await res.json();

  return users.map(user => {
  ...user,
  joinDate: Date(user),
  })
}

export function AsyncDataLoadingDemo() {
  // サーバー応答までdataはundefined
  // → スピナー表示
  const { data } = useSWR("/api/users/", fetcher)

  const tableSchema: Schema = {
    columns: [
      { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
      { key: "name", header: "Name", type: "string", width: 150 },
      { key: "role", header: "Role", type: "enum", options: ["Admin", "User", "Guest"], width: 120 },
      { key: "department", header: "Department", type: "string", width: 120 },
      { key: "joinDate", header: "Join Date", type: "date", width: 120 },
    ],
  };

  return (
    <div>
      <ExtableReact defaultData={data} schema={tableSchema} />
    </div>
  );
}
```

== Vue

```vue
<template>
  <div>
    <ExtableVue :defaultData="tableData" :schema="tableSchema" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ExtableVue } from "@extable/vue";
import type { Schema } from "@extable/core";

const tableSchema: Schema = {
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true, width: 80 },
    { key: "name", header: "Name", type: "string", width: 150 },
    { key: "role", header: "Role", type: "enum", options: ["Admin", "User", "Guest"], width: 120 },
    { key: "department", header: "Department", type: "string", width: 120 },
    { key: "joinDate", header: "Join Date", type: "date", width: 120 },
  ],
};

interface User {
  id: string
  name: string
  role: "Admin"|"User"|"Guest"
  department: string
  joinDate: Date
}

// サーバー応答までtableDataはnull
// → ローディングスピナー表示
const tableData = ref<User[]|null>(null);

onMounted(async () => {
  const res = await fetch("/api/users");
  const users = await res.json();
  
  tableData.value = users.map(user => {
    ...user,
    joinDate: Date(user),
  })
});
</script>
```

:::

## 重要ポイント

- `setData()`で取得後のデータを明示的に渡します。
- React/Vueの`defaultData`は`null`/`undefined`を受け取り、ローディング表示になります。
