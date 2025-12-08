import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/react';
import App from '../src/main';

describe('demo-react', () => {
  test('renders state preview', () => {
    const view = render(<App />);
    expect(view.container.querySelector('pre')).toBeTruthy();
  });
});
