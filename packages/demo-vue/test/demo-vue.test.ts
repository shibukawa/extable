import { describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

vi.mock('@extable/vue', () => ({
  Extable: defineComponent({
    name: 'ExtableMock',
    setup() {
      return () => h('div', { 'data-extable-mock': '1' });
    }
  })
}));

import App from '../src/App.vue';

describe('demo-vue', () => {
  test('renders state preview', () => {
    const wrapper = mount(App);
    expect(wrapper.find('pre').exists()).toBe(true);
  });
});
