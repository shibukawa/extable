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

  it('matches month short names', () => {
    const seq = inferSequence(['Jan', 'Feb']);
    expect(drain(seq, 3)).toEqual(['Mar', 'Apr', 'May']);
  });

  it('matches english ordinals', () => {
    const seq = inferSequence(['1st', '2nd', '3rd']);
    expect(drain(seq, 3)).toEqual(['4th', '5th', '6th']);
  });

  it('matches greek letter symbols', () => {
    const seq = inferSequence(['α', 'β']);
    expect(drain(seq, 3)).toEqual(['γ', 'δ', 'ε']);
  });

  it('matches element symbols', () => {
    const seq = inferSequence(['H', 'He']);
    expect(drain(seq, 3)).toEqual(['Li', 'Be', 'B']);
  });

  it('matches element names in Japanese', () => {
    const registry = createBuiltInRegistry(['ja']);
    const seq = inferSequence(['水素', 'ヘリウム'], { registry });
    expect(drain(seq, 3)).toEqual(['リチウム', 'ベリリウム', 'ホウ素']);
  });

  it('matches shogun lists', () => {
    const registry = createBuiltInRegistry(['ja']);
    const seq = inferSequence(['源頼朝', '源頼家'], { registry });
    expect(drain(seq, 3)).toEqual(['源実朝', '九条頼経', '九条頼嗣']);
  });

  it('matches shogun given-name lists', () => {
    const registry = createBuiltInRegistry(['ja']);
    const seq = inferSequence(['家康', '秀忠'], { registry });
    expect(drain(seq, 3)).toEqual(['家光', '家綱', '綱吉']);
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

  it('supports kanji numeral progressions', () => {
    const modern = inferSequence(['九', '十']);
    expect(drain(modern, 2)).toEqual(['十一', '十二']);
    const traditional = inferSequence(['拾', '拾壱']);
    expect(drain(traditional, 2)).toEqual(['拾弐', '拾参']);
    const limit = inferSequence(['九千九百九十九', '一万']);
    expect(limit.next().done).toBe(true);
  });

  it('supports embedded roman numerals', () => {
    const seq = inferSequence(['ドラクエIII', 'ドラクエIV']);
    expect(drain(seq, 2)).toEqual(['ドラクエV', 'ドラクエVI']);
    const punct = inferSequence(['III,', 'IV,']);
    expect(drain(punct, 2)).toEqual(['V,', 'VI,']);
  });

  it('supports embedded kanji numerals', () => {
    const seq = inferSequence(['第九回', '第十回']);
    expect(drain(seq, 2)).toEqual(['第十一回', '第十二回']);
    const mixed = inferSequence(['X九', 'X十']);
    expect(drain(mixed, 1)).toEqual(['X十一']);
  });

  it('stops at finite list end', () => {
    const registry = createBuiltInRegistry(['ja']);
    const seq = inferSequence(['甲', '乙'], { registry });
    const values = drain(seq, 20);
    expect(values[0]).toBe('丙');
    expect(values[values.length - 1]).toBe('癸');
    expect(values).toContain('癸');
  });

  it('matches prefecture aliases', () => {
    const registry = createBuiltInRegistry(['ja']);
    const seq = inferSequence(['青森', '岩手'], { registry });
    expect(drain(seq, 2)).toEqual(['宮城県', '秋田県']);
  });

  it('keeps weekday styles separate', () => {
    const enLong = inferSequence(['Monday', 'Tuesday']);
    expect(drain(enLong, 2)).toEqual(['Wednesday', 'Thursday']);
    const enShort = inferSequence(['Mon', 'Tue']);
    expect(drain(enShort, 2)).toEqual(['Wed', 'Thu']);
    const jaLong = inferSequence(['月曜日', '火曜日']);
    expect(drain(jaLong, 2)).toEqual(['水曜日', '木曜日']);
    const jaShort = inferSequence(['月曜', '火曜']);
    expect(drain(jaShort, 2)).toEqual(['水曜', '木曜']);
    const jaSingle = inferSequence(['月', '火']);
    expect(drain(jaSingle, 2)).toEqual(['水', '木']);
  });

  it('keeps month styles separate', () => {
    const long = inferSequence(['January', 'February']);
    expect(drain(long, 2)).toEqual(['March', 'April']);
    const short = inferSequence(['Jan', 'Feb']);
    expect(drain(short, 2)).toEqual(['Mar', 'Apr']);
  });

  it('matches US states', () => {
    const registry = createBuiltInRegistry(['en']);
    const seq = inferSequence(['Alabama', 'Alaska'], { registry });
    expect(drain(seq, 3)).toEqual(['Arizona', 'Arkansas', 'California']);
  });

  it('matches US state abbreviations', () => {
    const registry = createBuiltInRegistry(['en']);
    const seq = inferSequence(['AL', 'AK'], { registry });
    expect(drain(seq, 3)).toEqual(['AZ', 'AR', 'CA']);
  });

  it('matches Windows versions', () => {
    const seq = inferSequence(['Windows 1.0', 'Windows 2.0']);
    expect(drain(seq, 3)).toEqual(['Windows 2.1', 'Windows 3.0', 'Windows 3.1']);
  });

  it('matches macOS versions', () => {
    const seq = inferSequence(['Cheetah', 'Puma']);
    expect(drain(seq, 3)).toEqual(['Jaguar', 'Panther', 'Tiger']);
  });

  it('matches Debian versions', () => {
    const seq = inferSequence(['buster', 'bullseye']);
    expect(drain(seq, 2)).toEqual(['bookworm']);
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
