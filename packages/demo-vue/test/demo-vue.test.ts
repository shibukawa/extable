import { describe, expect, test } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../src/App.vue';

describe('demo-vue', () => {
  test('renders state preview', () => {
    const wrapper = mount(App);
    expect(wrapper.find('pre').exists()).toBe(true);
  });
});
