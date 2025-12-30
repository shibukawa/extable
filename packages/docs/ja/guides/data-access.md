# APIからのデータアクセス

Extableのデータ初期化、設定、取得の方法を解説します。

## 行の識別

APIで行にアクセスする際は、2種類の識別子があります。

- **Row ID**（`rowId: string`）: 各行の一意ID。フィルタ/ソート/並べ替えの影響を受けず安定します。データに`id`などのユニークキーがあればそれを使用できます。未指定の場合は内部で生成されます。
- **Row Index**（`index: number`）: 現在のビューにおける0始まりの位置。フィルタ/ソートで変化しますが、位置で素早くアクセスできます。

```typescript
// Row IDで取得（安定ID）
const row = table.getRow("user-123");  // 行IDが分かる場合に使用

// インデックスで取得（位置）
const row = table.getRow(0);  // 現在ビューの先頭行
const row = table.getRow(5);  // 現在ビューの6行目
```

多くのAPIは`rowId`または`index`のどちらでも受け取れます。

## APIへのアクセス

フレームワークに応じてアクセス方法が異なります。

:::tabs
== Vanilla

`ExtableCore`インスタンスから直接アクセスします。

```typescript
import { ExtableCore } from "@extable/core";

const table = new ExtableCore({
  root: container,
  schema,
  defaultData,
  defaultView: {},
});

// すべてのAPIを直接呼び出せる
const row = table.getRow("1");
const pending = table.getPending();
const data = table.getData();
```

== React

`ref`経由でアクセスします。

```typescript
import { useRef } from "react";
import { Extable } from "@extable/react";

export function MyTable() {
  const tableRef = useRef<ExtableCore>(null);

  const handleExport = () => {
    // ref経由でAPIにアクセス
    const data = tableRef.current?.getData();
    const pending = tableRef.current?.getPending();
  };

  return (
    <>
      <Extable ref={tableRef} schema={schema} defaultData={data} />
      <button onClick={handleExport}>Export</button>
    </>
  );
}
```

== Vue

テンプレートrefでアクセスします。

```vue
<script setup lang="ts">
import { ref } from "vue";
import { Extable } from "@extable/vue";
import type { ExtableCore } from "@extable/core";

const tableRef = ref<ExtableCore | null>(null);

const handleExport = () => {
  // ref経由でAPIにアクセス
  const data = tableRef.value?.getData();
  const pending = tableRef.value?.getPending();
};
</script>

<template>
  <div>
    <Extable ref="tableRef" :schema="schema" :default-data="data" />
    <button @click="handleExport">Export</button>
  </div>
</template>
```

:::

## 一括データロード

:::tabs
== Vanilla

### コンストラクタに渡す

初期化時にデータを渡します。

```typescript
import { ExtableCore } from "@extable/core";
import type { Schema } from "@extable/core";

interface UserRow {
  id: string;
  name: string;
  email: string;
  age: number;
}

const schema = {
  columns: [
    { key: "id", header: "ID", type: "string", readonly: true },
    { key: "name", header: "Name", type: "string" },
    { key: "email", header: "Email", type: "string" },
    { key: "age", header: "Age", type: "number" },
  ],
} satisfies Schema;

const data: UserRow[] = [
  { id: "1", name: "Alice", email: "alice@example.com", age: 30 },
  { id: "2", name: "Bob", email: "bob@example.com", age: 28 },
];

const table = new ExtableCore({
  root: document.getElementById("table-root")!,
  schema,
  defaultData: data,
  defaultView: {},
});
```

### マウント後に取得する

非同期ロード時は`defaultData`に`null`を渡します。Extableは`null`/`undefined`でローディングスピナーを表示します。取得後に`setData()`を呼びます。

```typescript
const table = new ExtableCore({
  root: document.getElementById("table-root")!,
  schema,
  defaultData: null,  // ローディング表示
  defaultView: {},
});

// 取得後にsetData()する
const response = await fetch("/api/users");
const fetchedData = await response.json();
table.setData(fetchedData);
```

== React

### コンストラクタに渡す

```typescript
import { Extable } from "@extable/react";

export function UserTable() {
  const data: UserRow[] = [
    { id: "1", name: "Alice", email: "alice@example.com", age: 30 },
    { id: "2", name: "Bob", email: "bob@example.com", age: 28 },
  ];

  return (
    <Extable
      schema={schema}
      defaultData={data}
      defaultView={{}}
    />
  );
}
```

### マウント後に取得する

非同期ロード時は`defaultData`に`null`を渡します。Extableは`null`/`undefined`でローディング表示し、Reactコンポーネントが`null/undefined → data`の遷移を自動で扱います。これは[SWR](https://swr.vercel.app)のような宣言的取得と相性が良いです。

```typescript
import useSWR from "swr";

export function UserTable() {
  // ローディング中はuseSWRがundefinedを返す
  const { data } = useSWR("/api/users", fetcher);

  return (
    <Extable
      schema={schema}
      defaultData={data}  // データ準備中はローディング表示
      defaultView={{}}
    />
  );
}
```

この遷移は一度だけ有効です。2回目以降は`setData()`で更新します。

```ts
  // 2回目以降はsetData()で更新
  const handleRefresh = async () => {
    const response = await fetch("/api/users");
    const refreshedData = await response.json();
    tableRef.current?.setData(refreshedData);
  };
```

== Vue

### コンストラクタに渡す

```vue
<script setup lang="ts">
const data = ref<UserRow[]>([
  { id: "1", name: "Alice", email: "alice@example.com", age: 30 },
  { id: "2", name: "Bob", email: "bob@example.com", age: 28 },
]);
</script>

<template>
  <Extable
    :schema="schema"
    :default-data="data"
    :default-view="{}"
  />
</template>
```

### マウント後に取得する

非同期ロード時は`defaultData`に`null`を渡します。Extableは`null`/`undefined`でローディング表示し、Vueコンポーネントが`null/undefined → data`の遷移を自動で扱います。

```vue
<script setup lang="ts">
const data = ref<UserRow[] | null>(null);

onMounted(async () => {
  const response = await fetch("/api/users");
  data.value = await response.json();
});
</script>

<template>
  <Extable
    :schema="schema"
    :default-data="data"
    :default-view="{}"
  />
</template>
```

この遷移は一度だけ有効です。2回目以降は`setData()`で更新します。

```ts
// 2回目以降はsetData()で更新
const handleRefresh = async () => {
  const response = await fetch("/api/users");
  const refreshedData = await response.json();
  tableRef.value?.setData(refreshedData);
};
```

:::

## 設定の更新

::: warning スキーマは不変
スキーマは初期化時に確定し、後から変更できません。テーブル生成前に設計しておきましょう。
:::

初期化後は、データやビューを次のAPIで更新します。

:::tabs
== Vanilla

```typescript
// データを更新
table.setData(newData);

// Viewを更新（表示列/フィルター/ソート）
table.setView(newView);
```

== React

初回マウント後はpropsの変更で更新されません。`ref`経由でAPIを呼びます。

```typescript
const tableRef = useRef<ExtableCore>(null);

// データを更新
tableRef.current?.setData(newData);

// Viewを更新
tableRef.current?.setView(newView);
```

== Vue

初回マウント後はpropsの変更で更新されません。`ref`経由でAPIを呼びます。

```typescript
const tableRef = ref<ExtableCore | null>(null);

// データを更新
tableRef.value?.setData(newData);

// Viewを更新
tableRef.value?.setView(newView);
```

:::

## 行レベル編集

### 行の取得

IDまたは配列インデックスで取得します（数式結果を含む）。

```typescript
// 行IDで取得（string）
const row = table.getRow("1");

// 配列インデックスで取得（number）
const rowAtIndex = table.getRow(0);

// 数式結果を含むRを返す。見つからなければnull
```

### 行の編集

編集後の状態を取得します。

```typescript
// 特定行の保留編集を取得（Tのみ、数式なし）
const rowPending = table.getPendingForRow("1");  // またはtable.getPendingForRow(0)

// 現在の状態を取得（保留と数式結果を含む）
const currentRow = table.getRow("1");

// 例: 元データと現在を比較
const originalRow = { id: "1", name: "Alice", email: "alice@example.com", age: 30 };
const delta = {
  original: originalRow,
  pending: rowPending,
  current: currentRow,
};
```

### 行の追加

```typescript
// 末尾に追加
const newRowId = table.insertRow({ id: "new-1", name: "Bob", email: "bob@example.com", age: 28 });

// 指定位置に追加（0=先頭, -1=末尾）
const newRowId = table.insertRow(
  { id: "new-2", name: "Charlie", email: "charlie@example.com", age: 35 },
  1  // インデックス1に挿入
);

// 生成された行IDを返す（失敗時はnull）
if (newRowId) {
  console.log("Row inserted with ID:", newRowId);
}
```

**directモード**では即時サーバーへ送信、**commitモード**では`commit()`が必要です。

### 行の削除

```typescript
// 行IDで削除
const success = table.deleteRow("1");

// ビューの行インデックスで削除
const rowId = table.getRow(0)?.id;  // 先頭行のIDを取得
if (rowId) {
  table.deleteRow(rowId);
}

// 削除成功でtrue、行がなければfalse
```

**directモード**では即時送信、**commitモード**では`commit()`が必要です。

## セルレベル編集

### セル値の取得

保留変更と数式結果を含むセル値を取得します。

```typescript
// 列キー指定で型安全に取得
const name = table.getCell("1", "name");  // string | undefined
const age = table.getCell("1", "age");    // number | undefined

// 表示用のフォーマット済み文字列を取得
const displayName = table.getDisplayValue("1", "name");

// セルが保留変更か判定
const isPending = table.getCellPending("1", "name");
```

### セル値の設定

```typescript
// 行IDと列キーで更新
table.setCellValue("1", "name", "Alice");

// 行インデックスと列キーで更新
table.setCellValue(0, "name", "Alice");

// 現在値から新値を計算する関数を使用
table.setCellValue("1", "age", (current) => (current ?? 0) + 1);
```

**directモード**は即時反映＋送信、**commitモード**は保留状態で`commit()`が必要です。readonlyセルは無視されます。

### 列の一括取得

```typescript
// 列キーで型安全に取得
const names = table.getColumnData("name");  // string[]
const ages = table.getColumnData("age");    // number[]
```

### 選択範囲への一括設定

```typescript
// 選択範囲を一括で同値に設定
table.setValueToSelection("example");

// もしくはセルごとに計算
table.setValueToSelection((current) => (current ?? 0) + 10);
```

readonlyセルと編集モードに従います。

## 全データアクセス

### 全データ取得

```typescript
// 保留と数式結果を含む現在データ
const allData = table.getData();  // R[]

// 編集/数式なしの元データ
const rawData = table.getRawData();  // T[]
```

### 保留変更の取得

```typescript
// 保留変更一覧（Tのみ、数式なし）
const pending = table.getPending();  // Map<string, Partial<T>>

// 保留がある行ID一覧
const changedRowIds = table.getPendingRowIds();  // string[]

// 保留があるか判定
const hasChanges = table.hasPendingChanges();    // boolean

// 保留セル数を取得
const cellCount = table.getPendingCellCount();   // number
```

### Commitの戻り値

`commit()`は`RowStateSnapshot<T, R>[]`を返します。

- `commit(): Promise<RowStateSnapshot<T, R>[]>`
- `commit(handler): Promise<RowStateSnapshot<T, R>[]>`

各スナップショットには次が含まれます。
- `rowId`: 行ID
- `rowIndex`: 現在のビューでの位置
- `data`: 計算後の行データ（`R`）
- `pending`: 保留中の生データ（commitモードのみ）
- `diagnostics`: 行の診断/バリデーションエラー

リストは今回の保留コマンドで触れた行のみです。

## Commitモードのデータ取得

### Commit前

```typescript
const pending = table.getPending();        // Map<string, Partial<T>>
const raw = table.getRawData();            // T[]

if (pending.size > 0) {
  await table.commit();
}
```

### 非同期ハンドラ付きCommit

非同期ハンドラで検証やサーバー同期を行えます。ハンドラが例外を投げるとcommitは中断されます。

```typescript
const snapshots = await table.commit(async (changes) => {
  await sendToServer({
    user: changes.user,
    commands: changes.commands,
  });
});

// スナップショット: RowStateSnapshot<T, R>[]
```

### Commit後

```typescript
const noLongerPending = table.getPending();  // 空または最小
const current = table.getData();             // 現在のテーブル状態
```

### サーバー同期（差分更新）

```typescript
const snapshots = await table.commit(async (changes) => {
  await sendToServer({
    action: "bulk-update",
    commands: changes.commands,
    user: changes.user,
    timestamp: Date.now(),
  });
});

// snapshotsはRowStateSnapshot<T, R>[] - 変更行一覧
```

サーバー統合例:

```typescript
async function sendToServer(payload: any) {
  const response = await fetch("/api/table/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.statusText}`);
  }

  return response.json();
}
```

## 便利なメソッド

### IDからインデックスを取得

```typescript
const rowIndex = table.getRowIndex("1");        // number（見つからなければ-1）
const colIndex = table.getColumnIndex("name");  // number（見つからなければ-1）
```

### テーブル状態の取得

```typescript
const state = table.getTableState();  // 保留数や編集モードなどを含む
const selection = table.getSelectionSnapshot();  // 現在のセル選択
```

## 数式の型安全

入力型と計算結果型が異なる場合:

```typescript
interface UserRow {
  id: string;
  name: string;
  age: number;
}

interface UserRowResult extends UserRow {
  ageGroup: string;  // 数式で計算
}

const table = new ExtableCore<UserRow, UserRowResult>({
  root: container,
  defaultData: initialUsers,
  defaultView: {},
  schema: {
    columns: [
      { key: "name", type: "string" },
      { key: "age", type: "number" },
      { key: "ageGroup", type: "string", formula: "=IF(age<30, 'Young', 'Senior')" },
    ],
  },
});

// 型安全アクセスは数式結果を含む
const row = table.getRow("1");  // ageGroupを含むUserRowResult
const ageGroup = table.getCell("1", "ageGroup");  // string | undefined
```

## サブスクリプション

テーブルの変更を購読できます。各サブスクは解除関数を返します。

### テーブル状態の購読

保留数、undo/redo、エラー、描画モードなどを監視します。

```typescript
const unsubscribe = table.subscribeTableState((current, previous) => {
  console.log("Pending changes:", current.pendingCellCount);
  console.log("Can undo:", current.undoRedo.canUndo);
  console.log("Can commit:", current.canCommit);
  console.log("Active errors:", current.activeErrors);
});

// 後で
unsubscribe();
```

### 選択状態の購読

選択範囲やアクティブセルの変化を監視します。

```typescript
const unsubscribe = table.subscribeSelection((current, previous, reason) => {
  console.log("Active row:", current.activeRowKey);
  console.log("Active column:", current.activeColumnKey);
  console.log("Change reason:", reason);  // 'selection', 'edit', 'action', 'data' など
  
  // アクティブセルの値を確認
  if (current.activeRowKey && current.activeColumnKey) {
    console.log("Active value:", current.activeValueDisplay);
  }

  // ボタンセルのアクションpayload（reason === "action"）
  if (reason === "action" && current.action) {
    console.log("Button action:", current.action.value);
  }
});

// 後で
unsubscribe();
```

ボタンセルの起動（クリック/Space）では`reason`が`"action"`になり、`current.action`にpayloadが入ります。リンクセルは遷移のみでpayloadは出ません。

### 行状態の購読

行単位のイベント（insert/edit/delete）を監視します。

```typescript
const unsubscribe = table.subscribeRowState((rowId, next, prev, reason) => {
  if (reason === "delete") {
    console.log(`Row ${rowId} was deleted`);
    return;
  }
  if (reason === "new") {
    console.log(`Row ${rowId} was inserted`, next?.data);
    return;
  }
  console.log(`Row ${rowId} was edited`, { prev: prev?.data, next: next?.data });
});

// 後で
unsubscribe();
```

## 例

### セル編集を検知する

```typescript
table.subscribeTableState((current, previous) => {
  if (current.pendingCellCount > (previous?.pendingCellCount ?? 0)) {
    console.log("A cell was edited!");
  }
});

table.subscribeSelection((current, prev, reason) => {
  if (reason === "edit" && prev?.activeRowKey && prev.activeColumnKey) {
    const newValue = table.getCell(prev.activeRowKey, prev.activeColumnKey);
    console.log("Edit confirmed:", newValue);
  }
});
```

### 変更データのエクスポート

```typescript
function exportChanges() {
  const pending = table.getPending();
  const csv = [];

  for (const [rowId, changes] of pending) {
    const row = table.getRow(rowId);
    csv.push({
      rowId,
      changes,
      currentState: row,
    });
  }

  return JSON.stringify(csv, null, 2);
}
```
