import { expect, test } from '@playwright/test';

test.setTimeout(60_000);

test('search sidebar works and stays interactive', async ({ page }) => {
  await page.goto('/');

  // Use HTML mode to make cells accessible for the smoke test.
  await page.locator('input[name="render-mode"][value="html"]').check();

  const firstNameCell = page.locator('td[data-col-key="name"]').first();
  await expect(firstNameCell).toBeVisible();
  await firstNameCell.click();

  await page.evaluate(() => (window as any).__extableCore?.showSearchPanel?.('find'));

  const sidebar = page.locator('.extable-search-sidebar');
  await expect(sidebar).toBeVisible();

  await sidebar.locator('input[data-extable-fr="query"]').fill('User 1');
  const rows = sidebar.locator('tbody[data-extable-fr="results-tbody"] tr');
  await expect(rows.first()).toBeVisible();

  await sidebar.locator('input[data-extable-fr="replace-toggle"]').check();
  await sidebar.locator('input[data-extable-fr="replace"]').fill('X');
  await sidebar.locator('button[data-extable-fr="replace-all"]').click();

  await expect(sidebar.locator('[data-extable-fr="status"]')).toHaveText(/0 matches/);

  // Sidebar stays visible while the table can still be interacted with.
  await page.locator('td[data-col-key="description"]').first().click();
  await expect(sidebar).toBeVisible();
});
