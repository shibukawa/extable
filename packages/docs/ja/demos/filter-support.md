# フィルター対応

列の値でフィルタリングやソートを有効化する方法を紹介します。

## インタラクティブデモ

このデモではフィルター/ソートを有効にしたテーブルを表示します。

<ClientOnly>
  <FilterSupportDemo />
</ClientOnly>

::: info Demo UI Note
このデモにはテーブル上部に**Undo**/**Redo**ボタンがあります。実運用ではショートカット（Undo: Ctrl/Cmd+Z、Redo: Ctrl/Cmd+Shift+Z）を使うケースが一般的です。ここではボタン操作でも試せるようにしています。
:::

## ここで確認できること

✅ **列フィルター** - 列ヘッダーから絞り込み  
✅ **重複値フィルター** - 列内の値から選択  
✅ **複数値選択** - 複数選択（OR条件）  
✅ **列ソート** - 昇順/降順の切り替え  
✅ **クリア** - フィルターとソートの解除  

## 使い方

:::tabs
== Vue

```vue
<template>
  <ExtableVue
    :data="tableData"
    :schema="tableSchema"
    :view="view"
    @view-change="updateView"
  />
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ExtableVue } from "@extable/vue";
import type { Schema, View } from "@extable/core";

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

const view = ref<View>({
  filters: [],
  sorts: [],
});

const updateView = (newView: View) => {
  view.value = newView;
};
</script>
```

== React

```tsx
import { useState } from "react";
import { ExtableReact } from "@extable/react";
import type { Schema, View } from "@extable/core";

export function FilterSupportDemo() {
  const [view, setView] = useState<View>({ filters: [], sorts: [] });

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

  return (
    <ExtableReact
      data={tableData}
      schema={tableSchema}
      view={view}
      onViewChange={setView}
    />
  );
}
```

== Vanilla

```ts
import { ExtableCore } from "@extable/core";
import type { Schema, View } from "@extable/core";

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

const initialView: View = {
  filters: [],
  sorts: [],
};

const core = new ExtableCore(container, {
  data: tableData,
  schema: tableSchema,
  view: initialView,
});

// View変更を監視
core.subscribeTableState((state) => {
  // UIでViewが変更された
  const updatedView = core.getView();
  console.log("View updated:", updatedView);
});
```

:::

## フィルターの種類

### 列ヘッダーのフィルターメニュー

列ヘッダー横の**フィルターアイコン**（🔻/漏斗）をクリックすると、Excel風のメニューが開きます。

1. **値の選択/解除** - 表示対象の値を選択
2. **空値の含有** - 空セルの表示/非表示
3. **ソート** - 昇順/降順
4. **検索** - 値が多いときに絞り込み
5. **エラーフィルター** - バリデーションエラー行のみ表示

適用すると列ヘッダーにフィルター表示が付き、再クリックで変更/解除できます。

### 重複値フィルター

列内の値で絞り込みます。

```ts
{
  kind: "values",
  key: "role",
  values: ["Admin", "User"],
  includeBlanks: false,
}
```

### プログラムによるフィルター

```ts
core.setView({
  filters: [
    {
      kind: "values",
      key: "department",
      values: ["Engineering", "Sales"],
      includeBlanks: false,
    },
  ],
});
```

## ソート

### 単一列ソート

```ts
core.setView({
  sorts: [
    {
      key: "name",
      dir: "asc", // または"desc"
    },
  ],
});
```

### 注意点

- 同時にソートできるのは1列のみ
- 別の列をソートすると前のソートは解除
- 同じ列を再度クリックすると昇順/降順が切り替わる
