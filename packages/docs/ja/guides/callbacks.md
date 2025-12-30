# コールバック

Extableはテーブル全体の状態、選択（セル）更新、行レベルの変更フックを公開しています。UI同期、ステータスバー更新、外部状態との連携に利用できます。

## テーブル状態

`subscribeTableState`でツールバーやステータスに影響する状態を監視します。

```ts
const unsubscribe = table.subscribeTableState((next, prev) => {
  console.log("canCommit", next.canCommit);
  console.log("pending", next.pendingCommandCount);
});

// 後で
unsubscribe();
```

`TableState`に含まれるもの:
- `canCommit`
- `pendingCommandCount`
- `pendingCellCount`
- `undoRedo`
- `renderMode`
- `activeErrors`

## 選択/セルイベント

`subscribeSelection`でアクティブセルや選択範囲の変化を監視します。

```ts
const unsubscribe = table.subscribeSelection((next, prev, reason) => {
  console.log("active", next.activeRowKey, next.activeColumnKey);
  console.log("reason", reason);
});
```

`SelectionChangeReason`:
- `selection`
- `edit`
- `style`
- `schema`
- `view`
- `data`
- `unknown`

## 行状態（Coreのみ）

`subscribeRowState`で行単位の更新を監視します。これは`ExtableCore`のみで、React/Vueラッパーにはまだ公開されていません。

```ts
const unsubscribe = table.subscribeRowState((rowId, next, prev, reason) => {
  if (reason === "delete") {
    console.log("row removed", rowId);
    return;
  }
  console.log("row updated", rowId, next?.data);
});
```

`RowChangeReason`は`new`、`edit`、`delete`です。

## React

```tsx
<Extable
  schema={schema}
  defaultData={data}
  defaultView={view}
  onTableState={(next) => setCanCommit(next.canCommit)}
  onCellEvent={(next, prev, reason) => {
    console.log(reason, next.activeValueDisplay);
  }}
/>
```

## Vue

```vue
<template>
  <Extable
    :schema="schema"
    :defaultData="data"
    :defaultView="view"
    @tableState="handleTableState"
    @cellEvent="handleCellEvent"
  />
</template>
```

メソッドの署名やデータ構造は[Core APIリファレンス](/ja/reference/core)を参照してください。
