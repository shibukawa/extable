# 条件付きReadonly/Disabled

`conditionalStyle`で行データに応じてreadonly/disabledを制御します。

## インタラクティブデモ

<ClientOnly>
  <ButtonLinkConditionalDemo />
</ClientOnly>

## ここで確認できること

- **Readonly制御** - `Edit`がoffのとき文字列/数値列をロック  
- **アクション無効化** - `Edit`がoffのときボタン/リンクを無効化  
- **共通トグル** - 単一の`Edit`フラグで挙動を統一  
- **一貫した見た目** - disabledはreadonlyのグレー表現  
