export type SequenceListMode = 'cycle' | 'finite';

export type SequenceList = {
  id: string;
  mode: SequenceListMode;
  langs: readonly string[];
  items: readonly string[];
  aliases?: Record<string, string>;
};

export type SequenceMatch = {
  id: string;
  langs?: readonly string[];
  match(seed: readonly string[]):
    | { score: number; startIndex?: number; step?: number; state?: unknown }
    | null;
  createIterator(
    seed: readonly string[],
    ctx: { step: number; state?: unknown }
  ): Iterator<string>;
};

export type RegistryQuery = {
  enabledIds?: readonly string[];
  queryText?: string;
};

export type SequenceMatchResult =
  | {
      kind: 'list';
      list: SequenceList;
      startIndex: number;
      step: number;
    }
  | {
      kind: 'matcher';
      matcher: SequenceMatch;
      step: number;
      state?: unknown;
    };

const fallbackLang = 'en';

const normalizeQueryToken = (value: string): string => {
  return value.trim().normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
};

const normalizeLangs = (langs?: readonly string[]): readonly string[] => {
  const result: string[] = [];
  if (langs) {
    for (const lang of langs) {
      const normalized = lang.trim();
      if (!normalized || result.includes(normalized)) {
        continue;
      }
      result.push(normalized);
    }
  }
  if (result.length === 0) {
    result.push(fallbackLang);
  } else if (!result.includes(fallbackLang)) {
    result.push(fallbackLang);
  }
  return result;
};

const resolveIndex = (list: SequenceList, token: string): number | null => {
  const directIndex = list.items.indexOf(token);
  if (directIndex !== -1) {
    return directIndex;
  }
  if (!list.aliases) {
    return null;
  }
  const canonical = list.aliases[token];
  if (!canonical) {
    return null;
  }
  const canonicalIndex = list.items.indexOf(canonical);
  return canonicalIndex === -1 ? null : canonicalIndex;
};

const hasQueryHit = (list: SequenceList, queryText: string): boolean => {
  const normalizedQuery = normalizeQueryToken(queryText);
  if (normalizeQueryToken(list.id).includes(normalizedQuery)) {
    return true;
  }
  for (const item of list.items) {
    if (normalizeQueryToken(item).includes(normalizedQuery)) {
      return true;
    }
  }
  if (!list.aliases) {
    return false;
  }
  return Object.keys(list.aliases).some((alias) =>
    normalizeQueryToken(alias).includes(normalizedQuery)
  );
};

const langsRank = (list: SequenceList, langs: readonly string[]): number => {
  if (list.langs.length === 0) {
    return 0;
  }
  let best = Number.POSITIVE_INFINITY;
  for (const lang of list.langs) {
    const index = langs.indexOf(lang);
    if (index !== -1 && index < best) {
      best = index;
    }
  }
  return best;
};

const matcherLangsAllowed = (matcher: SequenceMatch, langs: readonly string[]): boolean => {
  if (!matcher.langs || matcher.langs.length === 0) {
    return true;
  }
  return matcher.langs.some((lang) => langs.includes(lang));
};

export class SequenceRegistry {
  readonly langs: readonly string[];

  private lists: SequenceList[] = [];
  private matchers: SequenceMatch[] = [];

  constructor(opts?: { langs?: readonly string[] }) {
    this.langs = normalizeLangs(opts?.langs);
  }

  register(list: SequenceList): void {
    const index = this.lists.findIndex((item) => item.id === list.id);
    if (index === -1) {
      this.lists.push(list);
    } else {
      this.lists[index] = list;
    }
  }

  registerMatch(matcher: SequenceMatch): void {
    const index = this.matchers.findIndex((item) => item.id === matcher.id);
    if (index === -1) {
      this.matchers.push(matcher);
    } else {
      this.matchers[index] = matcher;
    }
  }

  unregister(id: string): void {
    this.lists = this.lists.filter((item) => item.id !== id);
    this.matchers = this.matchers.filter((item) => item.id !== id);
  }

  list(query?: RegistryQuery): SequenceList[] {
    let lists = [...this.lists];
    if (query?.enabledIds && query.enabledIds.length > 0) {
      const enabled = new Set(query.enabledIds);
      lists = lists.filter((list) => enabled.has(list.id));
    }
    const queryText = query?.queryText;
    if (queryText) {
      lists = lists.filter((list) => hasQueryHit(list, queryText));
    }
    return lists;
  }

  match(seed: readonly string[], query?: RegistryQuery): SequenceMatchResult | null {
    if (seed.length === 0) {
      return null;
    }
    let bestMatch: SequenceMatchResult | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;

    const enabledIds = query?.enabledIds ? new Set(query.enabledIds) : null;
    for (const matcher of this.matchers) {
      if (enabledIds && !enabledIds.has(matcher.id)) {
        continue;
      }
      if (!matcherLangsAllowed(matcher, this.langs)) {
        continue;
      }
      const matched = matcher.match(seed);
      if (!matched) {
        continue;
      }
      const score = matched.score;
      if (!Number.isFinite(score)) {
        continue;
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          kind: 'matcher',
          matcher,
          step: matched.step ?? 1,
          state: matched.state
        };
      }
    }

    const candidates = this.list(query)
      .map((list) => ({ list, rank: langsRank(list, this.langs) }))
      .filter((candidate) => Number.isFinite(candidate.rank))
      .sort((a, b) => a.rank - b.rank);

    for (const { list, rank } of candidates) {
      const indices: number[] = [];
      let matchFailed = false;
      for (const token of seed) {
        const index = resolveIndex(list, token);
        if (index === null) {
          matchFailed = true;
          break;
        }
        indices.push(index);
      }
      if (matchFailed) {
        continue;
      }
      const step = this.inferStep(list, indices);
      if (step === null) {
        continue;
      }
      const listScore = 10 - rank;
      if (listScore > bestScore) {
        bestScore = listScore;
        bestMatch = {
          kind: 'list',
          list,
          startIndex: indices[indices.length - 1] ?? 0,
          step
        };
      }
    }

    return bestMatch;
  }

  private inferStep(list: SequenceList, indices: number[]): number | null {
    if (indices.length < 2) {
      return 1;
    }
    const length = list.items.length;
    const baseStep = this.stepBetween(list.mode, length, indices[0]!, indices[1]!);
    if (baseStep === null) {
      return null;
    }
    for (let i = 2; i < indices.length; i += 1) {
      const expected = this.nextIndex(list.mode, length, indices[i - 1]!, baseStep);
      if (expected === null || expected !== indices[i]) {
        return null;
      }
    }
    return baseStep;
  }

  private stepBetween(
    mode: SequenceListMode,
    length: number,
    from: number,
    to: number
  ): number | null {
    if (mode === 'cycle') {
      const step = (to - from + length) % length;
      return step;
    }
    const step = to - from;
    if (step < 0) {
      return null;
    }
    return step;
  }

  private nextIndex(
    mode: SequenceListMode,
    length: number,
    from: number,
    step: number
  ): number | null {
    if (mode === 'cycle') {
      return (from + step) % length;
    }
    const next = from + step;
    if (next >= length) {
      return null;
    }
    return next;
  }
}
