# Commitモード

明示的な変更管理やマルチユーザー向けに、commitモードの使い方を紹介します。

## インタラクティブデモ

このデモでは、編集内容を確定前に保留するcommitモードを確認できます。

<ClientOnly>
  <CommitModeDemo />
</ClientOnly>

::: info Demo UI Note
このデモには**Undo**/**Redo**/**Commit**ボタンがあります。**Commit**は保留中の変更を確定します。実運用ではショートカットやAPI呼び出しで操作することが多いですが、ここではボタンで試せるようにしています。
:::

## ここで確認できること

✅ **保留変更** - 編集は即時反映されず保留  
✅ **Commitボタン** - 保留を一括確定  
✅ **Undo/Redo** - commit前なら取り消し可能  
✅ **変更トラッキング** - 変更セルの可視化  

## 使い方

:::tabs
== Vanilla

== Vue

```vue
<template>
  <div>
    <div class="controls">
      <button @click="handleCommit" :disabled="!hasPending">
        Commit {{ pendingCount }} changes
      </button>
    </div>
    <ExtableVue
      ref="tableRef"
      :data="tableData"
      :schema="tableSchema"
      edit-mode="commit"
      @table-state="updateTableState"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { ExtableVue } from "@extable/vue";
import type { Schema, TableState } from "@extable/core";

const tableRef = ref();
const hasPending = ref(false);
const pendingCount = ref(0);

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

const updateTableState = (state: TableState) => {
  hasPending.value = state.canCommit;
  pendingCount.value = state.pendingCellCount;
};

const handleCommit = async () => {
  const core = tableRef.value?.getCore();
  if (core) {
    await core.commit();
    alert("Changes committed!");
  }
};
</script>

<style scoped>
.controls {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
</style>
```

== React

```tsx
import { useRef, useState } from "react";
import { ExtableReact } from "@extable/react";
import type { Schema, TableState } from "@extable/core";

export function CommitModeDemo() {
  const tableRef = useRef();
  const [hasPending, setHasPending] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

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

  const handleTableState = (state: TableState) => {
    setHasPending(state.canCommit);
    setPendingCount(state.pendingCellCount);
  };

  const handleCommit = async () => {
    const core = tableRef.current?.getCore();
    if (core) {
      await core.commit();
      alert("Changes committed!");
    }
  };

  const handleUndo = () => {
    tableRef.current?.getCore()?.undo();
  };

  const handleRedo = () => {
    tableRef.current?.getCore()?.redo();
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button onClick={handleCommit} disabled={!hasPending}>
          Commit {pendingCount} changes
        </button>
        <button onClick={handleUndo}>Undo</button>
        <button onClick={handleRedo}>Redo</button>
      </div>
      <ExtableReact
        ref={tableRef}
        data={tableData}
        schema={tableSchema}
        editMode="commit"
        onTableState={handleTableState}
      />
    </div>
  );
}
```

:::

## 主な特徴

- **保留変更** - commitまで元データは変わらない
- **バッチ操作** - 複数変更を一括送信
- **ロールバック** - commit前にUndo可能
- **変更トラッキング** - 変更セル数を把握

## 使いどころ

- **複数ステップフォーム** - 送信前にまとめて確定
- **マルチユーザー編集** - 同一セルの競合を抑制
- **データ検証** - commit前に全体検証
- **トランザクション** - まとめて原子的に確定
