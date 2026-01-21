````markdown
# ユニーク ブール（ラジオ）

Interactive なデモです。`unique: true` を持つ `boolean` 列がラジオグループとして表示され、列内でただ一つの行だけが `true` になります。

<ClientOnly>
  <UniqueBoolDemo />
</ClientOnly>

::: info デモについて
「Primary」列のラジオを選択すると、その列で唯一の `true` 行としてマークされ、行がハイライトされます。
:::

## 動作の概要

- 列スキーマは `type: "boolean"` と `unique: true` を使います。
- HTML モードではネイティブの `<input type="radio">` を列ごとにグループ化して表示します。
- Canvas モードではラジオを絵文字（`◯` / `🔘`）で描画し、選択行をハイライトします。

## バニラでの利用例

```ts
import { ExtableCore } from "@extable/core";

const schema = {
  columns: [
    { key: 'id', header: '#', type: 'number', readonly: true },
    { key: 'name', header: 'Name', type: 'string' },
    { key: 'primary', header: 'Primary', type: 'boolean', unique: true },
  ]
};

const data = [
  { id:1, name:'A', primary:false },
  { id:2, name:'B', primary:true },
];

new ExtableCore({ root: document.getElementById('app')!, defaultData: data, defaultView: { hiddenColumns: [], filters: [], sorts: [] }, schema });
```

````
