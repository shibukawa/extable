# セル編集ガイド

Extableは、ExcelやGoogle Sheets互換のキーボード操作、マウス操作、クリップボード対応で直感的な編集体験を提供します。

## 基本のセル選択

### クリックで選択

任意のセルをクリックすると、青い枠で選択されます。

```
┌─────────────────────────────┐
│ Name      │ Email           │
├─────────────────────────────┤
│ Alice     │ alice@test.com  │  ← Click to select
│ Bob       │ bob@test.com    │
└─────────────────────────────┘
```

### ドラッグで複数セルを選択

クリックしてドラッグすると矩形範囲を選択できます。

```
┌─────────────────────────────┐
│ Name      │ Email           │
├─────────────────────────────┤
│ Alice     │ alice@test.com  │  ← Click and drag
│ Bob       │ bob@test.com    │     to here
│ Charlie   │ charlie@test.com│  ← Release
└─────────────────────────────┘
```

**選択の挙動:**
- 任意のセルからドラッグで矩形選択
- 範囲内の全セルが対象
- 画面外までドラッグすると自動スクロール

### Shift+Clickで選択拡張

Shiftを押しながら別セルをクリックすると、アクティブセルから範囲選択します。

```typescript
// アクティブセル: A1
// Shift+クリックでB2
// 結果: A1:B2を選択
```

## セル編集

### クリックして入力

セルを1回クリックして入力を始めると、即座に内容が置き換わります。

```
┌─────────────────────────────┐
│ Name      │ Email           │
├─────────────────────────────┤
│ Alice     │ alice@test.com  │  ← Click once
│ (typing)  │                 │     then type: "Bob"
│           │                 │     → Cell becomes "Bob"
└─────────────────────────────┘
```

**ポイント:**
- 最初のキー入力で置き換え
- 数値/日付/enumは適切にフォーマット
- 印字可能なキーで即編集開始

### ダブルクリックで編集

ダブルクリック（またはF2）で内容を保持したまま編集に入ります。

```
┌─────────────────────────────┐
│ Name      │ Email           │
├─────────────────────────────┤
│ Alice     │ alice@test.com  │  ← Double-click
│ Alice|    │                 │     (cursor appears, can edit text)
└─────────────────────────────┘
```

**用途:**
- 既存文字の修正/追記
- 複雑な値の編集
- セル内カーソル移動

### 編集中のショートカット

| Shortcut | Action |
|----------|--------|
| **Escape** | 編集キャンセル、変更破棄 |
| **Enter** | 確定して下へ |
| **Shift+Enter** | 確定して上へ |
| **Tab** | 確定して右へ |
| **Shift+Tab** | 確定して左へ |
| **Ctrl+A** | セル内全選択（編集時のみ） |
| **Ctrl+Z** | Undo（編集中） |
| **Ctrl+C** | 選択テキストをコピー |
| **Ctrl+V** | 編集セルへ貼り付け |

## セル移動

### 矢印キー

矢印キーで移動します。

```
┌─────────────────────────────┐
│ A1  │ B1  │ C1              │
├─────────────────────────────┤
│ A2  │ B2* │ C2              │  ← Active cell: B2
│ A3  │ B3  │ C3              │
└─────────────────────────────┘

↑ (Up)    → Move to B1
↓ (Down)  → Move to B3
← (Left)  → Move to A2
→ (Right) → Move to C2
```

**選択時:**
- 矢印キーでアクティブセル移動
- Shift+矢印で範囲拡張

### Tabで右へ

```text
Edit A1 → Press Tab → Move to B1
```

Shift+Tabで左へ:

```text
Edit B1 → Press Shift+Tab → Move to A1
```

### Enterで下へ

```text
Edit A1 → Press Enter → Move to A2
```

Shift+Enterで上へ:

```text
Edit A2 → Press Shift+Enter → Move to A1
```

## フィルハンドルで一括入力

フィルハンドルは縦方向の連続セルに一括入力する機能です。

### フィルハンドルの使い方

アクティブセル右下の小さな四角を下にドラッグします。

```
┌─────────────────────────────┐
│ Value   │ Description       │
├─────────────────────────────┤
│ 1       │ (active cell)     │  ← Drag from here
│ 1       │ (filled)          │
│ 1       │ (filled)          │
│ 1       │ (filled)          │
└─────────────────────────────┘
```

**挙動:**

1. **現在値のコピー**（デフォルト）
   ```
   Select: A1 = "Apple"
   Fill down to A5 → All cells = "Apple"
   ```

2. **連番の自動入力**（該当時）
   ```
   Select: A1 = 1, A2 = 2
   Fill down to A5 → Cells = 1, 2, 3, 4, 5
   ```

3. **型に合わせた入力**
   - Enum: 選択肢を順に循環
   - Boolean: true/falseを交互
   - Date: 1日ずつ加算
   - String: 値を繰り返し

### フィルハンドルの制限

- **縦方向のみ**（左右は不可）
- **連続セルのみ**
- **型とスキーマを尊重**

## コピー&ペースト

Extableのクリップボード操作はExcelやGoogle Sheetsと互換です。

### セルのコピー

```typescript
// A1:B3を選択
// Ctrl+Cを押す
// タブ区切りでクリップボードにコピー
```

**クリップボード形式:**
```
Alice	alice@test.com
Bob	bob@test.com
Charlie	charlie@test.com
```

### 外部ソースから貼り付け

Ctrl+V（MacはCmd+V）で貼り付けると:

1. TSV/CSVを解析
2. 位置で列をマッピング
3. 型変換と検証
4. 行数が足りなければ追加

**Excelからの例:**

```
Excel Selection:
Name      Email
Alice     alice@test.com
Bob       bob@test.com

Paste into Extable → Creates 2 rows with name/email columns
```

### 貼り付けの挙動

| Scenario | Behavior |
|----------|----------|
| Single cell paste | セル値の置き換え |
| Multi-cell paste | 矩形範囲に展開 |
| Paste beyond rows | 行を追加（commitモード） |
| Type mismatch | 検証し、無効セルはエラー表示 |
| Enum/Tags column | 許可値にマッピング |

### クリップボードの型

```typescript
// コピー: Name (string), Age (number), Active (boolean)
// 貼り付け時に型を保持
// 数値: "42" → 42（number）
// 真偽値: "true" → true（boolean）
// 日付: "2024-01-15" → Dateオブジェクト
```

## 編集モード

編集の挙動はモードで変わります。

### Direct（即時保存）

- 入力と同時に反映
- Undo/Redo可能
- Saveボタン不要

```typescript
// ユーザーがA1を編集 → "Alice"
// セルが即時更新
// 必要ならUndo可能
```

### Commit（バッチ）

- 編集は保留
- 変更は視覚的に表示
- `commit()`で一括送信

```typescript
// ユーザーがA1/A2/A3を編集
// 変更は"pending"として表示
// ユーザーが"Commit"で一括送信
// サーバーがバッチ処理
```

### Readonly

- 編集不可
- コピーのみ

## Tips & Tricks

### キーボードだけで編集

```
1. Click cell A1 (or navigate with arrows)
2. Type value for A1
3. Press Tab → Move to B1
4. Type value for B1
5. Press Enter → Move to next row
6. Continue editing without mouse
```

### 複数列を一括貼り付け

```
Excel:
Name     Email           Phone
Alice    alice@test.com  555-1234
Bob      bob@test.com    555-5678

Paste into Extable → Maps to Name, Email, Phone columns by position
```

### 最近の編集をUndo

Ctrl+Z（MacはCmd+Z）で取り消し:

- 単一セル編集
- フィルハンドル操作
- 貼り付け
- 行の追加/削除（対応時）

### フィルハンドルで高速入力

```
1. Enter first value in column (e.g., "Pending")
2. Select cell
3. Drag fill handle down to N cells
4. All cells fill with same value
5. Edit individual cells if needed
```
