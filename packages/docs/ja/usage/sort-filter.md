# ソート&フィルターガイド

Extableはビュー層に統合された直感的なソート/フィルターを提供します。ソートやフィルターは表示にのみ影響し、元データは変更されません。

## ソート/フィルターパネルを開く

各列ヘッダーのフィルター/ソートアイコンをクリックすると、その列の**ソート/フィルターパネル**が開きます。

## パネル構成

```
┌──────────────────────────────────────┐
│ Sort/Filter: Name             [×]    │
├──────────────────────────────────────┤
│ Filter                               │
│ ☐ Errors  ☐ Warnings                │
│ [Search values...]                   │
│                                      │
│ ☑ User 1                             │
│ ☑ User 10                            │
│ ☑ User 100                           │
│ ☑ User 11                            │
│ ☑ User 12                            │
│ ☑ User 13                            │
│ ...                                  │
│                                      │
│ [Select All] [Select None]           │
│ [Apply]      [Clear]                 │
│                                      │
│ Sort                                 │
│ [Sort Asc]  [Sort Desc]  [Clear Sort]│
└──────────────────────────────────────┘
```

## フィルタリング

### 列値によるフィルター

**重複値フィルター:**

選択列のユニークな値がチェックボックスで表示されます。

- **チェック/解除**で対象を絞り込み
- **空値の含有**を選択可能
- 複数値は**OR条件**（いずれか一致）

### 値検索

検索欄で素早く絞り込めます。

- 入力でリストをフィルタ
- 値が多い列で有効

### フィルター操作

- **Select All** - すべて選択
- **Select None** - すべて解除
- **Apply** - フィルター適用
- **Clear** - この列のフィルターを解除

### 診断フィルター

列にエラー/警告がある場合:

- **☐ Errors** - エラー行のみ表示
- **☐ Warnings** - 警告行のみ表示

## ソート

### 列でソート

パネル下部のソート欄を使用します。

- **Sort Asc** - 昇順（A→Z, 0→9, 早い→遅い）
- **Sort Desc** - 降順（Z→A, 9→0, 遅い→早い）
- **Clear Sort** - この列のソートを解除

### 単一列ソート

Extableは**1列のみ**のソートに対応します。別列でソートすると前のソートは上書きされます。

```
Scenario 1: Sort Name (Asc)
Table shows: All rows sorted by Name (A→Z)

Scenario 2: Click Sort Asc on Status
Result: Previous Name sort is replaced
Table shows: All rows sorted by Status
```

### ソート解除

**Clear Sort**でソートを外し、元のデータ順に戻します。
