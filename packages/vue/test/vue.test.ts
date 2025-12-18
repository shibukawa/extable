import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import { Extable } from '../src/index';
import { nextTick } from 'vue';

describe('vue wrapper', () => {
  test('renders container', () => {
    const wrapper = mount(Extable, {
      props: {
        schema: { columns: [] },
        defaultData: [],
        defaultView: {},
        options: { renderMode: 'html', editMode: 'direct', lockMode: 'none' }
      }
    });
    expect(wrapper.find('[data-extable-wrapper]').exists()).toBe(true);
  });

  test('exposes subscriptions via exposed core', async () => {
    const wrapper = mount(Extable, {
      props: {
        schema: { columns: [] },
        defaultData: [],
        defaultView: {},
        options: { renderMode: 'html', editMode: 'direct', lockMode: 'none' }
      }
    });

    await nextTick();
    const handle = wrapper.vm as unknown as {
      subscribeTableState: (cb: () => void) => () => void;
      subscribeSelection: (cb: () => void) => () => void;
    };
    expect(handle).toBeTruthy();

    let tableCalls = 0;
    const unsubTable = handle.subscribeTableState(() => {
      tableCalls += 1;
    });
    expect(tableCalls).toBe(1);
    unsubTable();
    unsubTable();

    let selectionCalls = 0;
    const unsubSel = handle.subscribeSelection(() => {
      selectionCalls += 1;
    });
    expect(selectionCalls).toBe(1);
    unsubSel();
    unsubSel();
  });
});
