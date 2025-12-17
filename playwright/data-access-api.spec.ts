import { expect, test } from '@playwright/test';

test.setTimeout(60_000);

test('public data access api works end-to-end (demo)', async ({ page }) => {
  await page.goto('/');

  // Use HTML mode to make cells accessible for the smoke test.
  await page.locator('input[name="render-mode"][value="html"]').check();
  await page.locator('input[name="edit-mode"][value="commit"]').check();
  await page.locator('input[name="data-mode"][value="standard"]').check();

  const firstNameCell = page.locator('td[data-col-key="name"]').first();
  await expect(firstNameCell).toBeVisible();

  await page.evaluate(() => {
    const core = (window as any).__extableCore;
    if (!core) throw new Error('missing __extableCore');

    const required = [
      'getCell',
      'getRawData',
      'getPending',
      'getPendingRowIds',
      'getPendingCellCount',
      'getTableData',
      'getColumnData',
      'insertRow',
      'deleteRow',
    ];
    for (const k of required) {
      if (typeof core[k] !== 'function') throw new Error(`missing method: ${k}`);
    }

    core.setCellValue({ rowIndex: 0, colKey: 'name' }, 'User 1X');
  });

  await expect(page.locator('#commit-state')).toContainText('pending=1');

  const pending = await page.evaluate(() => {
    const core = (window as any).__extableCore;
    const rowId = core.getAllRows()[0].id;
    const raw0 = core.getRawData()[0];
    if (!raw0) throw new Error('missing raw data');
    return {
      rowIds: core.getPendingRowIds(),
      cellCount: core.getPendingCellCount(),
      value: core.getCell(rowId, 'name'),
      raw: raw0.name,
    };
  });
  expect(pending.rowIds.length).toBeGreaterThan(0);
  expect(pending.cellCount).toBe(1);
  expect(pending.value).toBe('User 1X');
  expect(pending.raw).toBe('User 1');

  // Insert a row at the top and verify the DOM changes.
  await page.evaluate(() => {
    const core = (window as any).__extableCore;
    (window as any).__insertedRowId = core.insertRow({ name: 'Inserted' }, 0);
  });
  await expect(page.locator('td[data-col-key="name"]').first()).toHaveText('Inserted');

  // Delete the inserted row and verify it disappears.
  await page.evaluate(() => {
    const core = (window as any).__extableCore;
    const id = (window as any).__insertedRowId;
    core.deleteRow(id);
  });
  await expect(page.locator('td[data-col-key="name"]').first()).not.toHaveText('Inserted');

  // Commit clears pending commands/history.
  await page.locator('#commit-btn').click();
  await expect(page.locator('#commit-state')).toContainText('pending=0');
});

test('direct mode: edits apply immediately without pending map', async ({ page }) => {
  await page.goto('/');

  await page.locator('input[name="render-mode"][value="html"]').check();
  await page.locator('input[name="edit-mode"][value="direct"]').check();
  await page.locator('input[name="data-mode"][value="standard"]').check();

  const firstNameCell = page.locator('td[data-col-key="name"]').first();
  await expect(firstNameCell).toBeVisible();

  await page.evaluate(() => {
    const core = (window as any).__extableCore;
    core.setCellValue({ rowIndex: 0, colKey: 'name' }, 'User 1D');
  });

  await expect(page.locator('td[data-col-key="name"]').first()).toHaveText('User 1D');
  await expect(page.locator('#commit-state')).toContainText('pending=0');

  const pending = await page.evaluate(() => {
    const core = (window as any).__extableCore;
    const rowId = core.getAllRows()[0].id;
    const raw0 = core.getRawData()[0];
    if (!raw0) throw new Error('missing raw data');
    return {
      pendingSize: core.getPending().size,
      cellCount: core.getPendingCellCount(),
      value: core.getCell(rowId, 'name'),
      raw: raw0.name,
    };
  });
  expect(pending.pendingSize).toBe(0);
  expect(pending.cellCount).toBe(0);
  expect(pending.value).toBe('User 1D');
  expect(pending.raw).toBe('User 1D');
});
