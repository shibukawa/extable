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

type UnicodeGroup =
  | 'latin'
  | 'han'
  | 'hiragana'
  | 'katakana'
  | 'number'
  | 'punct'
  | 'symbol'
  | 'space'
  | 'other';

const getUnicodeGroup = (char: string): UnicodeGroup => {
  if (/\p{White_Space}/u.test(char)) return 'space';
  if (/\p{P}/u.test(char)) return 'punct';
  if (/\p{S}/u.test(char)) return 'symbol';
  if (/\p{Script=Latin}/u.test(char)) return 'latin';
  if (/\p{Script=Han}/u.test(char)) return 'han';
  if (/\p{Script=Hiragana}/u.test(char)) return 'hiragana';
  if (/\p{Script=Katakana}/u.test(char)) return 'katakana';
  if (/\p{N}/u.test(char)) return 'number';
  return 'other';
};

const splitByUnicodeGroups = (value: string): Array<{ value: string; group: UnicodeGroup }> => {
  const segments: Array<{ value: string; group: UnicodeGroup }> = [];
  let current = '';
  let currentGroup: UnicodeGroup | null = null;
  for (const char of value) {
    const group = getUnicodeGroup(char);
    if (currentGroup === group) {
      current += char;
      continue;
    }
    if (currentGroup !== null) {
      segments.push({ value: current, group: currentGroup });
    }
    current = char;
    currentGroup = group;
  }
  if (currentGroup !== null) {
    segments.push({ value: current, group: currentGroup });
  }
  return segments;
};

const parseEmbeddedRoman = (value: string): { prefix: string; num: number; suffix: string } | null => {
  const segments = splitByUnicodeGroups(value);
  const romanSegments = segments
    .map((segment, index) => ({ index, num: parseRoman(segment.value) }))
    .filter((entry) => entry.num !== null);
  if (romanSegments.length !== 1) {
    return null;
  }
  const romanIndex = romanSegments[0]!.index;
  const num = romanSegments[0]!.num as number;
  const prefix = segments.slice(0, romanIndex).map((segment) => segment.value).join('');
  const suffix = segments.slice(romanIndex + 1).map((segment) => segment.value).join('');
  return { prefix, num, suffix };
};

const createEmbeddedRomanIterator = (
  template: { prefix: string; suffix: string },
  last: number,
  step: number
): Iterator<string> => {
  let offset = 0;
  return {
    next() {
      offset += 1;
      const nextValue = last + step * offset;
      const roman = toRoman(nextValue);
      if (!roman) {
        return { value: undefined, done: true } as IteratorResult<string>;
      }
      return { value: `${template.prefix}${roman}${template.suffix}`, done: false };
    }
  };
};

type KanjiStyle = 'modern' | 'traditional';

const kanjiDigitsModern: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9
};

const kanjiDigitsTraditional: Record<string, number> = {
  壱: 1,
  弐: 2,
  参: 3,
  肆: 4,
  伍: 5,
  陸: 6,
  柒: 7,
  捌: 8,
  玖: 9
};

const kanjiUnits: Record<string, number> = {
  十: 10,
  拾: 10,
  百: 100,
  佰: 100,
  千: 1000,
  仟: 1000
};

const kanjiTenThousand: Record<string, number> = {
  万: 10000,
  萬: 10000
};

const kanjiNumeralChars = new Set([
  ...Object.keys(kanjiDigitsModern),
  ...Object.keys(kanjiDigitsTraditional),
  ...Object.keys(kanjiUnits),
  ...Object.keys(kanjiTenThousand)
]);

const isKanjiNumeralChar = (char: string): boolean => kanjiNumeralChars.has(char);

const detectKanjiStyle = (value: string): KanjiStyle => {
  if (/[壱弐参肆伍陸柒捌玖拾萬佰仟]/.test(value)) {
    return 'traditional';
  }
  return 'modern';
};

const parseKanjiNumber = (value: string): { num: number; style: KanjiStyle } | null => {
  if (!value) {
    return null;
  }
  const style = detectKanjiStyle(value);
  const hasTenThousand = value.includes('万') || value.includes('萬');
  if (hasTenThousand) {
    const match = /^([一二三四五六七八九壱弐参肆伍陸柒捌玖])?(万|萬)$/.exec(value);
    if (!match) {
      return null;
    }
    const digit = match[1];
    if (!digit) {
      return { num: 10000, style };
    }
    const num = kanjiDigitsModern[digit] ?? kanjiDigitsTraditional[digit];
    if (num !== 1) {
      return null;
    }
    return { num: 10000, style };
  }

  let total = 0;
  let current = 0;
  let lastUnit = Number.POSITIVE_INFINITY;
  let lastWasDigit = false;
  for (const char of value) {
    const digit = kanjiDigitsModern[char] ?? kanjiDigitsTraditional[char];
    if (digit) {
      if (lastWasDigit) {
        return null;
      }
      current = digit;
      lastWasDigit = true;
      continue;
    }
    const unit = kanjiUnits[char];
    if (unit) {
      if (unit >= lastUnit) {
        return null;
      }
      if (current === 0) {
        current = 1;
      }
      total += current * unit;
      current = 0;
      lastUnit = unit;
      lastWasDigit = false;
      continue;
    }
    if (kanjiTenThousand[char]) {
      return null;
    }
    return null;
  }
  total += current;
  if (total <= 0 || total > 10000) {
    return null;
  }
  return { num: total, style };
};

const parseEmbeddedKanji = (
  value: string
): { prefix: string; num: number; suffix: string; style: KanjiStyle } | null => {
  const runs: Array<{ start: number; end: number; text: string }> = [];
  let current = '';
  let startIndex = 0;
  let index = 0;
  for (const char of value) {
    if (isKanjiNumeralChar(char)) {
      if (!current) {
        startIndex = index;
      }
      current += char;
    } else {
      if (current) {
        runs.push({ start: startIndex, end: index, text: current });
        current = '';
      }
    }
    index += char.length;
  }
  if (current) {
    runs.push({ start: startIndex, end: index, text: current });
  }
  const matches = runs
    .map((run) => ({ run, parsed: parseKanjiNumber(run.text) }))
    .filter((entry) => entry.parsed !== null);
  if (matches.length !== 1) {
    return null;
  }
  const match = matches[0]!;
  const prefix = value.slice(0, match.run.start);
  const suffix = value.slice(match.run.end);
  return {
    prefix,
    num: match.parsed!.num,
    suffix,
    style: match.parsed!.style
  };
};

const toKanjiNumber = (value: number, style: KanjiStyle): string | null => {
  if (!Number.isFinite(value) || value <= 0 || value > 10000) {
    return null;
  }
  const digits = style === 'traditional'
    ? ['', '壱', '弐', '参', '肆', '伍', '陸', '柒', '捌', '玖']
    : ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const tenUnit = style === 'traditional' ? '拾' : '十';
  const tenThousandUnit = style === 'traditional' ? '萬' : '万';
  if (value === 10000) {
    return `${digits[1]}${tenThousandUnit}`;
  }
  let remaining = value;
  let output = '';
  const thousands = Math.floor(remaining / 1000);
  if (thousands > 0) {
    if (thousands > 1) {
      output += digits[thousands];
    }
    output += '千';
    remaining %= 1000;
  }
  const hundreds = Math.floor(remaining / 100);
  if (hundreds > 0) {
    if (hundreds > 1) {
      output += digits[hundreds];
    }
    output += '百';
    remaining %= 100;
  }
  const tens = Math.floor(remaining / 10);
  if (tens > 0) {
    if (tens > 1) {
      output += digits[tens];
    }
    output += tenUnit;
    remaining %= 10;
  }
  if (remaining > 0) {
    output += digits[remaining];
  }
  return output || null;
};

const createKanjiIterator = (last: number, step: number, style: KanjiStyle): Iterator<string> => {
  let offset = 0;
  return {
    next() {
      offset += 1;
      const nextValue = last + step * offset;
      const value = toKanjiNumber(nextValue, style);
      if (!value) {
        return { value: undefined, done: true } as IteratorResult<string>;
      }
      return { value, done: false };
    }
  };
};

const createEmbeddedKanjiIterator = (
  template: { prefix: string; suffix: string; style: KanjiStyle },
  last: number,
  step: number
): Iterator<string> => {
  let offset = 0;
  return {
    next() {
      offset += 1;
      const nextValue = last + step * offset;
      const value = toKanjiNumber(nextValue, template.style);
      if (!value) {
        return { value: undefined, done: true } as IteratorResult<string>;
      }
      return { value: `${template.prefix}${value}${template.suffix}`, done: false };
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

  const kanjiValues = seed.map((value) => parseKanjiNumber(value));
  if (kanjiValues.every((value) => value !== null)) {
    const parsed = kanjiValues as Array<{ num: number; style: KanjiStyle }>;
    const firstStyle = parsed[0]!.style;
    if (parsed.every((item) => item.style === firstStyle)) {
      const numeric = parsed.map((item) => item.num);
      const step = matchArithmetic(numeric);
      if (step !== null) {
        const last = parsed[parsed.length - 1]!;
        return {
          kind: 'arithmetic',
          iterator: createKanjiIterator(last.num, step, last.style)
        };
      }
    }
  }

  const embeddedRoman = seed.map((value) => parseEmbeddedRoman(value));
  if (embeddedRoman.every((value) => value !== null)) {
    const parsed = embeddedRoman as Array<{ prefix: string; num: number; suffix: string }>;
    const template = parsed[0]!;
    const matchesTemplate = parsed.every(
      (item) => item.prefix === template.prefix && item.suffix === template.suffix
    );
    if (matchesTemplate) {
      const numeric = parsed.map((item) => item.num);
      const step = matchArithmetic(numeric);
      if (step !== null) {
        const last = numeric[numeric.length - 1]!;
        return {
          kind: 'arithmetic',
          iterator: createEmbeddedRomanIterator(
            { prefix: template.prefix, suffix: template.suffix },
            last,
            step
          )
        };
      }
    }
  }

  const embeddedKanji = seed.map((value) => parseEmbeddedKanji(value));
  if (embeddedKanji.every((value) => value !== null)) {
    const parsed = embeddedKanji as Array<{
      prefix: string;
      num: number;
      suffix: string;
      style: KanjiStyle;
    }>;
    const template = parsed[0]!;
    const matchesTemplate = parsed.every(
      (item) =>
        item.prefix === template.prefix &&
        item.suffix === template.suffix &&
        item.style === template.style
    );
    if (matchesTemplate) {
      const numeric = parsed.map((item) => item.num);
      const step = matchArithmetic(numeric);
      if (step !== null) {
        const last = parsed[parsed.length - 1]!;
        return {
          kind: 'arithmetic',
          iterator: createEmbeddedKanjiIterator(
            { prefix: template.prefix, suffix: template.suffix, style: template.style },
            last.num,
            step
          )
        };
      }
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
