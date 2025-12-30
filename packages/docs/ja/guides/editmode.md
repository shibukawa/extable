# 編集モード

extableは、ユーザーの操作とデータ確定のタイミングを制御する3つの編集モードを提供します。即時更新、トランザクション型ワークフロー、閲覧専用といったユースケースに最適化されています。

## 概要

編集モードで決まること:
- **更新のタイミング**: 即時または明示的なcommit後
- **Undo/Redoの可否**: commitモードでは常に可能、readonlyでは不可
- **データ保存**: ローカルのみかサーバー同期か
- **ロック管理**: commitで行ロック解放（commit）/ロック取得なし（direct/readonly）

| モード | 更新タイミング | 永続化 | ロック管理 | Undo/Redo | 用途 |
|------|---------------|-------------|-----------------|-----------|----------|
| `"direct"` | 即時 | 編集ごと | なし | なし | Excelライク、単一ユーザー |
| `"commit"` | 明示的な呼び出し時 | commitで一括 | 行ごとに解放 | フル履歴 | マルチユーザー、トランザクション |
| `"readonly"` | N/A | 読み取り専用 | なし | N/A | 閲覧専用、コピーのみ |

## Directモード

デフォルト（`editMode: "direct"`）のDirectモードは、Excelのような即時編集体験を提供します。

### 挙動

- **即時適用**: 変更は即座にデータモデルへ反映
- **保留状態なし**: 変更は即時確定
- **明示的commitなし**: `commit()`は不要
- **Undo/Redoなし**: 即時確定のため履歴は保持しない
- **サーバー同期**: あれば1セルごとに送信

### 実装

Directモードでの編集処理:

```typescript
// ユーザーがセルを編集（row123, "name", "Alice"）
table.handleEdit(
  { kind: "edit", rowId: "row123", colKey: "name", next: "Alice", prev: "Bob" },
  commitNow: true  // Directモードでは常にcommitNow=true
);
```

処理の流れ:
1. **検証とreadonly判定**: readonlyなら拒否
2. **テーブル更新**: `table.setCellValue(rowId, colKey, value)`で即更新
3. **保留状態なし**: 変更は確定済み
4. **描画と通知**: 再描画し状態を通知
5. **サーバー同期（必要なら）**: `sendCommit()`が1セルのコマンドを送信

### 例

```typescript
// directモードでテーブルを作成
const table = new ExtableCore({
  root: element,
  defaultData: {
    rows: [
      { id: "1", name: "Alice", age: 30 },
      { id: "2", name: "Bob", age: 25 }
    ]
  },
  defaultView: {},
  schema: {
    columns: [
      { key: "name", header: "Name", type: "string" },
      { key: "age", header: "Age", type: "number" }
    ]
  },
  options: { editMode: "direct" }  // デフォルト。不要なら省略
});

// 入力が即時反映
// commit()は不要
```

## Commitモード

Commitモード（`editMode: "commit"`）は、マルチユーザーとトランザクション指向のワークフロー向けです。変更は`commit()`まで保留されます。

### 挙動

- **保留更新**: 編集はコマンドキューに蓄積
- **段階的編集**: UI上は反映されるが、実データは未確定
- **明示的commit**: `await table.commit()`で一括確定
- **Undo/Redo**: フル履歴を保持
- **ロック管理**: 行ロックを編集開始で取得し、commitで解放
- **サーバー同期**: commit時に一括送信

### 実装

Commitモードの編集処理:

```typescript
// ユーザーがセルを編集（row123, "name", "Alice"）
table.handleEdit(
  { kind: "edit", rowId: "row123", colKey: "name", next: "Alice", prev: "Bob" },
  commitNow: false  // Commitモードでは常にcommitNow=false
);
```

処理の流れ:
1. **検証とreadonly判定**: readonlyなら拒否
2. **コマンド追加**: コマンドキューに追加
3. **保留状態**: `table.setCellValue(...)`が保留マップに保存
4. **描画と通知**: ステージング値を表示
5. **即時サーバー同期なし**: commitまで送信しない

### Commit API

#### `async commit(): Promise<void>`

保留中の変更を一括確定します。

1. **保留コマンド収集**: キューから取得
2. **実データへ適用**: 保留マップを実データへ移動
3. **サーバー送信**: `sendCommit(commands)`で一括送信
4. **ロック解放**: `lockManager.unlockOnCommit()`で行ロック解放
5. **履歴クリア**: コマンドキューとundo/redo履歴を削除
6. **ビュー更新**: 再描画して状態通知
7. **エラー処理**: 失敗時は`activeErrors`に登録

```typescript
// 保留編集を一括commit
try {
  await table.commit();
  // 変更がサーバーに確定
  // Undo/redo履歴がクリア
} catch (e) {
  console.error("Commit failed:", e);
  // 保留は残り、再試行可能
}
```

### 例

```typescript
// commitモードでテーブルを作成
const table = new ExtableCore({
  root: element,
  defaultData: {
    rows: [
      { id: "1", name: "Alice", age: 30 },
      { id: "2", name: "Bob", age: 25 }
    ]
  },
  defaultView: {},
  schema: {
    columns: [
      { key: "name", header: "Name", type: "string" },
      { key: "age", header: "Age", type: "number" }
    ]
  },
  options: {
    editMode: "commit",
    server: myTransport,  // WebSocket / fetch+SSE / polling
    user: { id: "user1", name: "User One" }
  }
});

// A1/A2/B1を編集 → 保留バッファに保持
// 保留編集はUndo/Redo可能

// 準備ができたらcommit
await table.commit();
// 3件を一括送信
// 保留クリア、履歴リセット
```

### 保留状態

Commitモードでは、保留中の変更を次のように参照できます。

```typescript
// いくつか編集したがcommit前
const pending = table.getPending();
// 戻り値: { "row1": { "name": "New Name" }, "row2": { "age": 35 } }
```

### CommitモードのUndo/Redo

Commitモードでは、コマンドキューによりUndo/Redoが利用できます。

```typescript
// A1/A2/B1を編集（3件）
if (table.canUndo()) table.undo();  // B1を取り消し
if (table.canUndo()) table.undo();  // A2を取り消し
if (table.canUndo()) table.undo();  // A1を取り消し

// やり直し可能
if (table.canRedo()) table.redo();  // A1を再適用
```

#### 履歴ライフサイクル

| フェーズ | 履歴状態 | 挙動 |
|-------|---|---|
| **編集中** | 📝 Active | Undo/Redo可能、コマンド蓄積 |
| **commit前** | 📝 Active | Undo/Redo可能 |
| **commit中** | 🔄 Clearing | サーバー送信、ロック解放 |
| **commit後** | 🗑️ Cleared | `commandQueue.clear()`で履歴消去 |

#### Commit時の履歴クリア

`commit()`は次の手順で履歴を消去します。

1. **保留コマンド収集**
2. **実データへ適用**
3. **サーバー送信**
4. **ロック解放**
5. **履歴クリア**:
   ```typescript
   this.commandQueue.clear();  // applied[]/undone[]を空にする
   ```
6. 再描画と状態通知

つまり、**commit成功後はUndo/Redo履歴がすべて失われます**。サーバーへ確定した以上、ローカルでは取り消せないという意図的な設計です。

#### 実際のワークフロー

```typescript
// Commitモード: 編集フェーズ
const table = new ExtableCore({ root, defaultData, defaultView, schema, options: { editMode: "commit" } });

// ユーザーが編集
// table.canUndo() → true
// table.canRedo() → true（Undoした場合）

// ユーザーが確認してcommit
await table.commit();

// commit後は履歴リセット
// table.canUndo() → false
// table.canRedo() → false

// 新しい編集は新しい履歴
```

#### 履歴が消えないケース

履歴が消えるのは**commit成功時のみ**です。失敗した場合は履歴が残ります。

```typescript
try {
  await table.commit();
} catch (e) {
  // commit失敗時は履歴が残る
  // Undo/Redoして再試行可能
  console.warn("Commit failed, please retry:", e);
}
```

この場合、保留中の変更は残り、次の試行でUndo/Redo可能です。

## Readonlyモード

Readonlyモード（`editMode: "readonly"`）はセル編集を無効化し、閲覧とコピーのみ許可します。

### 挙動

- **編集不可**: `handleEdit()`は早期return
- **セルコピー**: 選択とコピーは可能
- **閲覧専用**: 見た目は通常だがreadonlyスタイル
- **保留状態なし**: コマンドは追加されない
- **commit不要**: 変更がない

### Readonlyと列/行のreadonly

Readonlyモードはテーブル全体を対象に編集不可にします。セル単位で制御したい場合は次を使います。

- **列単位readonly**: 列スキーマに`readonly: true`
  ```typescript
  schema: [
    { key: "id", label: "ID", readonly: true },  // IDは編集不可
    { key: "name", label: "Name" }                // Nameは常に編集可（row-readonly除く）
  ]
  ```

- **行単位readonly**: 行オブジェクトに`_readonly: true`
  ```typescript
  data: [
    { id: "1", name: "Alice", _readonly: true },  // 行1はreadonly
    { id: "2", name: "Bob" }                       // 行2は列スキーマに従い編集可
  ]
  ```

- **セル単位readonly（式）**: `readonly`を関数で指定
  ```typescript
  schema: [
    { key: "name", label: "Name", readonly: (rowObj, colKey) => rowObj.locked === true }
  ]
  ```

Readonlyモード（`editMode: "readonly"`）では、列/行の設定に関わらず全セルがreadonlyになります。

### Readonlyからの復帰

再編集を許可するには、次を実行します。

```typescript
table.setEditMode("direct");  // または"commit"
```

テーブルが再描画され、状態が通知されます（Saveボタンの有効化などに利用）。

### 例

```typescript
// readonlyモードでテーブル作成
const table = new ExtableCore({
  root: element,
  defaultData: {
    rows: [
      { id: "1", name: "Alice", age: 30 },
      { id: "2", name: "Bob", age: 25 }
    ]
  },
  defaultView: {},
  schema: {
    columns: [
      { key: "name", header: "Name", type: "string" },
      { key: "age", header: "Age", type: "number" }
    ]
  },
  options: { editMode: "readonly" }
});

// 閲覧とコピーのみ可能
// "Select all (Ctrl+C)"は可能、編集は不可

// 後で編集を有効化
table.setEditMode("commit");
// 再描画後に編集可能
```

## 編集モードの切り替え

`setEditMode(mode)`で実行時に切り替えられます。

- 最初はreadonly → commitで編集 → commit後はreadonly
- commit後に再編集を防ぐ

```typescript
table.setEditMode("readonly");   // 編集を無効化
table.setEditMode("commit");     // バッチ編集を有効化
await table.commit();            // 保留を確定
table.setEditMode("readonly");   // commit後にロック
```

### 再描画と状態通知

切り替え時の挙動:
- **条件付き再描画**: readonlyと編集可能の切替時に再描画
- **状態通知**: `emitTableState()`でリスナーへ通知
- **選択更新**: 現在の選択コンテキストを更新

## サーバー連携

### Directモード

編集ごとに`sendCommit()`を呼び、1セルのコマンドを送信します。

- 単一ユーザー
- 即時整合性が必要
- サーバーなし（sendCommitがno-op）

### Commitモード

保留中の編集をcommit時に一括送信します。

- マルチユーザーとロック型の整合性
- トランザクション的一貫性
- ロック解放（`unlockOnCommit`）
- ネットワーク削減（ユーザー操作ごとに1回）

### サーバー実装

サーバーはテーブル設定で指定します。

```typescript
interface Extable {
  server?: {
    commit(commands: Command[], user: UserInfo): Promise<void>;
    unlockRows(rowIds: string[], user: UserInfo): Promise<void>;
    // ... 他のメソッド
  };
  user?: UserInfo;
}
```

commitやdirectの編集時に以下が呼ばれます。

```typescript
await this.server.commit(commands, this.user);
```

サーバーはコマンドを処理（検証、永続化、他クライアント通知）し、必要に応じて`handleServerEvent`へ通知します。

### エラー処理

サーバーコミットが失敗した場合:

```typescript
try {
  await this.server.commit(commands, this.user);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  this.activeErrors = [
    ...this.activeErrors.filter((x) => x.scope !== "commit"),
    { scope: "commit", message: msg }
  ];
  this.emitTableState();
}
```

エラーは`activeErrors`に格納され、UIで表示できるよう状態が更新されます。

## 編集モードの選び方

### **Direct**が向く場合

- 単一ユーザーまたは並行編集なし
- 即時整合性で問題ない
- commit前のUndo/Redoが不要
- Excelライクな操作感

### **Commit**が向く場合

- マルチユーザー同期が必要
- トランザクション性が重要
- commit前のUndo/Redoが必要
- 行ロック管理が必要
- ネットワーク通信を最小化したい

### **Readonly**が向く場合

- 閲覧/レポート用途
- 一時的に編集を無効化
- 共有専用テーブル（コピーのみ）
- 権限上の読み取り専用

## 関連項目

- [データアクセス](/ja/guides/data-access): 変更の購読、保留編集の取得、commit処理
- [Readonly列](/ja/guides/style#readonly-columns): スキーマでの列/行readonly
- [数式](/ja/guides/formulas): 計算列とエラー処理
- [マルチユーザー編集](/ja/concepts/multi-user): 同期とロックモデル
