# バリデーションガイド

Extableはデータ整合性を保つために複数のバリデーション層を提供します。型制約、数式による検証、一意制約まで、実装方法をまとめます。

## バリデーション層

Extableのバリデーションは3層で構成されます。

```
┌─────────────────────────────────────────┐
│ 1. 型/スキーマ制約（最速）             │
│    - 型検証                             │
│    - 文字数/範囲制限                    │
│    - パターン一致                       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ 2. 数式によるカスタムバリデーション    │
│    - 複雑な業務ロジック                │
│    - 文脈付きエラーメッセージ          │
│    - 変更時に再評価                     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ 3. 一意制約                              │
│    - 列単位の一意性                      │
│    - 複数列の組み合わせ                  │
│    - 行を跨ぐ依存                        │
└─────────────────────────────────────────┘
```

## レイヤー1: 型/スキーマ制約

### 型ベースのバリデーション

列の型に対して自動的に検証されます。

```typescript
{
  key: 'email',
  header: 'Email',
  type: 'string',
  string: {
    regex: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
  }
}

{
  key: 'age',
  header: 'Age',
  type: 'number',
  format: {
    signed: false  // 非負のみ
  }
}

{
  key: 'birthDate',
  header: 'Birth Date',
  type: 'date'
  // ISO日付である必要あり
}
```

**自動検証される項目:**
- ✅ 型が一致する
- ✅ 文字列長が`string.maxLength`以内
- ✅ `string.regex`に一致
- ✅ `number.signed: false`なら非負
- ✅ 日付形式が正しい
- ✅ `enum.options`に一致
- ✅ `tags.options`に一致（`allowCustom`がfalseの場合）
- ✅ boolean型の正当性

### 長さ/範囲制約

```typescript
// 文字列長の検証
{
  key: 'username',
  type: 'string',
  string: {
    maxLength: 20
    // ✓ "alice", "bob123" （有効）
    // ✗ "thisisaverylongusernamethatwontfit" （長すぎる）
  }
}

// 数値範囲の検証（非負のみ）
{
  key: 'rating',
  type: 'number',
  format: {
    signed: false  // 0以上
    // ✓ 0, 1, 2, 3, 4, 5 （有効）
    // ✗ -1 （負数不可）
  }
}

// 日付範囲の検証
{
  key: 'birthDate',
  type: 'date',
  nullable: false
  // ✓ "1990-01-15" （有効な日付）
  // ✗ "not-a-date", null （無効）
}

// 文字列パターン検証（正規表現）
{
  key: 'phone',
  type: 'string',
  string: {
    regex: '^\\d{3}-\\d{4}-\\d{4}$'
    // ✓ "123-4567-8901" （有効）
    // ✗ "1234567890" （パターン不一致）
  }
}
```

min/maxの範囲検証はカスタム数式（レイヤー2）で行います。

### Nullableと必須

```typescript
// 必須項目（値が必要）
{
  key: 'name',
  type: 'string',
  nullable: false
  // ✓ "Alice", ""（空を許可する場合）
  // ✗ null, undefined
}

// 任意項目（空/Null可）
{
  key: 'middleName',
  type: 'string',
  nullable: true
  // ✓ "James", null, ""（すべて有効）
  // ✗ （無効なし）
}

// 読み取り専用の計算列（編集不可）
{
  key: 'totalPrice',
  type: 'number',
  readonly: true,
  formula: (row) => row.quantity * row.unitPrice
}
```

### スキーマレベルのエラー表示

Extableは以下でエラーを表示します。
- 🔴 無効セルの赤枠
- ⚠️ テーブル状態のエラー数
- 📋 `getTableState().activeErrors`に詳細

```typescript
// 検証エラーをプログラムで取得
const state = table.getTableState();
console.log(state.activeErrors);
// [
//   { scope: 'validation', message: 'メールは有効である必要があります', target: { rowId: 'row1', colKey: 'email' } },
//   { scope: 'validation', message: '年齢は0〜150の範囲', target: { rowId: 'row2', colKey: 'age' } }
// ]
```

## レイヤー2: 数式によるカスタムバリデーション

### 数式からのエラー返却

型制約を超える業務ロジックは数式で検証します。

```typescript
{
  key: 'password',
  header: 'Password',
  type: 'string',
  // パスワード検証用の隠し計算列
  string: { allowMultiline: false },
  formula: (row) => {
    const pwd = row.password;
    
    // 複数の検証ルール
    if (!pwd || pwd.length < 8) {
      return [pwd, new Error('Password must be at least 8 characters')];
    }
    if (!/[A-Z]/.test(pwd)) {
      return [pwd, new Error('Must contain at least one uppercase letter')];
    }
    if (!/[0-9]/.test(pwd)) {
      return [pwd, new Error('Must contain at least one number')];
    }
    
    // 有効なら表示用の値を返す
    return '●'.repeat(pwd.length);  // セキュリティ上ドットで表示
  }
}
```

**数式のエラーパターン:**

```typescript
formula: (row) => {
  // 検証チェック
  if (isInvalid(row)) {
    // [表示値, エラー]を返す
    return [row.value, new Error('Human-readable error message')];
  }
  
  // 正常時は計算値を返す
  return computedValue;
}
```

### 文脈付きエラーメッセージ

他のセルを参照するメッセージで、ユーザーに原因を伝えます。

```typescript
{
  key: 'endDate',
  header: 'End Date',
  type: 'date',
  formula: (row) => {
    const startDate = new Date(row.startDate);
    const endDate = new Date(row.endDate);
    
    if (endDate <= startDate) {
      return [
        row.endDate,
        new Error(
          `End date (${row.endDate}) must be after start date (${row.startDate})`
        ）
      ];
    }
    
    // 表示用に期間を計算
    const days = Math.floor((endDate - startDate) / (1000 * 60 * 60 * 24));
    return `${days} days`;
  }
}
```

### 条件付きスタイルと組み合わせ

```typescript
{
  key: 'discount',
  header: 'Discount %',
  type: 'number',
  format: { min: 0, max: 100 },
  
  // 検証と警告表示を行う計算列
  formula: (row) => {
    if (row.discount > 50) {
      return [
        row.discount,
        new Error('Discount exceeds 50% - requires manager approval'）
      ];
    }
    if (row.discount > 25) {
      return [
        row.discount,
        new Error('Discount exceeds 25% - review required'）
      ];
    }
    return row.discount;
  },
  
  // 割引レベルを色で可視化
  conditionalStyle: (row) => {
    if (row.discount > 50) {
      return { backgroundColor: '#ffcdd2', textColor: '#c62828' };  // 赤
    }
    if (row.discount > 25) {
      return { backgroundColor: '#fff3e0', textColor: '#e65100' };  // オレンジ
    }
    if (row.discount > 10) {
      return { backgroundColor: '#e8f5e9', textColor: '#2e7d32' };  // 緑
    }
    return null;
  }
}
```

### 行を跨ぐ検証

```typescript
{
  key: 'email',
  header: 'Email Address',
  type: 'string',
  string: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  
  formula: (row, allRows) => {
    const email = row.email;
    
    // テーブル内でメールの一意性を確認
    const duplicates = allRows.filter(
      r => r.email === email && r.id !== row.id
    );
    
    if (duplicates.length > 0) {
      return [
        email,
        new Error(`Email "${email}" is already used by another user`）
      ];
    }
    
    return email;
  }
}
```

**Note:** サーバー側の一意性チェックはレイヤー3の一意制約で扱うのが適切です。

## レイヤー3: 一意制約

### 列単位の一意性

```typescript
{
  key: 'username',
  header: 'Username',
  type: 'string',
  unique: true  // テーブル内で一意
  // ✓ alice, bob, charlie （すべて異なる）
  // ✗ alice, bob, alice （重複不可）
}

{
  key: 'email',
  header: 'Email',
  type: 'string',
  unique: true
}
```

**挙動:**
- 検証タイミング: 編集、行追加、インポート
- 表示: 赤枠 + `getTableState().activeErrors`にメッセージ
- サーバー同期: 通常はサーバー側でも検証する

### 複数列の一意制約

```typescript
// スキーマレベルの一意制約
const schema = {
  columns: [
    { key: 'company', type: 'string' },
    { key: 'department', type: 'string' },
    { key: 'employeeId', type: 'string' }
  ],
  
  // 組み合わせの一意制約
  unique: [
    ['company', 'department', 'employeeId']  // この組み合わせは一意
  ]
  // ✓ (Apple, Engineering, E001), (Apple, HR, E001), (Google, Engineering, E001)（重複なし）
  // ✗ (Apple, Engineering, E001), (Apple, Engineering, E001)（重複）
}
```

**用途:**
- 部署ごとの社員IDの重複防止
- 会社ごとのプロジェクトコード
- 姓名の組み合わせ一意性

### 条件付き一意制約

```typescript
{
  key: 'email',
  header: 'Email',
  type: 'string',
  
  formula: (row, allRows) => {
    // activeユーザーのみ一意性を適用
    if (row.status !== 'active') {
      return row.email;
    }
    
    // activeユーザー間でのみ一意性確認
    const activeEmails = allRows
      .filter(r => r.status === 'active'）
      .map(r => r.email);
    
    const isDuplicate = activeEmails.filter(e => e === row.email).length > 1;
    
    if (isDuplicate) {
      return [
        row.email,
        new Error(`Email "${row.email}" is already used by another active user`）
      ];
    }
    
    return row.email;
  }
}
```

## エラー表示と処理

### ユーザー向け表示

```typescript
// 1. 赤い枠＝無効セル
// 2. セルにエラーアイコン
// 3. セルメタデータに詳細

// エラーをプログラムで取得
table.subscribeTableState((state) => {
  const errors = state.activeErrors;
  
  errors.forEach(error => {
    console.log(`Row ${error.target.rowId}, Col ${error.target.colKey}: ${error.message}`);
  });
});

// 選択追跡でも取得
table.subscribeSelection((snapshot) => {
  if (snapshot.diagnostic) {
    console.log('Active cell has error:', snapshot.diagnostic.message);
  }
});
```

### エラーのスコープ

```typescript
// スキーマ検証エラー
{
  scope: 'validation',
  message: 'メールは有効である必要があります',
  target: { rowId: 'row1', colKey: 'email' }
}

// 数式エラー（カスタム検証）
{
  scope: 'formula',
  message: 'Password must be at least 8 characters',
  target: { rowId: 'row2', colKey: 'password' }
}

// 一意性エラー
{
  scope: 'unique',
  message: 'Email is not unique',
  target: { rowId: 'row3', colKey: 'email' }
}

// 診断エラー（数式例外）
{
  scope: 'diagnostic',
  message: 'Unexpected error in formula',
  target: { rowId: 'row4', colKey: 'computed' }
}
```

### エラーのフィルタリング

```typescript
const state = table.getTableState();

// 検証エラーのみ
const typeErrors = state.activeErrors.filter(e => e.scope === 'validation');

// 数式エラーのみ
const formulaErrors = state.activeErrors.filter(e => e.scope === 'formula');

// 特定行のみ
const rowErrors = state.activeErrors.filter(e => e.target?.rowId === 'row1');

// 特定列のみ
const colErrors = state.activeErrors.filter(e => e.target?.colKey === 'email');

// エラー数で
console.log(`Table has ${state.activeErrors.length} validation issues`);
```

## バリデーションパターン

### パターン1: メール検証

```typescript
{
  key: 'email',
  header: 'Email Address',
  type: 'string',
  string: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    length: { min: 5, max: 254 }
  },
  formula: (row, allRows) => {
    // activeユーザー間の一意性確認
    if (row.status === 'active') {
      const duplicates = allRows.filter(
        r => r.status === 'active' && r.email === row.email && r.id !== row.id
      );
      if (duplicates.length > 0) {
        return [row.email, new Error('Email already in use')];
      }
    }
    return row.email;
  }
}
```

### パターン2: 日付範囲

```typescript
{
  key: 'projectEndDate',
  header: 'End Date',
  type: 'date',
  formula: (row) => {
    const start = new Date(row.projectStartDate);
    const end = new Date(row.projectEndDate);
    
    if (!row.projectStartDate || !row.projectEndDate) {
      return [row.projectEndDate, new Error('Both dates required')];
    }
    
    if (end <= start) {
      return [
        row.projectEndDate,
        new Error(`End date must be after start date (${row.projectStartDate})`）
      ];
    }
    
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    return `${days} days`;
  }
}
```

### パターン3: パーセンテージ警告

```typescript
{
  key: 'completionPercent',
  header: 'Complete %',
  type: 'number',
  format: { min: 0, max: 100, scale: 0 },
  
  formula: (row) => {
    const pct = row.completionPercent;
    
    if (pct < 0 || pct > 100) {
      return [pct, new Error('Must be between 0 and 100')];
    }
    
    if (pct === 100 && !row.completedDate) {
      return [pct, new Error('Completion date required when 100% complete')];
    }
    
    return `${pct}%`;
  },
  
  conditionalStyle: (row) => {
    const pct = row.completionPercent;
    if (pct === 100) return { backgroundColor: '#c8e6c9' };     // 緑
    if (pct >= 75) return { backgroundColor: '#fff9c4' };       // 黄
    if (pct >= 50) return { backgroundColor: '#ffe0b2' };       // オレンジ
    return { backgroundColor: '#ffcdd2' };                      // 赤
  }
}
```

### パターン4: 依存フィールド

```typescript
{
  key: 'requiresApproval',
  header: 'Needs Approval?',
  type: 'boolean',
  
  formula: (row) => {
    // 他フィールドから自動計算
    const requiresApproval = 
      row.amount > 10000 ||
      row.category === 'sensitive' ||
      row.riskLevel === 'high';
    
    if (requiresApproval && !row.approverName) {
      return [
        requiresApproval,
        new Error('Approver must be assigned for high-risk transactions'）
      ];
    }
    
    return requiresApproval;
  }
}
```

## ベストプラクティス

### Do ✅

- **層を使い分ける**: 型制約→数式→一意制約
- **明確なエラーメッセージ**: 何がどう悪いかを示す
- **条件付きスタイル**で視覚的に強調
- **readonlyとの併用**: 計算列はreadonlyにする
- **境界ケースのテスト**: 空、null、極端値

### Don't ❌

- **数式を複雑にしすぎない**
- **エラーを隠さない**
- **クライアントだけに頼らない**（サーバー側は必須）
- **循環参照を避ける**
- **フィードバックなしの検証をしない**

## パフォーマンス考慮

### 検証タイミング

```typescript
// 型検証: 即時（数式前）
// 数式検証: レンダリングごとに行単位
// 一意性検証: セル変更時に列単位

// 最適化の流れ:
- Type constraint fails → cell marked red immediately
- Formula runs → may add additional errors
- Unique check runs → cross-row comparison
```

### 数式検証の最適化

```typescript
// ❌ NG: 数式内の重い計算
formula: (row, allRows) => {
  const expensive = allRows.map(r => {
    // 各行で重い計算
    return processRow(r);
  });
  return expensive;
}

// ✅ OK: 対象行のみ検証
formula: (row) => {
  // この行だけ検証
  if (row.value < 0) {
    return [row.value, new Error('Must be positive')];
  }
  return row.value;
}
```

## 送信前バリデーション

```typescript
// commit前にエラー確認
table.subscribeTableState((state) => {
  const hasErrors = state.activeErrors.length > 0;
  
  if (hasErrors) {
    document.getElementById('commitBtn').disabled = true;
    document.getElementById('errorMsg').textContent = 
      `Fix ${state.activeErrors.length} validation error(s)`;
  } else {
    document.getElementById('commitBtn').disabled = false;
    document.getElementById('errorMsg').textContent = '';
  }
});

// 正常時のみcommit
async function saveData() {
  const state = table.getTableState();
  
  if (state.activeErrors.length > 0) {
    alert('Please fix validation errors before saving');
    return;
  }
  
  await table.commit();
}
```

## サーバー側バリデーション

クライアント側だけでは不十分です。サーバー側でも必ず検証します。

```typescript
// クライアント側検証（第一防衛線）
// - 即時フィードバック
// - 明白なエラーを防止
// - UX向上

// サーバー側検証（必須）
// - 真のソース
// - 改ざん防止
// - 変化する業務ルールを強制
// - 同時編集に対応

// サーバー応答後にクライアント状態を更新
const response = await fetch('/api/save', { method: 'POST', body: data });

if (response.ok) {
  // サーバー検証OK
  table.commit();
} else {
  // サーバーが検証エラーを返却
  const errors = await response.json();
  displayServerErrors(errors);
}
```

## 関連項目

- [データフォーマットガイド](/ja/guides/data-format) - 列型と制約
- [数式ガイド](/ja/guides/formulas) - 高度な数式パターン
- [条件付きスタイルガイド](/ja/guides/conditional-style) - 視覚的なフィードバック
- [編集モードガイド](/ja/guides/editmode) - direct/commitの使い分け
