import { defineConfig } from "vitepress";
import { tabsMarkdownPlugin } from "vitepress-plugin-tabs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  lang: "en-US",
  title: "Extable",
  description: "Excel-like HTML table component with fixed column schema",
  base: process.env.BASE_PATH ?? "/",
  cleanUrls: true,
  markdown: {
    config(md) {
      md.use(tabsMarkdownPlugin);
    },
  },
  vite: {
    resolve: {
      alias: {
        "@extable/core/style.css": path.resolve(configDir, "../../core/src/styles.css"),
      },
    },
  },
  locales: {
    root: {
      label: "English",
      lang: "en-US",
      title: "Extable",
      description: "Excel-like HTML table component with fixed column schema",
      themeConfig: {
        nav: [
          { text: "Concepts", link: "/concepts/" },
          { text: "Guides", link: "/guides/integration" },
          { text: "Usage", link: "/usage/editing" },
          { text: "Demos", link: "/demos/" },
          { text: "Reference", link: "/reference/core" },
          {
            text: "GitHub",
            link: "https://github.com/shibukawa/extable",
            target: "_blank",
            rel: "noopener noreferrer",
          },
        ],
        footer: {
          message: "Released under the Apache 2.0 License",
          copyright: "Copyright 2026 Yoshiki Shibukawa",
        },
        sidebar: {
          "/concepts/": [
            { text: "Extable Design Concept", link: "/concepts/" },
            { text: "Uncontrolled Model", link: "/concepts/uncontrolled" },
            { text: "Differences from Excel", link: "/concepts/differences-from-excel" },
            { text: "Rendering Modes", link: "/concepts/rendering-modes" },
            { text: "Data / Schema / View", link: "/concepts/data-schema-view" },
            { text: "IME Input Handling", link: "/concepts/ime" },
            { text: "Multi-user (Preview)", link: "/concepts/multi-user" },
          ],
          "/guides/": [
            { text: "Integration", link: "/guides/integration" },
            { text: "Data Format", link: "/guides/data-format" },
            { text: "Edit Modes", link: "/guides/editmode" },
            { text: "Data Access from API", link: "/guides/data-access" },
            { text: "Callbacks", link: "/guides/callbacks" },
            { text: "Validation", link: "/guides/validation" },
            { text: "Style", link: "/guides/style" },
            { text: "Formulas", link: "/guides/formulas" },
            { text: "Conditional Style", link: "/guides/conditional-style" },
            { text: "Unit Testing", link: "/guides/unit-testing" },
          ],
          "/usage/": [
            { text: "Editing", link: "/usage/editing" },
            { text: "Sort & Filter", link: "/usage/sort-filter" },
            { text: "Search", link: "/usage/search" },
          ],
          "/demos/": [
            { text: "Overview", link: "/demos/" },
            { text: "Basic", items: [
              { text: "Basic Usage (Direct Mode)", link: "/demos/basic-usage" },
              { text: "Filter/Sort", link: "/demos/filter-support" },
              { text: "Auto Fill", link: "/demos/auto-fill-sequence" },
              { text: "Async Data Loading", link: "/demos/async-data-loading" },
            ]},
            { text: "Modes", items: [
              { text: "Readonly Mode", link: "/demos/readonly-mode" },
              { text: "Commit Mode", link: "/demos/commit-mode" },
              { text: "SSR vs Client Rendering", link: "/demos/ssr-compare" },
            ]},
            {
              text: "Format/Style", items: [
              { text: "Formatting", link: "/demos/formatting" },
              { text: "Numeric Formats", link: "/demos/number-formats" },
              { text: "Button/Link", link: "/demos/button-link" },
              { text: "Formula", link: "/demos/formulas" },
              { text: "Conditional Style", link: "/demos/conditional-style" },
              { text: "Unique Constraint", link: "/demos/unique-constraint" },
              { text: "Conditional Disable/Readonly", link: "/demos/conditional-access" },
            ]},
          ],
          "/reference/": [
            { text: "Core API", link: "/reference/core" },
            { text: "SSR", link: "/reference/ssr" },
            { text: "Events", link: "/reference/events" },
            { text: "constructor options", link: "/reference/init-options" },
          ],
        },
      },
    },
    ja: {
      label: "日本語",
      lang: "ja-JP",
      title: "Extable",
      description: "固定列スキーマを持つExcelライクなHTMLテーブルコンポーネント",
      themeConfig: {
        nav: [
          { text: "コンセプト", link: "/ja/concepts/" },
          { text: "ガイド", link: "/ja/guides/integration" },
          { text: "使い方", link: "/ja/usage/editing" },
          { text: "デモ", link: "/ja/demos/" },
          { text: "リファレンス", link: "/ja/reference/core" },
          {
            text: "GitHub",
            link: "https://github.com/shibukawa/extable",
            target: "_blank",
            rel: "noopener noreferrer",
          },
        ],
        footer: {
          message: "Apache 2.0 Licenseで公開",
          copyright: "Copyright 2026 Yoshiki Shibukawa",
        },
        sidebar: {
          "/ja/concepts/": [
            { text: "Extableの設計コンセプト", link: "/ja/concepts/" },
            { text: "アンコントロールドモデル", link: "/ja/concepts/uncontrolled" },
            { text: "Excelとの違い", link: "/ja/concepts/differences-from-excel" },
            { text: "レンダリングモード", link: "/ja/concepts/rendering-modes" },
            { text: "データ / スキーマ / ビュー", link: "/ja/concepts/data-schema-view" },
            { text: "IME入力の取り扱い", link: "/ja/concepts/ime" },
            { text: "マルチユーザー（プレビュー）", link: "/ja/concepts/multi-user" },
          ],
          "/ja/guides/": [
            { text: "導入", link: "/ja/guides/integration" },
            { text: "データフォーマット", link: "/ja/guides/data-format" },
            { text: "編集モード", link: "/ja/guides/editmode" },
            { text: "APIからのデータアクセス", link: "/ja/guides/data-access" },
            { text: "コールバック", link: "/ja/guides/callbacks" },
            { text: "バリデーション", link: "/ja/guides/validation" },
            { text: "スタイル", link: "/ja/guides/style" },
            { text: "数式", link: "/ja/guides/formulas" },
            { text: "条件付きスタイル", link: "/ja/guides/conditional-style" },
            { text: "ユニットテスト", link: "/ja/guides/unit-testing" },
          ],
          "/ja/usage/": [
            { text: "編集", link: "/ja/usage/editing" },
            { text: "ソートとフィルター", link: "/ja/usage/sort-filter" },
            { text: "検索", link: "/ja/usage/search" },
          ],
          "/ja/demos/": [
            { text: "概要", link: "/ja/demos/" },
            { text: "基本", items: [
              { text: "基本（ダイレクトモード）", link: "/ja/demos/basic-usage" },
              { text: "フィルター/ソート", link: "/ja/demos/filter-support" },
              { text: "オートフィル", link: "/ja/demos/auto-fill-sequence" },
              { text: "非同期データ読み込み", link: "/ja/demos/async-data-loading" },
            ]},
            { text: "モード", items: [
              { text: "読み取り専用モード", link: "/ja/demos/readonly-mode" },
              { text: "コミットモード", link: "/ja/demos/commit-mode" },
              { text: "SSRとクライアント描画の比較", link: "/ja/demos/ssr-compare" },
            ]},
            {
              text: "書式/スタイル", items: [
              { text: "書式", link: "/ja/demos/formatting" },
              { text: "数値フォーマット", link: "/ja/demos/number-formats" },
              { text: "ボタン/リンク", link: "/ja/demos/button-link" },
              { text: "数式", link: "/ja/demos/formulas" },
              { text: "条件付きスタイル", link: "/ja/demos/conditional-style" },
              { text: "一意制約", link: "/ja/demos/unique-constraint" },
              { text: "条件付き無効/読み取り専用", link: "/ja/demos/conditional-access" },
            ]},
          ],
          "/ja/reference/": [
            { text: "Core API", link: "/ja/reference/core" },
            { text: "イベント", link: "/ja/reference/events" },
            { text: "SSR", link: "/ja/reference/ssr" },
            { text: "コンストラクタオプション", link: "/ja/reference/init-options" },
          ],
        },
      },
    },
  },
});
