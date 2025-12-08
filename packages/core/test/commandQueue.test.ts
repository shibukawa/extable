import { describe, expect, test } from 'vitest';
import { CommandQueue } from '../src/commandQueue';

describe('CommandQueue', () => {
  test('enqueue and undo/redo with cap', () => {
    const q = new CommandQueue(2);
    q.enqueue({ kind: 'edit', rowId: 'r1', colKey: 'a', next: 1 });
    q.enqueue({ kind: 'edit', rowId: 'r2', colKey: 'b', next: 2 });
    q.enqueue({ kind: 'edit', rowId: 'r3', colKey: 'c', next: 3 });
    expect(q.listApplied().length).toBe(2); // cap applied
    const undone = q.undo();
    expect(undone?.rowId).toBe('r3');
    const redone = q.redo();
    expect(redone?.rowId).toBe('r3');
  });
});
