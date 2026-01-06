# History

## Unreleased

### 0.3.1

- Japanese VitePress docs under `/ja/` with localized navigation and content.

### Changed
- Formula columns no longer use readonly-muted styling but remain readonly for editing.
- Canvas selection overlay is clipped to keep headers on top.
- Buttons now show hover feedback.
- Tags render as pill chips with remove controls.
- Ordinal sequences preserve prefixes/suffixes and support English word ordinals.
- Japanese docs now localize comments inside sample code blocks.
- Japanese demo pages now localize explanation text while keeping code samples unchanged.
- Numeric editing uses a text input and parses/validates on commit (supports scientific notation and prefixed base literals).

### Added
- New integer column types: `int` (safe integer) and `uint` (non-negative safe integer).
- Integer display formats: `binary`/`octal`/`hex` (prefixed: `0b`/`0o`/`0x`) and number display format: `scientific`.
- Demo dataset `numbers` showcasing numeric formats.

### Fixed
- IME composition end now suppresses immediate Enter commits.
- Selection-mode IME composition start no longer opens an editor for readonly cells.
- Pressing Escape after a failed/invalid edit no longer commits the draft value; it restores the pre-edit value.

## 0.3.0

### Changed
- Initialization options removed `loading` and all `findReplace` fields.
- Column schema formatting unified under `format`.
- `commit()` accepts an async handler for pre-commit validation.

### Added
- Init options reference and callbacks guide.
- Button and link cell types with `action`/`link` click handling.
- Conditional `readonly`/`disabled` support for applicable column types.
- Auto-fill sequences expanded (US states, kanji numerals, Windows/macOS/Debian versions, element symbols, prefectures, shoguns, state abbreviations, weekday/month variants, roman numerals).
