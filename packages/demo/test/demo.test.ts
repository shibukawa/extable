import { describe, expect, test } from 'vitest';
import { demoRows } from '../src/data/fixtures';

describe('demo fixtures', () => {
  test('contains sample rows', () => {
    expect(demoRows.length).toBeGreaterThan(0);
  });
});
