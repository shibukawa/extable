import { Hono } from 'hono';

export const app = new Hono();

app.post('/api/commands', async (c) => {
  const payload = await c.req.json().catch(() => null);
  if (!payload) {
    return c.json({ status: 'error', reason: 'invalid-json' }, 400);
  }
  return c.json({ status: 'ok', received: payload });
});

app.get('/api/subscribe', (c) => {
  return c.json({
    status: 'ok',
    note: 'subscription stub (replace with SSE/WebSocket/polling transport)'
  });
});
