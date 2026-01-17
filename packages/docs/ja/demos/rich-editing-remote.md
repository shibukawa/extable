# リッチ編集（Lookup / 外部エディタ / ツールチップ）

このデモでは、スキーマのフックで実現する「リッチ編集」連携を紹介します。

- **リモートLookup**（タイプアヘッド + 表示ラベル/保存値の分離）
- **外部エディタ委譲**（Promiseでcommit/cancel）
- **非同期ツールチップ**（同期/Promiseどちらも可）

## インタラクティブデモ

<ClientOnly>
  <RichEditingRemoteDemo />
</ClientOnly>

## 仕組み

### リモートLookup

`edit.lookup.fetchCandidates` を設定すると、入力中に候補を取得してドロップダウンを表示します。
候補の `label` を表示しつつ、安定IDなどの `value` を含む構造化値を保存できます。

```ts
import type { LookupCandidate } from "@extable/core";

const fetchCandidates = async ({ query, signal }: { query: string; signal?: AbortSignal }): Promise<LookupCandidate[]> => {
  // AbortSignalを尊重しつつ、APIから候補を取得してください。
  // 戻り値: [{ label, value, meta? }, ...]
  // 注: 空のqueryでも全候補を返してください。そうすることで、セルをクリック時に
  // 初期状態で利用可能な候補が表示されます。
  const q = query.trim().toLowerCase();
  const allUsers = [{ id: "u1", name: "Alice" }, ...];
  return allUsers
    .filter(u => !q || u.name.toLowerCase().includes(q))
    .map(u => ({ label: u.name, value: u.id }));
};

const schema = {
  columns: [
    {
      key: "assignee",
      type: "string",
      edit: {
        lookup: {
          fetchCandidates,
        },
      },
    },
  ],
};
```

### 外部エディタ委譲

`edit.externalEditor.open` を設定すると、編集開始時に外部UIへ委譲できます。
ExtableはPromiseを待ち、`commit` で値を確定、`cancel` で変更なしにします。

```ts
const schema = {
  columns: [
    {
      key: "details",
      type: "string",
      edit: {
        externalEditor: {
          open: async ({ rowId, colKey, currentValue }) => {
            // モーダル/リッチエディタUIを開きます。
            // { kind: "commit", value } または { kind: "cancel" } を返します。
            return { kind: "cancel" };
          },
        },
      },
    },
  ],
};
```

### ツールチップ（非同期）

`tooltip.getText` は `string | null` または `Promise<string | null>` を返せます。

```ts
const schema = {
  columns: [
    {
      key: "assignee",
      type: "string",
      tooltip: {
        getText: async ({ currentValue, signal }) => {
          // ホバー表示用の情報を取得できます。
          return currentValue ? String(currentValue) : null;
        },
      },
    },
  ],
};
```
