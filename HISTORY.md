# History

## UnReleased

### Added

- Rich editing schema hooks: remote lookup (label/value separation), async tooltip text, and external editor delegation.
- New `lookup` cell value kind which renders its `label` while preserving a stored `value`.
- New `labeled` column type that stores values as `{ label, value }` and renders/copies the `label`.

### Changed

- Cleanup codes

## 0.3.4

### Added
- Server-side rendering entrypoint `@extable/core/ssr` with HTML builder, CSS serializer, and SSR renderer utilities.
- Go SSR module under `ssr/extable-go` with a typed `RenderTableHTML` API (no styling, minimal attributes).

### Changed
- Formula-readonly cells use a subtle blue text color (#99aaff) to improve editability cues.
- Removed legacy runtime fallbacks for ResizeObserver, requestAnimationFrame, elementFromPoint, and CSS.escape.

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
