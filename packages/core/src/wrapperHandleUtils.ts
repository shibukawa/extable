export function callCore<TCore, TResult>(
  core: TCore | null | undefined,
  fn: (core: TCore) => TResult,
): TResult | undefined {
  if (!core) return undefined;
  return fn(core);
}

export function callCoreOr<TCore, TResult>(
  core: TCore | null | undefined,
  fn: (core: TCore) => TResult,
  fallback: TResult,
): TResult {
  if (!core) return fallback;
  return fn(core);
}

export function callCorePromiseOr<TCore, TResult>(
  core: TCore | null | undefined,
  fn: (core: TCore) => Promise<TResult>,
  fallback: Promise<TResult>,
): Promise<TResult> {
  if (!core) return fallback;
  return fn(core);
}
