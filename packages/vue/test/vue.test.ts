import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import { Extable } from '../src/index';

describe('vue wrapper', () => {
  test('renders container', () => {
    const wrapper = mount(Extable, {
      props: {
        config: { data: { rows: [] }, schema: { columns: [] }, view: {} },
        options: { renderMode: 'html', editMode: 'direct', lockMode: 'none' }
      }
    });
    expect(wrapper.find('[data-extable-wrapper]').exists()).toBe(true);
  });
});
