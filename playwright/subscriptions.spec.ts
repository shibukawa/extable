import { expect, test } from '@playwright/test';

test.setTimeout(60_000);

test('subscriptions: tableState and selection can unsubscribe safely', async ({ page }) => {
  await page.goto('/');

  await page.locator('input[name="render-mode"][value="html"]').check();
  await page.locator('input[name="edit-mode"][value="commit"]').check();

  await expect(page.locator('td[data-col-key="name"]').first()).toBeVisible();

  const counts = await page.evaluate(() => {
    const core = (window as any).__extableCore;
    if (!core) throw new Error('missing __extableCore');

    const counts = { tableCalls: 0, selectionCalls: 0 };
    const tableUnsub = core.subscribeTableState(() => {
      counts.tableCalls += 1;
    });
    const selectionUnsub = core.subscribeSelection(() => {
      counts.selectionCalls += 1;
    });
    (window as any).__extableSub = { counts, tableUnsub, selectionUnsub };
    return { ...counts };
  });

  expect(counts.tableCalls).toBe(1);
  expect(counts.selectionCalls).toBe(1);

  await page.locator('td[data-col-key="name"]').first().click();

  await page.evaluate(() => {
    const core = (window as any).__extableCore;
    core.setCellValue(0, 'name', 'User 1S');
  });

  const after = await page.evaluate(() => {
    const core = (window as any).__extableCore;
    const sub = (window as any).__extableSub;
    const { counts, tableUnsub, selectionUnsub } = sub;

    const beforeUnsub = { ...counts };

    // Unsubscribe twice (idempotent).
    tableUnsub();
    tableUnsub();
    selectionUnsub();
    selectionUnsub();

    // Trigger again after unsubscribe.
    core.setCellValue(0, 'name', 'User 1S2');
    return {
      beforeUnsub,
      afterUnsub: { ...counts },
      canCommit: core.getTableState().canCommit,
    };
  });

  expect(after.beforeUnsub.tableCalls).toBeGreaterThanOrEqual(2);
  expect(after.beforeUnsub.selectionCalls).toBeGreaterThanOrEqual(2);
  expect(after.afterUnsub).toEqual(after.beforeUnsub);
  expect(after.canCommit).toBe(true);

  // Repeat in direct mode.
  await page.locator('input[name="edit-mode"][value="direct"]').check();
  await expect(page.locator('td[data-col-key="name"]').first()).toBeVisible();

  const directCounts = await page.evaluate(() => {
    const core = (window as any).__extableCore;
    const counts = { tableCalls: 0, selectionCalls: 0 };
    const tableUnsub = core.subscribeTableState(() => {
      counts.tableCalls += 1;
    });
    const selectionUnsub = core.subscribeSelection(() => {
      counts.selectionCalls += 1;
    });
    (window as any).__extableSub2 = { counts, tableUnsub, selectionUnsub };
    return { ...counts };
  });

  expect(directCounts.tableCalls).toBe(1);
  expect(directCounts.selectionCalls).toBe(1);

  await page.locator('td[data-col-key="name"]').first().click();
  await page.evaluate(() => {
    const core = (window as any).__extableCore;
    core.setCellValue(0, 'name', 'User 1S3');
  });

  const directAfter = await page.evaluate(() => {
    const core = (window as any).__extableCore;
    const sub = (window as any).__extableSub2;
    const { counts, tableUnsub, selectionUnsub } = sub;
    const beforeUnsub = { ...counts };
    tableUnsub();
    selectionUnsub();
    core.setCellValue(0, 'name', 'User 1S4');
    return {
      beforeUnsub,
      afterUnsub: { ...counts },
      canUndo: core.getTableState().undoRedo.canUndo,
      canCommit: core.getTableState().canCommit,
    };
  });

  expect(directAfter.beforeUnsub.tableCalls).toBeGreaterThanOrEqual(2);
  expect(directAfter.beforeUnsub.selectionCalls).toBeGreaterThanOrEqual(2);
  expect(directAfter.afterUnsub).toEqual(directAfter.beforeUnsub);
  expect(directAfter.canUndo).toBe(true);
  expect(directAfter.canCommit).toBe(false);
});
