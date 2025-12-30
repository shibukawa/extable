# オートフィルシーケンス

英語のみ、および日本語+英語の言語設定でシーケンスを試せます。

:::tabs
== English (en)
<ClientOnly>
  <AutoFillSequenceDemo lang="en" />
</ClientOnly>

== Japanese + English (ja + en)
<ClientOnly>
  <AutoFillSequenceDemo lang="ja" />
</ClientOnly>
:::

## 試してみること

- 数字、序数、ローマ数字をドラッグで連番入力
- `User 1` や `第1回` のような文字列パターン
- リスト系（曜日、月、ギリシャ文字）や有限リスト（十干）

## 内蔵リスト

循環リスト（末尾まで行くと先頭に戻る）:
- Weekdays（en/ja）
- Months（en/ja、日本の旧暦月名を含む）
- Quarters（en/ja）
- Zodiac animals（jaのみ: 十二支）
- Zodiac signs（en/ja）
- Directions（16風向, en/ja）
- AM/PM（en/ja）
- Seasons（en/ja）
- Solfege（en/ja）
- Rokuyō（jaのみ: 六曜）
- Greek letters（en/ja/記号）

有限リスト（末尾で停止）:
- Ten Heavenly Stems（jaのみ: 十干）
- Planets（en/ja、8惑星）
- Kuji-in（jaのみ: 九字）
- Eight virtues（jaのみ: 八徳）
- Element symbols（ja/en、日本語元素名対応）
- Japanese shoguns（鎌倉/足利/徳川）
- Japanese prefectures（jaのみ）
- US states（enのみ）
- Windows versions（コンシューマ向け）
- macOS codenames
- Debian codenames

::: info Tip
各列の先頭2行がシードです。フィルハンドルを下にドラッグしてシーケンスを生成します。
:::

## ソースコード

- Built-in sequences: [packages/sequence/src/builtins.ts](https://github.com/shibukawa/extable/blob/main/packages/sequence/src/builtins.ts)
