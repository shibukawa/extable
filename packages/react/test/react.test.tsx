import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/react';
import { Extable } from '../src/index';

describe('react wrapper', () => {
  test('renders container', () => {
    const { container } = render(
      <Extable
        schema={{ columns: [] }}
        defaultData={{ rows: [] }}
        defaultView={{}}
        options={{ renderMode: 'html', editMode: 'direct', lockMode: 'none' }}
      />
    );
    const wrapper = container.querySelector('[data-extable-wrapper]');
    expect(wrapper).toBeTruthy();
  });
});
