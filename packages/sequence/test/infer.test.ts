import { describe, expect, it } from 'vitest';
import { SequenceRegistry } from '../src/registry';
import { createBuiltInRegistry } from '../src/builtins';
import { inferSequence } from '../src/infer';

const drain = <T>(iter: Iterator<T>, count: number): T[] => {
  const out: T[] = [];
  for (let i = 0; i < count; i += 1) {
    const next = iter.next();
    if (next.done) {
      break;
    }
    out.push(next.value);
  }
  return out;
};

describe('inferSequence', () => {
  it('repeats single seed values', () => {
    const seq = inferSequence([42]);
    expect(drain(seq, 3)).toEqual([42, 42, 42]);
  });

  it('detects arithmetic progression for numbers', () => {
    const seq = inferSequence([2, 4, 6]);
    expect(drain(seq, 3)).toEqual([8, 10, 12]);
  });

  it('detects arithmetic progression for dates', () => {
    const d1 = new Date('2025-01-01T00:00:00Z');
    const d2 = new Date('2025-01-03T00:00:00Z');
    const seq = inferSequence([d1, d2]);
    const next = seq.next();
    expect(next.done).toBe(false);
    expect(next.value.toISOString()).toBe('2025-01-05T00:00:00.000Z');
  });

  it('detects geometric progression for numbers', () => {
    const seq = inferSequence([2, 6, 18]);
    expect(drain(seq, 3)).toEqual([54, 162, 486]);
  });

  it('falls back to seed repeat', () => {
    const seq = inferSequence(['A', 'C', 'B']);
    expect(drain(seq, 4)).toEqual(['A', 'C', 'B', 'A']);
  });

  it('matches built-in lists (aliases included)', () => {
    const seq = inferSequence(['Jan', 'Feb']);
    expect(drain(seq, 3)).toEqual(['March', 'April', 'May']);
  });

  it('matches english ordinals', () => {
    const seq = inferSequence(['1st', '2nd', '3rd']);
    expect(drain(seq, 3)).toEqual(['4th', '5th', '6th']);
  });

  it('matches greek letter symbols', () => {
    const seq = inferSequence(['α', 'β']);
    expect(drain(seq, 3)).toEqual(['γ', 'δ', 'ε']);
  });

  it('infers 16-wind step from cardinal directions', () => {
    const seq = inferSequence(['North', 'East', 'South', 'West']);
    expect(drain(seq, 4)).toEqual(['North', 'East', 'South', 'West']);
  });

  it('supports embedded number progressions', () => {
    const seq = inferSequence(['第10回', '第11回']);
    expect(drain(seq, 3)).toEqual(['第12回', '第13回', '第14回']);
  });

  it('supports roman numeral progressions up to 100', () => {
    const seq = inferSequence(['I', 'II']);
    expect(drain(seq, 3)).toEqual(['III', 'IV', 'V']);
    const end = inferSequence(['XCIX', 'C']);
    const next = end.next();
    expect(next.done).toBe(true);
  });

  it('stops at finite list end', () => {
    const registry = createBuiltInRegistry(['ja']);
    const seq = inferSequence(['甲', '乙'], { registry });
    const values = drain(seq, 20);
    expect(values[0]).toBe('丙');
    expect(values[values.length - 1]).toBe('癸');
    expect(values).toContain('癸');
  });

  it('honors user matchers over list matches by score', () => {
    const registry = createBuiltInRegistry(['en']);
    registry.register({
      id: 'custom-list',
      mode: 'cycle',
      langs: ['en'],
      items: ['A', 'B', 'C']
    });
    registry.registerMatch({
      id: 'custom-matcher',
      match(seed) {
        if (seed.length >= 2 && seed[0] === 'A' && seed[1] === 'B') {
          return { score: 100 };
        }
        return null;
      },
      createIterator() {
        return {
          next() {
            return { value: 'Z', done: false };
          }
        };
      }
    });
    const seq = inferSequence(['A', 'B'], { registry });
    expect(drain(seq, 2)).toEqual(['Z', 'Z']);
  });
});

describe('SequenceRegistry langs handling', () => {
  it('defaults to en when langs is empty', () => {
    const registry = new SequenceRegistry({ langs: [] });
    expect(registry.langs).toEqual(['en']);
  });

  it('appends en when missing', () => {
    const registry = new SequenceRegistry({ langs: ['ja'] });
    expect(registry.langs).toEqual(['ja', 'en']);
  });
});
