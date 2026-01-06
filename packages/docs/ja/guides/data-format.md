# データフォーマットガイド

Extableは多様なデータ型をサポートし、それぞれ検証ルール、スタイル、表示方法を持ちます。このガイドでは、スキーマの列定義と各型の扱い方を説明します。

## 列定義の構造

スキーマ内の各列は次の要素を持ちます。

```typescript
{
  key: 'columnName',           // 列の一意キー
  header: 'Display Label',     // 表示ラベル
  type: 'string' | 'number' | 'int' | 'uint' | 'boolean' | 'date' | 'time' | 'datetime' | 'enum' | 'tags' | 'button' | 'link',
  width?: number,              // 任意: 列幅（px）
  readonly?: boolean,          // 任意: 編集禁止
  nullable?: boolean,          // 任意: 空/Null可
  wrapText?: boolean,          // 任意: 折り返し有効化
  style?: { /* type-specific */ },
  conditionalStyle?: (row) => StyleObject | null,  // 任意: 動的スタイル
  formula?: (row) => value | [value, Error],       // 任意: 計算列
  // ... 型ごとのプロパティ
}
```

### `defineSchema`による型安全なスキーマ

`defineSchema<T>()`を使うと、`formula`/`conditionalStyle`内の`row`が行モデル`T`として型付けされます。

```typescript
import { defineSchema } from '@extable/core';

type Row = {
  id: number;
  quantity: number;
  unitPrice: number;
};

const schema = defineSchema<Row>({
  columns: [
    { key: 'id', header: 'ID', type: 'number', readonly: true },
    { key: 'quantity', header: 'Qty', type: 'number' },
    {
      key: 'unitPrice',
      header: 'Unit Price',
      type: 'number'
    },
    {
      key: 'total',
      header: 'Total',
      type: 'number',
      formula: (row) => row.quantity * row.unitPrice, // rowはRow
      conditionalStyle: (row) =>
        row.quantity * row.unitPrice > 1000 ? { backgroundColor: '#fff3cd' } : null
    }
  ],
  row: {
    conditionalStyle: (row) => (row.quantity === 0 ? { textColor: '#999' } : null)
  }
});
```

`defineSchema<Row>(...)`により`row.quantity`や`row.unitPrice`が補完されます。

## データ型

### String

プレーンテキスト。長さやパターン検証を追加できます。

```typescript
{
  key: 'email',
  header: 'Email Address',
  type: 'string',
  nullable: false,
  // 文字列固有のオプション:
  string: {
    length?: { min: 0, max: 255 },      // 文字数制限
    pattern?: /^[a-z0-9]+@[a-z]+\.[a-z]+$/,  // 正規表現で検証
    allowMultiline?: false               // デフォルト: 単一行
  }
}
```

**特徴:**
- デフォルト表示: プレーンテキスト
- 折り返し: `wrapText`で制御
- 検証: 文字数と正規表現
- Null扱い: `nullable: true`なら空セル表示

### Number

浮動小数点数。精度/スケールや表示オプションを設定できます。

```typescript
{
  key: 'salary',
  header: 'Annual Salary',
  type: 'number',
  format: {
    precision?: 10,           // 有効桁数（scientific表示で使用）
    scale?: 2,                // 小数桁（decimal表示）
    signed?: true,            // falseの場合、負数は無効
    thousandSeparator?: true, // カンマ区切りを表示（1,234.56）
    negativeRed?: true,       // 負数は赤
    format?: 'decimal' | 'scientific'
  },
  style: { align: 'right' }  // 数値は右寄せ
}
```

**表示例:**
- `1234` + `thousandSeparator: true` → `1,234`
- `-50` + `negativeRed: true` → 赤字
- `123.456` + `scale: 2` → `123.46`（丸め）
- `1234` + `format: 'scientific', precision: 4` → `1.234e+3`

### Integer（`int` / `uint`）

安全な整数（JavaScriptの`Number.MAX_SAFE_INTEGER`の範囲内）。

- `int`: 符号付きの安全整数
- `uint`: 非負の安全整数

```typescript
{
  key: 'flags',
  header: 'Flags',
  type: 'uint',
  format: {
    format: 'hex',            // 'decimal' | 'binary' | 'octal' | 'hex'
    negativeRed: false
  },
  style: { align: 'right' }
}
```

### Boolean

真偽値。表示形式を選べます。

```typescript
{
  key: 'active',
  header: 'Active Status',
  type: 'boolean',
  // 表示バリエーション:
  format: 'checkbox'           // ☑️ / ☐
  // または
  format: ['TRUE', 'FALSE']    // テキスト表示
  // または
  format: ['Yes', 'No']        // ローカライズ表示
  // または
  format: ['真', '偽']         // 非英語
}
```

**操作:**
- checkbox: クリック/Spaceで切替
- テキスト: セルクリックで切替

### Date

日付のみ。使用可能トークン: `yyyy`、`MM`、`dd`（リテラル可）。

**プリセット（format）:**

| Preset | Pattern        | Note                |
| ------ | -------------- | ------------------- |
| iso    | `yyyy-MM-dd`   | Default (ISO)       |
| us     | `MM/dd/yyyy`   | US style            |
| eu     | `dd.MM.yyyy`   | EU style            |

例: `iso`、`us`、`eu`またはカスタムパターン。

```typescript
{
  key: 'joinDate',
  header: 'Join Date',
  type: 'date',
  format?: 'yyyy-MM-dd'  // ISO標準（デフォルト）
  // その他の一般的な形式:
  // 'yyyy/MM/dd'             // スラッシュ形式
  // 'MM/dd/yyyy'             // 米国形式
  // 'dd.MM.yyyy'             // 欧州形式
}
```

**保存:**
- 内部はJavaScriptの`Date`オブジェクト
- 入出力はISO 8601（`YYYY-MM-DD`）
- Nullは空セル
- フォーマットエンジンは軽量内蔵（date-fnsは不要）。対応トークン: `yyyy`、`MM`、`dd`、`HH`、`hh`、`mm`、`ss`、`a`、単引用リテラル。例: `yyyy-MM-dd`、`HH:mm:ss`、`hh:mm a`、`yyyy/MM/dd HH:mm`。

### Time

時刻のみ。使用可能トークン: `HH`、`hh`、`mm`、`ss`、`a`（リテラル可）。

**プリセット（format）:**

| Preset | Pattern      | Note                 |
| ------ | ------------ | -------------------- |
| iso    | `HH:mm:ss`   | Default (24h + sec)  |
| 24h    | `HH:mm`      | 24h, seconds hidden  |
| 12h    | `hh:mm a`    | 12h, AM/PM           |

```typescript
{
  key: 'startTime',
  header: 'Start Time',
  type: 'time',
  format?: 'HH:mm:ss'    // 24時間+秒（デフォルト）
  // その他の一般的な形式:
  // 'HH:mm'                  // 24時間（秒なし）
  // 'hh:mm a'                // 12時間（AM/PM）
  // 'HH:mm:ss'               // 24時間（秒付き）
}
```

**保存:**
- 内部はJavaScriptの`Date`オブジェクト（date部分は無視）
- 入出力はISO 8601時刻（`HH:mm:ss`）
- フォーマットエンジンはDateと同じ軽量実装

### DateTime

日付+時刻。Date/Timeトークンの集合を使用します。

**プリセット（format）:**

| Preset   | Pattern                          | Note                                  |
| -------- | -------------------------------- | ------------------------------------- |
| iso      | `yyyy-MM-dd'T'HH:mm:ss'Z'`       | Default (ISO 24h)                     |
| iso-24h  | `yyyy-MM-dd'T'HH:mm:ss'Z'`       | Alias of `iso`                        |
| iso-12h  | `yyyy-MM-dd hh:mm a`             | ISO date + 12h                        |
| us       | `MM/dd/yyyy HH:mm`               | US date + 24h                         |
| us-24h   | `MM/dd/yyyy HH:mm`               | Alias of `us`                         |
| us-12h   | `MM/dd/yyyy hh:mm a`             | US date + 12h                         |
| eu       | `dd.MM.yyyy HH:mm`               | EU date + 24h                         |
| eu-24h   | `dd.MM.yyyy HH:mm`               | Alias of `eu`                         |
| eu-12h   | `dd.MM.yyyy hh:mm a`             | EU date + 12h                         |

```typescript
{
  key: 'createdAt',
  header: 'Created At',
  type: 'datetime',
  format?: "yyyy-MM-dd'T'HH:mm:ss'Z'"  // ISO 8601（デフォルト）
  // その他の一般的な形式:
  // 'yyyy/MM/dd HH:mm'       // 日時（秒なし）
  // 'MM/dd/yyyy hh:mm a'     // 米国形式（AM/PM）
}
```

**保存:**
- 内部はJavaScriptの`Date`オブジェクト
- 入出力はISO 8601（`YYYY-MM-DDTHH:mm:ssZ`）
- タイムゾーンはバックエンドと整合を取る
- フォーマットエンジンは同じ軽量実装

### Enum

選択肢から1つを選ぶ単一選択です。

```typescript
{
  key: 'department',
  header: 'Department',
  type: 'enum',
  enum: {
    options: ['Engineering', 'Sales', 'Marketing', 'HR']
  }
}
```

**操作:**
- セルクリックでドロップダウン
- `options`以外は無効
- `nullable: true`なら空も許可

**検証:**
- `options`外の値はエラー
- 大文字小文字は区別

### Tags（タグリスト）

複数選択のタグ型です。

```typescript
{
  key: 'labels',
  header: 'Labels',
  type: 'tags',
  tags: {
    options: ['urgent', 'review', 'approved', 'archived'],
    allowCustom?: false  // ユーザー定義タグを禁止（推奨）
  }
}
```

**保存:**
- 内部は配列（`['urgent', 'approved']`）
- 表示はカンマ区切りまたはタグチップ

**操作:**
- セルクリックでマルチセレクト
- チェックで追加/削除
- `allowCustom: true`ならユーザー定義タグを許可（整合性上は非推奨）

### Button

アクションセル。ボタンは**常にreadonly**で編集不可です。

```typescript
{
  key: 'action',
  header: 'Action',
  type: 'button',
  style: { align: 'center' }
}
```

**値の形:**
- `string` → ラベル（例: `"Open"`）
- `{ label: string; command: string; commandfor: string }` → アクションペイロード

`command`と`commandfor`は必ずセットで指定します。

**挙動:**
- クリックまたは**Space**でセルアクションイベントを送出
- `style.disabled`または`conditionalStyle` → `{ disabled: true }`で無効化（buttonのみ）

### Link

リンクセル。リンクも**常にreadonly**で編集不可です。

```typescript
{
  key: 'docs',
  header: 'Docs',
  type: 'link'
}
```

**値の形:**
- `string` → URL（ラベルとhref）
- `{ label: string; href: string; target?: string }` → ラベル付きリンク

`target`のデフォルトは`_self`です。

**挙動:**
- クリックまたは**Space**で遷移
- `style.disabled`または`conditionalStyle` → `{ disabled: true }`で無効化（linkのみ）

## 共通プロパティ

### readonly

ユーザー編集を禁止します（ID列や計算列など）。

```typescript
{
  key: 'employeeId',
  header: 'Employee ID',
  type: 'string',
  readonly: true  // ユーザーは編集不可
}
```

### nullable

空/Nullを許可します。

```typescript
{
  key: 'middleName',
  header: 'Middle Name (optional)',
  type: 'string',
  nullable: true  // 空セル可
}
```

### wrapText

長文の折り返しを有効化します。

```typescript
{
  key: 'description',
  header: 'Description',
  type: 'string',
  wrapText: true  // 折り返しを有効化
}
```

### format

列の見た目を調整します。詳細は[スタイルガイド](/ja/guides/style)を参照してください。

```typescript
{
  key: 'status',
  header: 'Status',
  type: 'string',
  style: {
    align: 'center',                    // 配置: 'left' | 'right' | 'center'
    textColor?: '#d32f2f',
    background?: '#fff3e0'
  }
}
```

### conditionalStyle

行データに応じて動的にスタイルを適用します。例は[条件付きスタイル](/ja/guides/conditional-style)を参照。

```typescript
{
  key: 'score',
  header: 'Score',
  type: 'number',
  conditionalStyle: (row) => {
    if (row.score >= 90) return { backgroundColor: '#c8e6c9' };      // 緑
    if (row.score < 50) return { backgroundColor: '#ffcdd2' };       // 赤
    return null;  // デフォルトスタイル
  }
}
```

### formula

JavaScript関数で計算列を定義します。詳細は[数式ガイド](/ja/guides/formulas)を参照。

```typescript
{
  key: 'total',
  header: 'Total',
  type: 'number',
  readonly: true,
  formula: (row) => row.price * row.quantity  // 計算結果
}
```

## 完全な例

```typescript
const schema = {
  columns: [
    // ID列 - readonly
    {
      key: 'id',
      header: '#',
      type: 'number',
      readonly: true,
      width: 50
    },
    // Name - 必須文字列（折り返し）
    {
      key: 'name',
      header: 'Employee Name',
      type: 'string',
      nullable: false,
      wrapText: true,
      width: 180
    },
    // Email - パターン検証付き
    {
      key: 'email',
      header: 'Email',
      type: 'string',
      string: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      width: 200
    },
    // Department - enum
    {
      key: 'department',
      header: 'Department',
      type: 'enum',
      enum: { options: ['Engineering', 'Sales', 'Marketing', 'HR'] },
      width: 140
    },
    // Salary - フォーマット済み数値
    {
      key: 'salary',
      header: 'Salary',
      type: 'number',
      format: { scale: 2, thousandSeparator: true, negativeRed: true },
      style: { align: 'right' },
      width: 120
    },
    // Active - booleanチェックボックス
    {
      key: 'active',
      header: 'Active',
      type: 'boolean',
      format: 'checkbox',
      width: 80
    },
    // Join Date - フォーマット済み日付
    {
      key: 'joinDate',
      header: 'Join Date',
      type: 'date',
      format: 'yyyy/MM/dd',
      width: 130
    },
    // Skills - タグリスト
    {
      key: 'skills',
      header: 'Skills',
      type: 'tags',
      tags: { options: ['JavaScript', 'TypeScript', 'React', 'Python', 'SQL'] },
      width: 160
    },
    // Annual Compensation - 計算済みreadonly
    {
      key: 'annualComp',
      header: 'Annual Comp',
      type: 'number',
      readonly: true,
      format: { scale: 0, thousandSeparator: true },
      style: { align: 'right' },
      formula: (row) => row.salary * 1.25,  // 給与 + 25%の福利
      width: 140
    },
    // Notes - プレーン列
    {
      key: 'notes',
      header: 'Notes',
      type: 'string',
      wrapText: true,
      nullable: true,
      width: 220
    }
  ]
};
```

## バリデーションとエラー処理

スキーマ制約に合わないデータはエラー表示になります。

- **赤いセル枠**: 無効データ（型違い、正規表現失敗、enum不一致）
- **警告アイコン**: 非致命（数式のフォールバックなど）
- **エラーアイコン**: 致命的（数式が例外を投げた）

例:
- 数値列に`'abc'` → エラー
- `pattern: /^\d+$/`の文字列に`'abc'` → エラー
- enum列に`options`外の値 → エラー
- 数式が`new Error()` → 警告/エラー

## 次のステップ

- [スタイルと条件付き書式](/ja/guides/style)
- [数式と計算列](/ja/guides/formulas)
- [編集モードとreadonly列](/ja/guides/editmode)
- [Data/Schema/Viewの分離](/ja/concepts/data-schema-view)
