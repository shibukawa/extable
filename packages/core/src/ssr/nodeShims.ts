export const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

function getNodeProcess(): { env?: Record<string, string | undefined>; platform?: string } | undefined {
  if (typeof globalThis === "undefined") return undefined;
  return (globalThis as { process?: { env?: Record<string, string | undefined>; platform?: string } })
    .process;
}

export function getDefaultLocale(): string {
  if (isBrowser && typeof navigator !== "undefined") {
    return navigator.language || "en-US";
  }
  const envLang = getNodeProcess()?.env?.LANG;
  if (!envLang) return "en-US";
  return envLang.split(".")[0].replace("_", "-");
}

export function getNavigator(): Navigator | { language?: string; userAgent?: string; platform?: string } {
  if (typeof navigator !== "undefined") return navigator;
  return {
    language: getDefaultLocale(),
    userAgent: "node",
    platform: getNodeProcess()?.platform ?? "unknown",
  };
}

export const ResizeObserverShim:
  | typeof ResizeObserver
  | (new () => { observe: () => void; unobserve: () => void; disconnect: () => void }) =
  typeof ResizeObserver !== "undefined"
    ? ResizeObserver
    : class {
        // No-op fallback for SSR.
        observe() {}
        unobserve() {}
        disconnect() {}
      };

export function getRequestAnimationFrame(): (cb: FrameRequestCallback) => number {
  if (typeof requestAnimationFrame !== "undefined") return requestAnimationFrame;
  return (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 16) as unknown as number;
}

export function getCancelAnimationFrame(): (id: number | ReturnType<typeof setTimeout>) => void {
  if (typeof cancelAnimationFrame !== "undefined") return cancelAnimationFrame;
  return (id: number | ReturnType<typeof setTimeout>) => {
    clearTimeout(id as ReturnType<typeof setTimeout>);
  };
}
