// Test-only polyfills for APIs assumed to exist in supported browsers.

if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error test polyfill
  globalThis.ResizeObserver = ResizeObserver;
}
