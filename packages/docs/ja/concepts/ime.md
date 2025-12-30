# IME入力の取り扱い

## なぜIME対応が重要か

ブラウザでテキストエディタやスプレッドシートを作ったことがない場合、日本語・中国語・韓国語などで使われる**IME（Input Method Editor）**が、単純な`<input>`では扱いにくい理由が分かりにくいかもしれません。

IME入力は**ASCIIキーボード入力と根本的に異なる**ためです。IMEでは次の流れになります。

1. ユーザーが複数のキーを入力して変換中の文字列を作る
2. IMEが候補リストを表示し選択を促す
3. ユーザーが候補を確定（多くの場合EnterやSpace）
4. その後、確定文字列が入力に反映される

`keydown`だけを見てEnterを「セル確定」と扱うと、**予期しない挙動**になります。

- 最初の文字が入力に表示されない
- 変換確定のEnterでセルが確定され、次の行に移動してしまう
- 複数文字の変換が壊れる

**ExtableはCanvas描画と隠し`<input>`を連携し、適切なイベントを監視することで解決します。**

## アーキテクチャ: Canvas + 隠し入力

ExtableはパフォーマンスのためCanvas描画を主としますが、Canvasはキーボード入力やIMEイベントを受け取れません。そこで次を行います。

1. **透明な`<input>`を作成しアクティブセル上に配置**
2. **セルが選択状態になったら`input`にフォーカス**
3. **`compositionstart`と`compositionend`を監視してIME状態を把握**
4. **IME確定とナビゲーションを状態で区別**

## ExtableがIMEを扱う流れ

### 1. 初期化: 隠し入力の作成

ユーザーがセルをクリックしたとき（readonlyでもbooleanでもない場合）:

```typescript
// 透明なinputを作成
const hiddenInput = document.createElement('input');
hiddenInput.type = 'text';
hiddenInput.style.position = 'absolute';
hiddenInput.style.opacity = '0';  // 非表示だがフォーカス可能
hiddenInput.style.pointerEvents = 'none';

// HTMLならセル内、Canvasなら隠しレイヤーに配置
container.appendChild(hiddenInput);

// IME開始のため即フォーカス
hiddenInput.focus();
hiddenInput.select();  // すべて選択して入力開始
```

### 2. Compositionイベントの監視

IME対応の鍵は`keydown`ではなく`compositionstart`/`compositionend`です。

```typescript
let isComposing = false;

hiddenInput.addEventListener('compositionstart', () => {
  // IME入力開始（例: 日本語入力）
  isComposing = true;
});

hiddenInput.addEventListener('compositionend', () => {
  // IME候補の確定完了
  // 確定文字列がinput.valueに反映
  isComposing = false;
});

hiddenInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    // composing中でなければEnterを確定/移動として扱う
    if (!isComposing) {
      commitCellEdit(hiddenInput.value);
      moveToCellBelow();
    }
    // composing中はIMEのEnter処理に任せる
    // （候補の確定）
  }
});
```

### 3. `compositionstart`が`keydown`より先に来る理由

重要なタイムラインは次の通りです。

```
User types "a" (first keystroke in IME)
→ compositionstart event fires
→ keydown event fires (but isComposing=true, so we ignore it)
→ text "a" appears in input
→ User types "i" (still composing)
→ keydown event fires (but isComposing=true)
→ text "ai" appears in input
→ User presses Enter to select candidate "あ"
→ compositionend event fires (isComposing=false, input.value="あ")
→ keydown event fires (now isComposing=false, so we treat Enter as commit)
```

`keydown`だけを見ると、最初の`a`が落ち、Enterが変換確定前のナビゲーションとして処理されてしまいます。

### 4. 選択モード中のTab/矢印キー

セル選択中は隠し入力にフォーカスが残ったままですが、**選択モード**ではナビゲーションが優先されます。

```typescript
hiddenInput.addEventListener('keydown', (event) => {
  if (isInSelectionMode) {
    // 選択モードではナビゲーションキーで選択を移動し、
    // inputに文字を入力しない
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectCellBelow();
      updateHiddenInputToNewCell();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectCellAbove();
      updateHiddenInputToNewCell();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      selectCellToRight();
      updateHiddenInputToNewCell();
    } else if (event.key === 'Shift' && event.shiftKey && event.key === 'Tab') {
      event.preventDefault();
      selectCellToLeft();
      updateHiddenInputToNewCell();
    }
  }
});
```

### 5. 編集モードへの遷移

**ナビゲーションやクリップボード以外のキー**を押すと、セルが**編集モード**になり入力が可視化されます。

```typescript
hiddenInput.addEventListener('keydown', (event) => {
  if (isInSelectionMode && !isNavigationKey(event) && !isClipboardShortcut(event)) {
    // 編集モードへ移行
    isInEditMode = true;
    hiddenInput.style.opacity = '1';  // inputを表示
    hiddenInput.style.pointerEvents = 'auto';
    
    // そのまま入力文字として処理
    // （preventDefaultせず文字を表示）
  }
});
```

### 6. 確定して次のセルへ

編集モード中にEnterを押した場合（IME確定中でないとき）:

```typescript
hiddenInput.addEventListener('keydown', (event) => {
  if (isInEditMode) {
    if (event.key === 'Enter' && !isComposing) {
      event.preventDefault();
      
      // 編集値を確定
      const finalValue = hiddenInput.value;
      applyEdit(finalValue);
      
      // 次のセルへ移動（デフォルトは下、Shift+Enterで上）
      const nextCell = event.shiftKey ? selectCellAbove() : selectCellBelow();
      
      // 新しいセルで選択モードに戻る
      isInEditMode = false;
      updateHiddenInputToNewCell();
    }
  }
});
```

## 完全な例: Vanilla JavaScript

全体の流れを簡略化した実装例です。

```typescript
class ExtableEditor {
  private hiddenInput: HTMLInputElement;
  private isComposing = false;
  private isInEditMode = false;
  
  constructor(private container: HTMLElement) {
    this.createHiddenInput();
  }
  
  private createHiddenInput() {
    this.hiddenInput = document.createElement('input');
    this.hiddenInput.type = 'text';
    this.hiddenInput.style.position = 'absolute';
    this.hiddenInput.style.opacity = '0';
    this.hiddenInput.style.pointerEvents = 'none';
    this.hiddenInput.style.width = '100px';
    this.hiddenInput.style.height = '24px';
    
    this.hiddenInput.addEventListener('compositionstart', () => {
      this.isComposing = true;
    });
    
    this.hiddenInput.addEventListener('compositionend', () => {
      this.isComposing = false;
    });
    
    this.hiddenInput.addEventListener('keydown', (e) => this.handleKeyDown(e));
    
    this.container.appendChild(this.hiddenInput);
  }
  
  selectCell(row: number, col: number) {
    // セル位置に隠しinputを配置
    const cell = this.getCellElement(row, col);
    const rect = cell.getBoundingClientRect();
    this.hiddenInput.style.left = rect.left + 'px';
    this.hiddenInput.style.top = rect.top + 'px';
    
    // クリアしてフォーカス
    this.hiddenInput.value = '';
    this.hiddenInput.style.opacity = '0';
    this.isInEditMode = false;
    this.hiddenInput.focus();
    this.hiddenInput.select();
  }
  
  private handleKeyDown(event: KeyboardEvent) {
    // 選択モードでのナビゲーションキー
    if (!this.isInEditMode) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        this.navigateDown();
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        this.navigateUp();
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        event.shiftKey ? this.navigateLeft() : this.navigateRight();
        return;
      }
    }
    
    // Enter: 確定（composing中は除く）
    if (event.key === 'Enter' && !this.isComposing) {
      event.preventDefault();
      if (this.isInEditMode) {
        this.commitEdit();
        this.isInEditMode = false;
      }
      return;
    }
    
    // その他のキーで編集モードへ
    if (!this.isInEditMode && !this.isComposing) {
      this.isInEditMode = true;
      this.hiddenInput.style.opacity = '1';
      this.hiddenInput.style.pointerEvents = 'auto';
    }
  }
  
  private commitEdit() {
    const value = this.hiddenInput.value;
    console.log('Committing:', value);
    // 値をデータモデルへ反映
  }
  
  private navigateDown() {
    console.log('Move down');
    // 選択を更新してselectCell(...)を呼ぶ
  }
  
  private navigateUp() {
    console.log('Move up');
  }
  
  private navigateRight() {
    console.log('Move right');
  }
  
  private navigateLeft() {
    console.log('Move left');
  }
  
  private getCellElement(row: number, col: number): HTMLElement {
    // 実装は任意
    return document.querySelector(`[data-row="${row}"][data-col="${col}"]`)!;
  }
}
```

## 重要ポイント

1. **`compositionstart`と`compositionend`を必ず使う**（`keydown`だけに頼らない）
2. **composition中にpreventDefaultしない**（IMEの挙動を尊重）
3. **ナビゲーション/確定キーは`!isComposing`のときだけ処理**
4. **Canvas描画でも隠しinputをフォーカス**してIMEイベントを受け取る
5. **編集モード中はinputを見える位置に置く**（入力内容を確認できる）
6. **選択モードと編集モードは別状態**（選択は移動、編集は入力）

## 参考リンク

- [MDN: compositionstart event](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionstart_event)
- [MDN: compositionend event](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event)
- [W3C: UI Events](https://www.w3.org/TR/uievents/#events-compositionevents)
- [Extable Advanced Edit Spec](https://github.com/shibukawa/extable/blob/main/.specs/20251210_advanced-edit/design.md) – full implementation details

## 次のステップ

- [readonlyとloading状態](/ja/guides/editmode)でIME入力時の挙動を確認
- [HTMLモードとCanvasモード](/ja/concepts/rendering-modes)の違いを理解
- [アンコントロールド専用の思想](/ja/concepts/uncontrolled)で統合方針を確認
