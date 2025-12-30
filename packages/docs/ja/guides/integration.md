# 導入ガイド

このガイドでは、Extableをアプリケーションへ統合するための基本事項を解説します。

## 導入

### はじめに

初期化と基本設定の理解には、[Basic Usage Demo](/ja/demos/basic-usage)から始めるのが最短です。

関連項目:
- [データフォーマットガイド](/ja/guides/data-format) - スキーマ定義と対応型
- [APIからのデータアクセス](/ja/guides/data-access) - 非同期データ取得パターン
- [Init Optionsリファレンス](/ja/reference/init-options) - テーブル初期化オプション

### ショートカットキー登録

Undo/Redoのキーボードショートカットを登録します。

:::tabs
== Vanilla

```typescript
import { ExtableCore } from "@extable/core";

const table = new ExtableCore({
  root: container,
  schema,
  defaultData,
  defaultView: {},
});

// Ctrl+Z / Ctrl+Shift+Z（undo/redo）のキー操作を登録
const onKey = (e: KeyboardEvent) => {
  const key = e.key.toLowerCase();
  const isMod = e.metaKey || e.ctrlKey;
  if (!isMod) return;

  // 取り消し: Ctrl/Cmd+Z
  if (key === "z") {
    if (!table) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) {
      table.redo();  // やり直し: Ctrl/Cmd+Shift+Z
    } else {
      table.undo();  // 取り消し: Ctrl/Cmd+Z
    }
  }
};
document.addEventListener("keydown", onKey, { capture: true });
window.addEventListener("beforeunload", () => {
  document.removeEventListener("keydown", onKey, { capture: true });
});
```

== React

```typescript
import { Extable } from "@extable/react";
import { useRef, useEffect } from "react";

export function MyTable() {
  const tableRef = useRef<ExtableCore>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      // 取り消し: Ctrl/Cmd+Z
      if (key === "z") {
        if (!tableRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          tableRef.current.redo();  // やり直し: Ctrl/Cmd+Shift+Z
        } else {
          tableRef.current.undo();  // 取り消し: Ctrl/Cmd+Z
        }
      }
    };

    document.addEventListener("keydown", onKey, { capture: true });
    return () => {
      document.removeEventListener("keydown", onKey, { capture: true });
    };
  }, []);

  return <Extable ref={tableRef} schema={schema} defaultData={data} defaultView={{}} />;
}
```

== Vue

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { Extable } from "@extable/vue";
import type { ExtableCore } from "@extable/core";

const tableRef = ref<ExtableCore | null>(null);

const onKey = (e: KeyboardEvent) => {
  const key = e.key.toLowerCase();
  const isMod = e.metaKey || e.ctrlKey;
  if (!isMod) return;

  // 取り消し: Ctrl/Cmd+Z
  if (key === "z") {
    if (!tableRef.value) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.shiftKey) {
      tableRef.value.redo();  // やり直し: Ctrl/Cmd+Shift+Z
    } else {
      tableRef.value.undo();  // 取り消し: Ctrl/Cmd+Z
    }
  }
};

onMounted(() => {
  document.addEventListener("keydown", onKey, { capture: true });
});

onUnmounted(() => {
  document.removeEventListener("keydown", onKey, { capture: true });
});
</script>

<template>
  <Extable ref="tableRef" :schema="schema" :default-data="data" :default-view="{}" />
</template>
```

:::

**キーボードショートカット:**
- **Ctrl/Cmd+Z** - 直前の変更を取り消し
- **Ctrl/Cmd+Shift+Z** - 取り消しをやり直し

Undo/Redoの詳細は[データアクセスAPI](/ja/guides/data-access#undo--redo)を参照してください。

### レイアウトとレスポンシブ設計

テーブルのコンテナは明示的なサイズが必要です。以下に、各フレームワークでのHTML構造、class/style設定、CSS（またはTailwind）の例を示します。

:::tabs
== Vanilla

テーブルはコンテナ（`#table-root`）いっぱいに表示します。親とコンテナに明示的なサイズを持たせ、flexで配置します。

```html
<div class="app">
  <aside class="sidebar"><!-- Menu --></aside>
  <div class="main">
    <div class="toolbar"><!-- Controls --></div>
    <div id="table-root"></div>
  </div>
</div>
```

```typescript
const core = new ExtableCore({
  root: document.getElementById("table-root")!,
  defaultData: data,
  schema: schema,
  options: {
    // 任意: デフォルトのクラス/スタイルを適用
    defaultClass: "table-container",
    defaultStyle: { border: "1px solid #e0e0e0" },
  },
});
```

CSS:

```css
.app {
  display: flex;
  height: 100vh;
}

.sidebar {
  width: 250px;
  border-right: 1px solid #e0e0e0;
  overflow-y: auto;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.toolbar {
  padding: 8px 12px;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;
}

#table-root {
  flex: 1;
  min-height: 0;
}

.table-container {
  /* Applied via options.defaultClass */
}
```

== React

Reactラッパー（`@extable/react/Extable`）をTailwindで使う例です。

```tsx
import { useRef } from "react";
import { Extable, type ExtableHandle } from "@extable/react";
import type { Schema } from "@extable/core";

export function TableView({ data, schema }: { data: any[]; schema: Schema }) {
  const tableRef = useRef<ExtableHandle>(null);

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r overflow-y-auto">
        {/* Sidebar content */}
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b px-3 py-2">
          {/* Toolbar content */}
        </div>
        <div className="min-h-0 flex-1 overflow-visible p-5">
          <Extable
            ref={tableRef}
            schema={schema}
            defaultData={data}
            defaultView={{}}
            options={{}}
            className="min-h-0 h-full w-full"
          />
        </div>
      </div>
    </div>
  );
}
```

`className`と`style`の両方が利用できます。

```tsx
// classNameを使用（Tailwind）
<Extable className="min-h-0 h-full w-full" />

// inline styleを使用
<Extable style={{ height: "100%", width: "100%" }} />

// 他のHTMLAttributesと併用
<Extable
  className="my-table"
  style={{ backgroundColor: "#f5f5f5" }}
  data-testid="extable-demo"
/>
```

== Vue

Vueコンポーネントは`class`と`style`を通常通り受け取れます。

```vue
<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { Extable } from "@extable/vue";
import type { Schema } from "@extable/core";

defineProps<{ data: any[]; schema: Schema }>();

const tableRef = ref<InstanceType<typeof Extable> | null>(null);
</script>

<template>
  <div class="flex h-screen">
    <aside class="w-64 border-r overflow-y-auto">
      <!-- Sidebar content -->
    </aside>
    <div class="flex-1 flex flex-col min-w-0">
      <div class="border-b px-3 py-2">
        <!-- Toolbar content -->
      </div>
      <div class="min-h-0 flex-1 overflow-visible p-5">
        <Extable
          ref="tableRef"
          :schema="schema"
          :default-data="data"
          :default-view="{}"
          :options="{}"
          class="min-h-0 h-full w-full"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Scoped styles automatically apply to this component */
</style>
```

`class`と`style`の両方に対応します。

```vue
<!-- Using class (Tailwind) -->
<Extable class="min-h-0 h-full w-full" />

<!-- Using inline style -->
<Extable :style="{ height: '100%', width: '100%' }" />

<!-- Combining both -->
<Extable
  class="my-table"
  :style="{ backgroundColor: '#f5f5f5' }"
/>
```

:::

::: tip コンテナ要件
- `width`と`height`を明示（`auto`は不可）
- flex/gridでは`min-width: 0`と`min-height: 0`を設定
- コンテナのサイズ変更に自動追従
:::

### カスタマイズ

- [バリデーション](/ja/guides/validation) - スキーマ制約
- [編集モード](/ja/guides/editmode) - 特定セル/列の保護
- [数式](/ja/guides/formulas) - 計算列の追加
- [条件付きスタイル](/ja/guides/conditional-style) - 動的スタイル
- [スタイル](/ja/guides/style) - テーマと見た目

## インタラクション設計

アプリの要件に合わせてインタラクションパターンを選びます。  
詳細なAPIは[データアクセスAPI](/ja/guides/data-access)を参照してください。

### 読み取り専用モード

ユーザーは閲覧や検索のみ可能で編集できません。

```typescript
const table = new ExtableCore({
  root: container,
  schema,
  defaultData,
  defaultView: {},
  options: {
    editMode: "readonly",  // すべての編集を無効化
  },
});
```

用途: レポート、ダッシュボード、監査ログ。

### 直接編集モード

編集は即時反映され、確認操作は不要です（設定されていればサーバーへ即送信）。

```typescript
const table = new ExtableCore({
  root: container,
  schema,
  defaultData,
  defaultView: {},
  options: {
    editMode: "direct",  // デフォルト: 変更は即時反映
  },
});

// 行単位の変更を監視
table.subscribeRowState((rowId, event) => {
  if (event === "edit") {
    console.log(`Row ${rowId} was edited - send to server`);
  } else if (event === "new") {
    console.log(`Row ${rowId} was inserted`);
  } else if (event === "delete") {
    console.log(`Row ${rowId} was deleted`);
  }
});
```

用途: 迅速な入力フォーム、ライブダッシュボード、即時フィードバック。

### コミットモード

編集は保留され、ユーザーが明示的にcommitするまで反映されません。

```typescript
const table = new ExtableCore({
  root: container,
  schema,
  defaultData,
  defaultView: {},
  options: {
    editMode: "commit",  // 明示的なcommitが必要
  },
});

// 保留変更を監視してUI更新
table.subscribeTableState((state) => {
  const saveButton = document.getElementById("save-btn");
  // 保留がある時だけSaveボタンを有効化
  saveButton!.disabled = !state.canCommit;
  
  console.log(`${state.pendingCellCount} cells pending`);
});
```

ユーザーが「Save」や「Submit」などをクリックしたとき（アプリ側で実装）:

```typescript
async function handleSave() {
  try {
    const changes = await table.commit();
    
    // 差分をサーバーへ送信
    const response = await fetch("/api/table/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changes }),
    });

    if (response.ok) {
      console.log("Changes saved successfully");
    }
  } catch (error) {
    console.error("Save failed:", error);
  }
}
```

用途: フォームワークフロー、一括インポート、トランザクション更新、監査対応。

## テスト

ユニットテストとE2Eテスト戦略は[ユニットテストガイド](/ja/guides/unit-testing)を参照してください。
