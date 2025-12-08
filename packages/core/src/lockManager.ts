import type { LockMode, ServerAdapter, UserInfo } from './types';

export class LockManager {
  private lockedRows = new Set<string>();
  private mode: LockMode = 'none';
  private server?: ServerAdapter;
  private user?: UserInfo;

  constructor(mode: LockMode, server?: ServerAdapter, user?: UserInfo) {
    this.mode = mode;
    this.server = server;
    this.user = user;
  }

  setMode(mode: LockMode) {
    this.mode = mode;
  }

  setUser(user?: UserInfo) {
    this.user = user;
  }

  async selectRow(rowId: string) {
    if (this.mode !== 'row') return;
    if (this.lockedRows.has(rowId)) return;
    this.lockedRows.add(rowId);
    if (this.server && this.user) {
      try {
        await this.server.lockRow(rowId, this.user);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('lockRow failed', e);
      }
    }
  }

  async unlockOnMove(currentRowId?: string) {
    if (this.mode !== 'row') return;
    if (!currentRowId) return;
    await this.unlockRows([currentRowId]);
  }

  async unlockOnCommit(keepRowId?: string) {
    if (this.mode !== 'row') return;
    const toUnlock: string[] = [];
    this.lockedRows.forEach((id) => {
      if (id !== keepRowId) toUnlock.push(id);
    });
    if (toUnlock.length) {
      await this.unlockRows(toUnlock);
    }
  }

  async unlockRows(rowIds: string[]) {
    rowIds.forEach((id) => this.lockedRows.delete(id));
    if (this.server && this.user) {
      try {
        await this.server.unlockRows(rowIds, this.user);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('unlockRows failed', e);
      }
    }
  }

  getLockedRows() {
    return new Set(this.lockedRows);
  }
}
