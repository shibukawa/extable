# 数値フォーマット

数値の表示書式と入力パースを確認するデモです。

- 浮動小数点（`number`）の **decimal** / **scientific** 表示
- 安全整数（`int`/`uint`）の **decimal** / **binary** / **octal** / **hex** 表示

## インタラクティブデモ

<ClientOnly>
  <NumberFormatsDemo />
</ClientOnly>

::: info 編集メモ
数値列はテキスト入力で編集し、確定時にパースします。

入力例:
- 10進: `123`, `-123.45`
- 科学表記: `1e3`, `-1.2E-3`
- 接頭辞付きの基数表記: `0b1010`, `0o755`, `0x2a`
- 全角数字は確定時に正規化されます: `１２３` → `123`
:::

## 関連ドキュメント

- [データフォーマットガイド（Number / Integer）](/ja/guides/data-format#number)
- [ExtableCore APIリファレンス](/ja/reference/core)
