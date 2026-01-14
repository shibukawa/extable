# SSR vs Client Rendering

Compare the same dataset rendered as static HTML, HTML mode client render, and Canvas mode client render.

## Interactive Demo

<ClientOnly>
  <SsrCompareDemo />
</ClientOnly>

::: info Note
The SSR output is a static HTML snapshot. Client rendering rebuilds the DOM on mount; it is not DOM hydration.
:::
