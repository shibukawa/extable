import { describe, expect, test } from 'vitest';
import { createTablePlaceholder, mountTable } from '../src/index';

describe('core placeholder', () => {
  test('mounts table and marks target', () => {
    const placeholder = createTablePlaceholder(
      {
        data: { rows: [] },
        schema: { columns: [] },
        view: {}
      },
      { renderMode: 'html', editMode: 'direct', lockMode: 'none' }
    );
    const target = document.createElement('div');
    const mounted = mountTable(target, placeholder);
    expect((mounted as any).root).toBe(target);
    expect(target.dataset.extable).toBe('ready');
  });
});
