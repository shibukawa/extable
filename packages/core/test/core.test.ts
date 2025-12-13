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

  test('datetime-local editor initializes without timezone suffix', () => {
    const placeholder = createTablePlaceholder(
      {
        data: { rows: [{ dt: '2024-11-01T09:30:00Z' }] },
        schema: { columns: [{ key: 'dt', header: 'DT', type: 'datetime' }] },
        view: {}
      },
      { renderMode: 'html', editMode: 'direct', lockMode: 'none' }
    );
    const target = document.createElement('div');
    mountTable(target, placeholder);

    const cell = target.querySelector('td[data-col-key="dt"]') as HTMLTableCellElement | null;
    expect(cell).toBeTruthy();

    cell!.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
    cell!.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));

    const input = cell!.querySelector('input') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    expect(input!.type).toBe('datetime-local');
    expect(input!.value).not.toBe('');
    expect(input!.value.includes('Z')).toBe(false);
  });
});
