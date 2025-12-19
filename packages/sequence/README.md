# @extable/sequence

Sequence inference engine for Extable auto-fill.

This package provides a small, composable sequence engine that can detect list patterns,
arithmetic/geometric progressions, and structured string patterns (embedded numbers, roman numerals,
English ordinals) and then generate subsequent values.

## Install

```bash
npm install @extable/sequence
```

## Usage

```ts
import { inferSequence, createBuiltInRegistry } from "@extable/sequence";

const registry = createBuiltInRegistry(["ja", "en"]);
const seq = inferSequence(["Jan", "Feb"], { registry });

// The iterator yields values *after* the seed.
seq.next().value; // "March"
```

## API

### inferSequence

```ts
inferSequence(seed: readonly number[], options?: { registry?: SequenceRegistry }): Sequence<number>
inferSequence(seed: readonly Date[], options?: { registry?: SequenceRegistry }): Sequence<Date>
inferSequence(seed: readonly string[], options?: { registry?: SequenceRegistry }): Sequence<string>
```

Inference priority:
1. Single-item seed -> copy
2. Built-in/custom list match
3. Arithmetic progression
4. Geometric progression (numbers only)
5. Seed repeat

### SequenceRegistry

```ts
const registry = new SequenceRegistry({ langs: ["ja", "en"] });
registry.register(list);
registry.registerMatch(matcher);
```

- `langs` controls language preference (no `navigator` dependency).
- `en` is appended if missing.

## Built-in Lists

Cycle lists (wrap-around):
- Weekdays (en/ja)
- Months (en/ja, traditional Japanese month names)
- Quarters (en/ja)
- Zodiac animals (十二支)
- Zodiac signs (en/ja)
- Directions (16-wind, en/ja)
- AM/PM (en/ja)
- Seasons (en/ja)
- Solfege (en/ja)
- Rokuyo (六曜)
- Greek letters (en/ja/symbols)

Finite lists (stop at end):
- Ten Heavenly Stems (十干)
- Planets (en/ja, 8 planets)
- Kuji-in (九字)
- Eight virtues (八徳)

## Custom Matchers

You can register custom matchers with a score to override built-ins:

```ts
registry.registerMatch({
  id: "custom",
  match(seed) {
    if (seed[0] === "A" && seed[1] === "B") return { score: 100 };
    return null;
  },
  createIterator() {
    return {
      next() {
        return { value: "Z", done: false };
      }
    };
  }
});
```

## License

Apache-2.0
