import type { SequenceList, SequenceMatch } from './registry';
import { SequenceRegistry } from './registry';

const weekdaysEn: SequenceList = {
  id: 'weekdays-en',
  mode: 'cycle',
  langs: ['en'],
  items: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  aliases: {
    Mon: 'Monday',
    Tue: 'Tuesday',
    Tues: 'Tuesday',
    Wed: 'Wednesday',
    Thu: 'Thursday',
    Thur: 'Thursday',
    Thurs: 'Thursday',
    Fri: 'Friday',
    Sat: 'Saturday',
    Sun: 'Sunday'
  }
};

const weekdaysJa: SequenceList = {
  id: 'weekdays-ja',
  mode: 'cycle',
  langs: ['ja'],
  items: ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'],
  aliases: {
    月曜: '月曜日',
    月: '月曜日',
    火曜: '火曜日',
    火: '火曜日',
    水曜: '水曜日',
    水: '水曜日',
    木曜: '木曜日',
    木: '木曜日',
    金曜: '金曜日',
    金: '金曜日',
    土曜: '土曜日',
    土: '土曜日',
    日曜: '日曜日',
    日: '日曜日'
  }
};

const monthsEn: SequenceList = {
  id: 'months-en',
  mode: 'cycle',
  langs: ['en'],
  items: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ],
  aliases: {
    Jan: 'January',
    Feb: 'February',
    Mar: 'March',
    Apr: 'April',
    Jun: 'June',
    Jul: 'July',
    Aug: 'August',
    Sep: 'September',
    Sept: 'September',
    Oct: 'October',
    Nov: 'November',
    Dec: 'December'
  }
};

const monthsJa: SequenceList = {
  id: 'months-ja',
  mode: 'cycle',
  langs: ['ja'],
  items: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
};

const monthsJaTraditional: SequenceList = {
  id: 'months-ja-traditional',
  mode: 'cycle',
  langs: ['ja'],
  items: ['睦月', '如月', '弥生', '卯月', '皐月', '水無月', '文月', '葉月', '長月', '神無月', '霜月', '師走']
};

const quartersEn: SequenceList = {
  id: 'quarters-en',
  mode: 'cycle',
  langs: ['en'],
  items: ['Q1', 'Q2', 'Q3', 'Q4']
};

const quartersJa: SequenceList = {
  id: 'quarters-ja',
  mode: 'cycle',
  langs: ['ja'],
  items: ['第1四半期', '第2四半期', '第3四半期', '第4四半期']
};

const zodiacAnimals: SequenceList = {
  id: 'zodiac-animals-ja',
  mode: 'cycle',
  langs: ['ja'],
  items: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
};

const zodiacSignsEn: SequenceList = {
  id: 'zodiac-signs-en',
  mode: 'cycle',
  langs: ['en'],
  items: [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces'
  ]
};

const zodiacSignsJa: SequenceList = {
  id: 'zodiac-signs-ja',
  mode: 'cycle',
  langs: ['ja'],
  items: ['牡羊座', '牡牛座', '双子座', '蟹座', '獅子座', '乙女座', '天秤座', '蠍座', '射手座', '山羊座', '水瓶座', '魚座'],
  aliases: {
    さそり座: '蠍座'
  }
};

const directions16En: SequenceList = {
  id: 'directions-16-en',
  mode: 'cycle',
  langs: ['en'],
  items: [
    'North',
    'North-Northeast',
    'Northeast',
    'East-Northeast',
    'East',
    'East-Southeast',
    'Southeast',
    'South-Southeast',
    'South',
    'South-Southwest',
    'Southwest',
    'West-Southwest',
    'West',
    'West-Northwest',
    'Northwest',
    'North-Northwest'
  ]
};

const directions16Ja: SequenceList = {
  id: 'directions-16-ja',
  mode: 'cycle',
  langs: ['ja'],
  items: [
    '北',
    '北北東',
    '北東',
    '東北東',
    '東',
    '東南東',
    '南東',
    '南南東',
    '南',
    '南南西',
    '南西',
    '西南西',
    '西',
    '西北西',
    '北西',
    '北北西'
  ]
};

const ampmEn: SequenceList = {
  id: 'ampm-en',
  mode: 'cycle',
  langs: ['en'],
  items: ['AM', 'PM'],
  aliases: {
    'A.M.': 'AM',
    'P.M.': 'PM'
  }
};

const ampmJa: SequenceList = {
  id: 'ampm-ja',
  mode: 'cycle',
  langs: ['ja'],
  items: ['午前', '午後']
};

const seasonsEn: SequenceList = {
  id: 'seasons-en',
  mode: 'cycle',
  langs: ['en'],
  items: ['Spring', 'Summer', 'Autumn', 'Winter'],
  aliases: {
    Fall: 'Autumn'
  }
};

const seasonsJa: SequenceList = {
  id: 'seasons-ja',
  mode: 'cycle',
  langs: ['ja'],
  items: ['春', '夏', '秋', '冬']
};

const solfegeJa: SequenceList = {
  id: 'solfege-ja',
  mode: 'cycle',
  langs: ['ja'],
  items: ['ド', 'レ', 'ミ', 'ファ', 'ソ', 'ラ', 'シ']
};

const solfegeEn: SequenceList = {
  id: 'solfege-en',
  mode: 'cycle',
  langs: ['en'],
  items: ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti'],
  aliases: {
    So: 'Sol',
    Si: 'Ti'
  }
};

const greekLettersEn: SequenceList = {
  id: 'greek-letters-en',
  mode: 'cycle',
  langs: ['en'],
  items: [
    'Alpha',
    'Beta',
    'Gamma',
    'Delta',
    'Epsilon',
    'Zeta',
    'Eta',
    'Theta',
    'Iota',
    'Kappa',
    'Lambda',
    'Mu',
    'Nu',
    'Xi',
    'Omicron',
    'Pi',
    'Rho',
    'Sigma',
    'Tau',
    'Upsilon',
    'Phi',
    'Chi',
    'Psi',
    'Omega'
  ]
};

const greekLettersJa: SequenceList = {
  id: 'greek-letters-ja',
  mode: 'cycle',
  langs: ['ja'],
  items: [
    'アルファ',
    'ベータ',
    'ガンマ',
    'デルタ',
    'イプシロン',
    'ゼータ',
    'イータ',
    'シータ',
    'イオタ',
    'カッパ',
    'ラムダ',
    'ミュー',
    'ニュー',
    'クサイ',
    'オミクロン',
    'パイ',
    'ロー',
    'シグマ',
    'タウ',
    'ウプシロン',
    'ファイ',
    'カイ',
    'プサイ',
    'オメガ'
  ]
};

const greekLettersSymbols: SequenceList = {
  id: 'greek-letters-symbols',
  mode: 'cycle',
  langs: ['en', 'ja'],
  items: [
    'α',
    'β',
    'γ',
    'δ',
    'ε',
    'ζ',
    'η',
    'θ',
    'ι',
    'κ',
    'λ',
    'μ',
    'ν',
    'ξ',
    'ο',
    'π',
    'ρ',
    'σ',
    'τ',
    'υ',
    'φ',
    'χ',
    'ψ',
    'ω'
  ],
  aliases: {
    'ς': 'σ'
  }
};

const rokuyo: SequenceList = {
  id: 'rokuyo-ja',
  mode: 'cycle',
  langs: ['ja'],
  items: ['先勝', '友引', '先負', '仏滅', '大安', '赤口']
};

const heavenlyStems: SequenceList = {
  id: 'heavenly-stems-ja',
  mode: 'finite',
  langs: ['ja'],
  items: ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
};

const planetsEn: SequenceList = {
  id: 'planets-en',
  mode: 'finite',
  langs: ['en'],
  items: ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune']
};

const planetsJa: SequenceList = {
  id: 'planets-ja',
  mode: 'finite',
  langs: ['ja'],
  items: ['水星', '金星', '地球', '火星', '木星', '土星', '天王星', '海王星']
};

const kujiIn: SequenceList = {
  id: 'kuji-in-ja',
  mode: 'finite',
  langs: ['ja'],
  items: ['臨', '兵', '闘', '者', '皆', '陣', '烈', '在', '前']
};

const eightVirtues: SequenceList = {
  id: 'eight-virtues-ja',
  mode: 'finite',
  langs: ['ja'],
  items: ['仁', '義', '礼', '智', '忠', '信', '孝', '悌']
};

const builtInLists: SequenceList[] = [
  weekdaysEn,
  weekdaysJa,
  monthsEn,
  monthsJa,
  monthsJaTraditional,
  quartersEn,
  quartersJa,
  zodiacAnimals,
  zodiacSignsEn,
  zodiacSignsJa,
  directions16En,
  directions16Ja,
  ampmEn,
  ampmJa,
  seasonsEn,
  seasonsJa,
  solfegeJa,
  solfegeEn,
  greekLettersEn,
  greekLettersJa,
  greekLettersSymbols,
  rokuyo,
  heavenlyStems,
  planetsEn,
  planetsJa,
  kujiIn,
  eightVirtues
];

const ordinalSuffix = (value: number): string => {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'th';
  const mod10 = value % 10;
  if (mod10 === 1) return 'st';
  if (mod10 === 2) return 'nd';
  if (mod10 === 3) return 'rd';
  return 'th';
};

const parseOrdinal = (value: string): number | null => {
  const match = /^(\d+)(st|nd|rd|th)$/.exec(value);
  if (!match) return null;
  const num = Number(match[1]);
  if (!Number.isFinite(num) || num <= 0) return null;
  const suffix = match[2];
  if (ordinalSuffix(num) !== suffix) return null;
  return num;
};

const ordinalMatcher: SequenceMatch = {
  id: 'ordinal-en',
  langs: ['en'],
  match(seed) {
    if (seed.length < 2) return null;
    const values = seed.map((value) => parseOrdinal(value));
    if (values.some((value) => value === null)) return null;
    const nums = values as number[];
    const step = nums[1]! - nums[0]!;
    for (let i = 2; i < nums.length; i += 1) {
      if (nums[i]! - nums[i - 1]! !== step) return null;
    }
    return { score: 80, step };
  },
  createIterator(seed, ctx) {
    const last = parseOrdinal(seed[seed.length - 1] ?? '');
    let current = last ?? 0;
    return {
      next() {
        current += ctx.step;
        if (current <= 0 || !Number.isFinite(current)) {
          return { value: undefined, done: true } as IteratorResult<string>;
        }
        return { value: `${current}${ordinalSuffix(current)}`, done: false };
      }
    };
  }
};

export const registerBuiltInLists = (registry: SequenceRegistry): void => {
  for (const list of builtInLists) {
    registry.register(list);
  }
};

export const registerBuiltInMatchers = (registry: SequenceRegistry): void => {
  registry.registerMatch(ordinalMatcher);
};

export const createBuiltInRegistry = (langs?: readonly string[]): SequenceRegistry => {
  const registry = new SequenceRegistry({ langs });
  registerBuiltInLists(registry);
  registerBuiltInMatchers(registry);
  return registry;
};
