# ExtableCore APIリファレンス

ExtableCoreはExtableのフレームワーク非依存コアです。下記メソッドはVanilla/React/Vueで共通です。フレームワーク別のアクセスは[APIアクセス](/ja/guides/data-access#apiへのアクセス)を参照してください。

## コンストラクタ

```typescript
new ExtableCore<T, R>(init: CoreInit<T>)
```

データ、スキーマ、オプションでテーブルを初期化します。

**パラメータ**:
- `root: HTMLElement` - テーブルのコンテナ要素
- `schema: Schema<T, R>` - 列定義、検証、フォーマット
- `defaultData?: NullableData<T>` - 初期データ
- `defaultView?: View` - 初期フィルター/ソート/表示列
- `options?: CoreOptions` - 描画モード、編集モード、ロック、スタイル、サーバー連携

**例**:
```typescript
const table = new ExtableCore({
  root: document.getElementById("table"),
  schema: mySchema,
  defaultData: rows,
  defaultView: { filters: [], sorts: [] },
  options: { renderMode: "html", editMode: "commit" },
});
```

---

## ライフサイクル

### `destroy()`
テーブルを破棄してDOMから削除します。リスナー解除とバックグラウンド停止も行います。

### `remount(target: HTMLElement)`
別のDOM要素に再マウントします。モーダルやレイアウト変更に便利です。

---

## データ管理

### データ取得

#### `getData(): R[]`
数式を評価済みのデータを取得します（`R`）。

#### `getRawData(): T[]`
数式未適用の生データを取得します（`T`）。

#### `getTableData(): R[]`
フィルター/ソート後の表示データを取得します。

例は[フィルター/ソート](/ja/demos/filter-support)を参照。

#### `getRow(rowIdOrIndex: string | number): R | null`
IDまたはインデックスで行を取得します。

#### `getCell(rowIdOrIndex: string | number, colKey: string): unknown`
行と列キーでセル値を取得します。

### データ更新

#### `setData(data: NullableData<T>)`
テーブル全データを置き換えます。

#### `setCellValue(rowIdOrIndex: string | number, colKey: string, value: unknown): void`
1セルの値を更新します（direct/commitに従う）。

#### `insertRow(rowData: T, position?: number | string): string | null`
指定位置に行を追加します（未指定なら末尾）。

**パラメータ**:
- `rowData` - 新しい行データ
- `position` - 挿入位置（行インデックスまたは行ID）

#### `deleteRow(row: string | number): boolean`
行を削除します。成功時`true`。

---

## スキーマとビュー

#### `setSchema(schema: Schema<T, R>)`
スキーマを更新し、再検証/再描画を行います。

#### `getSchema(): Schema<T, R>`
現在のスキーマを取得します。

#### `setView(view: View)`
フィルター、ソート、表示列を更新します。

#### `getView(): View`
現在のビュー状態を取得します。

ビュー設定は[フィルターサポート](/ja/demos/filter-support)を参照。

### Readonly / Disabled マトリクス

| Column Type | Schema `readonly` | Conditional `{ readonly: true }` | Schema `disabled` | Conditional `{ disabled: true }` | Notes |
| --- | --- | --- | --- | --- | --- |
| `button` | Always readonly (not configurable) | Not supported | Supported | Supported | Disabled uses readonly gray and blocks interaction. |
| `link` | Always readonly (not configurable) | Not supported | Supported | Supported | Disabled uses readonly gray and blocks interaction. |
| `formula` | Always readonly (not configurable) | Not supported | Not supported | Not supported | Conditional readonly/disabled ignored. |
| `boolean/number/date/time/datetime` | Supported | Supported | Not supported | Not supported | Readonly can be set in schema or conditionalStyle. |
| `string/enum/tags` | Supported | Supported | Not supported | Not supported | Readonly can be set in schema or conditionalStyle. |

`disabled`はbutton/linkのみ`style.disabled`または`conditionalStyle`で設定します。

---

## CommitモードAPI

commitモードでは編集が保留されます。以下が保留状態とcommitを管理します。

#### `getPending(): Map<string, Record<string, unknown>>`
保留中の編集を行IDで取得します。

#### `getPendingRowIds(): string[]`
保留がある行ID一覧を取得します。

#### `getPendingCellCount(): number`
保留セル数を取得します。

#### `commit(): Promise<RowStateSnapshot<T, R>[]>`
保留編集を確定して変更行を返します。

#### `commit(handler: (changes) => Promise<void>): Promise<RowStateSnapshot<T, R>[]>`
非同期ハンドラを実行し、成功時にcommitします。ハンドラが失敗すると中断されます。

例は[Commitモード](/ja/demos/commit-mode)を参照。

---

## Undo & Redo

#### `undo()`
直前の編集を戻します。

#### `redo()`
直前に戻した編集を再適用します。

#### `getUndoRedoHistory(): UndoRedoHistory`
Undo/Redoの履歴情報を取得します。

---

## 選択とセルアクセス

#### `getRowIndex(rowId: string): number`
行IDからビュー内インデックスを取得します。

#### `getColumnIndex(colKey: string): number`
列キーからスキーマ内インデックスを取得します。

#### `findRowById(rowId: string): InternalRow | null`
内部行オブジェクトを取得します。

#### `getAllRows(): InternalRow[]`
すべての内部行（非表示含む）を取得します。

#### `getSelectionSnapshot(): SelectionSnapshot`
現在の選択状態を取得します。

#### `setValueToSelection(next: Updater<unknown>)`
選択中のセルを一括更新します。

---

## スタイルと外観

#### `setRootClass(classNames: string | string[])`
ルート要素のクラスを追加/切替します。

#### `setRootStyle(style: Partial<CSSStyleDeclaration>)`
ルート要素にインラインスタイルを適用します。

---

## UI

### フィルター/ソートパネル

#### `showFilterSortPanel(colKey: string)`
指定列のパネルを表示します。

**パラメータ**:
- `colKey` - 対象列キー

#### `hideFilterSortPanel()`
パネルを閉じます。

#### `toggleFilterSortPanel(colKey: string)`
指定列のパネル表示を切り替えます。別列が開いている場合は閉じます。

#### `isFilterSortPanelVisible(): boolean`
パネルが開いているかを返します。

例は[フィルター/ソート](/ja/demos/filter-support)を参照。

---

## サブスクリプションとイベント

#### `subscribeTableState(listener: TableStateListener): () => void`
テーブル状態の変更を購読します。解除関数を返します。

**シグネチャ**: `(next: TableState, prev: TableState | null) => void`

#### `subscribeSelection(listener: SelectionListener): () => void`
選択の変更を購読します。

**シグネチャ**: `(next: SelectionSnapshot, prev: SelectionSnapshot | null, reason: SelectionChangeReason) => void`

#### `subscribeRowState(listener: RowStateListener<T, R>): () => void`
行単位の変更を購読します。

**シグネチャ**: `(rowId: string, next: RowStateSnapshot<T, R> | null, prev: RowStateSnapshot<T, R> | null, reason: RowChangeReason) => void`

利用例は[コールバック](/ja/guides/callbacks)を参照。

---

## 行の識別

行アクセスは次の2方式です。

- **Row ID**（`string`）: フィルター/ソートでも変わらない安定ID
- **Row Index**（`number`）: 現在ビューでの0始まり位置

多くのメソッドはどちらでも受け取れます。詳細は[データアクセス](/ja/guides/data-access#行の識別)を参照。

---

## フレームワーク別アクセス

すべてのメソッドは共通です。

- **Vanilla JS**: `ExtableCore`に直接呼び出し
- **React**: `<Extable>`の`ref`から呼び出し
- **Vue**: `<Extable>`のtemplate refから呼び出し

例は[APIアクセス](/ja/guides/data-access#apiへのアクセス)を参照してください。
