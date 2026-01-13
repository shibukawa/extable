# SSRとクライアント描画の比較

同じデータセットを、静的HTML・HTMLモード・Canvasモードで比較します。

## インタラクティブデモ

<ClientOnly>
  <SsrCompareDemo />
</ClientOnly>

::: info Note
SSR出力は静的HTMLのスナップショットです。クライアント側はマウント時にDOMを再構築します（DOMハイドレーションではありません）。
:::
