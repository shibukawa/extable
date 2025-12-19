import type { SequenceKind, SequenceValue } from './types';

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

export class Sequence<T extends SequenceValue> implements Iterable<T>, Iterator<T> {
  readonly seed: readonly T[];
  kind: SequenceKind;
  private iterator: Iterator<T>;

  constructor(...seed: T[]);
  constructor(...args: unknown[]) {
    const seed = args as T[];
    this.seed = seed;
    this.kind = seed.length === 1 ? 'copy' : 'seed-repeat';
    this.iterator = createSeedRepeatIterator(seed);
  }

  static fromSeed<T extends SequenceValue>(
    seed: readonly T[],
    kind: SequenceKind,
    iterator: Iterator<T>
  ): Sequence<T> {
    const instance = new Sequence<T>(...seed);
    instance.kind = kind;
    instance.iterator = iterator;
    return instance;
  }

  next(): IteratorResult<T> {
    return this.iterator.next();
  }

  [Symbol.iterator](): Iterator<T> {
    return this;
  }
}
