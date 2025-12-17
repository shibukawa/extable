import { describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('@extable/react', async () => {
  const React = await import('react');
  return {
    Extable: React.forwardRef(function ExtableMock(props: any, ref: any) {
      React.useImperativeHandle(
        ref,
        () => ({
          getCore: () => null,
          destroy: () => {},
          setData: () => {},
          setView: () => {},
          setSchema: () => {},
          setRenderMode: () => {},
          setEditMode: () => {},
          setLockMode: () => {}
        }),
        []
      );
      const { className, style } = props ?? {};
      return React.createElement('div', { className, style, 'data-extable-mock': '1' });
    })
  };
});

import App from '../src/main';

describe('demo-react', () => {
  test('renders state preview', () => {
    const view = render(<App />);
    expect(view.container.querySelector('pre')).toBeTruthy();
  });
});
