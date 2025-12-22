# Auto-fill Sequences

Test the sequence engine with English-only and Japanese+English language preferences.

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

## What to Try

- Drag-fill numbers, ordinals, and roman numerals.
- Drag-fill string patterns like `User 1` or `第1回`.
- Test list sequences (months, weekdays, Greek letters) and finite lists (heavenly stems).

## Built-in Lists

Cycle lists (wrap-around):
- Weekdays (en/ja)
- Months (en/ja, including traditional Japanese month names)
- Quarters (en/ja)
- Zodiac animals (ja only: 十二支)
- Zodiac signs (en/ja)
- Directions (16-wind, en/ja)
- AM/PM (en/ja)
- Seasons (en/ja)
- Solfege (en/ja)
- Rokuyō (ja only: 六曜)
- Greek letters (en/ja/symbols)

Finite lists (stop at end):
- Ten Heavenly Stems (ja only: 十干)
- Planets (en/ja, 8 planets)
- Kuji-in (ja only: 九字)
- Eight virtues (ja only: 八徳)
- Element symbols (ja/en, supports Japanese element names)
- Japanese shoguns (Kamakura/Ashikaga/Tokugawa)
- Japanese prefectures (ja only)
- US states (en only)
- Windows versions (consumer releases)
- macOS codenames
- Debian codenames

::: info Tip
The first two rows in each column are the seeds. Drag the fill handle downward to generate the sequence.
:::

## Source Code

- Built-in sequences: [packages/sequence/src/builtins.ts](https://github.com/shibukawa/extable/blob/main/packages/sequence/src/builtins.ts)
