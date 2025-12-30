# アンコントロールド専用の思想

## なぜアンコントロールドなのか

Extableは、データライフサイクルを**明示的で予測可能**に保つために**アンコントロールド専用**の統合を採用しています。

### コントロールドプロップの問題点

従来のコントロールドコンポーネントでは、親コンポーネントが状態を持ち、再レンダリングでテーブルと同期します。テーブルのような複雑なUIでは次の問題が生まれます。

- **状態の肥大化**: 選択状態、編集中の値、undo/redo履歴、表示フィルター/ソートなどが親の責務になる
- **再レンダリング負荷**: キー入力やクリック、スクロールのたびに親の再レンダリングが発生しやすい（大規模テーブルでは高コスト）
- **暗黙の自動同期**: React/Vueの自動同期が、実際にサーバー側のデータがいつ変わったのかを曖昧にする

### Extableのアプローチ: 明示的な責務分担

Extableはこれを反転させ、**コアライブラリがUI状態**（選択、編集、ビュー）を持ち、**開発者がデータライフサイクル**を管理します。

| 関心事 | 担当 | 役割 |
|---------|-------|---|
| UI状態（選択、編集モード、表示フィルター） | Extable core | 内部でリアクティブに管理し、親からは不可視 |
| データライフサイクル（取得、キャッシュ、更新、再取得） | 開発者 | 明示的に制御し、コードから可視 |

## 開発者の責務: 2ステップ

Extable利用者の責務は**最小限かつ明示的**です。

1. **初期ロード**: `defaultData`で初期データを渡す
2. **更新後**: API呼び出し後に`setData()`で最新データを渡す

それだけです。自動同期も魔法の動作もなく、更新タイミングはあなたが決めます。

## コードパターン

:::tabs

== Vanilla

```javascript
const core = new ExtableCore({
  root: document.getElementById('table'),
  defaultData: initialData,
  defaultView: defaultView,
  schema: schema,
});

// テーブル状態の変更を監視（ユーザー編集など）
core.subscribeTableState((nextState, prevState, reason) => {
  console.log('Table changed:', reason);
  
  // 例: 編集検知時に最新データを取得して反映
  if (reason === 'edit' || reason === 'commandExecuted') {
    handleTableChanged();
  }
});

async function handleTableChanged() {
  try {
    // APIから最新データを取得
    const response = await fetch('/api/table');
    const freshData = await response.json();
    
    // 明示的にテーブルへ新データを反映
    core.setData(freshData);
  } catch (error) {
    console.error('Failed to refresh:', error);
  }
}

// ユーザーがSaveボタンをクリックしたとき
document.getElementById('saveBtn').addEventListener('click', async () => {
  // 送信が必要なら現在のテーブルデータを取得
  // この例では再取得のみ行い、保存はサーバーに任せる
  await handleTableChanged();
});
```

== React

```tsx
import { useRef } from 'react';
import { Extable } from '@extable/react';

export function MyTable() {
  const tableRef = useRef(null);

  const handleTableStateChange = async (nextState, prevState, reason) => {
    console.log('Table state changed:', reason);
    
    // 編集やコマンド実行時にデータを再取得
    if (reason === 'edit' || reason === 'commandExecuted') {
      await refreshTableData();
    }
  };

  const refreshTableData = async () => {
    try {
      const response = await fetch('/api/table');
      const freshData = await response.json();
      
      // 明示的に新しいデータを反映
      tableRef.current?.setData(freshData);
    } catch (error) {
      console.error('Failed to refresh:', error);
    }
  };

  const handleSaveClick = async () => {
    // ここに保存処理を書く
    // 保存成功後にテーブルを更新
    await refreshTableData();
  };

  return (
    <>
      <Extable
        ref={tableRef}
        schema={schema}
        defaultData={initialData}
        defaultView={defaultView}
        onTableState={handleTableStateChange}
      />
      <button onClick={handleSaveClick}>Save</button>
    </>
  );
}
```

== Vue

```vue
<template>
  <div>
    <ExtableVue
      ref="tableRef"
      :schema="schema"
      :defaultData="initialData"
      :defaultView="defaultView"
      @tableState="handleTableStateChange"
    />
    <button @click="handleSaveClick">Save</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import ExtableVue from '@extable/vue';

const tableRef = ref(null);
const schema = { /* ... */ };
const initialData = { /* ... */ };
const defaultView = { /* ... */ };

const handleTableStateChange = async (nextState, prevState, reason) => {
  console.log('Table state changed:', reason);
  
  // 編集やコマンド実行時にデータを再取得
  if (reason === 'edit' || reason === 'commandExecuted') {
    await refreshTableData();
  }
};

const refreshTableData = async () => {
  try {
    const response = await fetch('/api/table');
    const freshData = await response.json();
    
    // 明示的に新しいデータを反映
    tableRef.value?.setData(freshData);
  } catch (error) {
    console.error('Failed to refresh:', error);
  }
};

const handleSaveClick = async () => {
  // ここに保存処理を書く
  // 保存成功後にテーブルを更新
  await refreshTableData();
};
</script>
```
:::

## 利点

1. **明快さ**: 隠れた再取得やキャッシュがなく、更新タイミングはコードで制御
2. **柔軟性**: SWR、React Query、Apolloなど任意の取得ライブラリと統合可能
3. **予測可能性**: プロップ差分の魔法がなく、書いた通りに動作
4. **テスト容易性**: データ更新が明示的な関数呼び出しで、モックしやすい

## いつ更新するか

`setData()`を**呼ぶべきタイミング**:

- ユーザーがSave/Syncボタンを押したとき
- WebSocketで新しいデータを受信したとき
- サーバーをポーリングして新しいデータを受け取ったとき
- マルチユーザー同期が完了したとき

`setData()`を**自動で呼ばないタイミング**:

- キー入力ごと（編集はテーブル内部で完結）
- 画面遷移時（明示的に取得する場合を除く）
- 親コンポーネントのプロップ変更（`defaultData`で一度渡す）

## 次のステップ

- **ガイド** → **導入**で最小構成を確認
- **使い方** → **編集**で内部の編集フローを理解
- **リファレンス**で`setData()`や`subscribeTableState()`などのAPIを確認
