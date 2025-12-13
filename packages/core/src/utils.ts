export function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `row_${Math.random().toString(16).slice(2)}`;
}

export function toArray<T>(value: T | T[] | undefined): T[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

export function removeFromParent(el: Element | null | undefined) {
  if (!el) return;
  try {
    el.remove();
  } catch {
    // Ignore NotFoundError from re-entrant blur/remove edge cases.
  }
}
