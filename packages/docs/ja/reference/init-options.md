# Init Options

`ExtableCore`の初期化ペイロードと`options`オブジェクトの説明です。

## `CoreInit<T>`

```ts
new ExtableCore<T>({
  root: HTMLElement,
  schema: Schema<T>,
  defaultData: NullableData<T>,
  defaultView: View,
  options?: CoreOptions,
})
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `root` | `HTMLElement` | yes | Extableをマウントする要素。 |
| `schema` | `Schema<T>` | yes | 列定義と検証ルール。 |
| `defaultData` | `NullableData<T>` | yes | 初期ローディングは`null`/`undefined`。null→data遷移は1回のみ自動。 |
| `defaultView` | `View` | yes | 初期フィルター/ソート/列表示。デフォルトは`{}`。 |
| `options` | `CoreOptions` | no | 描画、編集モード、スタイル、サーバー連携。 |

## CoreOptions

### `renderMode`
- Type: `"auto" | "html" | "canvas"`
- Default: `"auto"`
- Notes: `"auto"`はUAとオプションでHTML/Canvasを選択。

### `editMode`
- Type: `"direct" | "commit" | "readonly"`
- Default: `"direct"`
- Notes: `"commit"`は`commit()`呼び出しまで保留。

### `lockMode`
- Type: `"none" | "row"`
- Default: `"none"`
- Notes: `"row"`はマルチユーザーで行ロックを有効化。

### `langs`
- Type: `string[]`
- Default: `undefined`
- Notes: 自動入力シーケンスの言語（例: `"ja"`, `"en"`）。

### `defaultClass`
- Type: `string | string[]`
- Default: `undefined`
- Notes: ルート要素に付与する追加クラス。

### `defaultStyle`
- Type: `Partial<CSSStyleDeclaration>`
- Default: `undefined`
- Notes: ルート要素に適用するインラインスタイル。

### `server`
- Type: `ServerAdapter`
- Default: `undefined`
- Notes: マルチユーザー同期を有効化。`lockRow`, `unlockRows`, `commit`, `subscribe`が必要。

### `user`
- Type: `UserInfo`
- Default: `undefined`
- Notes: ロックとcommit時のユーザー識別。

## ラッパー対応

- **Vanilla**: `new ExtableCore()`に直接渡す。
- **React/Vue**: `schema`, `defaultData`, `defaultView`, `options`propsで対応。

初期化後のメソッドは[Core APIリファレンス](/ja/reference/core)を参照してください。
