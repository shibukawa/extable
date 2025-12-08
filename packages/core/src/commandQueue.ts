import type { Command } from './types';

export class CommandQueue {
  private applied: Command[] = [];
  private undone: Command[] = [];
  private cap: number;

  constructor(cap = 100) {
    this.cap = cap;
  }

  enqueue(command: Command) {
    this.applied.push(command);
    if (this.applied.length > this.cap) {
      this.applied.shift();
    }
    this.undone = [];
  }

  listApplied() {
    return [...this.applied];
  }

  undo() {
    const cmd = this.applied.pop();
    if (cmd) this.undone.push(cmd);
    return cmd;
  }

  redo() {
    const cmd = this.undone.pop();
    if (cmd) this.applied.push(cmd);
    return cmd;
  }

  clear() {
    this.applied = [];
    this.undone = [];
  }
}
