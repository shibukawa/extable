# イベントとコールバックペイロード

Extableのイベントコールバックのペイロードと戻り値をまとめます。

## テーブル状態

### `subscribeTableState(listener)`

**Signature**:
```ts
(listener: TableStateListener) => () => void
```

**Listener**:
```ts
(next: TableState, prev: TableState | null) => void
```

**戻り値**:
- 解除関数を返します。
- リスナーの戻り値は無視されます。

**TableState fields**:
- `canCommit: boolean`
- `pendingCommandCount: number`
- `pendingCellCount?: number`
- `undoRedo: { canUndo: boolean; canRedo: boolean }`
- `renderMode: "html" | "canvas"`
- `activeErrors: TableError[]`

**TableError**:
- `scope: "validation" | "commit" | "render" | "formula" | "conditionalStyle" | "unknown"`
- `message: string`
- `target?: { rowId?: string; colKey?: string }`

## 選択/セルイベント

### `subscribeSelection(listener)`

**Signature**:
```ts
(listener: SelectionListener) => () => void
```

**Listener**:
```ts
(next: SelectionSnapshot, prev: SelectionSnapshot | null, reason: SelectionChangeReason) => void
```

**戻り値**:
- 解除関数を返します。
- リスナーの戻り値は無視されます。

**SelectionSnapshot fields**:
- `ranges: SelectionRange[]`
- `activeRowIndex: number | null`
- `activeRowKey: string | null`
- `activeColumnIndex: number | null`
- `activeColumnKey: string | null`
- `activeValueRaw: unknown`
- `activeValueDisplay: string`
- `activeValueType: ColumnType | null`
- `diagnostic: CellDiagnostic | null`
- `action?: CellAction | null` (only when `reason === "action"`)
- `styles: { columnStyle: Partial<ResolvedCellStyle>; cellStyle: Partial<ResolvedCellStyle>; resolved: Partial<ResolvedCellStyle> }`

**SelectionChangeReason**:
- `selection`
- `edit`
- `action`
- `style`
- `schema`
- `view`
- `data`
- `unknown`

**CellAction**:
- `kind: "button"`
- `rowId: string`
- `colKey: string`
- `value: ButtonActionValue`

**ButtonActionValue**:
- `{ label: string }`
- `{ label: string; command: string; commandfor: string }`

**Notes**:
- `reason === "action"`はボタンクリック/Spaceのみ。
- リンクセルは`href`へ遷移し、`action`は出ません。

## 行状態（Coreのみ）

### `subscribeRowState(listener)`

**Signature**:
```ts
(listener: RowStateListener<T, R>) => () => void
```

**Listener**:
```ts
(rowId: string, next: RowStateSnapshot<T, R> | null, prev: RowStateSnapshot<T, R> | null, reason: RowChangeReason) => void
```

**戻り値**:
- 解除関数を返します。
- リスナーの戻り値は無視されます。

**RowStateSnapshot fields**:
- `rowId: string`
- `rowIndex: number`
- `data: R`
- `pending?: Partial<T>`
- `diagnostics?: TableError[]`

**RowChangeReason**:
- `new`
- `edit`
- `delete`

## ラッパーのコールバック

### React

```ts
onTableState?: (next: TableState, prev: TableState | null) => void
onCellEvent?: (next: SelectionSnapshot, prev: SelectionSnapshot | null, reason: SelectionChangeReason) => void
```

### Vue

```ts
@tableState="(next, prev) => {}"
@cellEvent="(next, prev, reason) => {}"
```

ラッパーのコールバックは戻り値を無視します。

## 関連ドキュメント

- [コールバックガイド](/ja/guides/callbacks)
- [Core APIリファレンス](/ja/reference/core)
- [データアクセスガイド](/ja/guides/data-access)
