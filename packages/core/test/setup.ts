import { beforeAll, beforeEach } from "vitest";

// Test-only polyfills for APIs assumed to exist in supported browsers.

// ResizeObserver
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error test polyfill
  globalThis.ResizeObserver = ResizeObserver;
}

// requestAnimationFrame / cancelAnimationFrame
if (typeof globalThis.requestAnimationFrame === "undefined") {
  // @ts-expect-error test polyfill
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    return setTimeout(() => cb(Date.now()), 0) as unknown as number;
  };
}
if (typeof globalThis.cancelAnimationFrame === "undefined") {
  // @ts-expect-error test polyfill
  globalThis.cancelAnimationFrame = (id: number) => {
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
  };
}

// document.elementFromPoint
const applyDomPolyfills = () => {
  const win = typeof window !== "undefined" ? window : undefined;
  if (win?.document) {
    try {
      // @ts-expect-error test polyfill
      if (globalThis.document !== win.document) globalThis.document = win.document;
    } catch {
      // ignore read-only globals
    }
  }
  const DocCtor = (globalThis.Document ?? win?.Document) as
    | (typeof Document | undefined)
    | undefined;
  if (DocCtor) {
    const docProto = DocCtor.prototype;
    try {
      Object.defineProperty(docProto, "elementFromPoint", {
        configurable: true,
        writable: true,
        value: () => null,
      });
    } catch {
      try {
        // @ts-expect-error test polyfill fallback
        docProto.elementFromPoint = () => null;
      } catch {
        // ignore non-writable prototypes
      }
    }
  }
  const doc = (globalThis.document ?? win?.document) as Document | undefined;
  if (doc) {
    const docProto = Object.getPrototypeOf(doc) as Document | null;
    if (docProto) {
      try {
        Object.defineProperty(docProto, "elementFromPoint", {
          configurable: true,
          writable: true,
          value: () => null,
        });
      } catch {
        try {
          // @ts-expect-error test polyfill fallback
          docProto.elementFromPoint = () => null;
        } catch {
          // ignore non-writable prototypes
        }
      }
    }
    try {
      Object.defineProperty(doc, "elementFromPoint", {
        configurable: true,
        writable: true,
        value: () => null,
      });
    } catch {
      try {
        // @ts-expect-error test polyfill fallback
        doc.elementFromPoint = () => null;
      } catch {
        // ignore non-writable documents
      }
    }
  }
  if (win?.document && typeof win.document.elementFromPoint !== "function") {
    try {
      Object.defineProperty(win.document, "elementFromPoint", {
        configurable: true,
        writable: true,
        value: () => null,
      });
    } catch {
      // @ts-expect-error test polyfill fallback
      win.document.elementFromPoint = () => null;
    }
  }
};

applyDomPolyfills();
beforeAll(() => {
  applyDomPolyfills();
});
beforeEach(() => {
  applyDomPolyfills();
});

// CSS.escape
if (typeof (globalThis as any).CSS === "undefined") {
  (globalThis as any).CSS = {};
}
if (typeof (globalThis as any).CSS.escape !== "function") {
  (globalThis as any).CSS.escape = (value: string) => {
    // Minimal escaping for attribute selector values.
    return String(value).replace(/["\\]/g, "\\$&");
  };
}
