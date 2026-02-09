# History

## 0.3.9

### Changed

- Synchronized workspace package versions from `0.3.8` to `0.3.9` across root, core, wrappers, sequence, server, docs, and demos.
- Updated inter-package dependency references to `0.3.9` for cross-package compatibility (`core`->`sequence`, `react`/`vue`->`core`, `docs`/demos->core or wrappers).
- Size-first refactor:
  - split renderer internals into focused modules (`rendererTypes`, `rendererShared`, `htmlRenderer`, `canvasRenderer`) and kept `renderers` as a re-export surface.
  - extracted shared formatter and selection helper modules (`valueFormatter`, `selectionClipboard`, `selectionCoercion`, `selectionEditorFactory`, `selectionInitialValue`) to reduce duplication.
  - extracted index auxiliary UI definitions (`indexUi`) for context-menu/filter-sort template constants.
  - reorganized overlay-related styles into `src/styles-overlays.css` and imported from `src/styles.css`.
  - reduced React/Vue wrapper proxy duplication by introducing shared core helper utilities (`wrapperHandleUtils`) and using them in both wrappers.
  - packaging/build policy updates:
    - clean `dist` output on build (`emptyOutDir: true`),
    - release-aware sourcemap policy (`EXTABLE_RELEASE=1` disables maps),
    - map files excluded from publish artifacts,
    - added size scripts (`size:core:gzip`, `size:core:pack`, `size:core`) and core release build script.

## 0.3.8

### Changed (Breaking)

- Vue wrapper: `defaultView` prop is now optional; core accepts an optional `defaultView` and falls back to an empty view when not provided.
- Schema shape: flattened `enum` and `tags` to top-level arrays (`enum: [...]`, `tags: [...]`). Legacy nested `{ options: [...] }` shape has been removed.
- Labeled options: option objects of the form `{ label, value }` are only permitted when the column `type` is `labeled`. Using labeled option objects with other column types now triggers schema validation errors.
- Lookup API rename: `edit.lookup.fetchCandidates(ctx)` was renamed to `edit.lookup.candidates(ctx)` (async candidate fetcher).
- External editor API simplified: `edit.externalEditor.open(ctx)` was replaced by a function `edit.externalEditor(ctx)` that directly returns a Promise result.
- DataModel schema validation: `DataModel` now validates the schema on construction and `setSchema()`; `enum`/`tags` columns must provide either a local options array or a `edit.lookup.candidates` hook.
- Core runtime changes: selection/editor creation, validation, and rendering logic updated to match the new schema/API shapes (notably `selectionManager`, `validation`, and `dataModel`).
- Docs/demos/tests: updated demo fixtures, documentation, and unit tests to reflect the API and schema changes.
- Migration notes (breaking changes):
  - Update any `edit.lookup.fetchCandidates` usages to `edit.lookup.candidates`.
  - Replace `edit.externalEditor.open` usages with `edit.externalEditor` (callable function).
  - Replace legacy `enum: { options: [...] }` / `tags: { options: [...] }` shapes with top-level arrays `enum: [...]` / `tags: [...]`.
  - If you relied on labeled option objects (`{ label, value }`), set the column `type` to `labeled`.

- Tests: unit tests and rich-editing tests were updated; `@extable/core` tests run green after these changes.

### Changed

- Appearance of unique and boolean field in commit mode.
- Layout compatibility: improved flex/grid stretch behavior with safer `.extable-root` sizing defaults (`width/height/min-width/min-height`) and added optional `layoutDiagnostics` warnings for common parent shrink constraints.
- Docs/demos: added horizontal-scroll troubleshooting guidance and aligned demo layouts with explicit `min-width: 0` constraints.

## 0.3.7

### Added

- Column header resize by dragging the header edge (HTML and Canvas modes), with `View.columnWidths` persistence and `col-resize` cursor feedback.

### Changed

- Commit mode now renders unique-boolean radios with red (current) and gray (previous) indicators in HTML and Canvas modes.

## 0.3.6

### Added

- dynamic readonly function: support `ColumnSchema.readonly` as a per-row predicate `(row) => boolean` to compute readonly state dynamically (cached per-row version; exceptions produce a warning and default to editable).

### Changed

- boolean fields marked `unique` now behave like radio buttons.

## 0.3.5

### Added

- Rich editing schema hooks: remote lookup (label/value separation), async tooltip text, and external editor delegation.
- New `lookup` cell value kind which renders its `label` while preserving a stored `value`.
- New `labeled` column type that stores values as `{ label, value }` and renders/copies the `label`.
- Lookup editing now supports `recentLookup` option (default: `true`) which displays recently selected candidates with a `[recent]` label badge.
- Lookup editing now supports `allowFreeInput` option (default: `false`) which allows users to commit values that don't match any candidate.

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
