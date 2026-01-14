# History

## Unreleased

### Changed
- SSR `renderTableHTML` defaults skip formatting/styles/raw attributes and validation output; use `includeStyles` and `includeRawAttributes` to opt in.
- SSR performance test default budget restored to 100ms.
- SSR uses a fast rendering path (when styles/raw/conditionals are disabled) with deterministic row ids for better throughput.
- SSR output no longer emits `data-row-index`/`data-cell` attributes.
- SSR output no longer emits `data-extable-ssr`, `data-col-type`, `data-computed`, or `data-readonly`.
- SSR performance test default budget is now 300ms to reduce CI variability.

### Added
- Server-side rendering entrypoint `@extable/core/ssr` with HTML builder, CSS serializer, and SSR renderer utilities.

### Changed
- Formula-readonly cells use a subtle blue text color (#99aaff) to improve editability cues.

### Fixed
- Core: export `@extable/core/style.css` from source for workspace builds without prebuilt assets.

## 0.3.3

### Changed
- Numeric editing uses a text input and parses/validates on commit (supports scientific notation and prefixed base literals).
- Reduce visual differences between HTML and Canvas renderers (cell padding, editor geometry, row height, and text alignment).

### Added
- New integer column types: `int` (safe integer) and `uint` (non-negative safe integer).
- Integer display formats: `binary`/`octal`/`hex` (prefixed: `0b`/`0o`/`0x`) and number display format: `scientific`.
- Demo dataset `numbers` showcasing numeric formats.
- Docs: add numeric formats demo page and reference links.

### Fixed
- HTML renderer no longer sets per-cell `width/height`; row height is controlled by `tr` height and column width by header cells.
- Row header `line-height` no longer forces row height in HTML renderer.
- Canvas font rendering was tuned to visually match HTML.
- HTML column header filter/sort button no longer reserves space; it appears on hover/active without truncating the label excessively.
- HTML top-left corner cell now stays visible on both vertical and horizontal scroll.

## 0.3.2

### Fixed
- Readonly cells can no longer be edited.
- Pressing Escape after a failed/invalid edit no longer commits the draft value; it restores the pre-edit value.

## 0.3.1

### Added
- Japanese VitePress docs under `/ja/` with localized navigation and content.

### Changed
- Formula columns no longer use readonly-muted styling but remain readonly for editing.
- Canvas selection overlay is clipped to keep headers on top.
- Buttons now show hover feedback.
- Tags render as pill chips with remove controls.
- Ordinal sequences preserve prefixes/suffixes and support English word ordinals.
- Japanese docs now localize comments inside sample code blocks.
- Japanese demo pages now localize explanation text while keeping code samples unchanged.

### Fixed
- IME composition end now suppresses immediate Enter commits.
- Selection-mode IME composition start no longer opens an editor for readonly cells.

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
