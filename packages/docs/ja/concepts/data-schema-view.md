# Data / Schema / View モデル

Extableはテーブル設定を**Data / Schema / Viewの3つの関心事**に分離します。この分離により、マルチユーザー協調、予測可能な状態管理、クリーンなアーキテクチャが実現します。

## 主な設計原則

| 項目 | Data | Schema | View |
|--------|------|--------|------|
| **所有者** | アプリケーション | アプリケーション | ユーザー |
| **変更可能か** | 可能（`setData()`） | 不可（初期化時に固定） | 可能（フィルター、ソート、列） |
| **他ユーザーに影響** | あり（全ユーザーに同じデータ） | あり（全ユーザーに同じ列） | なし（各ユーザー固有） |
| **永続化先** | バックエンドDB | アプリコード | localStorage / URLクエリ / セッション |
| **例** | 新しい従業員行の追加 | 給与列のリネーム | 給与列を非表示にする |

## Data: 真のデータ

**Data**は実データです。単純な配列（行）として表現します。

```typescript
const data = [
  { id: 'emp-001', name: 'Alice', department: 'Engineering', salary: 95000, active: true },
  { id: 'emp-002', name: 'Bob', department: 'Sales', salary: 72000, active: true },
  { id: 'emp-003', name: 'Carol', department: 'Marketing', salary: 68000, active: false }
];
```

### 対応データ型

Extableは次の型を標準で扱えます。

- **string**: 文字列（長さや正規表現の検証）
- **number**: 数値（精度、スケール、符号制約）
- **boolean**: 真偽値（checkbox、yes/noなどの表示）
- **date**: 日付（YYYY-MM-DD）
- **time**: 時刻（HH:mm:ss）
- **datetime**: 日付+時刻のタイムスタンプ
- **enum**: 固定の選択肢
- **tags**: 1セルに複数タグ
- **button**: クリック可能なアクションセル
- **link**: URLへ遷移するリンクセル

### Dataの設定と更新

テーブル生成時に初期データを渡します。

```typescript
const table = new ExtableCore({
  root: document.getElementById('table'),
  defaultData: data,  // 初期データ
  schema: schema,
  defaultView: view
});
```

`setData()`でいつでもデータを更新できます。

```typescript
// APIから最新データを取得
const freshData = await fetch('/api/employees').then(r => r.json());

// テーブルを更新
table.setData(freshData);
```

`setData()`はデータ配列を丸ごと置き換え、再描画を行います。

```typescript
// データ変更を監視
table.onTableState(({ data, view, schema }) => {
  console.log('Data updated:', data);
});

// データを更新
table.setData(newEmployeeList);
```

### データ検証

データは初期化や更新時にスキーマと照合され、無効な値はExcelのような赤枠で示されます。

## Schema: 変更不可の列定義

**Schema**は列の構造と挙動を定義します。Excelと異なり、**初期化時に固定**され、エンドユーザーは変更できません。

```typescript
const schema = {
  columns: [
    {
      key: 'id',
      type: 'string',
      header: 'Employee ID',
      readonly: true,  // ユーザーは編集不可
    },
    {
      key: 'name',
      type: 'string',
      header: 'Full Name',
      nullable: false,  // 必須項目
    },
    {
      key: 'department',
      type: 'enum',
      header: 'Department',
      enum: { options: ['Engineering', 'Sales', 'Marketing', 'HR'] },
    },
    {
      key: 'salary',
      type: 'number',
      header: 'Salary (USD)',
      format: { precision: 2 },
      style: { align: 'right' },
      conditionalStyle: (row) => {
        if (row.salary > 90000) return { backgroundColor: '#d4edda' };  // 高額給与は緑
        return null;
      }
    },
    {
      key: 'active',
      type: 'boolean',
      header: 'Active',
      format: 'checkbox'
    },
    {
      key: 'notes',
      type: 'string',
      header: 'Notes',
      wrapText: true  // この列で折り返しを有効化
    },
    {
      key: 'fullCompensation',
      type: 'number',
      header: 'Full Compensation',
      readonly: true,
      formula: (row) => row.salary * 1.25  // 計算列
    }
  ]
};
```

### Schemaの機能

- **型安全**: 期待される型を保証
- **バリデーション**: 文字数、正規表現、数値の最小/最大、nullable制約
- **フォーマット**: 数値精度、日付形式、boolean表示
- **スタイル**: 文字色、背景、太字/斜体、装飾（下線、取り消し線）
- **折り返し**: 列ごとの折り返し（`wrapText`）
- **条件付き書式**: 値に応じた動的スタイル（関数で定義）
- **readonly列**: IDや計算列などの編集防止
- **計算列**: JavaScript関数で定義する数式列（ユーザーは編集不可）

### Readonly / Disabled マトリクス

| 列タイプ | Schema `readonly` | Conditional `{ readonly: true }` | Schema `disabled` | Conditional `{ disabled: true }` | Notes |
| --- | --- | --- | --- | --- | --- |
| `button` | 常にreadonly（変更不可） | 非対応 | 対応 | 対応 | disabledはreadonlyのグレー表示で操作不可。 |
| `link` | 常にreadonly（変更不可） | 非対応 | 対応 | 対応 | disabledはreadonlyのグレー表示で操作不可。 |
| `formula` | 常にreadonly（変更不可） | 非対応 | 非対応 | 非対応 | conditionalのreadonly/disabledは無視。 |
| `boolean/number/date/time/datetime` | 対応 | 対応 | 非対応 | 非対応 | readonlyはschemaかconditionalStyleで設定。 |
| `string/enum/tags` | 対応 | 対応 | 非対応 | 非対応 | readonlyはschemaかconditionalStyleで設定。 |

`disabled`はbutton/linkのみ`style.disabled`または`conditionalStyle`で設定します。

### なぜ固定スキーマなのか

- **データ整合性**: アプリが構造を保証し、予期しない変更がない
- **バージョン管理**: スキーマ変更はアプリと共に配布される
- **協調性**: すべてのユーザーが同じ列構成を共有
- **予測可能なAPI**: 列と制約を開発者が制御

詳細なスキーマ例と設定は[データフォーマットガイド](/ja/guides/data-format)を参照してください。

## View: ユーザーごとの表示・整理

**View**はユーザーの作業空間です。各ユーザーが独自のビュー状態を持ち、共有データには影響しません。

```typescript
const view = {
  // 列の表示と順序
  columnOrder: ['id', 'name', 'active', 'department'],  // 'salary'と'fullCompensation'を非表示
  
  // ソート
  sortOrder: [
    { key: 'active', direction: 'desc' },  // アクティブを先頭に
    { key: 'name', direction: 'asc' }     // 次にアルファベット順
  ],
  
  // フィルター
  filters: {
    department: ['Engineering', 'Sales'],  // 対象部署のみ表示
    active: [true]                         // アクティブのみ表示
  }
};
```

### Viewの構成要素

- **列の順序と可視性**: どの列を表示するか、どの順で表示するか
- **ソート順**: 昇順/降順を含む並び順
- **フィルター**: 列の値で行を絞り込む（縦方向のみ）

### ユーザーごとの永続化

Viewは通常**ユーザーのセッションローカル**です。次のようにlocalStorageやバックエンドに保存できます。

```typescript
// View変更時に保存
table.onTableState(({ view }) => {
  localStorage.setItem('my-table-view', JSON.stringify(view));
});

// ページ読み込み時に復元
const savedView = localStorage.getItem('my-table-view');
const restoredView = savedView ? JSON.parse(savedView) : defaultView;

const table = new ExtableCore({
  root: document.getElementById('table'),
  defaultData: data,
  schema: schema,
  defaultView: restoredView  // 保存済みビューを使用
});
```

### View永続化の利点

- **ソートを維持**: リロード後もソート順が残る
- **フィルターを記憶**: 絞り込み状態を保持
- **列の好み**: 可視列設定を一度行えば継続
- **タブごとの独立性**: ブラウザタブ間で独自のビューを持てる

## 次のステップ

- [スキーマ設定とデータ型](/ja/guides/data-format)
- [readonly/数式列の仕組み](/ja/guides/editmode)
- [アンコントロールド専用の思想](/ja/concepts/uncontrolled)でテーブル外の状態管理を理解
