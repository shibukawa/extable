import { createBuiltInRegistry } from './builtins';
import { Sequence } from './sequence';
import type { SequenceKind, SequenceValue } from './types';
import type { SequenceMatchResult, SequenceRegistry } from './registry';

const numberEpsilon = 1e-9;
const romanMax = 100;

const createCopyIterator = <T>(value: T): Iterator<T> => {
  return {
    next() {
      return { value, done: false };
    }
  };
};

const createSeedRepeatIterator = <T>(seed: readonly T[]): Iterator<T> => {
  let index = 0;
  return {
    next() {
      if (seed.length === 0) {
        return { value: undefined, done: true } as IteratorResult<T>;
      }
      const value = seed[index % seed.length] as T;
      index += 1;
      return { value, done: false };
    }
  };
};

const createArithmeticNumberIterator = (last: number, step: number): Iterator<number> => {
  let offset = 0;
  return {
    next() {
      offset += 1;
      const value = last + step * offset;
      return { value, done: false };
    }
  };
};

const createArithmeticDateIterator = (last: Date, stepMs: number): Iterator<Date> => {
  let offset = 0;
  return {
    next() {
      offset += 1;
      const value = new Date(last.getTime() + stepMs * offset);
      return { value, done: false };
    }
  };
};

const createGeometricIterator = (last: number, ratio: number): Iterator<number> => {
  let offset = 0;
  return {
    next() {
      offset += 1;
      const value = last * ratio ** offset;
      return { value, done: false };
    }
  };
};

const createListIterator = (
  match: SequenceMatchResult,
  seed: readonly string[]
): Iterator<string> => {
  if (match.kind === 'matcher') {
    return match.matcher.createIterator(seed, { step: match.step, state: match.state });
  }
  const { list, startIndex, step } = match;
  const length = list.items.length;
  let currentIndex = startIndex;
  return {
    next() {
      if (list.mode === 'finite') {
        const nextIndex = currentIndex + step;
        if (nextIndex >= length) {
          return { value: undefined, done: true } as IteratorResult<string>;
        }
        currentIndex = nextIndex;
        return { value: list.items[currentIndex] as string, done: false };
      }
      currentIndex = (currentIndex + step) % length;
      return { value: list.items[currentIndex] as string, done: false };
    }
  };
};

const isNumberSeed = (seed: readonly SequenceValue[]): seed is readonly number[] => {
  return seed.every((value) => typeof value === 'number' && Number.isFinite(value));
};

const isDateSeed = (seed: readonly SequenceValue[]): seed is readonly Date[] => {
  return seed.every((value) => value instanceof Date && !Number.isNaN(value.getTime()));
};

const isStringSeed = (seed: readonly SequenceValue[]): seed is readonly string[] => {
  return seed.every((value) => typeof value === 'string');
};

const parseEmbeddedNumber = (value: string): { prefix: string; num: number; width: number; suffix: string } | null => {
  const match = /^(.*?)(-?\d+)([^0-9]*)$/.exec(value);
  if (!match) {
    return null;
  }
  const prefix = match[1] ?? '';
  const digits = match[2] ?? '';
  const suffix = match[3] ?? '';
  const num = Number(digits);
  if (!Number.isFinite(num)) {
    return null;
  }
  const width = digits.replace('-', '').length;
  return { prefix, num, width, suffix };
};

const createEmbeddedNumberIterator = (
  template: { prefix: string; suffix: string; width: number },
  last: number,
  step: number
): Iterator<string> => {
  let offset = 0;
  return {
    next() {
      offset += 1;
      const next = last + step * offset;
      const sign = next < 0 ? '-' : '';
      const digits = Math.abs(next).toString().padStart(template.width, '0');
      return { value: `${template.prefix}${sign}${digits}${template.suffix}`, done: false };
    }
  };
};

const romanMap: Array<[string, number]> = [
  ['C', 100],
  ['XC', 90],
  ['L', 50],
  ['XL', 40],
  ['X', 10],
  ['IX', 9],
  ['V', 5],
  ['IV', 4],
  ['I', 1]
];

const toRoman = (value: number): string | null => {
  if (value < 1 || value > romanMax) {
    return null;
  }
  let remaining = value;
  let output = '';
  for (const [symbol, amount] of romanMap) {
    while (remaining >= amount) {
      output += symbol;
      remaining -= amount;
    }
  }
  return output;
};

const parseRoman = (value: string): number | null => {
  if (value.length === 0) {
    return null;
  }
  if (value !== value.toUpperCase()) {
    return null;
  }
  let remaining = value;
  let total = 0;
  for (const [symbol, amount] of romanMap) {
    while (remaining.startsWith(symbol)) {
      total += amount;
      remaining = remaining.slice(symbol.length);
    }
  }
  if (remaining.length > 0) {
    return null;
  }
  const canonical = toRoman(total);
  if (!canonical || canonical !== value) {
    return null;
  }
  return total;
};

const createRomanIterator = (last: number, step: number): Iterator<string> => {
  let offset = 0;
  return {
    next() {
      offset += 1;
      const next = last + step * offset;
      const roman = toRoman(next);
      if (!roman) {
        return { value: undefined, done: true } as IteratorResult<string>;
      }
      return { value: roman, done: false };
    }
  };
};

const matchArithmetic = (values: readonly number[]): number | null => {
  if (values.length < 2) {
    return null;
  }
  const step = values[1]! - values[0]!;
  for (let i = 2; i < values.length; i += 1) {
    if (Math.abs(values[i]! - values[i - 1]! - step) > numberEpsilon) {
      return null;
    }
  }
  return step;
};

const matchGeometric = (values: readonly number[]): number | null => {
  if (values.length < 2) {
    return null;
  }
  if (values[0] === 0) {
    return null;
  }
  const ratio = values[1]! / values[0]!;
  for (let i = 2; i < values.length; i += 1) {
    if (values[i - 1] === 0) {
      return null;
    }
    if (Math.abs(values[i]! / values[i - 1]! - ratio) > numberEpsilon) {
      return null;
    }
  }
  return ratio;
};

const inferStringSequence = (
  seed: readonly string[]
): { kind: SequenceKind; iterator: Iterator<string> } | null => {
  const embedded = seed.map((value) => parseEmbeddedNumber(value));
  if (embedded.every(Boolean)) {
    const first = embedded[0]!;
    const last = embedded[embedded.length - 1]!;
    const samePattern = embedded.every(
      (entry) => entry?.prefix === first.prefix && entry?.suffix === first.suffix
    );
    if (samePattern) {
      const values = embedded.map((entry) => entry?.num ?? 0);
      const step = matchArithmetic(values);
      if (step !== null) {
        return {
          kind: 'arithmetic',
          iterator: createEmbeddedNumberIterator(
            { prefix: last.prefix, suffix: last.suffix, width: last.width },
            last.num,
            step
          )
        };
      }
    }
  }

  const romanValues = seed.map((value) => parseRoman(value));
  if (romanValues.every((value) => value !== null)) {
    const numeric = romanValues as number[];
    const step = matchArithmetic(numeric);
    if (step !== null) {
      const last = numeric[numeric.length - 1]!;
      return {
        kind: 'arithmetic',
        iterator: createRomanIterator(last, step)
      };
    }
  }

  return null;
};

const inferFromList = (
  seed: readonly string[],
  registry: SequenceRegistry
): { kind: SequenceKind; iterator: Iterator<string> } | null => {
  const match = registry.match(seed);
  if (!match) {
    return null;
  }
  return {
    kind: 'list',
    iterator: createListIterator(match, seed)
  };
};

export function inferSequence(seed: readonly number[], options?: { registry?: SequenceRegistry }): Sequence<number>;
export function inferSequence(seed: readonly Date[], options?: { registry?: SequenceRegistry }): Sequence<Date>;
export function inferSequence(seed: readonly string[], options?: { registry?: SequenceRegistry }): Sequence<string>;
export function inferSequence(
  seed: readonly SequenceValue[],
  options?: { registry?: SequenceRegistry }
): Sequence<SequenceValue> {
  const registry = options?.registry ?? createBuiltInRegistry();
  if (seed.length === 0) {
    return Sequence.fromSeed(seed, 'seed-repeat', createSeedRepeatIterator(seed));
  }
  if (seed.length === 1) {
    return Sequence.fromSeed(seed, 'copy', createCopyIterator(seed[0]!));
  }

  if (isStringSeed(seed)) {
    const listSequence = inferFromList(seed, registry);
    if (listSequence) {
      return Sequence.fromSeed(seed, listSequence.kind, listSequence.iterator);
    }
    const structured = inferStringSequence(seed);
    if (structured) {
      return Sequence.fromSeed(seed, structured.kind, structured.iterator);
    }
  }

  if (isNumberSeed(seed)) {
    const step = matchArithmetic(seed);
    if (step !== null) {
      return Sequence.fromSeed(
        seed,
        'arithmetic',
        createArithmeticNumberIterator(seed[seed.length - 1]!, step)
      );
    }
    const ratio = matchGeometric(seed);
    if (ratio !== null) {
      return Sequence.fromSeed(
        seed,
        'geometric',
        createGeometricIterator(seed[seed.length - 1]!, ratio)
      );
    }
  }

  if (isDateSeed(seed)) {
    const times = seed.map((value) => value.getTime());
    const step = matchArithmetic(times);
    if (step !== null) {
      return Sequence.fromSeed(
        seed,
        'arithmetic',
        createArithmeticDateIterator(seed[seed.length - 1]!, step)
      );
    }
  }

  return Sequence.fromSeed(seed, 'seed-repeat', createSeedRepeatIterator(seed));
}
