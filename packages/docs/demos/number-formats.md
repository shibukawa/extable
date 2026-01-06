# Numeric Formats

Showcase for numeric formatting and parsing:

- Floating-point numbers in **decimal** and **scientific** display
- Safe integers (`int`/`uint`) in **decimal**, **binary**, **octal**, and **hex** display

## Interactive Demo

<ClientOnly>
  <NumberFormatsDemo />
</ClientOnly>

::: info Editing note
Numeric columns use a text editor and parse on commit.

Supported examples:
- Decimal: `123`, `-123.45`
- Scientific: `1e3`, `-1.2E-3`
- Base-prefixed integers: `0b1010`, `0o755`, `0x2a`
- Full-width digits are normalized on commit: `１２３` → `123`
:::

## Related docs

- [Data Format Guide (Number / Integer)](/guides/data-format#number)
- [ExtableCore API Reference](/reference/core)
