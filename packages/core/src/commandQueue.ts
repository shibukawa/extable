import type { Command } from './types';

type CommandGroup = { batchId: string | null; commands: Command[] };

function getBatchId(cmd: Command) {
  const p = cmd.payload as any;
  if (!p) return null;
  const id = p.batchId;
  return typeof id === 'string' && id.length ? id : null;
}

export class CommandQueue {
  private applied: CommandGroup[] = [];
  private undone: CommandGroup[] = [];
  private cap: number;

  constructor(cap = 100) {
    this.cap = cap;
  }

  enqueue(command: Command) {
    const batchId = getBatchId(command);
    const last = this.applied.at(-1);
    if (batchId && last && last.batchId === batchId) {
      last.commands.push(command);
    } else {
      this.applied.push({ batchId, commands: [command] });
    }
    while (this.applied.length > this.cap) this.applied.shift();
    this.undone = [];
  }

  canUndo() {
    return this.applied.length > 0;
  }

  canRedo() {
    return this.undone.length > 0;
  }

  listApplied() {
    const out: Command[] = [];
    for (const group of this.applied) out.push(...group.commands);
    return out;
  }

  undo() {
    const group = this.applied.pop();
    if (group) this.undone.push(group);
    return group?.commands ?? null;
  }

  redo() {
    const group = this.undone.pop();
    if (group) this.applied.push(group);
    return group?.commands ?? null;
  }

  clear() {
    this.applied = [];
    this.undone = [];
  }
}
