# Init Options

This reference describes the initialization payload for `ExtableCore` and the `options` object used by all wrappers.

## `CoreInit<T>`

```ts
new ExtableCore<T>({
  root: HTMLElement,
  schema: Schema<T>,
  defaultData: NullableData<T>,
  defaultView: View,
  options?: CoreOptions,
})
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `root` | `HTMLElement` | yes | Container element where Extable mounts. |
| `schema` | `Schema<T>` | yes | Column definitions and validation rules. |
| `defaultData` | `NullableData<T>` | yes | Pass `null` or `undefined` for initial loading. The null -> data transition is handled once. |
| `defaultView` | `View` | yes | Initial filters, sorts, and column visibility. Can be `{}` for defaults. |
| `options` | `CoreOptions` | no | Rendering, edit mode, styles, and server integration. |

## CoreOptions

### `renderMode`
- Type: `"auto" | "html" | "canvas"`
- Default: `"auto"`
- Notes: `"auto"` selects HTML or Canvas based on user agent and options.

### `editMode`
- Type: `"direct" | "commit" | "readonly"`
- Default: `"direct"`
- Notes: `"commit"` stages changes until `commit()` is called.

### `lockMode`
- Type: `"none" | "row"`
- Default: `"none"`
- Notes: `"row"` enforces row-level locks in multi-user flows.

### `langs`
- Type: `string[]`
- Default: `undefined`
- Notes: Preferred languages for auto-fill sequence matching (for example `"ja"`, `"en"`).

### `defaultClass`
- Type: `string | string[]`
- Default: `undefined`
- Notes: Extra class names added to the root element on mount.

### `defaultStyle`
- Type: `Partial<CSSStyleDeclaration>`
- Default: `undefined`
- Notes: Inline styles applied to the root element on mount.

### `server`
- Type: `ServerAdapter`
- Default: `undefined`
- Notes: Enables multi-user synchronization. Requires `lockRow`, `unlockRows`, `commit`, and `subscribe`.

### `user`
- Type: `UserInfo`
- Default: `undefined`
- Notes: Identifies the current user for locking and commit operations.

## Wrapper Mapping

- **Vanilla**: pass the fields directly to `new ExtableCore()`.
- **React/Vue**: use the `schema`, `defaultData`, `defaultView`, and `options` props to mirror `CoreInit`.

See [Core API Reference](/reference/core) for methods available after initialization.
