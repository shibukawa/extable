# デモ

## インタラクティブ例

### Basic Usage（埋め込み）

Extableを最小構成で試せるデモです。**10,000行**を読み込み、基本性能を確認できます。

👉 **[Basic Usage Demo →](/ja/demos/basic-usage)**

- 10,000行データセット
- 実レンダリング時間

## 機能デモ

機能ごとに分けたデモを用意しています。

### データとパフォーマンス

- **[Async Data Loading →](/ja/demos/async-data-loading)** - ローディング表示付きで動的に読み込み
- **[SSRとクライアント描画の比較 →](/ja/demos/ssr-compare)** - 静的HTMLとHTML/Canvas描画を比較

### 追加の編集モード

- **[Readonly Mode →](/ja/demos/readonly-mode)** - 編集不可の表示専用
- **[Commit Mode →](/ja/demos/commit-mode)** - 編集を保留して一括確定
- **[リッチ編集 →](/ja/demos/rich-editing-remote)** - リモートLookup、外部エディタ委譲、非同期ツールチップ

### 表示・フォーマット・検証

- **[Formatting →](/ja/demos/formatting)** - 通貨、日付、数値、配置、スタイル
- **[数値フォーマット →](/ja/demos/number-formats)** - 科学表記と接頭辞付きの基数表記（0b/0o/0x）
- **[Formulas →](/ja/demos/formulas)** - 数式による計算列
- **[Conditional Style →](/ja/demos/conditional-style)** - 値に応じた色やスタイル
- **[Button & Link Cells →](/ja/demos/button-link)** - ボタン/リンクセル
- **[Conditional Readonly/Disabled →](/ja/demos/conditional-access)** - 編集可否の切り替え
- **[Unique Constraint →](/ja/demos/unique-constraint)** - 一意制約と検証
- **[Unique Boolean (Radio) →](/ja/demos/unique-bool)** - ブール列をラジオグループとして表示（1行のみ true）
- **[Auto-fill Sequences →](/ja/demos/auto-fill-sequence)** - 連番やリストのドラッグ入力

### 使い方のサンプル

- **[Filter/Sort Sample →](/ja/demos/filter-support)** - 列フィルターとソート

## 外部デモ

### フル機能デモ

マルチユーザー編集、サーバー同期、発展機能を含む完全版はGitHubで確認できます。

| Framework | Repository | Features |
| --- | --- | --- |
| **Vanilla** | [packages/demo](https://github.com/shibukawa/extable/tree/main/packages/demo) | Core library, all data types, formulas, validation, multi-user sync |
| **React** | [packages/demo-react](https://github.com/shibukawa/extable/tree/main/packages/demo-react) | React hooks, uncontrolled component, state management patterns |
| **Vue** | [packages/demo-vue](https://github.com/shibukawa/extable/tree/main/packages/demo-vue) | Vue 3 setup, ref integration, reactive data patterns |

## ローカル実行

開発環境でフルデモを動かす場合:

```bash
# Install dependencies
npm install

# Run Vanilla (Core) demo
npm run dev:demo

# Run React demo
npm run dev:demo-react

# Run Vue demo
npm run dev:demo-vue
```

アクセス先:
- Vanilla: `http://localhost:5173`
- React: `http://localhost:5174`
- Vue: `http://localhost:5175`

## デモで確認できる内容

✅ **複数データ型** - string/number/date/boolean/enum/tags  
✅ **数式と検証** - 計算列、カスタム検証、エラー表示  
✅ **条件付き書式** - 値に応じた動的スタイル  
✅ **一意制約** - 重複値の防止  
✅ **マルチユーザー編集** - 行ロックによる並行編集  
✅ **ソート&フィルター** - 列単位の絞り込みと並び替え  
✅ **パフォーマンス** - 1K〜10K行での動作確認  

## 学習の流れ

1. **最初に**: [Basic Usage](/ja/demos/basic-usage) - コア概念を理解
2. **機能を学ぶ**: [Guides](/ja/guides/integration) - 各機能の詳細
3. **実装例を見る**: [GitHub Demos](https://github.com/shibukawa/extable) - 実装全体
4. **リファレンス**: [API Docs](/ja/reference/core) - 完全なAPI仕様
