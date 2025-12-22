import type { SequenceList, SequenceMatch } from './registry';
import { SequenceRegistry } from './registry';

const weekdaysEnLong: SequenceList = {
  id: 'weekdays-en-long',
  mode: 'cycle',
  langs: ['en'],
  items: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
};

const weekdaysEnShort: SequenceList = {
  id: 'weekdays-en-short',
  mode: 'cycle',
  langs: ['en'],
  items: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  aliases: {
    Tues: 'Tue',
    Thur: 'Thu',
    Thurs: 'Thu'
  }
};

const weekdaysJaLong: SequenceList = {
  id: 'weekdays-ja-long',
  mode: 'cycle',
  langs: ['ja'],
  items: ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日']
};

const weekdaysJaShort: SequenceList = {
  id: 'weekdays-ja-short',
  mode: 'cycle',
  langs: ['ja'],
  items: ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜']
};

const weekdaysJaSingle: SequenceList = {
  id: 'weekdays-ja-single',
  mode: 'cycle',
  langs: ['ja'],
  items: ['月', '火', '水', '木', '金', '土', '日']
};

const monthsEnLong: SequenceList = {
  id: 'months-en-long',
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
  ]
};

const monthsEnShort: SequenceList = {
  id: 'months-en-short',
  mode: 'cycle',
  langs: ['en'],
  items: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  aliases: {
    Sept: 'Sep'
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

const elementSymbols: SequenceList = {
  id: 'element-symbols',
  mode: 'finite',
  langs: ['ja', 'en'],
  items: [
    'H',
    'He',
    'Li',
    'Be',
    'B',
    'C',
    'N',
    'O',
    'F',
    'Ne',
    'Na',
    'Mg',
    'Al',
    'Si',
    'P',
    'S',
    'Cl',
    'Ar',
    'K',
    'Ca',
    'Sc',
    'Ti',
    'V',
    'Cr',
    'Mn',
    'Fe',
    'Co',
    'Ni',
    'Cu',
    'Zn',
    'Ga',
    'Ge',
    'As',
    'Se',
    'Br',
    'Kr',
    'Rb',
    'Sr',
    'Y',
    'Zr',
    'Nb',
    'Mo',
    'Tc',
    'Ru',
    'Rh',
    'Pd',
    'Ag',
    'Cd',
    'In',
    'Sn',
    'Sb',
    'Te',
    'I',
    'Xe',
    'Cs',
    'Ba',
    'La',
    'Ce',
    'Pr',
    'Nd',
    'Pm',
    'Sm',
    'Eu',
    'Gd',
    'Tb',
    'Dy',
    'Ho',
    'Er',
    'Tm',
    'Yb',
    'Lu',
    'Hf',
    'Ta',
    'W',
    'Re',
    'Os',
    'Ir',
    'Pt',
    'Au',
    'Hg',
    'Tl',
    'Pb',
    'Bi',
    'Po',
    'At',
    'Rn',
    'Fr',
    'Ra',
    'Ac',
    'Th',
    'Pa',
    'U',
    'Np',
    'Pu',
    'Am',
    'Cm',
    'Bk',
    'Cf',
    'Es',
    'Fm',
    'Md',
    'No',
    'Lr',
    'Rf',
    'Db',
    'Sg',
    'Bh',
    'Hs',
    'Mt',
    'Ds',
    'Rg',
    'Cn',
    'Nh',
    'Fl',
    'Mc',
    'Lv',
    'Ts',
    'Og'
  ]
};

const elementNamesJa: SequenceList = {
  id: 'element-names-ja',
  mode: 'finite',
  langs: ['ja'],
  items: [
    '水素',
    'ヘリウム',
    'リチウム',
    'ベリリウム',
    'ホウ素',
    '炭素',
    '窒素',
    '酸素',
    'フッ素',
    'ネオン',
    'ナトリウム',
    'マグネシウム',
    'アルミニウム',
    'ケイ素',
    'リン',
    '硫黄',
    '塩素',
    'アルゴン',
    'カリウム',
    'カルシウム',
    'スカンジウム',
    'チタン',
    'バナジウム',
    'クロム',
    'マンガン',
    '鉄',
    'コバルト',
    'ニッケル',
    '銅',
    '亜鉛',
    'ガリウム',
    'ゲルマニウム',
    'ヒ素',
    'セレン',
    '臭素',
    'クリプトン',
    'ルビジウム',
    'ストロンチウム',
    'イットリウム',
    'ジルコニウム',
    'ニオブ',
    'モリブデン',
    'テクネチウム',
    'ルテニウム',
    'ロジウム',
    'パラジウム',
    '銀',
    'カドミウム',
    'インジウム',
    'スズ',
    'アンチモン',
    'テルル',
    'ヨウ素',
    'キセノン',
    'セシウム',
    'バリウム',
    'ランタン',
    'セリウム',
    'プラセオジム',
    'ネオジム',
    'プロメチウム',
    'サマリウム',
    'ユウロピウム',
    'ガドリニウム',
    'テルビウム',
    'ジスプロシウム',
    'ホルミウム',
    'エルビウム',
    'ツリウム',
    'イッテルビウム',
    'ルテチウム',
    'ハフニウム',
    'タンタル',
    'タングステン',
    'レニウム',
    'オスミウム',
    'イリジウム',
    '白金',
    '金',
    '水銀',
    'タリウム',
    '鉛',
    'ビスマス',
    'ポロニウム',
    'アスタチン',
    'ラドン',
    'フランシウム',
    'ラジウム',
    'アクチニウム',
    'トリウム',
    'プロトアクチニウム',
    'ウラン',
    'ネプツニウム',
    'プルトニウム',
    'アメリシウム',
    'キュリウム',
    'バークリウム',
    'カリホルニウム',
    'アインスタイニウム',
    'フェルミウム',
    'メンデレビウム',
    'ノーベリウム',
    'ローレンシウム',
    'ラザホージウム',
    'ドブニウム',
    'シーボーギウム',
    'ボーリウム',
    'ハッシウム',
    'マイトネリウム',
    'ダームスタチウム',
    'レントゲニウム',
    'コペルニシウム',
    'ニホニウム',
    'フレロビウム',
    'モスコビウム',
    'リバモリウム',
    'テネシン',
    'オガネソン'
  ]
};

const shogunsKamakura: SequenceList = {
  id: 'shoguns-kamakura-ja',
  mode: 'finite',
  langs: ['ja'],
  items: [
    '源頼朝',
    '源頼家',
    '源実朝',
    '藤原頼経',
    '藤原頼嗣',
    '宗尊親王',
    '惟康親王',
    '久明親王',
    '守邦親王'
  ]
};

const shogunsAshikaga: SequenceList = {
  id: 'shoguns-ashikaga-ja',
  mode: 'finite',
  langs: ['ja'],
  items: [
    '足利尊氏',
    '足利義詮',
    '足利義満',
    '足利義持',
    '足利義量',
    '足利義教',
    '足利義勝',
    '足利義政',
    '足利義尚',
    '足利義稙',
    '足利義澄',
    '足利義晴',
    '足利義輝',
    '足利義栄',
    '足利義昭'
  ]
};

const shogunsAshikagaGiven: SequenceList = {
  id: 'shoguns-ashikaga-given-ja',
  mode: 'finite',
  langs: ['ja'],
  items: [
    '尊氏',
    '義詮',
    '義満',
    '義持',
    '義量',
    '義教',
    '義勝',
    '義政',
    '義尚',
    '義稙',
    '義澄',
    '義晴',
    '義輝',
    '義栄',
    '義昭'
  ]
};

const shogunsTokugawa: SequenceList = {
  id: 'shoguns-tokugawa-ja',
  mode: 'finite',
  langs: ['ja'],
  items: [
    '徳川家康',
    '徳川秀忠',
    '徳川家光',
    '徳川家綱',
    '徳川綱吉',
    '徳川家宣',
    '徳川家継',
    '徳川吉宗',
    '徳川家重',
    '徳川家治',
    '徳川家斉',
    '徳川家慶',
    '徳川家定',
    '徳川家茂',
    '徳川慶喜'
  ]
};

const shogunsTokugawaGiven: SequenceList = {
  id: 'shoguns-tokugawa-given-ja',
  mode: 'finite',
  langs: ['ja'],
  items: [
    '家康',
    '秀忠',
    '家光',
    '家綱',
    '綱吉',
    '家宣',
    '家継',
    '吉宗',
    '家重',
    '家治',
    '家斉',
    '家慶',
    '家定',
    '家茂',
    '慶喜'
  ]
};

const prefectureItems: string[] = [
  '北海道',
  '青森県',
  '岩手県',
  '宮城県',
  '秋田県',
  '山形県',
  '福島県',
  '茨城県',
  '栃木県',
  '群馬県',
  '埼玉県',
  '千葉県',
  '東京都',
  '神奈川県',
  '新潟県',
  '富山県',
  '石川県',
  '福井県',
  '山梨県',
  '長野県',
  '岐阜県',
  '静岡県',
  '愛知県',
  '三重県',
  '滋賀県',
  '京都府',
  '大阪府',
  '兵庫県',
  '奈良県',
  '和歌山県',
  '鳥取県',
  '島根県',
  '岡山県',
  '広島県',
  '山口県',
  '徳島県',
  '香川県',
  '愛媛県',
  '高知県',
  '福岡県',
  '佐賀県',
  '長崎県',
  '熊本県',
  '大分県',
  '宮崎県',
  '鹿児島県',
  '沖縄県'
];

const prefectureAliases: Record<string, string> = prefectureItems.reduce(
  (aliases, item) => {
    if (item === '北海道') {
      return aliases;
    }
    if (/[都府県]$/.test(item)) {
      const alias = item.slice(0, -1);
      aliases[alias] = item;
    }
    return aliases;
  },
  {} as Record<string, string>
);

const prefecturesJa: SequenceList = {
  id: 'prefectures-ja',
  mode: 'finite',
  langs: ['ja'],
  items: prefectureItems,
  aliases: prefectureAliases
};

const usStates: SequenceList = {
  id: 'us-states-en',
  mode: 'finite',
  langs: ['en'],
  items: [
    'Alabama',
    'Alaska',
    'Arizona',
    'Arkansas',
    'California',
    'Colorado',
    'Connecticut',
    'Delaware',
    'Florida',
    'Georgia',
    'Hawaii',
    'Idaho',
    'Illinois',
    'Indiana',
    'Iowa',
    'Kansas',
    'Kentucky',
    'Louisiana',
    'Maine',
    'Maryland',
    'Massachusetts',
    'Michigan',
    'Minnesota',
    'Mississippi',
    'Missouri',
    'Montana',
    'Nebraska',
    'Nevada',
    'New Hampshire',
    'New Jersey',
    'New Mexico',
    'New York',
    'North Carolina',
    'North Dakota',
    'Ohio',
    'Oklahoma',
    'Oregon',
    'Pennsylvania',
    'Rhode Island',
    'South Carolina',
    'South Dakota',
    'Tennessee',
    'Texas',
    'Utah',
    'Vermont',
    'Virginia',
    'Washington',
    'West Virginia',
    'Wisconsin',
    'Wyoming'
  ]
};

const usStateAbbreviations: SequenceList = {
  id: 'us-states-abbrev-en',
  mode: 'finite',
  langs: ['en'],
  items: [
    'AL',
    'AK',
    'AZ',
    'AR',
    'CA',
    'CO',
    'CT',
    'DE',
    'FL',
    'GA',
    'HI',
    'ID',
    'IL',
    'IN',
    'IA',
    'KS',
    'KY',
    'LA',
    'ME',
    'MD',
    'MA',
    'MI',
    'MN',
    'MS',
    'MO',
    'MT',
    'NE',
    'NV',
    'NH',
    'NJ',
    'NM',
    'NY',
    'NC',
    'ND',
    'OH',
    'OK',
    'OR',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VT',
    'VA',
    'WA',
    'WV',
    'WI',
    'WY'
  ]
};

const windowsVersions: SequenceList = {
  id: 'windows-versions',
  mode: 'finite',
  langs: ['ja', 'en'],
  items: [
    'Windows 1.0',
    'Windows 2.0',
    'Windows 2.1',
    'Windows 3.0',
    'Windows 3.1',
    'Windows 3.11',
    'Windows 95',
    'Windows 98',
    'Windows 98 SE',
    'Windows Me',
    'Windows XP',
    'Windows Vista',
    'Windows 7',
    'Windows 8',
    'Windows 8.1',
    'Windows 10',
    'Windows 11'
  ]
};

const macosVersions: SequenceList = {
  id: 'macos-versions',
  mode: 'finite',
  langs: ['ja', 'en'],
  items: [
    'Cheetah',
    'Puma',
    'Jaguar',
    'Panther',
    'Tiger',
    'Leopard',
    'Snow Leopard',
    'Lion',
    'Mountain Lion',
    'Mavericks',
    'Yosemite',
    'El Capitan',
    'Sierra',
    'High Sierra',
    'Mojave',
    'Catalina',
    'Big Sur',
    'Monterey',
    'Ventura',
    'Sonoma',
    'Sequoia',
    'Tahoe'
  ]
};

const debianVersions: SequenceList = {
  id: 'debian-codenames',
  mode: 'finite',
  langs: ['ja', 'en'],
  items: [
    'buzz',
    'rex',
    'bo',
    'hamm',
    'slink',
    'potato',
    'woody',
    'sarge',
    'etch',
    'lenny',
    'squeeze',
    'wheezy',
    'jessie',
    'stretch',
    'buster',
    'bullseye',
    'bookworm',
    'trixie'
  ]
};

const builtInLists: SequenceList[] = [
  weekdaysEnLong,
  weekdaysEnShort,
  weekdaysJaLong,
  weekdaysJaShort,
  weekdaysJaSingle,
  monthsEnLong,
  monthsEnShort,
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
  eightVirtues,
  elementSymbols,
  elementNamesJa,
  shogunsKamakura,
  shogunsAshikaga,
  shogunsAshikagaGiven,
  shogunsTokugawa,
  shogunsTokugawaGiven,
  prefecturesJa,
  usStates,
  usStateAbbreviations,
  windowsVersions,
  macosVersions,
  debianVersions
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
