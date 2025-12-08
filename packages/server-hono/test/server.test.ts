import { describe, expect, test } from 'vitest';
import { app } from '../src/app';

describe('server-hono stubs', () => {
  test('accepts command payloads', async () => {
    const res = await app.request('/api/commands', {
      method: 'POST',
      body: JSON.stringify({ commands: [{ id: '1' }] }),
      headers: { 'content-type': 'application/json' }
    });
    const json = await res.json();
    expect(json.status).toBe('ok');
  });

  test('rejects invalid payload', async () => {
    const res = await app.request('/api/commands', {
      method: 'POST',
      body: '{bad',
      headers: { 'content-type': 'application/json' }
    });
    expect(res.status).toBe(400);
  });
});
