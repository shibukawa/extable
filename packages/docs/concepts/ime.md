# IME Input Handling

## Why IME Support Matters

If you've never built a text editor or spreadsheet in the browser and you're not familiar with **IME (Input Method Editor)** used in Japanese, Chinese, Korean, and other languages, you might have wondered why a simple `<input>` element can't just work.

The issue is that **IME input is fundamentally different from ASCII keyboard input**. With IME:

1. User types several keystrokes, each composing partial text
2. IME displays a candidate list for the user to select from
3. User confirms the selection (usually with Enter or Space)
4. Only then is the final text committed to the input

If your code naively listens to `keydown` events and treats Enter as "confirm this cell edit and move to the next cell," you'll get **unexpected behavior**:

- The first character typed might not appear in the input
- Pressing Enter to select an IME candidate will accidentally confirm the cell and move the cursor to the next row
- Multi-character composition will be corrupted

**Extable solves this by carefully coordinating Canvas rendering with a hidden `<input>` element and listening to the correct events.**

## The Architecture: Canvas + Hidden Input

Extable primarily renders using Canvas for performance, but Canvas cannot receive keyboard input or IME events. The solution is:

1. **Create a transparent `<input>` element** placed absolutely over the active cell
2. **Focus that input when a cell enters selection mode**
3. **Listen to `compositionstart` and `compositionend` events** to know when IME is active
4. **Distinguish between IME confirmation and user navigation** using composition state

## Step-by-Step: How Extable Handles IME

### 1. Initialization: Hidden Input Creation

When a user clicks a cell (and the cell is not readonly and not a boolean):

```typescript
// Create a transparent input element
const hiddenInput = document.createElement('input');
hiddenInput.type = 'text';
hiddenInput.style.position = 'absolute';
hiddenInput.style.opacity = '0';  // invisible but focusable
hiddenInput.style.pointerEvents = 'none';

// Place it inside the cell (HTML mode) or a hidden layer (Canvas mode)
container.appendChild(hiddenInput);

// Focus immediately so IME starts in this input
hiddenInput.focus();
hiddenInput.select();  // Select all text so user can start typing
```

### 2. Listening to Composition Events

The key to IME support is listening to `compositionstart` and `compositionend` events instead of relying on `keydown` alone:

```typescript
let isComposing = false;

hiddenInput.addEventListener('compositionstart', () => {
  // User started IME input (e.g., typing Japanese)
  isComposing = true;
});

hiddenInput.addEventListener('compositionend', () => {
  // User finished selecting an IME candidate
  // The final text is now committed to the input.value
  isComposing = false;
});

hiddenInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    // Only treat Enter as "commit and move" if NOT composing
    if (!isComposing) {
      commitCellEdit(hiddenInput.value);
      moveToCellBelow();
    }
    // If composing, let the default IME behavior handle Enter
    // (confirm the candidate selection)
  }
});
```

### 3. Why This Order Matters: `compositionstart` Before `keydown`

Here's the crucial timeline:

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

If you only listened to `keydown`, the first `a` would be lost, and the Enter press would be treated as navigation before the composition completes.

### 4. Handling Tab and Arrow Keys in Selection Mode

Once a cell is selected, the hidden input remains focused but in **selection mode**. The user can navigate without entering edit mode:

```typescript
hiddenInput.addEventListener('keydown', (event) => {
  if (isInSelectionMode) {
    // In selection mode, navigation keys should move the selection,
    // not insert characters into the input
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

### 5. Entering Edit Mode

When the user presses **any other key** (not navigation, not clipboard shortcuts), the cell enters **edit mode** and the input becomes visible:

```typescript
hiddenInput.addEventListener('keydown', (event) => {
  if (isInSelectionMode && !isNavigationKey(event) && !isClipboardShortcut(event)) {
    // Switch to edit mode
    isInEditMode = true;
    hiddenInput.style.opacity = '1';  // show the input
    hiddenInput.style.pointerEvents = 'auto';
    
    // The keystroke is processed as normal input text
    // (do NOT preventDefault; let the character appear)
  }
});
```

### 6. Committing and Moving to Next Cell

When in edit mode and the user presses Enter (and is not composing):

```typescript
hiddenInput.addEventListener('keydown', (event) => {
  if (isInEditMode) {
    if (event.key === 'Enter' && !isComposing) {
      event.preventDefault();
      
      // Commit the edited value
      const finalValue = hiddenInput.value;
      applyEdit(finalValue);
      
      // Move to the next cell (down by default, up if Shift+Enter)
      const nextCell = event.shiftKey ? selectCellAbove() : selectCellBelow();
      
      // Return to selection mode in the new cell
      isInEditMode = false;
      updateHiddenInputToNewCell();
    }
  }
});
```

## Complete Example: Vanilla JavaScript

Here's a simplified implementation showing the full flow:

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
    // Position the hidden input at this cell's location
    const cell = this.getCellElement(row, col);
    const rect = cell.getBoundingClientRect();
    this.hiddenInput.style.left = rect.left + 'px';
    this.hiddenInput.style.top = rect.top + 'px';
    
    // Clear and focus
    this.hiddenInput.value = '';
    this.hiddenInput.style.opacity = '0';
    this.isInEditMode = false;
    this.hiddenInput.focus();
    this.hiddenInput.select();
  }
  
  private handleKeyDown(event: KeyboardEvent) {
    // Navigation keys in selection mode
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
    
    // Enter: commit (only if not composing)
    if (event.key === 'Enter' && !this.isComposing) {
      event.preventDefault();
      if (this.isInEditMode) {
        this.commitEdit();
        this.isInEditMode = false;
      }
      return;
    }
    
    // Any other key: enter edit mode
    if (!this.isInEditMode && !this.isComposing) {
      this.isInEditMode = true;
      this.hiddenInput.style.opacity = '1';
      this.hiddenInput.style.pointerEvents = 'auto';
    }
  }
  
  private commitEdit() {
    const value = this.hiddenInput.value;
    console.log('Committing:', value);
    // Apply the value to your data model
  }
  
  private navigateDown() {
    console.log('Move down');
    // Update selection, call selectCell(...)
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
    // Your implementation
    return document.querySelector(`[data-row="${row}"][data-col="${col}"]`)!;
  }
}
```

## Key Takeaways

1. **Always use `compositionstart` and `compositionend`**, not just `keydown`
2. **Don't preventDefault in composition events**—let the IME handle them
3. **Only treat navigation/commit keys (Enter, Tab, etc.) when `!isComposing`**
4. **Focus a hidden input even for Canvas rendering** to receive IME events
5. **Keep the input element positioned and visible** during edit mode so users can see what they're typing
6. **Selection mode and edit mode are different states**—selection mode lets you navigate, edit mode lets you modify text

## Further Reading

- [MDN: compositionstart event](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionstart_event)
- [MDN: compositionend event](https://developer.mozilla.org/en-US/docs/Web/API/Element/compositionend_event)
- [W3C: UI Events](https://www.w3.org/TR/uievents/#events-compositionevents)
- [Extable Advanced Edit Spec](https://github.com/shibukawa/extable/blob/main/.specs/20251210_advanced-edit/design.md) – full implementation details

## Next Steps

- Understand how [readonly and loading states](/guides/editmode) work with IME input
- Learn about [HTML mode vs Canvas mode](/guides/unit-testing) and their rendering differences
- Explore the [uncontrolled-only philosophy](/concepts/uncontrolled) for integrating Extable with your app

